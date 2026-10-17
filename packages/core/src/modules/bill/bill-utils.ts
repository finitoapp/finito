import type { AccountTransactionId } from "../account-transaction/account-transaction-types.ts"
import type {
  OverpaymentResolutionId,
  OverpaymentResolutionKind,
} from "../overpayment-resolution/overpayment-resolution-types.ts"
import { derivePaymentStatus } from "../payment/payment-status-utils.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import type { RefundId } from "../refund/refund-types.ts"
import { deriveRefundableAmount } from "../refund/refund-utils.ts"
import {
  type ClaimedAmount,
  toPaymentCurrencyAmount,
} from "../shared/claimed-amount.ts"
import {
  type FiatCurrency,
  NonNegativeInteger,
  type TimestampMs,
} from "../shared/schema.ts"
import type { TableId } from "../table/table-types.ts"
import type { BillCoverage, BillStatus, SyncClockHex } from "./bill-types.ts"

/**
 * Derives a bill's display status, in precedence order (first match wins):
 * `confirmedClosedAt` > `canceledAt` > coverage > `open`. Mirrors
 * `derivePaymentStatus`'s shape and reasoning:
 *
 * - `confirmedClosedAt` is staff's explicit resolution of the
 *   canceled+funded collision (see `confirmBillClosedDespiteCancellation`)
 *   and outranks `canceledAt` on purpose, the same way
 *   `payment.confirmedPaidAt` outranks `payment.canceledAt`.
 * - `canceledAt` otherwise wins over coverage: an explicit discard is not
 *   silently undone just because a stray/late claim happens to cover the
 *   total (see docs/bill-payment-states.md).
 * - Coverage only counts as "closed" together with `hasActiveClaim` — a
 *   brand-new bill with no line items yet also has `billTotal === 0 ===
 *   claimedSum` (trivially "paid" by `deriveBillCoverage`'s own definition),
 *   but must stay `open`/editable until an actual payment has been claimed
 *   for it. Requiring at least one claim is what keeps that fresh-empty-cart
 *   case from reading as instantly `closed`.
 */
export const deriveBillStatus = ({
  canceledAt,
  confirmedClosedAt,
  hasActiveClaim,
  coverage,
}: {
  readonly canceledAt: TimestampMs | null
  readonly confirmedClosedAt: TimestampMs | null
  readonly hasActiveClaim: boolean
  readonly coverage: BillCoverage
}): BillStatus => {
  if (confirmedClosedAt !== null) return "closed"
  if (canceledAt !== null) return "canceled"
  return hasActiveClaim && coverage !== "underpaid" ? "closed" : "open"
}

/**
 * Compares what has actually been claimed as paid against a bill's
 * line-item total, independent of `bill.status`. See
 * docs/bill-payment-states.md.
 */
export const deriveBillCoverage = (
  billTotal: NonNegativeInteger,
  claimedSum: NonNegativeInteger
): BillCoverage => {
  if (claimedSum === billTotal) return "paid"
  return claimedSum < billTotal ? "underpaid" : "overpaid"
}

/**
 * One claimed transaction as the bill-coverage queries return it: the
 * shared money fields plus which payment it settles and that payment's tip.
 */
export interface ClaimedTransaction extends ClaimedAmount {
  readonly paymentId: PaymentId
  readonly tipAmount: NonNegativeInteger
}

/**
 * Sums, per payment, the non-tip portion of every distinct account
 * transaction actively claimed against it, then adds those per-payment
 * totals together.
 *
 * The dedup-by-transaction-id rule and the currency conversion both come
 * from `sumDistinctClaimedAmounts`, which the payment's own
 * excess-settlement check uses too; what this adds is the tip. Tip is
 * subtracted only once per payment (it's an attribute of the payment, not
 * of any one transaction), and a payment whose transactions still fall
 * short of its tip (a partial, incomplete split) contributes zero rather
 * than a negative amount.
 */
