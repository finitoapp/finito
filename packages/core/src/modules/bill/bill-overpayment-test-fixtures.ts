import type { AccountTransactionId } from "../account-transaction/account-transaction-types.ts"
import type { OverpaymentResolutionId } from "../overpayment-resolution/overpayment-resolution-types.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import type { RefundId } from "../refund/refund-types.ts"
import { NonNegativeInteger } from "../shared/schema.ts"
import type { SyncClockHex } from "./bill-types.ts"
import {
  type BillOverpayment,
  type BillOverpaymentInput,
  deriveBillOverpayment,
  deriveRefundOverpaymentAmount,
  deriveUnreportedMoney,
  type OverpaymentRefundKind,
} from "./bill-utils.ts"

export const syncClockHex = (clock: number): SyncClockHex =>
  clock.toString(16).padStart(12, "0")

export interface SeededRandom {
  readonly next: () => number
  readonly integer: (min: number, max: number) => number
  readonly pick: <T>(values: ReadonlyArray<T>) => T
  readonly shuffle: <T>(values: ReadonlyArray<T>) => ReadonlyArray<T>
}

export const createSeededRandom = (seed: number): SeededRandom => {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = state
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
  const integer = (min: number, max: number) =>
    min + Math.floor(next() * (max - min + 1))
  const pick = <T>(values: ReadonlyArray<T>): T => {
    const value = values[integer(0, values.length - 1)]
    if (value === undefined) throw new Error("Nothing to pick from")
    return value
  }
  const shuffle = <T>(values: ReadonlyArray<T>): ReadonlyArray<T> => {
    const shuffled = [...values]
    for (let index = shuffled.length - 1; index > 0; index--) {
      const other = integer(0, index)
      const value = shuffled[index]
      const otherValue = shuffled[other]
      if (value === undefined || otherValue === undefined) continue
      shuffled[index] = otherValue
      shuffled[other] = value
    }
    return shuffled
  }
  return { next, integer, pick, shuffle }
}

interface SimulatedPayment {
  readonly ask: number
  reportedGoods: number
  acknowledgement: {
    readonly clock: number
    readonly known: ReadonlySet<AccountTransactionId>
  } | null
}

interface SimulatedTransaction {
  readonly id: AccountTransactionId
  readonly paymentId: PaymentId
  readonly money: number
  readonly clock: number
  present: boolean
}

interface SimulatedRefund {
  readonly id: RefundId
  readonly paymentId: PaymentId
  readonly amount: number
  readonly clock: number
  readonly known: ReadonlySet<AccountTransactionId>
  readonly overpaymentAmount: number | null
  readonly withoutDeviceAmount: number
}

interface SimulatedResolution {
  readonly id: OverpaymentResolutionId
  readonly paymentId: PaymentId
  readonly kind: "tip" | "kept" | "withdrawal"
  readonly amount: number
  readonly clock: number
  readonly known: ReadonlySet<AccountTransactionId>
  readonly withdrawnId: OverpaymentResolutionId | null
}

export type SimulatedResolutionKind = "tip" | "kept"

