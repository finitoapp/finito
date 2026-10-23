import { DateIso, ok, type Run } from "@evolu/common"

import { unclaimedIncomingTransactionsSinceQuery } from "../../modules/account-transaction/account-transaction-queries.ts"
import type { AccountTransactionId } from "../../modules/account-transaction/account-transaction-types.ts"
import { reconcileAccountTransaction } from "../../modules/reconciliation-claim/reconciliation-claim-actions.ts"
import { parseLightningInvoice } from "../../modules/shared/lightning-invoice-utils.ts"
import {
  parseSelfPayBankMessage,
  parseSelfPayLightningMemo,
} from "../../modules/table-self-pay/table-self-pay-reference-utils.ts"
import type {
  AppBackgroundJob,
  AppBackgroundJobContext,
} from "../background-job-types.ts"
import { createKeyedTaskQueue } from "../keyed-task-queue.ts"

const MINUTE_MS = 60 * 1000
const CHECK_INTERVAL_MS = MINUTE_MS
const RETRY_AFTER_MS = [1, 3, 6, 11].map((minutes) => minutes * MINUTE_MS)
const LATE_RETRY_EVERY_MS = 60 * MINUTE_MS
const LOOKBACK_MS = 7 * 24 * 60 * MINUTE_MS

export const nextSelfPayPointerAttemptAt = (
  firstSeenAt: number,
  lastAttemptAt: number
): number => {
  const due = RETRY_AFTER_MS.map((after) => firstSeenAt + after).find(
    (at) => at > lastAttemptAt
  )
  return due ?? lastAttemptAt + LATE_RETRY_EVERY_MS
}

const carriesPointer = ({
  recipientMessage,
  lnInvoice,
}: {
  readonly recipientMessage: string | null
  readonly lnInvoice: string | null
}): boolean => {
  if (parseSelfPayBankMessage(recipientMessage) !== null) return true
  if (lnInvoice === null) return false
  const invoice = parseLightningInvoice(lnInvoice)
  return (
    invoice.ok && parseSelfPayLightningMemo(invoice.value.description) !== null
  )
}

export const createSelfPayPointerJob =
  ({
    intervalMs = CHECK_INTERVAL_MS,
  }: {
    readonly intervalMs?: number
  } = {}): AppBackgroundJob =>
  (run) => {
    const jobRun = run.create({
      ...run.deps,
      console: run.deps.console.child("self-pay-pointer-job"),
    })
    const retries = new SelfPayPointerRetries(jobRun, intervalMs)

    const disposer = new AsyncDisposableStack()
    disposer.use(jobRun)
    disposer.defer(() => retries.dispose())
    return ok(disposer)
  }

export const startSelfPayPointerJob = createSelfPayPointerJob()

class SelfPayPointerRetries {
  private readonly run: Run<AppBackgroundJobContext>
  private readonly queue = createKeyedTaskQueue<AccountTransactionId>({
    onError: (error) => this.run.deps.onError(error),
  })
  private readonly lastAttemptAt = new Map<AccountTransactionId, number>()
  private readonly timer: ReturnType<typeof setInterval>

  constructor(run: Run<AppBackgroundJobContext>, intervalMs: number) {
    this.run = run
    this.timer = setInterval(() => {
      void this.retryDue().catch((error: unknown) =>
        this.run.deps.onError(error)
      )
    }, intervalMs)
    ;(this.timer as { readonly unref?: () => void }).unref?.()
  }

  dispose(): void {
    clearInterval(this.timer)
    this.queue[Symbol.dispose]()
  }

  private async retryDue(): Promise<void> {
    const now = this.run.deps.date.now().getTime()
    const rows = await this.run.deps.evolu.loadQuery(
      unclaimedIncomingTransactionsSinceQuery(
        DateIso.orThrow(new Date(now - LOOKBACK_MS).toISOString())
      )
    )
    for (const row of rows) {
      if (!carriesPointer(row)) continue
      const firstSeenAt = Date.parse(row.createdAt)
      const last = this.lastAttemptAt.get(row.id) ?? firstSeenAt
      if (now < nextSelfPayPointerAttemptAt(firstSeenAt, last)) continue

      this.lastAttemptAt.set(row.id, now)
      this.queue.enqueue(row.id, async () => {
        await this.run.ok(reconcileAccountTransaction(row.id))
      })
    }
  }
}