export const calculateClaimedSum = (
  claimedTransactions: ReadonlyArray<ClaimedTransaction>
): NonNegativeInteger => {
  const uniqueTransactions = new Map(
    claimedTransactions.map((transaction) => [
      transaction.accountTransactionId,
      transaction,
    ])
  )

  // Gross and tip travel together per payment rather than in two parallel
  // maps: the tip is only meaningful against the gross it is subtracted from,
  // and keeping them apart made it possible to look one up without the other.
  //
  // Every row of a payment carries that payment's own `tipAmount`, joined from
  // the same `payment` row, so through either current query these values
  // always agree and the `max` below is whichever one they all are. Nothing
  // enforces that though — a widened join would break it silently — and
  // taking whichever row was read last would then be a coin flip in one of
  // two directions. Too small a tip inflates the claimed sum, and an inflated
  // sum can read a bill as covered while money is still missing. The largest
  // tip can only leave a bill looking *less* covered, which staff notice.
  const claimedByPayment = new Map<
    PaymentId,
    { readonly gross: number; readonly tip: NonNegativeInteger }
  >()
  for (const transaction of uniqueTransactions.values()) {
    const { paymentId, tipAmount } = transaction
    const claimed = claimedByPayment.get(paymentId)
    claimedByPayment.set(paymentId, {
      gross: (claimed?.gross ?? 0) + toPaymentCurrencyAmount(transaction),
      tip:
        claimed === undefined
          ? tipAmount
          : NonNegativeInteger(Math.max(claimed.tip, tipAmount)),
    })
  }

  return NonNegativeInteger(
    [...claimedByPayment.values()].reduce(
      (sum, { gross, tip }) => sum + Math.max(0, gross - tip),
      0
    )
  )
}

export interface OverpaymentPayment {
  readonly id: PaymentId
  readonly amount: NonNegativeInteger
  readonly tipAmount: NonNegativeInteger
  readonly currency: FiatCurrency
  readonly cashReceivedAmount: NonNegativeInteger | null
  readonly acknowledgementClock: SyncClockHex | null
}

export interface OverpaymentTransaction extends ClaimedAmount {
  readonly paymentId: PaymentId
  readonly claimClock: SyncClockHex
}

export interface OverpaymentRefund {
  readonly id: RefundId
  readonly paymentId: PaymentId
  readonly amount: NonNegativeInteger
  readonly isTip: boolean
  readonly overpaymentAmount: NonNegativeInteger | null
  readonly knownTransactionIds: ReadonlyArray<AccountTransactionId> | null
  readonly withoutDeviceAmount: NonNegativeInteger
  readonly recordClock: SyncClockHex
}

export interface OverpaymentResolution {
  readonly id: OverpaymentResolutionId
  readonly paymentId: PaymentId
  readonly kind: OverpaymentResolutionKind
  readonly amount: NonNegativeInteger
  readonly knownTransactionIds: ReadonlyArray<AccountTransactionId>
  readonly withdrawnId: OverpaymentResolutionId | null
  readonly recordClock: SyncClockHex
}

export interface BillOverpaymentInput {
  readonly billTotal: NonNegativeInteger
  readonly isCanceled: boolean
  readonly payments: ReadonlyArray<OverpaymentPayment>
  readonly transactions: ReadonlyArray<OverpaymentTransaction>
  readonly refunds: ReadonlyArray<OverpaymentRefund>
  readonly resolutions: ReadonlyArray<OverpaymentResolution>
}

export type OverpaymentAnswerSource =
  | { readonly type: "return"; readonly id: RefundId }
  | { readonly type: "tip" | "kept"; readonly id: OverpaymentResolutionId }
  | { readonly type: "acknowledgement" }

export interface OverpaymentAnswer {
  readonly source: OverpaymentAnswerSource
  readonly paymentId: PaymentId
  readonly amount: NonNegativeInteger
  readonly answered: NonNegativeInteger
  readonly isWithdrawn: boolean
  readonly recordClock: SyncClockHex
  readonly drawnFrom: ReadonlyArray<AccountTransactionId>
}

