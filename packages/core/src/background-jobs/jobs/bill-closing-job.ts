import { ok, type Query, type Run } from "@evolu/common"
import type { z } from "zod"

import type { EvoluSchema } from "../../evolu/schema.ts"
import { AccountTransactionId } from "../../modules/account-transaction/account-transaction-types.ts"
import {
  reconcileBillsClosedAt,
  saveBillClosingCursor,
} from "../../modules/bill/bill-actions.ts"
import {
  billClosingCursorQuery,
  billIdsOfBillLinesQuery,
  billIdsOfClaimsQuery,
  billIdsOfPaymentsQuery,
  billIdsOfTransactionsQuery,
  closedBillIdsWithRemovedMoneyQuery,
  openListedBillIdsQuery,
} from "../../modules/bill/bill-closing-queries.ts"
import { BillId } from "../../modules/bill/bill-types.ts"
import { BillLineId } from "../../modules/bill-line/bill-line-types.ts"
import { PaymentId } from "../../modules/payment/payment-types.ts"
import { ReconciliationClaimId } from "../../modules/reconciliation-claim/reconciliation-claim-types.ts"
import {
  changedHistoryRowsQuery,
  evoluHistoryMaxRowidQuery,
  idFromHex,
} from "../../modules/shared/evolu-history-queries.ts"
import type {
  AppBackgroundJob,
  AppBackgroundJobContext,
} from "../background-job-types.ts"
import { createKeyedTaskQueue } from "../keyed-task-queue.ts"

const CLOSING_DEBOUNCE_MS = 1000

const watchedTables = [
  "billLine",
  "payment",
  "reconciliationClaim",
  "accountTransaction",
  "bill",
] as const

export const createBillClosingJob =
  ({
    debounceMs = CLOSING_DEBOUNCE_MS,
  }: {
    readonly debounceMs?: number
  } = {}): AppBackgroundJob =>
  (run) => {
    const jobRun = run.create({
      ...run.deps,
      console: run.deps.console.child("bill-closing-job"),
    })
    const closing = new BillClosing(jobRun, debounceMs)
    closing.start()

    const disposer = new AsyncDisposableStack()
    disposer.use(jobRun)
    disposer.defer(() => closing.dispose())
    return ok(disposer)
  }

export const startBillClosingJob = createBillClosingJob()

class BillClosing {
  private readonly run: Run<AppBackgroundJobContext>
  private readonly debounceMs: number
  private readonly queue = createKeyedTaskQueue({
    onError: (error) => this.run.deps.onError(error),
  })
  private readonly unsubscribes: Array<() => void> = []
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private hasSynced = false

  constructor(run: Run<AppBackgroundJobContext>, debounceMs: number) {
    this.run = run
    this.debounceMs = debounceMs
  }

  start(): void {
    const { appOwnerSync, evolu } = this.run.deps
    this.unsubscribes.push(
      appOwnerSync.subscribe(() => this.startOnceSynced()),
      evolu.subscribeQuery(evoluHistoryMaxRowidQuery)(() => this.schedule())
    )
    this.startOnceSynced()
  }

  async dispose(): Promise<void> {
    if (this.queue.isDisposed) return
    for (const unsubscribe of this.unsubscribes) unsubscribe()
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer)
    await this.queue[Symbol.asyncDispose]()
  }

  private startOnceSynced(): void {
    if (this.hasSynced || !this.run.deps.appOwnerSync.isSynced()) return
    this.hasSynced = true
    this.queue.enqueue("close", () => this.close())
  }

  private schedule(): void {
    if (!this.hasSynced) return
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      this.queue.enqueue("close", () => this.close())
    }, this.debounceMs)
    ;(this.debounceTimer as { readonly unref?: () => void }).unref?.()
  }

  private async close(): Promise<void> {
    const { evolu } = this.run.deps
    const [cursor] = await evolu.loadQuery(billClosingCursorQuery)
    const [max] = await evolu.loadQuery(evoluHistoryMaxRowidQuery)
    const maxRowid = Number(max?.maxRowid ?? 0)
    const afterRowid = cursor?.historyRowid ?? null
    if (afterRowid !== null && maxRowid <= afterRowid) return

    const billIds =
      afterRowid === null
        ? await this.firstRunBillIds()
        : await this.changedBillIds(afterRowid, maxRowid)
    if (this.queue.isDisposed) return
    await this.run.ok(reconcileBillsClosedAt(billIds))
    await this.run.ok(saveBillClosingCursor(maxRowid))
  }

  private async firstRunBillIds(): Promise<ReadonlyArray<BillId>> {
    const { evolu } = this.run.deps
    const [open, removed] = await Promise.all([
      evolu.loadQuery(openListedBillIdsQuery),
      evolu.loadQuery(closedBillIdsWithRemovedMoneyQuery),
    ])
    return [...open, ...removed].map(({ id }) => id)
  }

  private async changedBillIds(
    afterRowid: number,
    throughRowid: number
  ): Promise<ReadonlyArray<BillId>> {
    const { evolu, evoluOwner } = this.run.deps
    const changed = await evolu.loadQuery(
      changedHistoryRowsQuery({
        ownerId: evoluOwner.id,
        afterRowid,
        throughRowid,
        tables: watchedTables,
      })
    )
    const idsOf = <TId>(
      table: (typeof watchedTables)[number],
      schema: z.ZodType<TId>
    ): ReadonlyArray<TId> => [
      ...new Set(
        changed.flatMap((row) => {
          if (row.table !== table) return []
          if (table === "bill" && row.column !== "closedAt") return []
          const parsed = schema.safeParse(idFromHex(row.idHex))
          return parsed.success ? [parsed.data] : []
        })
      ),
    ]
    const billIdsOf = async <TId>(
      ids: ReadonlyArray<TId>,
      query: (
        ids: ReadonlyArray<TId>
      ) => Query<EvoluSchema, { readonly billId: BillId }>
    ): Promise<ReadonlyArray<BillId>> =>
      ids.length === 0
        ? []
        : (await evolu.loadQuery(query(ids))).map(({ billId }) => billId)

    const lookups = await Promise.all([
      billIdsOf(idsOf("billLine", BillLineId), billIdsOfBillLinesQuery),
      billIdsOf(idsOf("payment", PaymentId), billIdsOfPaymentsQuery),
      billIdsOf(
        idsOf("reconciliationClaim", ReconciliationClaimId),
        billIdsOfClaimsQuery
      ),
      billIdsOf(
        idsOf("accountTransaction", AccountTransactionId),
        billIdsOfTransactionsQuery
      ),
    ])
    return [...idsOf("bill", BillId), ...lookups.flat()]
  }
}
