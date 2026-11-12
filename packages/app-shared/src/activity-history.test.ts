import type { Money } from "@payky/core/modules/shared/money"
import { describe, expect, test } from "vitest"
import {
  type BillHistoryRow,
  billHistoryIssueLabels,
  deriveKeptGoodsCoverage,
  deriveOverpaymentEntry,
  derivePaymentHistoryRowState,
  formatActivityDayTitle,
  hasAnyIssue,
  type PaymentHistoryRow,
  refundBadgeLabels,
  resolvePaymentTitle,
  summarizeBillHistoryRow,
  sumSettledTips,
} from "./activity-history.ts"
import { paykyBrand } from "./brand.ts"
import { formatMoney } from "./format-money.ts"
import { createTranslate } from "./i18n/translate.ts"

const t = createTranslate("en", paykyBrand)
const now = new Date(2026, 9, 17, 12)
const money = (value: Money) => formatMoney(value, "en-US")

/** A pending, bill-less payment; tests override only what they exercise. */
const payment = (overrides: Record<string, unknown> = {}): PaymentHistoryRow =>
  ({
    id: "p1",
    amount: 100,
    canceledAt: null,
    confirmedPaidAt: null,
    expiresAt: null,
    excessAcknowledgedAt: null,
    billId: null,
    billLines: [],
    billItems: [],
    billClaimedTransactions: [],
    ownClaimedTransactions: [],
    ...overrides,
  }) as unknown as PaymentHistoryRow

const claim = (paymentId: string, amount: number, id = "tx1") => ({
  paymentId,
  accountTransactionId: id,
  amount,
  currency: "CZK",
  paymentAmount: amount,
  paymentCurrency: "CZK",
  paymentAmountSats: null,
  tipAmount: 0,
  transactionKind: "cashRegister",
})

const espressoLine = {
  billId: "b1",
  catalogItemId: null,
  itemId: "i1",
  type: "item",
  kind: "add",
  quantity: 3,
  totalAmount: 165,
}
const espresso = {
  id: "i1",
  name: "Espresso",
  description: null,
  currency: "CZK",
  taxRateId: null,
}

describe("derivePaymentHistoryRowState", () => {
  test("a claimed payment is paid, an unclaimed one pending", () => {
    expect(derivePaymentHistoryRowState(payment(), now, false).status).toBe(
      "pending"
    )
    expect(
      derivePaymentHistoryRowState(
        payment({ ownClaimedTransactions: [claim("p1", 100)] }),
        now,
        false
      ).status
    ).toBe("paid")
  })

  test("an expired or canceled payment is void", () => {
    expect(
      derivePaymentHistoryRowState(
        payment({ expiresAt: now.getTime() - 1 }),
        now,
        false
      ).isVoid
    ).toBe(true)
    expect(
      derivePaymentHistoryRowState(payment({ canceledAt: 1 }), now, false)
        .isVoid
    ).toBe(true)
  })

  test("a canceled payment whose money arrived is a collision, not void", () => {
    const state = derivePaymentHistoryRowState(
      payment({ canceledAt: 1, ownClaimedTransactions: [claim("p1", 100)] }),
      now,
      false
    )
    expect(state.status).toBe("canceled")
    expect(state.hasCancellationCollision).toBe(true)
    expect(state.isVoid).toBe(false)
    expect(hasAnyIssue(state.issueFlags)).toBe(true)
  })

  test("a bill-less payment raises no coverage issue", () => {
    expect(
      hasAnyIssue(
        derivePaymentHistoryRowState(payment(), now, false).issueFlags
      )
    ).toBe(false)
  })

  test("a bill with nothing paid yet is not flagged underpaid", () => {
    const flags = derivePaymentHistoryRowState(
      payment({
        billId: "b1",
        billLines: [],
        billClaimedTransactions: [],
      }),
      now,
      false
    ).issueFlags
    expect(flags.billUnderpaid).toBe(false)
    expect(flags.billOverpaid).toBe(false)
  })

  test("an unresolved overpayment flags the bill, or the payment without one", () => {
    const withBill = derivePaymentHistoryRowState(
      payment({ billId: "b1", billClaimedTransactions: [claim("other", 50)] }),
      now,
      true
    ).issueFlags
    expect(withBill.billOverpaid).toBe(true)
    expect(withBill.hasExcessSettlement).toBe(false)

    const withoutBill = derivePaymentHistoryRowState(
      payment(),
      now,
      true
    ).issueFlags
    expect(withoutBill.hasExcessSettlement).toBe(true)
    expect(withoutBill.billOverpaid).toBe(false)
  })

  test("a payment on a canceled bill flags its money overpaid, never the bill underpaid", () => {
    const flagsOf = (billConfirmedClosedAt: number | null) =>
      derivePaymentHistoryRowState(
        payment({
          billId: "b1",
          billCanceledAt: 1,
          billConfirmedClosedAt,
          billLines: [espressoLine],
          billItems: [espresso],
          billClaimedTransactions: [claim("p1", 50)],
        }),
        now,
        billConfirmedClosedAt === null
      ).issueFlags
    expect(flagsOf(null)).toMatchObject({
      billUnderpaid: false,
      billOverpaid: true,
    })
    expect(flagsOf(2)).toMatchObject({
      billUnderpaid: true,
      billOverpaid: false,
    })
  })

  test("a resolved overpayment flags nothing", () => {
    const flags = derivePaymentHistoryRowState(
      payment({ billId: "b1", billClaimedTransactions: [claim("other", 50)] }),
      now,
      false
    ).issueFlags
    expect(flags.billOverpaid).toBe(false)
    expect(flags.hasExcessSettlement).toBe(false)
  })
})