export interface BillOverpayment {
  readonly overpayment: NonNegativeInteger
  readonly unresolved: NonNegativeInteger
  readonly answers: ReadonlyArray<OverpaymentAnswer>
  readonly roomByPayment: ReadonlyMap<PaymentId, NonNegativeInteger>
}

export type OverpaymentRefundKind =
  | { readonly type: "return" | "goods" }
  | { readonly type: "items"; readonly removedLinesAmount: NonNegativeInteger }

interface LedgerTransaction {
  readonly id: AccountTransactionId
  readonly paymentId: PaymentId
  readonly money: number
  readonly claimClock: SyncClockHex
}

interface LedgerRow {
  readonly key: string
  readonly source: OverpaymentAnswerSource
  readonly paymentId: PaymentId
  readonly amount: number
  readonly knownIds: ReadonlySet<AccountTransactionId>
  readonly recordClock: SyncClockHex
}

interface LedgerRefund extends LedgerRow {
  readonly overpaymentAmount: number
}

interface LedgerResolution extends LedgerRow {
  readonly withdrawnClock: SyncClockHex | null
}

interface Ledger {
  readonly total: number
  readonly asks: ReadonlyMap<PaymentId, number>
  readonly transactions: ReadonlyArray<LedgerTransaction>
  readonly refunds: ReadonlyArray<LedgerRefund>
  readonly resolutions: ReadonlyArray<LedgerResolution>
}

interface Allocation {
  readonly answered: ReadonlyMap<string, number>
  readonly drawnFrom: ReadonlyMap<string, ReadonlyArray<AccountTransactionId>>
  readonly returned: number
  readonly resolved: number
  readonly resolvedOn: ReadonlyMap<PaymentId, number>
}

const compareText = (a: string, b: string): number =>
  Number(a > b) - Number(a < b)

const byClaim = (
  a: { readonly claimClock: SyncClockHex; readonly id: string },
  b: { readonly claimClock: SyncClockHex; readonly id: string }
): number => compareText(a.claimClock, b.claimClock) || compareText(a.id, b.id)

const byRecord = (
  a: { readonly recordClock: SyncClockHex; readonly key: string },
  b: { readonly recordClock: SyncClockHex; readonly key: string }
): number =>
  compareText(a.recordClock, b.recordClock) || compareText(a.key, b.key)

const sumOf = (values: ReadonlyArray<number>): number =>
  values.reduce((sum, value) => sum + value, 0)

const moneyOf = (
  transactions: ReadonlyArray<LedgerTransaction>,
  paymentId?: PaymentId
): number =>
  sumOf(
    transactions
      .filter(
        (transaction) =>
          paymentId === undefined || transaction.paymentId === paymentId
      )
      .map(({ money }) => money)
  )

const valueTransactions = (
  payments: ReadonlyArray<OverpaymentPayment>,
  transactions: ReadonlyArray<OverpaymentTransaction>
): ReadonlyArray<LedgerTransaction> => {
  const claimed = new Map<AccountTransactionId, OverpaymentTransaction>()
  for (const transaction of [...transactions].sort((a, b) =>
    byClaim(
      { claimClock: a.claimClock, id: a.accountTransactionId },
      { claimClock: b.claimClock, id: b.accountTransactionId }
    )
  )) {
    if (!claimed.has(transaction.accountTransactionId)) {
      claimed.set(transaction.accountTransactionId, transaction)
    }
  }

  return payments
    .flatMap((payment) => {
      const own = [...claimed.values()].filter(
        (transaction) => transaction.paymentId === payment.id
      )
      const gross = sumOf(own.map(toPaymentCurrencyAmount))
      const money = Math.min(
        Math.max(0, gross - payment.tipAmount),
        deriveRefundableAmount({
          ...payment,
          excess: NonNegativeInteger(Math.max(0, gross - payment.amount)),
        })
      )
      let notCounted = gross - money
      return own.map((transaction): LedgerTransaction => {
        const value = toPaymentCurrencyAmount(transaction)
        const deducted = Math.min(value, notCounted)
        notCounted -= deducted
        return {
          id: transaction.accountTransactionId,
          paymentId: payment.id,
          money: value - deducted,
          claimClock: transaction.claimClock,
        }
      })
    })
    .sort(byClaim)
}