export interface OverpaymentSimulation {
  readonly total: () => number
  readonly setTotal: (total: number) => void
  readonly paymentIds: () => ReadonlyArray<PaymentId>
  readonly addPayment: (name: string, ask: number) => PaymentId
  readonly pay: (
    paymentId: PaymentId,
    money: number,
    options?: { readonly reported?: boolean }
  ) => AccountTransactionId
  readonly presentTransactionIds: () => ReadonlySet<AccountTransactionId>
  readonly remove: (transactionId: AccountTransactionId) => void
  readonly hasRemovals: () => boolean
  readonly input: (
    known?: ReadonlySet<AccountTransactionId>
  ) => BillOverpaymentInput
  readonly derive: () => BillOverpayment
  readonly recordRefund: (
    paymentId: PaymentId,
    amount: number,
    kind: OverpaymentRefundKind,
    known?: ReadonlySet<AccountTransactionId>
  ) => RefundId
  readonly recordLegacyRefund: (
    paymentId: PaymentId,
    amount: number
  ) => RefundId
  readonly recordResolution: (
    kind: SimulatedResolutionKind,
    paymentId: PaymentId,
    amount: number,
    known?: ReadonlySet<AccountTransactionId>
  ) => OverpaymentResolutionId | null
  readonly forceResolution: (
    kind: SimulatedResolutionKind,
    paymentId: PaymentId,
    amount: number,
    options: {
      readonly known: ReadonlySet<AccountTransactionId>
      readonly clockBefore?: RefundId | OverpaymentResolutionId
    }
  ) => OverpaymentResolutionId
  readonly withdraw: (resolutionId: OverpaymentResolutionId) => void
  readonly activeResolutionIds: () => ReadonlyArray<OverpaymentResolutionId>
  readonly acknowledge: (paymentId: PaymentId) => void
  readonly isAcknowledged: (paymentId: PaymentId) => boolean
  readonly money: () => number
  readonly held: () => number
  readonly holds: (paymentId: PaymentId) => number
  readonly refundedGoods: (overpayment: BillOverpayment) => number
  readonly reportedGoods: () => number
  readonly unreportedMoney: () => number
  readonly eetHolds: () => number
  readonly withoutDeviceAmount: (refundId: RefundId) => number
}

