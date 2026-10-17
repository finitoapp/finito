import { type Id, ok, type Task } from "@evolu/common"

import type { EvoluOwnerDep } from "../../deps.ts"
import type { AppSchema } from "../../evolu/schema.ts"
import type { BillLineRow } from "../bill-line/bill-line.ts"
import { deriveBillTotalAfterLines } from "../bill-line/bill-line-utils.ts"
import { eetReportedGoodsQuery } from "../eet/eet-queries.ts"
import { overpaymentResolutionsQuery } from "../overpayment-resolution/overpayment-resolution-queries.ts"
import type { OverpaymentResolutionId } from "../overpayment-resolution/overpayment-resolution-types.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import { overpaymentRefundsQuery } from "../refund/refund-queries.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  mapWriteClocks,
  writeClocksQuery,
} from "../shared/evolu-history-queries.ts"
import { type FiatCurrency, NonNegativeInteger } from "../shared/schema.ts"
import {
  overpaymentPaymentsQuery,
  overpaymentTransactionsQuery,
} from "./bill-coverage-queries.ts"
import {
  type BillNotFoundError,
  loadBillStatusSnapshot,
} from "./bill-guards.ts"
import {
  deriveReportedGoodsByPayment,
  toBillOverpaymentInput,
} from "./bill-overpayment-utils.ts"
import {
  type BillId,
  type OverpaymentScope,
  overpaymentScopesOf,
  type SyncClockHex,
} from "./bill-types.ts"
import {
  type BillOverpaymentInput,
  deriveBillOverpayment,
} from "./bill-utils.ts"

export const loadWriteClocks =
  <TId extends Id>({
    table,
    ids,
    column,
    pick = "first",
  }: {
    readonly table: keyof typeof AppSchema
    readonly ids: ReadonlyArray<TId>
    readonly column?: string
    readonly pick?: "first" | "last"
  }): Task<ReadonlyMap<TId, SyncClockHex>, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    if (ids.length === 0) return ok(new Map())
    const { evolu, evoluOwner } = run.deps
    const rows = await evolu.loadQuery(
      writeClocksQuery({ ownerId: evoluOwner.id, table, column, ids, pick })
    )
    return ok(mapWriteClocks(ids, rows))
  }

const loadOverpaymentTotal =
  (
    scope: OverpaymentScope,
    payments: ReadonlyArray<{
      readonly amount: NonNegativeInteger
      readonly tipAmount: NonNegativeInteger
    }>
  ): Task<
    { readonly billTotal: NonNegativeInteger; readonly isCanceled: boolean },
    BillNotFoundError,
    EvoluDep
  > =>
  async (run) => {
    if (scope.billId === undefined) {
      const payment = payments[0]
      return ok({
        billTotal: NonNegativeInteger(
          payment === undefined
            ? 0
            : Math.max(0, payment.amount - payment.tipAmount)
        ),
        isCanceled: false,
      })
    }
    const snapshot = await run(loadBillStatusSnapshot(scope.billId))
    if (!snapshot.ok) return snapshot
    return ok({
      billTotal: snapshot.value.billTotal,
      isCanceled: snapshot.value.status === "canceled",
    })
  }