const overpaymentOf = (ledger: Ledger): number =>
  Math.max(0, moneyOf(ledger.transactions) - ledger.total)

const heldAboveGoods = (ledger: Ledger): number =>
  moneyOf(ledger.transactions) -
  sumOf(ledger.refunds.map(({ amount }) => amount)) -
  Math.max(
    0,
    ledger.total -
      sumOf(
        ledger.refunds.map(
          ({ amount, overpaymentAmount }) => amount - overpaymentAmount
        )
      )
  )

const paymentHolds = (ledger: Ledger, paymentId: PaymentId): number =>
  moneyOf(ledger.transactions, paymentId) -
  sumOf(
    ledger.refunds
      .filter((refund) => refund.paymentId === paymentId)
      .map(({ amount }) => amount)
  )

const attributeShares = (ledger: Ledger): Map<AccountTransactionId, number> => {
  const within = new Map<AccountTransactionId, number>()
  const shares = new Map<AccountTransactionId, number>()
  const stillAsked = new Map(ledger.asks)
  for (const transaction of ledger.transactions) {
    const asked = stillAsked.get(transaction.paymentId) ?? 0
    const inAsk = Math.min(transaction.money, Math.max(0, asked))
    stillAsked.set(transaction.paymentId, asked - inAsk)
    within.set(transaction.id, inAsk)
    shares.set(transaction.id, transaction.money - inAsk)
  }

  const withinSum = sumOf([...within.values()])
  let aboveTotal = Math.max(0, withinSum - ledger.total)
  for (const transaction of [...ledger.transactions].reverse()) {
    const take = Math.min(aboveTotal, within.get(transaction.id) ?? 0)
    shares.set(transaction.id, (shares.get(transaction.id) ?? 0) + take)
    aboveTotal -= take
  }

  let stillDue = Math.max(0, ledger.total - withinSum)
  for (const transaction of ledger.transactions) {
    const share = shares.get(transaction.id) ?? 0
    const cover = Math.min(stillDue, share)
    shares.set(transaction.id, share - cover)
    stillDue -= cover
  }
  return shares
}

const allocate = (ledger: Ledger): Allocation => {
  const shares = attributeShares(ledger)
  const transactionsById = new Map(
    ledger.transactions.map((transaction) => [transaction.id, transaction])
  )
  const answered = new Map<string, number>()
  const drawnFrom = new Map<string, ReadonlyArray<AccountTransactionId>>()
  const draw = (row: LedgerRow, cap: number): number => {
    const known = [...row.knownIds]
      .flatMap((id) => {
        const transaction = transactionsById.get(id)
        return transaction === undefined ? [] : [transaction]
      })
      .sort(
        (a, b) =>
          Number(a.paymentId !== row.paymentId) -
            Number(b.paymentId !== row.paymentId) || byClaim(b, a)
      )
    let got = 0
    const from: AccountTransactionId[] = []
    for (const transaction of known) {
      const share = shares.get(transaction.id) ?? 0
      const take = Math.min(cap - got, share)
      if (take <= 0) continue
      shares.set(transaction.id, share - take)
      got += take
      from.push(transaction.id)
    }
    answered.set(row.key, got)
    drawnFrom.set(row.key, from)
    return got
  }

  let returned = 0
  for (const refund of ledger.refunds) {
    if (refund.overpaymentAmount > 0) {
      returned += draw(refund, refund.overpaymentAmount)
    }
  }

  const roomForResolutions = Math.max(
    0,
    Math.min(overpaymentOf(ledger) - returned, heldAboveGoods(ledger))
  )
  let resolved = 0
  const resolvedOn = new Map<PaymentId, number>()
  for (const resolution of ledger.resolutions) {
    if (resolution.withdrawnClock !== null) {
      answered.set(resolution.key, 0)
      drawnFrom.set(resolution.key, [])
      continue
    }
    const onPayment = resolvedOn.get(resolution.paymentId) ?? 0
    const got = draw(
      resolution,
      Math.max(
        0,
        Math.min(
          resolution.amount,
          paymentHolds(ledger, resolution.paymentId) - onPayment,
          roomForResolutions - resolved
        )
      )
    )
    resolvedOn.set(resolution.paymentId, onPayment + got)
    resolved += got
  }

  return { answered, drawnFrom, returned, resolved, resolvedOn }
}

