import { createIdFromString } from "@evolu/common"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import type { Money } from "@payky/core/modules/shared/money"
import { NonNegativeInteger } from "@payky/core/modules/shared/schema"
import { describe, expect, test } from "vitest"
import { paykyBrand } from "./brand.ts"
import { formatMoney } from "./format-money.ts"
import {
  announceGuestMoney,
  guestMoneyArrivalMessage,
} from "./guest-money-arrival.ts"
import { createTranslate } from "./i18n/translate.ts"

const paymentId = (name: string): PaymentId =>
  createIdFromString<"Payment">(name)

const guestPayment = (name: string, amount: number, tipAmount = 0) => ({
  id: paymentId(name),
  amount: NonNegativeInteger(amount),
  tipAmount: NonNegativeInteger(tipAmount),
  selfPayId: paymentId(name),
  claimedTransactions: [{ kind: "iban" as const }],
})

const open = { status: "open" as const, amountDue: NonNegativeInteger(18000) }

const formatEnUs = (money: Money) => formatMoney(money, "en-US")

describe("announceGuestMoney", () => {
  test("does not announce guest money already there at the first look", () => {
    expect(announceGuestMoney(null, [guestPayment("g1", 12000)], open)).toEqual(
      {
        announced: new Set([paymentId("g1")]),
        arrival: undefined,
      }
    )
  })

  test("announces what guests paid since, without their tip, and what is left", () => {
    expect(
      announceGuestMoney(
        new Set([paymentId("g1")]),
        [guestPayment("g1", 12000), guestPayment("g2", 5500, 500)],
        open
      )
    ).toEqual({
      announced: new Set([paymentId("g1"), paymentId("g2")]),
      arrival: {
        type: "arrived",
        paid: NonNegativeInteger(5000),
        remaining: NonNegativeInteger(18000),
      },
    })
  })

  test("says guests paid the bill when their money closed it", () => {
    expect(
      announceGuestMoney(new Set(), [guestPayment("g1", 30000)], {
        status: "closed",
        amountDue: NonNegativeInteger(0),
      }).arrival
    ).toEqual({ type: "closed" })
  })

  test("ignores staff payments, unclaimed guest payments and a canceled bill", () => {
    const staffPayment = { ...guestPayment("s1", 1000), selfPayId: null }
    const unclaimed = { ...guestPayment("g1", 1000), claimedTransactions: [] }

    expect(
      announceGuestMoney(new Set(), [staffPayment, unclaimed], open)
    ).toEqual({ announced: new Set(), arrival: undefined })
    expect(
      announceGuestMoney(new Set(), [guestPayment("g2", 1000)], {
        status: "canceled",
        amountDue: NonNegativeInteger(0),
      }).arrival
    ).toBeUndefined()
  })
})

describe("guestMoneyArrivalMessage", () => {
  const t = createTranslate("en", paykyBrand)

  test("names what guests paid and what is left", () => {
    expect(
      guestMoneyArrivalMessage(
        {
          type: "arrived",
          paid: NonNegativeInteger(5000),
          remaining: NonNegativeInteger(18000),
        },
        "EUR",
        t,
        formatEnUs
      )
    ).toBe("Guests paid €50.00 · €180.00 left")
    expect(
      guestMoneyArrivalMessage({ type: "closed" }, "EUR", t, formatEnUs)
    ).toBe("Guests paid this bill")
  })
})
