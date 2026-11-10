import { describe, expect, test } from "vitest"
import type { AccountTransactionId } from "../account-transaction/account-transaction-types.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import type { Currency } from "../shared/schema.ts"
import { NonNegativeInteger, TimestampMs } from "../shared/schema.ts"
import {
  type ClaimedTransaction,
  calculateClaimedSum,
  claimedPaymentIdSet,
  deriveBillCoverage,
  deriveBillHistoryItemSummary,
  deriveBillStatus,
  hasPendingPayment,
} from "./bill-utils.ts"

const now = new Date("2026-06-05T12:00:00.000Z")

/**
 * A claimed transaction in the payment's own currency — the ordinary
 * cash/IBAN shape, where no conversion applies. Cross-currency cases below
 * override `currency`/`paymentAmountSats` explicitly.
 */
const claimed = (fields: {
  readonly paymentId: string
  readonly accountTransactionId: string
  readonly amount: number
  readonly tipAmount?: number
  readonly currency?: Currency
  readonly paymentAmount?: number
  readonly paymentAmountSats?: number | null
}): ClaimedTransaction => ({
  paymentId: fields.paymentId as PaymentId,
  accountTransactionId: fields.accountTransactionId as AccountTransactionId,
  amount: fields.amount,
  currency: fields.currency ?? "CZK",
  tipAmount: NonNegativeInteger(fields.tipAmount ?? 0),
  paymentAmount: NonNegativeInteger(fields.paymentAmount ?? fields.amount),
  paymentCurrency: "CZK",
  paymentAmountSats:
    fields.paymentAmountSats === null || fields.paymentAmountSats === undefined
      ? null
      : NonNegativeInteger(fields.paymentAmountSats),
})

describe("deriveBillStatus", () => {
  test("open when nothing else applies", () => {
    expect(
      deriveBillStatus({
        canceledAt: null,
        confirmedClosedAt: null,
        hasActiveClaim: false,
        coverage: "underpaid",
      })
    ).toBe("open")
  })

  test("open when coverage is trivially 'paid' but no claim has ever landed — the fresh-empty-cart guard", () => {
    // A brand-new bill with no line items yet has billTotal === claimedSum
    // === 0, which `deriveBillCoverage` calls "paid" — but with zero
    // payments, that must not read as `closed`. See the doc comment above
    // `deriveBillStatus` and docs/bill-payment-states.md.
    expect(
      deriveBillStatus({
        canceledAt: null,
        confirmedClosedAt: null,
        hasActiveClaim: false,
        coverage: "paid",
      })
    ).toBe("open")
  })

  test("closed when a claim exists and coverage is paid", () => {
    expect(
      deriveBillStatus({
        canceledAt: null,
        confirmedClosedAt: null,
        hasActiveClaim: true,
        coverage: "paid",
      })
    ).toBe("closed")
  })

  test("closed when a claim exists and coverage is overpaid", () => {
    expect(
      deriveBillStatus({
        canceledAt: null,
        confirmedClosedAt: null,
        hasActiveClaim: true,
        coverage: "overpaid",
      })
    ).toBe("closed")
  })

  test("open when a claim exists but coverage is still underpaid — a split/partial payment", () => {
    expect(
      deriveBillStatus({
        canceledAt: null,
        confirmedClosedAt: null,
        hasActiveClaim: true,
        coverage: "underpaid",
      })
    ).toBe("open")
  })

  test("canceled outranks closed-by-coverage — an explicit discard wins the display", () => {
    expect(
      deriveBillStatus({
        canceledAt: TimestampMs(now.getTime() - 1_000),
        confirmedClosedAt: null,
        hasActiveClaim: true,
        coverage: "paid",
      })
    ).toBe("canceled")
  })

  test("canceled when nothing has been claimed either", () => {
    expect(
      deriveBillStatus({
        canceledAt: TimestampMs(now.getTime() - 1_000),
        confirmedClosedAt: null,
        hasActiveClaim: false,
        coverage: "underpaid",
      })
    ).toBe("canceled")
  })

  test("confirmedClosedAt outranks canceled — staff resolving the cancel+funded collision wins the display", () => {
    expect(
      deriveBillStatus({
        canceledAt: TimestampMs(now.getTime() - 1_000),
        confirmedClosedAt: TimestampMs(now.getTime() - 1),
        hasActiveClaim: true,
        coverage: "paid",
      })
    ).toBe("closed")
  })

  test("confirmedClosedAt outranks canceled even for an overpaid bill", () => {
    expect(
      deriveBillStatus({
        canceledAt: TimestampMs(now.getTime() - 1_000),
        confirmedClosedAt: TimestampMs(now.getTime() - 1),
        hasActiveClaim: true,
        coverage: "overpaid",
      })
    ).toBe("closed")
  })
})