const unresolvedOf = (ledger: Ledger, allocation: Allocation): number =>
  Math.max(
    0,
    Math.min(
      overpaymentOf(ledger) - allocation.returned,
      heldAboveGoods(ledger)
    ) - allocation.resolved
  )

const returnableOf = (
  ledger: Ledger,
  allocation: Allocation,
  paymentId: PaymentId
): number => {
  if (moneyOf(ledger.transactions) >= ledger.total) {
    return unresolvedOf(ledger, allocation)
  }
  const returnedBefore = sumOf(
    ledger.refunds
      .filter((refund) => refund.paymentId === paymentId)
      .map(({ overpaymentAmount }) => overpaymentAmount)
  )
  return Math.max(
    0,
    moneyOf(ledger.transactions, paymentId) -
      (ledger.asks.get(paymentId) ?? 0) -
      returnedBefore
  )
}

const askedToReturn = (
  kind: OverpaymentRefundKind,
  returnable: number
): number => {
  if (kind.type === "return") return returnable
  if (kind.type === "items")
    return Math.min(kind.removedLinesAmount, returnable)
  return 0
}

const refundOverpaymentAmount = (
  ledger: Ledger,
  {
    paymentId,
    amount,
    kind,
  }: {
    readonly paymentId: PaymentId
    readonly amount: number
    readonly kind: OverpaymentRefundKind
  }
): number => {
  const allocation = allocate(ledger)
  const leftOnPayment = Math.max(0, paymentHolds(ledger, paymentId) - amount)
  const resolutionsCut = Math.max(
    0,
    (allocation.resolvedOn.get(paymentId) ?? 0) - leftOnPayment
  )
  const returning = Math.min(
    amount,
    askedToReturn(kind, returnableOf(ledger, allocation, paymentId)) +
      resolutionsCut
  )
  const goodsRefundedAfter =
    sumOf(
      ledger.refunds.map(
        ({ amount: refunded, overpaymentAmount }) =>
          refunded - overpaymentAmount
      )
    ) +
    amount -
    returning
  return Math.min(
    amount,
    returning + Math.max(0, goodsRefundedAfter - ledger.total)
  )
}

const ledgerAt = (ledger: Ledger, clock: SyncClockHex): Ledger => ({
  ...ledger,
  transactions: ledger.transactions.filter(
    (transaction) => transaction.claimClock < clock
  ),
  refunds: ledger.refunds.filter((refund) => refund.recordClock < clock),
  resolutions: ledger.resolutions
    .filter((resolution) => resolution.recordClock < clock)
    .map((resolution) =>
      resolution.withdrawnClock !== null && resolution.withdrawnClock >= clock
        ? { ...resolution, withdrawnClock: null }
        : resolution
    ),
})

