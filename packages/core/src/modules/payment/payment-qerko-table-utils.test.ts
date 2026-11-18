import { createIdFromString } from "@evolu/common"
import { describe, expect, test } from "vitest"

import type { BillId } from "../bill/bill-types.ts"
import type { BillLineSummary } from "../bill-line/bill-line-summary.ts"
import { createBillLineSummaryId } from "../bill-line/bill-line-utils.ts"
import type { ItemLineType } from "../item/item-types.ts"
import {
  Integer,
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
  PositiveInteger,
  PositiveNumber,
} from "../shared/schema.ts"
import {
  checkQerkoTablePaymentStart,
  createQerkoTableBill,
  createQerkoTableList,
  deriveQerkoTableOffer,
} from "./payment-qerko-table-utils.ts"

const billId = createIdFromString<"Bill">("bill-1") as BillId

const summary = (
  name: string,
  totalAmount: number,
  {
    quantity = 1,
    type = "manualAmount",
  }: { readonly quantity?: number; readonly type?: ItemLineType } = {}
): BillLineSummary => {
  const itemId = createIdFromString<"Item">(name)
  return {
    id: createBillLineSummaryId({
      billId,
      catalogItemId: null,
      itemId,
      type,
    }),
    billId,
    catalogItemId: null,
    itemId,
    type,
    name: NonEmptyStringSchema.decode(name),
    description: null,
    currency: "CZK",
    quantity: PositiveNumber(quantity),
    totalAmount: Integer(totalAmount),
    taxRateId: null,
  }
}

const bill = {
  id: billId,
  label: null,
  displayNumber: PositiveInteger(7),
  currency: "CZK" as const,
}

describe("createQerkoTableList", () => {
  test("lists each code once, as the first table that has it", () => {
    expect(
      createQerkoTableList([
        { code: NonEmptyString255("A"), name: NonEmptyString255("Window") },
        { code: NonEmptyString255("B"), name: NonEmptyString255("Bar") },
        { code: NonEmptyString255("A"), name: NonEmptyString255("Copy") },
      ])
    ).toEqual([
      { id: "A", name: "Window" },
      { id: "B", name: "Bar" },
    ])
  })
})

describe("deriveQerkoTableOffer", () => {
  test("offers an unpaid bill's lines, goods before the discount, adding up to the bill", () => {
    const discount = summary("Discount", -1_000)
    const beer = summary("Beer", 12_900)
    const offer = deriveQerkoTableOffer({
      summaries: [discount, beer],
      ledger: [discount, beer],
      claimedSum: 0,
    })

    expect(offer).toMatchObject({
      kind: "lines",
      restAmount: 11_900,
      lines: [{ name: "Beer" }, { name: "Discount" }],
    })
  })

  test("offers a partly paid bill's rest as one amount", () => {
    expect(
      deriveQerkoTableOffer({
        summaries: [summary("Beer", 12_900), summary("Soup", 5_000)],
        ledger: [],
        claimedSum: 5_000,
      })
    ).toEqual({ kind: "rest", restAmount: 12_900 })
  })

  test.each([
    ["no lines", [], 0],
    ["a bill paid off", [summary("Beer", 12_900)], 12_900],
    ["a bill paid above its total", [summary("Beer", 12_900)], 15_000],
    ["a bill of a tip alone", [summary("Tip", 2_000, { type: "tip" })], 0],
    [
      "a bill below zero",
      [summary("Beer", 1_000), summary("Discount", -2_000)],
      0,
    ],
  ])("offers nothing for %s", (_case, summaries, claimedSum) => {
    expect(
      deriveQerkoTableOffer({ summaries, ledger: [], claimedSum })
    ).toBeNull()
  })
})

describe("createQerkoTableBill", () => {
  test("names the bill by its label or number and prices each line at its total", () => {
    const cheese = summary("Cheese", 4_550, { quantity: 0.35 })
    const offer = deriveQerkoTableOffer({
      summaries: [cheese],
      ledger: [cheese],
      claimedSum: 0,
    })
    if (offer === null) throw new Error("no offer")

    expect(createQerkoTableBill({ bill, offer })).toEqual({
      id: billId,
      name: "#7",
      currency: "CZK",
      items: [
        {
          id: cheese.id,
          name: "Cheese (0,35)",
          price: "45.5",
          quantity: "1",
          minQuantity: "0",
        },
      ],
      allowPartialPayment: false,
      allowTip: true,
      denyDiscounts: true,
      denyMenus: true,
    })
    expect(
      createQerkoTableBill({
        bill: { ...bill, label: NonEmptyString255("Anna") },
        offer,
      }).name
    ).toBe("Anna")
  })
})

describe("checkQerkoTablePaymentStart", () => {
  const beer = summary("Beer", 5_000)
  const lemonade = summary("Lemonade", 5_000)
  const offered = createQerkoTableBill({
    bill,
    offer: {
      kind: "lines",
      restAmount: NonNegativeInteger(10_000),
      lines: [
        { ...beer, discountShare: null },
        { ...lemonade, discountShare: null },
      ],
    },
  })

  test("accepts the items offered, in any order, with a tip in none of them", () => {
    expect(
      checkQerkoTablePaymentStart({
        wire: {
          currency: "CZK",
          items: [...offered.items].reverse(),
          discount: { value: "0" },
        },
        offered,
        currency: "CZK",
      })
    ).toBeNull()
  })

  test("refuses another item of the same price", () => {
    const [first] = offered.items
    if (first === undefined) throw new Error("no item")
    expect(
      checkQerkoTablePaymentStart({
        wire: {
          currency: "CZK",
          items: [first, { ...first, id: "other" }],
          discount: null,
        },
        offered,
        currency: "CZK",
      })
    ).toBe("items")
  })

  test("refuses an item at another price", () => {
    expect(
      checkQerkoTablePaymentStart({
        wire: {
          currency: "CZK",
          items: offered.items.map((item) => ({ ...item, price: "49" })),
          discount: null,
        },
        offered,
        currency: "CZK",
      })
    ).toBe("items")
  })
})