describe("deriveOverpaymentEntry", () => {
  test("a payment without a bill is an entry once its claims exceed its amount", () => {
    expect(
      deriveOverpaymentEntry(
        payment({ ownClaimedTransactions: [claim("p1", 100)] })
      )
    ).toBeNull()
    expect(
      deriveOverpaymentEntry(
        payment({
          ownClaimedTransactions: [
            claim("p1", 100, "a"),
            claim("p1", 100, "b"),
          ],
        })
      )
    ).toEqual({ paymentId: "p1" })
  })

  test("a payment of an overpaid bill is an entry for the bill", () => {
    expect(
      deriveOverpaymentEntry(
        payment({
          billId: "b1",
          billCanceledAt: null,
          billConfirmedClosedAt: null,
          billClaimedTransactions: [claim("p1", 100)],
        })
      )
    ).toEqual({ billId: "b1", billTotal: 0, isCanceled: false })
  })

  test("a canceled bill is marked so, unless it was confirmed closed", () => {
    const entryOf = (billConfirmedClosedAt: number | null) =>
      deriveOverpaymentEntry(
        payment({
          billId: "b1",
          billCanceledAt: 1,
          billConfirmedClosedAt,
          billClaimedTransactions: [claim("p1", 100)],
        })
      )
    expect(entryOf(null)).toMatchObject({ isCanceled: true })
    expect(entryOf(2)).toMatchObject({ isCanceled: false })
  })

  test("a canceled bill keeps no goods, so any money on it is an entry", () => {
    expect(
      deriveOverpaymentEntry(
        payment({
          billId: "b1",
          billCanceledAt: 1,
          billConfirmedClosedAt: null,
          billLines: [espressoLine],
          billItems: [espresso],
          billClaimedTransactions: [claim("p1", 50)],
        })
      )
    ).toEqual({ billId: "b1", billTotal: 165, isCanceled: true })
  })

  test("a bill that is paid or underpaid is no entry", () => {
    expect(
      deriveOverpaymentEntry(
        payment({ billId: "b1", billClaimedTransactions: [] })
      )
    ).toBeNull()
  })
})

describe("resolvePaymentTitle", () => {
  const none = {
    billLabel: null,
    billDisplayNumber: null,
    paymentSerialNumber: null,
  }

  test("prefers the bill label, then number, then payment number", () => {
    expect(
      resolvePaymentTitle({ ...none, billLabel: "Terrace" as never }, t)
    ).toBe("Terrace")
    expect(
      resolvePaymentTitle(
        {
          ...none,
          billDisplayNumber: 7 as never,
          paymentSerialNumber: 3 as never,
        },
        t
      )
    ).toBe(t("bill.list.label", { number: 7 }))
    expect(
      resolvePaymentTitle({ ...none, paymentSerialNumber: 3 as never }, t)
    ).toBe(t("paymentHistory.paymentNumber", { number: 3 }))
    expect(resolvePaymentTitle(none, t)).toBe(t("paymentHistory.payment"))
  })
})

describe("formatActivityDayTitle", () => {
  const amounts = [
    { value: 1000, currency: "CZK" },
    { value: 500, currency: "CZK" },
  ] as never

  test("appends the day total once the group is complete", () => {
    const complete = formatActivityDayTitle({
      date: now,
      now,
      locale: "en-US",
      amounts,
      isComplete: true,
      format: money,
    })
    const incomplete = formatActivityDayTitle({
      date: now,
      now,
      locale: "en-US",
      amounts,
      isComplete: false,
      format: money,
    })
    expect(complete.startsWith(incomplete)).toBe(true)
    expect(complete).toContain("·")
    expect(incomplete).not.toContain("·")
  })

  test("writes the total through the app's own formatter", () => {
    const title = formatActivityDayTitle({
      date: now,
      now,
      locale: "en-US",
      amounts,
      isComplete: true,
      format: (value) =>
        formatMoney(value, "en-US", { fraction: "whenNonZero" }),
    })
    expect(title).toMatch(/CZK\s15$/u)
  })

  test("leaves the total off for a day without paid amounts", () => {
    expect(
      formatActivityDayTitle({
        date: now,
        now,
        locale: "en-US",
        amounts: [],
        isComplete: true,
        format: money,
      })
    ).not.toContain("·")
  })
})