const buildLedger = (input: BillOverpaymentInput): Ledger => {
  const total = input.billTotal
  const asks = new Map(
    input.payments.map((payment) => [
      payment.id,
      Math.max(0, payment.amount - payment.tipAmount),
    ])
  )
  const transactions = valueTransactions(input.payments, input.transactions)
  const claimedBefore = (clock: SyncClockHex) =>
    new Set(
      transactions
        .filter((transaction) => transaction.claimClock < clock)
        .map(({ id }) => id)
    )

  const withdrawnClocks = new Map<OverpaymentResolutionId, SyncClockHex>()
  for (const withdrawal of input.resolutions) {
    if (withdrawal.kind !== "withdrawal" || withdrawal.withdrawnId === null) {
      continue
    }
    const earlier = withdrawnClocks.get(withdrawal.withdrawnId)
    if (earlier === undefined || withdrawal.recordClock < earlier) {
      withdrawnClocks.set(withdrawal.withdrawnId, withdrawal.recordClock)
    }
  }
  const recorded = input.resolutions.flatMap(
    (resolution): ReadonlyArray<LedgerResolution> =>
      resolution.kind === "withdrawal"
        ? []
        : [
            {
              key: resolution.id,
              source: { type: resolution.kind, id: resolution.id },
              paymentId: resolution.paymentId,
              amount: resolution.amount,
              knownIds: new Set(resolution.knownTransactionIds),
              recordClock: resolution.recordClock,
              withdrawnClock: withdrawnClocks.get(resolution.id) ?? null,
            },
          ]
  )
  const acknowledged = input.payments.flatMap(
    (payment): ReadonlyArray<LedgerResolution> => {
      if (payment.acknowledgementClock === null) return []
      const knownIds = claimedBefore(payment.acknowledgementClock)
      const known = transactions.filter(({ id }) => knownIds.has(id))
      const amount = Math.max(
        0,
        Math.min(
          moneyOf(known, payment.id) - (asks.get(payment.id) ?? 0),
          moneyOf(known) - total
        )
      )
      if (amount === 0) return []
      return [
        {
          key: `acknowledgement:${payment.id}`,
          source: { type: "acknowledgement" },
          paymentId: payment.id,
          amount,
          knownIds,
          recordClock: payment.acknowledgementClock,
          withdrawnClock: null,
        },
      ]
    }
  )
  const resolutions = [...recorded, ...acknowledged].sort(byRecord)

  const refunds: LedgerRefund[] = []
  for (const refund of input.refunds
    .filter(({ isTip }) => !isTip)
    .map((refund) => ({ ...refund, key: refund.id }))
    .sort(byRecord)) {
    const row = {
      key: refund.id,
      source: { type: "return", id: refund.id } as const,
      paymentId: refund.paymentId,
      amount: refund.amount,
      recordClock: refund.recordClock,
    }
    if (
      refund.overpaymentAmount !== null &&
      refund.knownTransactionIds !== null
    ) {
      refunds.push({
        ...row,
        overpaymentAmount: refund.overpaymentAmount,
        knownIds: new Set(refund.knownTransactionIds),
      })
      continue
    }
    refunds.push({
      ...row,
      overpaymentAmount: refundOverpaymentAmount(
        ledgerAt(
          { total, asks, transactions, refunds, resolutions },
          refund.recordClock
        ),
        {
          paymentId: refund.paymentId,
          amount: refund.amount,
          kind: { type: "return" },
        }
      ),
      knownIds: claimedBefore(refund.recordClock),
    })
  }

  return { total, asks, transactions, refunds, resolutions }
}

export const deriveBillOverpayment = (
  input: BillOverpaymentInput
): BillOverpayment => {
  const none = NonNegativeInteger(0)
  if (input.isCanceled) {
    return {
      overpayment: none,
      unresolved: none,
      answers: [],
      roomByPayment: new Map(input.payments.map(({ id }) => [id, none])),
    }
  }

  const ledger = buildLedger(input)
  const allocation = allocate(ledger)
  const answerOf = (
    row: LedgerRow,
    amount: number,
    isWithdrawn: boolean
  ): OverpaymentAnswer => ({
    source: row.source,
    paymentId: row.paymentId,
    amount: NonNegativeInteger(amount),
    answered: NonNegativeInteger(allocation.answered.get(row.key) ?? 0),
    isWithdrawn,
    recordClock: row.recordClock,
    drawnFrom: allocation.drawnFrom.get(row.key) ?? [],
  })

  return {
    overpayment: NonNegativeInteger(overpaymentOf(ledger)),
    unresolved: NonNegativeInteger(unresolvedOf(ledger, allocation)),
    answers: [
      ...ledger.refunds
        .filter(({ overpaymentAmount }) => overpaymentAmount > 0)
        .map((refund) => answerOf(refund, refund.overpaymentAmount, false)),
      ...ledger.resolutions.map((resolution) =>
        answerOf(
          resolution,
          resolution.amount,
          resolution.withdrawnClock !== null
        )
      ),
    ],
    roomByPayment: new Map(
      input.payments.map(({ id }) => [
        id,
        NonNegativeInteger(
          Math.max(
            0,
            paymentHolds(ledger, id) - (allocation.resolvedOn.get(id) ?? 0)
          )
        ),
      ])
    ),
  }
}