describe("deriveBillCoverage", () => {
  test("paid when the claimed sum matches the total exactly", () => {
    expect(
      deriveBillCoverage(NonNegativeInteger(1_000), NonNegativeInteger(1_000))
    ).toBe("paid")
  })

  test("paid when the total is zero and nothing was claimed", () => {
    expect(
      deriveBillCoverage(NonNegativeInteger(0), NonNegativeInteger(0))
    ).toBe("paid")
  })

  test("underpaid when the claimed sum is below the total, including zero", () => {
    expect(
      deriveBillCoverage(NonNegativeInteger(1_000), NonNegativeInteger(0))
    ).toBe("underpaid")
    expect(
      deriveBillCoverage(NonNegativeInteger(1_000), NonNegativeInteger(400))
    ).toBe("underpaid")
  })

  test("overpaid when the claimed sum exceeds the total", () => {
    expect(
      deriveBillCoverage(NonNegativeInteger(1_000), NonNegativeInteger(1_500))
    ).toBe("overpaid")
  })
})

describe("calculateClaimedSum", () => {
  test("sums amount minus tip across payments", () => {
    expect(
      calculateClaimedSum([
        claimed({
          paymentId: "payment-1",
          accountTransactionId: "tx-1",
          amount: 1_000,
        }),
        claimed({
          paymentId: "payment-2",
          accountTransactionId: "tx-2",
          amount: 2_500,
          tipAmount: 500,
        }),
      ])
    ).toBe(3_000)
  })

  test("deduplicates a transaction claimed more than once for the same payment", () => {
    expect(
      calculateClaimedSum([
        claimed({
          paymentId: "payment-1",
          accountTransactionId: "tx-1",
          amount: 1_000,
        }),
        claimed({
          paymentId: "payment-1",
          accountTransactionId: "tx-1",
          amount: 1_000,
        }),
      ])
    ).toBe(1_000)
  })

  test("sums two distinct transactions claimed for the same payment (a genuine split, or a duplicate-settlement collision)", () => {
    expect(
      calculateClaimedSum([
        claimed({
          paymentId: "payment-1",
          accountTransactionId: "tx-cash",
          amount: 1_000,
        }),
        claimed({
          paymentId: "payment-1",
          accountTransactionId: "tx-lightning",
          amount: 1_000,
        }),
      ])
    ).toBe(2_000)
  })

  test("subtracts tip only once per payment across its distinct transactions", () => {
    expect(
      calculateClaimedSum([
        claimed({
          paymentId: "payment-1",
          accountTransactionId: "tx-cash",
          amount: 600,
          tipAmount: 100,
        }),
        claimed({
          paymentId: "payment-1",
          accountTransactionId: "tx-lightning",
          amount: 400,
          tipAmount: 100,
        }),
      ])
    ).toBe(900)
  })

  test("floors a payment whose transactions fall short of its tip at zero", () => {
    // A partial, incomplete split: 100 arrived against a payment carrying a
    // 500 tip. Without the floor this payment would contribute -400 and eat
    // into what other payments legitimately covered.
    expect(
      calculateClaimedSum([
        claimed({
          paymentId: "payment-short",
          accountTransactionId: "tx-partial",
          amount: 100,
          tipAmount: 500,
        }),
        claimed({
          paymentId: "payment-full",
          accountTransactionId: "tx-full",
          amount: 1_000,
        }),
      ])
    ).toBe(1_000)
  })

  test("subtracts the largest tip when a payment's rows disagree about it", () => {
    // Every row of a payment carries that payment's own `tipAmount`, joined
    // from the same `payment` row, so this cannot happen through either
    // current query. Nothing enforces it though, and picking whichever row
    // happened to be read last is a coin flip in one of two directions: too
    // small a tip inflates the claimed sum, and an inflated sum can read a
    // bill as covered while money is still missing. The larger tip is the
    // conservative choice — it can only leave a bill looking *less* covered,
    // which staff notice, rather than closing one that was not paid.
    expect(
      calculateClaimedSum([
        claimed({
          paymentId: "payment-1",
          accountTransactionId: "tx-a",
          amount: 600,
          tipAmount: 300,
        }),
        claimed({
          paymentId: "payment-1",
          accountTransactionId: "tx-b",
          amount: 400,
          tipAmount: 100,
        }),
      ])
    ).toBe(700)
  })

  test("returns zero for no claimed transactions", () => {
    expect(calculateClaimedSum([])).toBe(0)
  })

  test("converts a satoshi settlement into the payment's fiat amount", () => {
    // The 129.00 CZK bill paid by an 8 600-sat Lightning invoice. Summed raw,
    // this read as 8 600 minor units against a 12 900 total and left the bill
    // underpaid — and uneditable — forever.
    expect(
      calculateClaimedSum([
        claimed({
          paymentId: "payment-1",
          accountTransactionId: "tx-lightning",
          amount: 8_600,
          currency: "BTC",
          paymentAmount: 12_900,
          paymentAmountSats: 8_600,
        }),
      ])
    ).toBe(12_900)
  })

  test("subtracts the tip from a converted satoshi settlement", () => {
    expect(
      calculateClaimedSum([
        claimed({
          paymentId: "payment-1",
          accountTransactionId: "tx-lightning",
          amount: 8_600,
          currency: "BTC",
          tipAmount: 900,
          paymentAmount: 12_900,
          paymentAmountSats: 8_600,
        }),
      ])
    ).toBe(12_000)
  })

  test("scales a partial satoshi settlement instead of crediting the whole payment", () => {
    // Half the satoshis the invoice asked for is half the fiat, not a paid
    // bill — substituting `payment.amount` whenever the currency differs
    // would close this one.
    expect(
      calculateClaimedSum([
        claimed({
          paymentId: "payment-1",
          accountTransactionId: "tx-lightning",
          amount: 4_300,
          currency: "BTC",
          paymentAmount: 12_900,
          paymentAmountSats: 8_600,
        }),
      ])
    ).toBe(6_450)
  })

  test("counts two satoshi settlements on one payment separately", () => {
    // The duplicate-settlement collision on the Lightning path: two devices
    // each settle the same invoice. Both are real money, so the bill reads
    // overpaid — crediting `payment.amount` per row would say the same, but
    // for the wrong reason, and would say it for a half-sized pair too.
    expect(
      calculateClaimedSum([
        claimed({
          paymentId: "payment-1",
          accountTransactionId: "tx-first",
          amount: 8_600,
          currency: "BTC",
          paymentAmount: 12_900,
          paymentAmountSats: 8_600,
        }),
        claimed({
          paymentId: "payment-1",
          accountTransactionId: "tx-second",
          amount: 8_600,
          currency: "BTC",
          paymentAmount: 12_900,
          paymentAmountSats: 8_600,
        }),
      ])
    ).toBe(25_800)
  })

  test("counts nothing for a foreign-currency transaction with no rate to convert by", () => {
    // Only a manual claim can produce this. Counting zero leaves the bill
    // underpaid and visible to staff; inventing a rate would close it on a
    // number nobody computed.
    expect(
      calculateClaimedSum([
        claimed({
          paymentId: "payment-1",
          accountTransactionId: "tx-lightning",
          amount: 8_600,
          currency: "BTC",
          paymentAmount: 12_900,
          paymentAmountSats: null,
        }),
      ])
    ).toBe(0)
  })
})

