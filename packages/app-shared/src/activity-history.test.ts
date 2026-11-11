import type { Money } from "@payky/core/modules/shared/money"
import { describe, expect, test } from "vitest"
import {
  type BillHistoryRow,
  billHistoryIssueLabels,
  derivePaymentHistoryRowState,
  formatActivityDayTitle,
  hasAnyIssue,
  type PaymentHistoryRow,
  refundBadgeLabel,
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

describe("derivePaymentHistoryRowState", () => {
  test("a claimed payment is paid, an unclaimed one pending", () => {
    expect(derivePaymentHistoryRowState(payment(), now).status).toBe("pending")
    expect(
      derivePaymentHistoryRowState(
        payment({ ownClaimedTransactions: [claim("p1", 100)] }),
        now
      ).status
    ).toBe("paid")
  })

  test("an expired or canceled payment is void", () => {
    expect(
      derivePaymentHistoryRowState(
        payment({ expiresAt: now.getTime() - 1 }),
        now
      ).isVoid
    ).toBe(true)
    expect(
      derivePaymentHistoryRowState(payment({ canceledAt: 1 }), now).isVoid
    ).toBe(true)
  })

  test("a canceled payment whose money arrived is a collision, not void", () => {
    const state = derivePaymentHistoryRowState(
      payment({ canceledAt: 1, ownClaimedTransactions: [claim("p1", 100)] }),
      now
    )
    expect(state.status).toBe("canceled")
    expect(state.hasCancellationCollision).toBe(true)
    expect(state.isVoid).toBe(false)
    expect(hasAnyIssue(state.issueFlags)).toBe(true)
  })

  test("a bill-less payment raises no coverage issue", () => {
    expect(
      hasAnyIssue(derivePaymentHistoryRowState(payment(), now).issueFlags)
    ).toBe(false)
  })

  test("a bill with nothing paid yet is not flagged underpaid", () => {
    const flags = derivePaymentHistoryRowState(
      payment({
        billId: "b1",
        billLines: [],
        billClaimedTransactions: [],
      }),
      now
    ).issueFlags
    expect(flags.billUnderpaid).toBe(false)
    expect(flags.billOverpaid).toBe(false)
  })

  test("a bill claimed beyond its (empty) total is overpaid", () => {
    const flags = derivePaymentHistoryRowState(
      payment({
        billId: "b1",
        billClaimedTransactions: [claim("other", 50)],
      }),
      now
    ).issueFlags
    expect(flags.billOverpaid).toBe(true)
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

describe("refundBadgeLabel", () => {
  const summary = (
    refundedAmount: number,
    refundableAmount: number,
    returnedAmount = refundedAmount
  ) =>
    ({
      refundedAmount,
      refundableAmount,
      returnedAmount,
      currency: "CZK",
    }) as never

  test("is empty for no summary or nothing refunded", () => {
    expect(refundBadgeLabel(undefined, t, money)).toBeNull()
    expect(refundBadgeLabel(summary(0, 100), t, money)).toBeNull()
  })

  test("names a partial and a full refund differently", () => {
    const partial = refundBadgeLabel(summary(50, 100), t, money)
    const full = refundBadgeLabel(summary(100, 100), t, money)
    expect(partial).not.toBeNull()
    expect(full).not.toBeNull()
    expect(partial).not.toBe(full)
  })

  test("shows every amount given back, the tip included, while its state counts goods", () => {
    // All 50 of the goods and a tip of 5: refunded in full, 55 back.
    const label = refundBadgeLabel(summary(5_000, 5_000, 5_500), t, money)
    expect(label).toBe(refundBadgeLabel(summary(5_500, 5_500), t, money))
    expect(label).toContain("55")
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
    expect(billHistoryIssueLabels(summary, t)).toEqual([])
  })

  test("a canceled bill whose money arrived is flagged, not silently canceled", () => {
    const summary = summarizeBillHistoryRow(
      bill({ canceledAt: 1, claimedTransactions: [claim("p1", 100)] })
    )
    expect(summary.status).toBe("canceled")
    expect(summary.hasCancellationCollision).toBe(true)
    expect(billHistoryIssueLabels(summary, t)).toContain(
      t("bill.collision.title")
    )
  })

  test("a bill closed without payment that another device added a line to stays closed and is flagged underpaid", () => {
    // Closed with "Finish" at zero, then a device that had not seen the
    // closing added a coffee for 59.
    const summary = summarizeBillHistoryRow(
      bill({
        confirmedClosedAt: 1,
        lines: [
          {
            billId: "b1",
            catalogItemId: null,
            itemId: "coffee",
            type: "catalogItem",
            kind: "add",
            quantity: 1,
            totalAmount: 5_900,
          },
        ],
        items: [
          {
            id: "coffee",
            name: "Coffee",
            description: null,
            currency: "CZK",
            taxRateId: null,
          },
        ],
      })
    )
    expect(summary.status).toBe("closed")
    expect(summary.coverage).toBe("underpaid")
    expect(billHistoryIssueLabels(summary, t)).toEqual([
      t("billHistory.underpaid"),
    ])
  })

  test("a bill closed without payment at zero raises no issue", () => {
    const summary = summarizeBillHistoryRow(bill({ confirmedClosedAt: 1 }))
    expect(summary.status).toBe("closed")
    expect(billHistoryIssueLabels(summary, t)).toEqual([])
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