export const deriveOverpaymentTip = (
  overpayment: BillOverpayment,
  paymentId: PaymentId
): NonNegativeInteger =>
  NonNegativeInteger(
    sumOf(
      overpayment.answers
        .filter(
          (answer) =>
            answer.source.type === "tip" &&
            !answer.isWithdrawn &&
            answer.paymentId === paymentId
        )
        .map(({ answered }) => answered)
    )
  )

export const deriveRefundOverpaymentAmount = (
  input: BillOverpaymentInput,
  refund: {
    readonly paymentId: PaymentId
    readonly amount: NonNegativeInteger
    readonly kind: OverpaymentRefundKind
  }
): NonNegativeInteger =>
  NonNegativeInteger(
    input.isCanceled ? 0 : refundOverpaymentAmount(buildLedger(input), refund)
  )

export const deriveReturnableOverpayment = (
  input: BillOverpaymentInput,
  paymentId: PaymentId
): NonNegativeInteger => {
  if (input.isCanceled) return NonNegativeInteger(0)
  const ledger = buildLedger(input)
  return NonNegativeInteger(returnableOf(ledger, allocate(ledger), paymentId))
}

export const deriveUnreportedMoney = (
  input: BillOverpaymentInput,
  reportedGoodsByPayment: ReadonlyMap<PaymentId, NonNegativeInteger>
): NonNegativeInteger => {
  const transactions = valueTransactions(input.payments, input.transactions)
  const neverReported = sumOf(
    input.payments.map(({ id }) =>
      Math.max(
        0,
        moneyOf(transactions, id) - (reportedGoodsByPayment.get(id) ?? 0)
      )
    )
  )
  const returnedWithoutDevice = sumOf(
    input.refunds
      .filter(({ isTip }) => !isTip)
      .map(({ withoutDeviceAmount }) => withoutDeviceAmount)
  )
  return NonNegativeInteger(Math.max(0, neverReported - returnedWithoutDevice))
}

export interface BillHistoryItemSummary {
  readonly status: BillStatus
  /**
   * The canceled+funded collision from docs/bill-payment-states.md: the
   * bill was discarded, but its payments already cover its total —
   * `deriveBillStatus` still reads `canceled` until staff explicitly
   * resolves it via `confirmBillClosedDespiteCancellation`.
   */
  readonly hasCancellationCollision: boolean
  readonly billTotal: NonNegativeInteger
  readonly claimedSum: NonNegativeInteger
  readonly amountDue: NonNegativeInteger
  readonly coverage: BillCoverage
}

/**
 * Combines a bill's `canceledAt`/`confirmedClosedAt`, its precomputed
 * `billTotal` (from `calculateBillLineSummaries`), and its claimed
 * transactions into its derived status, coverage and cancellation collision.
 * The history list (`BillHistory`) and the detail screens (`useBillStatus`)
 * both read it, so they cannot disagree. See docs/bill-payment-states.md.
 */
export const deriveBillHistoryItemSummary = ({
  canceledAt,
  confirmedClosedAt,
  billTotal,
  claimedTransactions,
}: {
  readonly canceledAt: TimestampMs | null
  readonly confirmedClosedAt: TimestampMs | null
  readonly billTotal: NonNegativeInteger
  readonly claimedTransactions: ReadonlyArray<ClaimedTransaction>
}): BillHistoryItemSummary => {
  const claimedSum = calculateClaimedSum(claimedTransactions)
  const coverage = deriveBillCoverage(billTotal, claimedSum)
  const hasActiveClaim = claimedTransactions.length > 0
  const status = deriveBillStatus({
    canceledAt,
    confirmedClosedAt,
    hasActiveClaim,
    coverage,
  })

  return {
    status,
    hasCancellationCollision:
      canceledAt !== null &&
      confirmedClosedAt === null &&
      hasActiveClaim &&
      coverage !== "underpaid",
    billTotal,
    claimedSum,
    amountDue: NonNegativeInteger(Math.max(0, billTotal - claimedSum)),
    coverage,
  }
}