describe("hasPendingPayment", () => {
  const now = new Date("2026-06-05T12:00:00.000Z")

  test("false when there are no payments", () => {
    expect(hasPendingPayment([], new Set(), now)).toBe(false)
  })

  test("true when a payment is neither canceled, claimed, nor expired", () => {
    expect(
      hasPendingPayment(
        [{ id: "payment-1" as PaymentId, canceledAt: null, expiresAt: null }],
        new Set(),
        now
      )
    ).toBe(true)
  })

  test("false when the only payment is canceled", () => {
    expect(
      hasPendingPayment(
        [
          {
            id: "payment-1" as PaymentId,
            canceledAt: TimestampMs(now.getTime() - 1_000),
            expiresAt: null,
          },
        ],
        new Set(),
        now
      )
    ).toBe(false)
  })

  test("false when the only payment is already claimed (paid)", () => {
    expect(
      hasPendingPayment(
        [{ id: "payment-1" as PaymentId, canceledAt: null, expiresAt: null }],
        new Set(["payment-1" as PaymentId]),
        now
      )
    ).toBe(false)
  })

  test("false when the only payment has expired", () => {
    expect(
      hasPendingPayment(
        [
          {
            id: "payment-1" as PaymentId,
            canceledAt: null,
            expiresAt: TimestampMs(now.getTime() - 1),
          },
        ],
        new Set(),
        now
      )
    ).toBe(false)
  })

  test("true when at least one of several payments is still pending", () => {
    expect(
      hasPendingPayment(
        [
          {
            id: "payment-1" as PaymentId,
            canceledAt: TimestampMs(now.getTime() - 1_000),
            expiresAt: null,
          },
          { id: "payment-2" as PaymentId, canceledAt: null, expiresAt: null },
        ],
        new Set(),
        now
      )
    ).toBe(true)
  })
})

