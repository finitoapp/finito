import { describe, expect, test } from "vitest"

import type { TaxRecapRow } from "../bill-line/bill-line-tax-utils.ts"
import { decimalAmountToMinorUnits } from "../shared/money.ts"
import { NonNegativeInteger, TimestampMsSchema } from "../shared/schema.ts"
import { TaxRatePercentage } from "../tax-rate/tax-rate-types.ts"
import {
  classifyQerkoPaymentState,
  createQerkoReceipt,
  deriveQerkoPaymentAttemptState,
} from "./payment-qerko-payment-utils.ts"

const recapRow = (
  ratePercentage: number,
  baseAmount: number,
  taxAmount: number
): TaxRecapRow => ({
  taxRateId: null,
  name: null,
  ratePercentage: TaxRatePercentage(ratePercentage),
  baseAmount,
  taxAmount,
  grossAmount: baseAmount + taxAmount,
})

/** Qerko cancels a payment whose receipt's base and tax miss its total. */
const taxTotal = (receipt: ReturnType<typeof createQerkoReceipt>): number =>
  receipt.taxInfo.reduce(
    (sum, row) =>
      sum +
      (decimalAmountToMinorUnits({ currency: "CZK", value: row.base }) ?? 0) +
      (decimalAmountToMinorUnits({ currency: "CZK", value: row.tax }) ?? 0),
    0
  )

describe("createQerkoReceipt", () => {
  test("uses the bill's VAT lines when they cover the payment", () => {
    const receipt = createQerkoReceipt({
      serialNumber: 7,
      amount: NonNegativeInteger(22_100),
      currency: "CZK",
      taxRecap: [recapRow(2100, 10_000, 2_100), recapRow(1200, 8_929, 1_071)],
    })

    expect(receipt.items).toEqual([
      { name: "Platba #7", quantity: "1", price: "221" },
    ])
    expect(receipt.taxInfo).toEqual([
      { rate: "21", base: "100", tax: "21" },
      { rate: "12", base: "89.29", tax: "10.71" },
    ])
    expect(taxTotal(receipt)).toBe(22_100)
  })

  test("puts a tip on top of the lines at 0 %", () => {
    const receipt = createQerkoReceipt({
      serialNumber: 7,
      amount: NonNegativeInteger(13_100),
      currency: "CZK",
      taxRecap: [recapRow(2100, 10_000, 2_100)],
    })

    expect(receipt.taxInfo.at(-1)).toEqual({ rate: "0", base: "10", tax: "0" })
    expect(taxTotal(receipt)).toBe(13_100)
  })

  test.each([
    ["no lines", []],
    ["part of the bill", [recapRow(2100, 10_000, 2_100)]],
  ])("is one 0 %% line for %s", (_case, taxRecap) => {
    const receipt = createQerkoReceipt({
      serialNumber: null,
      amount: NonNegativeInteger(5_000),
      currency: "CZK",
      taxRecap,
    })

    expect(receipt.items[0]?.name).toBe("Platba")
    expect(receipt.taxInfo).toEqual([{ rate: "0", base: "50", tax: "0" }])
  })
})

describe("Qerko payment states", () => {
  test.each([
    ["STARTED", "ongoing"],
    ["PROCESSING", "ongoing"],
    ["AUTHORIZED", "ongoing"],
    ["PAID", "paid"],
    ["CANCELLED", "failed"],
    ["ERROR", "failed"],
    ["ANYTHING_ELSE", "failed"],
  ])("%s is %s", (state, outcome) => {
    expect(classifyQerkoPaymentState(state)).toBe(outcome)
  })

  test("an attempt reads from its write-once columns", () => {
    expect(
      deriveQerkoPaymentAttemptState({ processingAt: null, outcome: null })
    ).toBe("started")
    expect(
      deriveQerkoPaymentAttemptState({
        processingAt: TimestampMsSchema.decode(1),
        outcome: null,
      })
    ).toBe("processing")
    expect(
      deriveQerkoPaymentAttemptState({ processingAt: null, outcome: "paid" })
    ).toBe("paid")
  })
})