/**
 * Which of a bill's payments count as settled, from its claimed *transaction*
 * rows — shared by `isBillLocked` (`bill-actions.ts`) and
 * `usePendingPayments` (the reactive equivalent) so the Task guard and the UI
 * lock can never answer this differently. That sharing is the point; see
 * `hasPendingPayment` below.
 *
 * The `paymentId` parameter is load-bearing, not incidental: payment rows key
 * their own id as `id`, so handing this the payments that merely *have* a
 * claim — the drift it exists to prevent — is a type error rather than a
 * plausible-looking set.
 *
 * Built from `claimedTransactionsByBillIdQuery` rather than
 * `claimedPaymentsByBillIdQuery`, i.e. from claims whose account transaction
 * is actually present. A claim on its own is not evidence that money arrived:
 * `calculateClaimedSum` cannot count a transaction that is not there, so
 * feeding the lock the looser "has any claim at all" reading let a bill read
 * `open` with coverage 0 while its payment still displayed as paid — and the
 * cart stayed editable underneath an outstanding payment, which is the one
 * thing the lock exists to prevent.
 *
 * The cost is a transient false lock during the sync window where a claim has
 * arrived from another device and its transaction has not. That resolves
 * itself, and errs towards keeping a cart still rather than letting it move
 * under a customer who is mid-payment.
 */
export const claimedPaymentIdSet = (
  claimedTransactions: ReadonlyArray<{ readonly paymentId: PaymentId }>
): ReadonlySet<PaymentId> =>
  new Set(claimedTransactions.map((transaction) => transaction.paymentId))

/**
 * The ids of every *live* payment attempt on a bill — one whose derived
 * status (see `derivePaymentStatus`) is `pending`. This is the basis of the
 * bill's editing lock: `editable = bill.status === "open" && !hasPendingPayment(...)`.
 * Nothing is stored for this — it is recomputed from the payment rows every
 * time, so the lock clears itself the moment the live payment resolves
 * (paid, canceled, or expires), with no separate "unlock" step. See
 * docs/bill-payment-states.md.
 */
export const derivePendingPaymentIds = (
  payments: ReadonlyArray<{
    readonly id: PaymentId
    readonly canceledAt: TimestampMs | null
    readonly expiresAt: TimestampMs | null
  }>,
  claimedPaymentIds: ReadonlySet<PaymentId>,
  now: Date
): ReadonlyArray<PaymentId> =>
  payments
    .filter(
      (payment) =>
        derivePaymentStatus({
          canceledAt: payment.canceledAt,
          // `confirmedPaidAt` can only ever be set once `canceledAt` already
          // is (see `confirmPaymentPaidDespiteCancellation`), and both of
          // those branches resolve to a non-"pending" status ahead of this
          // one — so passing `null` here can never change whether a bill
          // counts as locked. Not selected by this query on purpose, to
          // avoid widening it for a value that can't affect the result.
          confirmedPaidAt: null,
          expiresAt: payment.expiresAt,
          hasActiveClaim: claimedPaymentIds.has(payment.id),
          now,
        }) === "pending"
    )
    .map((payment) => payment.id)

export const hasPendingPayment = (
  payments: ReadonlyArray<{
    readonly id: PaymentId
    readonly canceledAt: TimestampMs | null
    readonly expiresAt: TimestampMs | null
  }>,
  claimedPaymentIds: ReadonlySet<PaymentId>,
  now: Date
): boolean =>
  derivePendingPaymentIds(payments, claimedPaymentIds, now).length > 0

export const deriveOpenBillTableId = (
  tableId: TableId | null,
  liveTableIds: ReadonlySet<TableId>
): TableId | null =>
  tableId !== null && liveTableIds.has(tableId) ? tableId : null