export const createOverpaymentSimulation = (
  initialTotal: number
): OverpaymentSimulation => {
  let total = initialTotal
  let clock = 0
  const payments = new Map<PaymentId, SimulatedPayment>()
  const transactions: SimulatedTransaction[] = []
  const refunds: SimulatedRefund[] = []
  const resolutions: SimulatedResolution[] = []

  const tick = () => {
    clock += 2
    return clock
  }
  const presentTransactionIds = () =>
    new Set(transactions.filter((tx) => tx.present).map((tx) => tx.id))
  const isWithin = (
    rowKnown: ReadonlySet<AccountTransactionId>,
    known: ReadonlySet<AccountTransactionId>
  ) => {
    const present = presentTransactionIds()
    return [...rowKnown].every((id) => !present.has(id) || known.has(id))
  }

  const input = (
    known: ReadonlySet<AccountTransactionId> = presentTransactionIds()
  ): BillOverpaymentInput => ({
    billTotal: NonNegativeInteger(total),
    isCanceled: false,
    payments: [...payments].map(([id, payment]) => ({
      id,
      amount: NonNegativeInteger(payment.ask),
      tipAmount: NonNegativeInteger(0),
      currency: "CZK",
      cashReceivedAmount: null,
      acknowledgementClock:
        payment.acknowledgement !== null &&
        isWithin(payment.acknowledgement.known, known)
          ? syncClockHex(payment.acknowledgement.clock)
          : null,
    })),
    transactions: transactions
      .filter((tx) => tx.present && known.has(tx.id))
      .map((tx) => ({
        accountTransactionId: tx.id,
        paymentId: tx.paymentId,
        amount: tx.money,
        currency: "CZK",
        paymentAmount: NonNegativeInteger(payments.get(tx.paymentId)?.ask ?? 0),
        paymentCurrency: "CZK",
        paymentAmountSats: null,
        claimClock: syncClockHex(tx.clock),
      })),
    refunds: refunds
      .filter((refund) => isWithin(refund.known, known))
      .map((refund) => ({
        id: refund.id,
        paymentId: refund.paymentId,
        amount: NonNegativeInteger(refund.amount),
        isTip: false,
        overpaymentAmount:
          refund.overpaymentAmount === null
            ? null
            : NonNegativeInteger(refund.overpaymentAmount),
        knownTransactionIds:
          refund.overpaymentAmount === null ? null : [...refund.known],
        withoutDeviceAmount: NonNegativeInteger(refund.withoutDeviceAmount),
        recordClock: syncClockHex(refund.clock),
      })),
    resolutions: resolutions
      .filter((resolution) => isWithin(resolution.known, known))
      .map((resolution) => ({
        id: resolution.id,
        paymentId: resolution.paymentId,
        kind: resolution.kind,
        amount: NonNegativeInteger(resolution.amount),
        knownTransactionIds: [...resolution.known],
        withdrawnId: resolution.withdrawnId,
        recordClock: syncClockHex(resolution.clock),
      })),
  })

  const reportedGoodsByPayment = () =>
    new Map(
      [...payments].map(([id, payment]) => [
        id,
        NonNegativeInteger(payment.reportedGoods),
      ])
    )

  const moneyOf = (paymentId: PaymentId) =>
    transactions
      .filter((tx) => tx.present && tx.paymentId === paymentId)
      .reduce((sum, tx) => sum + tx.money, 0)

  const refundedOf = (paymentId: PaymentId) =>
    refunds
      .filter((refund) => refund.paymentId === paymentId)
      .reduce((sum, refund) => sum + refund.amount, 0)

  const recordResolutionRow = (
    kind: SimulatedResolution["kind"],
    paymentId: PaymentId,
    amount: number,
    known: ReadonlySet<AccountTransactionId>,
    withdrawnId: OverpaymentResolutionId | null,
    rowClock: number
  ) => {
    const id = `w${rowClock}` as OverpaymentResolutionId
    resolutions.push({
      id,
      paymentId,
      kind,
      amount,
      clock: rowClock,
      known,
      withdrawnId,
    })
    return id
  }

  const clockOf = (id: RefundId | OverpaymentResolutionId) => {
    const row =
      refunds.find((refund) => refund.id === id) ??
      resolutions.find((resolution) => resolution.id === id)
    if (row === undefined) throw new Error(`No row ${id}`)
    return row.clock
  }

  return {
    total: () => total,
    setTotal: (newTotal) => {
      total = newTotal
    },
    paymentIds: () => [...payments.keys()],
    addPayment: (name, ask) => {
      const id = name as PaymentId
      payments.set(id, { ask, reportedGoods: 0, acknowledgement: null })
      return id
    },
    pay: (paymentId, money, { reported = true } = {}) => {
      const txClock = tick()
      const id = `t${txClock}` as AccountTransactionId
      transactions.push({ id, paymentId, money, clock: txClock, present: true })
      const payment = payments.get(paymentId)
      if (payment !== undefined && reported) payment.reportedGoods += money
      return id
    },
    presentTransactionIds,
    remove: (transactionId) => {
      const tx = transactions.find(({ id }) => id === transactionId)
      if (tx !== undefined) tx.present = false
    },
    hasRemovals: () => transactions.some((tx) => !tx.present),
    input,
    derive: () => deriveBillOverpayment(input()),
    recordRefund: (
      paymentId,
      amount,
      kind,
      known = presentTransactionIds()
    ) => {
      const view = input(known)
      const overpaymentAmount = deriveRefundOverpaymentAmount(view, {
        paymentId,
        amount: NonNegativeInteger(amount),
        kind,
      })
      const withoutDeviceAmount = Math.min(
        amount,
        deriveUnreportedMoney(view, reportedGoodsByPayment())
      )
      const refundClock = tick()
      const id = `r${refundClock}` as RefundId
      refunds.push({
        id,
        paymentId,
        amount,
        clock: refundClock,
        known,
        overpaymentAmount,
        withoutDeviceAmount,
      })
      return id
    },
    recordLegacyRefund: (paymentId, amount) => {
      const refundClock = tick()
      const id = `r${refundClock}` as RefundId
      refunds.push({
        id,
        paymentId,
        amount,
        clock: refundClock,
        known: presentTransactionIds(),
        overpaymentAmount: null,
        withoutDeviceAmount: 0,
      })
      return id
    },
    recordResolution: (
      kind,
      paymentId,
      amount,
      known = presentTransactionIds()
    ) => {
      const overpayment = deriveBillOverpayment(input(known))
      const room = overpayment.roomByPayment.get(paymentId) ?? 0
      if (amount > overpayment.unresolved || amount > room) return null
      return recordResolutionRow(kind, paymentId, amount, known, null, tick())
    },
    forceResolution: (kind, paymentId, amount, { known, clockBefore }) =>
      recordResolutionRow(
        kind,
        paymentId,
        amount,
        known,
        null,
        clockBefore === undefined ? tick() : clockOf(clockBefore) - 1
      ),
    withdraw: (resolutionId) => {
      const withdrawn = resolutions.find(({ id }) => id === resolutionId)
      if (withdrawn === undefined) return
      recordResolutionRow(
        "withdrawal",
        withdrawn.paymentId,
        0,
        presentTransactionIds(),
        resolutionId,
        tick()
      )
    },
    activeResolutionIds: () => {
      const withdrawnIds = new Set(
        resolutions.flatMap(({ withdrawnId }) =>
          withdrawnId === null ? [] : [withdrawnId]
        )
      )
      return resolutions
        .filter(
          ({ id, kind }) => kind !== "withdrawal" && !withdrawnIds.has(id)
        )
        .map(({ id }) => id)
    },
    acknowledge: (paymentId) => {
      const payment = payments.get(paymentId)
      if (payment === undefined || payment.acknowledgement !== null) return
      payment.acknowledgement = {
        clock: tick(),
        known: presentTransactionIds(),
      }
    },
    isAcknowledged: (paymentId) =>
      payments.get(paymentId)?.acknowledgement !== null,
    money: () =>
      transactions
        .filter((tx) => tx.present)
        .reduce((sum, tx) => sum + tx.money, 0),
    held: () =>
      transactions
        .filter((tx) => tx.present)
        .reduce((sum, tx) => sum + tx.money, 0) -
      refunds.reduce((sum, refund) => sum + refund.amount, 0),
    holds: (paymentId) => moneyOf(paymentId) - refundedOf(paymentId),
    refundedGoods: (overpayment) => {
      const returned = new Map(
        overpayment.answers.flatMap((answer) =>
          answer.source.type === "return"
            ? [[answer.source.id, answer.amount] as const]
            : []
        )
      )
      return refunds.reduce(
        (sum, refund) => sum + refund.amount - (returned.get(refund.id) ?? 0),
        0
      )
    },
    reportedGoods: () =>
      [...payments.values()].reduce(
        (sum, payment) => sum + payment.reportedGoods,
        0
      ),
    unreportedMoney: () =>
      deriveUnreportedMoney(input(), reportedGoodsByPayment()),
    eetHolds: () => {
      let reversed = 0
      for (const [paymentId, payment] of payments) {
        let room = payment.reportedGoods
        for (const refund of refunds
          .filter((row) => row.paymentId === paymentId)
          .sort((a, b) => a.clock - b.clock)) {
          const reversal = Math.min(
            refund.amount - refund.withoutDeviceAmount,
            room
          )
          room -= reversal
          reversed += reversal
        }
      }
      return (
        [...payments.values()].reduce(
          (sum, payment) => sum + payment.reportedGoods,
          0
        ) - reversed
      )
    },
    withoutDeviceAmount: (refundId) =>
      refunds.find(({ id }) => id === refundId)?.withoutDeviceAmount ?? 0,
  }
}

export const answeredBy = (
  overpayment: BillOverpayment,
  id: RefundId | OverpaymentResolutionId
): number =>
  overpayment.answers.find(
    (answer) => "id" in answer.source && answer.source.id === id
  )?.answered ?? 0

export const answeredByResolutions = (overpayment: BillOverpayment): number =>
  overpayment.answers
    .filter((answer) => answer.source.type !== "return")
    .reduce((sum, answer) => sum + answer.answered, 0)