describe("deriveBillHistoryItemSummary", () => {
  test("open, no collision, for a fresh bill with nothing claimed", () => {
    expect(
      deriveBillHistoryItemSummary({
        canceledAt: null,
        confirmedClosedAt: null,
        billTotal: NonNegativeInteger(1_000),
        claimedTransactions: [],
      })
    ).toEqual({
      status: "open",
      hasCancellationCollision: false,
      billTotal: 1_000,
      claimedSum: 0,
      amountDue: 1_000,
      coverage: "underpaid",
    })
  })

  test("closed once claims cover the total", () => {
    expect(
      deriveBillHistoryItemSummary({
        canceledAt: null,
        confirmedClosedAt: null,
        billTotal: NonNegativeInteger(1_000),
        claimedTransactions: [
          claimed({
            paymentId: "payment-1",
            accountTransactionId: "tx-1",
            amount: 1_000,
          }),
        ],
      })
    ).toEqual({
      status: "closed",
      hasCancellationCollision: false,
      billTotal: 1_000,
      claimedSum: 1_000,
      amountDue: 0,
      coverage: "paid",
    })
  })

  test("leaves what the claims have not paid due", () => {
    const summary = deriveBillHistoryItemSummary({
      canceledAt: null,
      confirmedClosedAt: null,
      billTotal: NonNegativeInteger(1_000),
      claimedTransactions: [
        claimed({
          paymentId: "payment-1",
          accountTransactionId: "tx-1",
          amount: 300,
        }),
      ],
    })

    expect(summary.claimedSum).toBe(300)
    expect(summary.amountDue).toBe(700)
  })

  test("leaves nothing due on an overpaid bill", () => {
    const summary = deriveBillHistoryItemSummary({
      canceledAt: null,
      confirmedClosedAt: null,
      billTotal: NonNegativeInteger(1_000),
      claimedTransactions: [
        claimed({
          paymentId: "payment-1",
          accountTransactionId: "tx-1",
          amount: 1_200,
        }),
      ],
    })

    expect(summary.coverage).toBe("overpaid")
    expect(summary.amountDue).toBe(0)
  })

  test("flags the canceled+funded collision: canceled but already covered by a claim", () => {
    const summary = deriveBillHistoryItemSummary({
      canceledAt: TimestampMs(now.getTime() - 1_000),
      confirmedClosedAt: null,
      billTotal: NonNegativeInteger(1_000),
      claimedTransactions: [
        claimed({
          paymentId: "payment-1",
          accountTransactionId: "tx-1",
          amount: 1_000,
        }),
      ],
    })

    expect(summary.status).toBe("canceled")
    expect(summary.hasCancellationCollision).toBe(true)
  })

  test("no collision flag once staff confirms the bill closed despite the cancellation", () => {
    const summary = deriveBillHistoryItemSummary({
      canceledAt: TimestampMs(now.getTime() - 1_000),
      confirmedClosedAt: TimestampMs(now.getTime() - 1),
      billTotal: NonNegativeInteger(1_000),
      claimedTransactions: [
        claimed({
          paymentId: "payment-1",
          accountTransactionId: "tx-1",
          amount: 1_000,
        }),
      ],
    })

    expect(summary.status).toBe("closed")
    expect(summary.hasCancellationCollision).toBe(false)
  })
})

describe("claimedPaymentIdSet", () => {
  test("returns the set of claimed payment ids, deduplicated", () => {
    // Keyed on `paymentId`: these are claimed *transaction* rows, and one
    // payment can carry several of them.
    const set = claimedPaymentIdSet([
      { paymentId: "payment-1" as PaymentId },
      { paymentId: "payment-2" as PaymentId },
      { paymentId: "payment-1" as PaymentId },
    ])

    expect(set.has("payment-1" as PaymentId)).toBe(true)
    expect(set.has("payment-2" as PaymentId)).toBe(true)
    expect(set.has("payment-3" as PaymentId)).toBe(false)
    expect(set.size).toBe(2)
  })

  test("returns an empty set for no claimed payments", () => {
    expect(claimedPaymentIdSet([]).size).toBe(0)
  })
})