describe("refundBadgeLabels", () => {
  const summary = (
    refundedAmount: number,
    refundableAmount: number,
    returnedAmount = refundedAmount,
    returnedOverpaymentAmount = 0
  ) =>
    ({
      refundedAmount,
      refundableAmount,
      returnedAmount,
      returnedOverpaymentAmount,
      currency: "USD",
    }) as never

  test("is empty for no summary or nothing refunded", () => {
    expect(refundBadgeLabels(undefined, t, money)).toEqual([])
    expect(refundBadgeLabels(summary(0, 100), t, money)).toEqual([])
  })

  test("names a partial and a full refund differently", () => {
    expect(refundBadgeLabels(summary(50, 100), t, money)).toEqual([
      "Partly refunded $0.50",
    ])
    expect(refundBadgeLabels(summary(100, 100), t, money)).toEqual([
      "Refunded $1.00",
    ])
  })

  test("reads a returned overpayment as one, apart from the goods (refund/0015)", () => {
    expect(refundBadgeLabels(summary(400, 1000, 400, 400), t, money)).toEqual([
      "Returned overpayment $4.00",
    ])
    expect(refundBadgeLabels(summary(700, 1000, 700, 500), t, money)).toEqual([
      "Returned overpayment $5.00",
      "Partly refunded $2.00",
    ])
  })

  test("shows every amount given back, the tip included, while its state counts goods", () => {
    // All 50 of the goods and a tip of 5: refunded in full, 55 back.
    const labels = refundBadgeLabels(summary(5_000, 5_000, 5_500), t, money)
    expect(labels).toEqual(refundBadgeLabels(summary(5_500, 5_500), t, money))
    expect(labels.join()).toContain("55")
  })
})

describe("bill history rows", () => {
  const bill = (overrides: Record<string, unknown> = {}): BillHistoryRow =>
    ({
      canceledAt: null,
      confirmedClosedAt: null,
      lines: [],
      items: [],
      claimedTransactions: [],
      ...overrides,
    }) as unknown as BillHistoryRow

  test("an untouched open bill is open and raises no issue", () => {
    const summary = summarizeBillHistoryRow(bill())
    expect(summary.status).toBe("open")
    expect(billHistoryIssueLabels(summary, t, false)).toEqual([])
  })

  test("a canceled bill whose money arrived is flagged, not silently canceled", () => {
    const summary = summarizeBillHistoryRow(
      bill({ canceledAt: 1, claimedTransactions: [claim("p1", 100)] })
    )
    expect(summary.status).toBe("canceled")
    expect(summary.hasCancellationCollision).toBe(true)
    expect(billHistoryIssueLabels(summary, t, false)).toContain(
      t("bill.collision.title")
    )
  })

  test("an overpaid bill is flagged only while some of it is unresolved", () => {
    const summary = summarizeBillHistoryRow(
      bill({ claimedTransactions: [claim("p1", 100)] })
    )
    expect(summary.coverage).toBe("overpaid")
    expect(billHistoryIssueLabels(summary, t, true)).toContain(
      t("billHistory.overpaid")
    )
    expect(billHistoryIssueLabels(summary, t, false)).not.toContain(
      t("billHistory.overpaid")
    )
  })

  test("a canceled bill keeps no goods, so its money reads overpaid, never underpaid", () => {
    const summary = summarizeBillHistoryRow(
      bill({
        canceledAt: 1,
        lines: [espressoLine],
        items: [espresso],
        claimedTransactions: [claim("p1", 50)],
      })
    )
    expect(deriveKeptGoodsCoverage(summary)).toBe("overpaid")
    expect(billHistoryIssueLabels(summary, t, true)).toEqual([
      t("billHistory.overpaid"),
    ])

    const confirmedClosed = summarizeBillHistoryRow(
      bill({
        canceledAt: 1,
        confirmedClosedAt: 2,
        lines: [espressoLine],
        items: [espresso],
        claimedTransactions: [claim("p1", 50)],
      })
    )
    expect(deriveKeptGoodsCoverage(confirmedClosed)).toBe("underpaid")
    expect(billHistoryIssueLabels(confirmedClosed, t, false)).toEqual([
      t("billHistory.underpaid"),
    ])
  })

  test("counts each payment's tip once however many transactions settled it", () => {
    const row = (paymentId: string, tipAmount: number, id: string) => ({
      ...claim(paymentId, 100, id),
      tipAmount,
    })
    expect(
      sumSettledTips({
        claimedTransactions: [
          row("p1", 10, "a"),
          row("p1", 10, "b"),
          row("p2", 5, "c"),
        ] as never,
      })
    ).toBe(15)
  })
})
