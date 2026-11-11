import type { AccountKind } from "@payky/core/modules/account/account-types"
import type { PaymentMethodAccount } from "@payky/core/modules/account/account-utils"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import type { BillLineSummary } from "@payky/core/modules/bill-line/bill-line-summary"
import type { BillLineSummaryId } from "@payky/core/modules/bill-line/bill-line-types"
import type { ItemId } from "@payky/core/modules/item/item-types"
import { SparkSecret } from "@payky/core/modules/shared/key-derivation"
import {
  type FiatCurrency,
  IbanSchema,
  Integer,
  NonEmptyString255,
  PositiveNumber,
} from "@payky/core/modules/shared/schema"
import { describe, expect, test } from "vitest"
import {
  billCheckoutHintKeys,
  cartWriteErrorKeys,
  deriveBillCheckout,
  markCashPaidErrorKeys,
} from "./bill-checkout.ts"

const line = (
  itemId: string,
  totalAmount: number,
  type: BillLineSummary["type"] = "catalogItem"
): BillLineSummary => ({
  id: `summary-${itemId}` as BillLineSummaryId,
  billId: "bill-1" as BillId,
  catalogItemId: null,
  itemId: itemId as ItemId,
  type,
  name: NonEmptyString255(itemId),
  description: null,
  currency: "CZK",
  quantity: PositiveNumber(1),
  totalAmount: Integer(totalAmount),
  taxRateId: null,
})

/** An account of `kind` turned on, set up in `currency`. */
const account = (
  kind: AccountKind,
  currency: FiatCurrency = "CZK"
): PaymentMethodAccount => ({
  kind,
  sparkSecret:
    kind === "spark" ? SparkSecret("42373a7543db65ae0228ead6c9cbffcc") : null,
  iban: kind === "iban" ? IbanSchema.decode("CZ6508000000192000145399") : null,
  ibanCurrency: kind === "iban" ? currency : null,
  cashRegisterCurrency: kind === "cashRegister" ? currency : null,
  cardCurrency: kind === "cardSwitchio" ? currency : null,
  qerkoTerminalCurrency: kind === "qerkoTerminal" ? currency : null,
  qerkoPaymentCurrency: kind === "qerkoPayment" ? currency : null,
  lightningAddress:
    kind === "lightningAddress" ? NonEmptyString255("cafe@example.com") : null,
})

describe("deriveBillCheckout", () => {
  const checkout = (
    summaries: ReadonlyArray<BillLineSummary>,
    paymentAccounts: ReadonlyArray<PaymentMethodAccount> = [
      account("cashRegister"),
      account("iban"),
    ]
  ) =>
    deriveBillCheckout({
      summaries,
      currency: "CZK",
      paymentAccounts,
      cardTerminalLinked: true,
      qerkoRestaurantPaired: true,
    })

  test("offers Finish in Charge's place for a bill whose goods come to exactly zero", () => {
    expect(checkout([line("water", 0)])).toBe("finish")
    expect(checkout([line("water", 0), line("bread", 0)])).toBe("finish")
  })

  test("charges a bill with a free item and a positive total, and a bill too small for cash", () => {
    expect(checkout([line("water", 0), line("coffee", 5900)])).toBe("charge")
    // Cash is refused on the payment screen, not here: a card takes it.
    expect(checkout([line("candy", 40)])).toBe("charge")
  })

  test("keeps Charge disabled, with a hint, where no payment method turned on can take the bill", () => {
    // A cash-only shop cannot take a bill cash rounds to nothing.
    const cash = account("cashRegister")
    expect(checkout([line("candy", 40)], [cash])).toBe("noPayableMethod")
    expect(checkout([line("candy", 50)], [cash])).toBe("charge")
    expect(checkout([line("candy", 40)], [cash, account("spark")])).toBe(
      "charge"
    )
    // A method in another currency is not offered, so it does not help.
    expect(
      checkout([line("candy", 40)], [cash, account("cardSwitchio", "EUR")])
    ).toBe("noPayableMethod")
    // With no method turned on the payment screen says what is missing.
    expect(checkout([line("candy", 40)], [])).toBe("charge")
    expect(billCheckoutHintKeys.noPayableMethod).toBe("bill.noPayableMethod")
  })

  test("counts the card terminal and Qerko payments only where the payment screen will show them", () => {
    const accounts = [
      account("cashRegister"),
      account("cardSwitchio"),
      account("qerkoPayment"),
    ]
    const judge = (
      cardTerminalLinked: boolean,
      qerkoRestaurantPaired: boolean
    ) =>
      deriveBillCheckout({
        summaries: [line("candy", 40)],
        currency: "CZK",
        paymentAccounts: accounts,
        cardTerminalLinked,
        qerkoRestaurantPaired,
      })
    // A browser without a paired Qerko restaurant shows only cash.
    expect(judge(false, false)).toBe("noPayableMethod")
    expect(judge(true, false)).toBe("charge")
    expect(judge(false, true)).toBe("charge")
  })

  test("offers neither for an empty bill, nor for goods of zero beside a tip", () => {
    expect(checkout([])).toBe("empty")
    expect(checkout([line("water", 0), line("tip", 500, "tip")])).toBe(
      "notPayable"
    )
    // Charge stays disabled with a hint that the tip is in the way.
    expect(billCheckoutHintKeys.notPayable).toBe("bill.notPayable")
    expect(billCheckoutHintKeys.empty).toBeNull()
  })

  test("keeps Charge disabled on a bill below zero, which can only be discarded", () => {
    expect(checkout([line("coffee", 1_000), line("discount", -1_500)])).toBe(
      "negative"
    )
    // A tip does not lift it: the goods are what is judged.
    expect(
      checkout([
        line("coffee", 1_000),
        line("discount", -1_500),
        line("tip", 5_000, "tip"),
      ])
    ).toBe("negative")
    // A discount down to exactly zero is finished instead.
    expect(checkout([line("coffee", 1_000), line("discount", -1_000)])).toBe(
      "finish"
    )
  })
})

describe("markCashPaidErrorKeys", () => {
  test("says why cash cannot settle a payment it rounds to nothing, rather than to try again", () => {
    expect(markCashPaidErrorKeys.CashAmountRoundsToZero).toBe(
      "paymentWait.cashPaid.notPayable"
    )
    expect(markCashPaidErrorKeys.PaymentCanceled).toBe(
      "paymentWait.cashPaid.error"
    )
  })
})

describe("cartWriteErrorKeys", () => {
  test("tells staff a partly paid bill cannot drop below what was paid, rather than to try again", () => {
    expect(cartWriteErrorKeys.BillTotalBelowPaid).toBe("bill.totalBelowPaid")
    expect(cartWriteErrorKeys.BillLocked).toBe("bill.locked")
  })
})