export const loadOverpaymentInput =
  (
    scope: OverpaymentScope
  ): Task<BillOverpaymentInput, BillNotFoundError, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evolu } = run.deps
    const scopes = overpaymentScopesOf(scope)
    const [payments, transactions, refunds, resolutions] = await Promise.all([
      evolu.loadQuery(overpaymentPaymentsQuery(scopes)),
      evolu.loadQuery(overpaymentTransactionsQuery(scopes)),
      evolu.loadQuery(overpaymentRefundsQuery(scopes)),
      evolu.loadQuery(overpaymentResolutionsQuery(scopes)),
    ])
    const total = await run(loadOverpaymentTotal(scope, payments))
    if (!total.ok) return total

    const [claims, refundClocks, resolutionClocks, acknowledgements] =
      await Promise.all([
        run.ok(
          loadWriteClocks({
            table: "reconciliationClaim",
            ids: transactions.map(({ claimId }) => claimId),
          })
        ),
        run.ok(
          loadWriteClocks({ table: "refund", ids: refunds.map(({ id }) => id) })
        ),
        run.ok(
          loadWriteClocks({
            table: "overpaymentResolution",
            ids: resolutions.map(({ id }) => id),
          })
        ),
        run.ok(
          loadWriteClocks({
            table: "payment",
            ids: payments
              .filter(
                ({ excessAcknowledgedAt }) => excessAcknowledgedAt !== null
              )
              .map(({ id }) => id),
            column: "excessAcknowledgedAt",
          })
        ),
      ])

    return ok(
      toBillOverpaymentInput(
        { ...total.value, payments, transactions, refunds, resolutions },
        {
          claims,
          refunds: refundClocks,
          resolutions: resolutionClocks,
          acknowledgements,
        }
      )
    )
  }

export const loadReportedGoodsByPayment =
  (
    scope: OverpaymentScope
  ): Task<ReadonlyMap<PaymentId, NonNegativeInteger>, never, EvoluDep> =>
  async (run) =>
    ok(
      deriveReportedGoodsByPayment(
        await run.deps.evolu.loadQuery(eetReportedGoodsQuery(scope))
      )
    )

export type BillEditOutcome =
  | { readonly type: "staysOpen" }
  | { readonly type: "paid" }
  | { readonly type: "overpaid"; readonly unresolved: NonNegativeInteger }

export const loadBillEditOutcome =
  (
    billId: BillId,
    lines: ReadonlyArray<
      Pick<
        BillLineRow,
        | "billId"
        | "catalogItemId"
        | "itemId"
        | "type"
        | "kind"
        | "quantity"
        | "totalAmount"
      >
    >
  ): Task<BillEditOutcome, BillNotFoundError, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const snapshot = await run(loadBillStatusSnapshot(billId))
    if (!snapshot.ok) return snapshot
    const { status, items, hasActiveClaim, claimedSum } = snapshot.value
    const billTotal = deriveBillTotalAfterLines(
      items,
      lines.filter((line) => line.billId === billId)
    )
    if (status !== "open" || !hasActiveClaim || claimedSum < billTotal) {
      return ok({ type: "staysOpen" })
    }

    const input = await run(loadOverpaymentInput({ billId }))
    if (!input.ok) return input
    const { unresolved } = deriveBillOverpayment({ ...input.value, billTotal })
    return ok(
      unresolved === 0 ? { type: "paid" } : { type: "overpaid", unresolved }
    )
  }

export interface AnsweredOverpaymentTip {
  readonly currency: FiatCurrency
  readonly amount: NonNegativeInteger
}

export const loadAnsweredOverpaymentTips =
  (
    tips: ReadonlyArray<{
      readonly id: OverpaymentResolutionId
      readonly paymentId: PaymentId
      readonly billId: BillId | null
      readonly currency: FiatCurrency
    }>
  ): Task<
    ReadonlyArray<AnsweredOverpaymentTip>,
    never,
    EvoluDep & EvoluOwnerDep
  > =>
  async (run) => {
    const scopes = new Map<string, OverpaymentScope>(
      tips.map(({ billId, paymentId }) =>
        billId === null ? [paymentId, { paymentId }] : [billId, { billId }]
      )
    )
    const inputs = await Promise.all(
      [...scopes.values()].map((scope) => run(loadOverpaymentInput(scope)))
    )
    const answered = new Map(
      inputs.flatMap((input) =>
        input.ok
          ? deriveBillOverpayment(input.value).answers.flatMap((answer) =>
              answer.source.type === "tip" && !answer.isWithdrawn
                ? [[answer.source.id, answer.answered] as const]
                : []
            )
          : []
      )
    )
    return ok(
      tips.map(({ id, currency }) => ({
        currency,
        amount: answered.get(id) ?? NonNegativeInteger(0),
      }))
    )
  }
