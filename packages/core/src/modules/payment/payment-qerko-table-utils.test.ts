import { createIdFromString } from "@evolu/common"
import { describe, expect, test } from "vitest"

import type { QerkoWirePayment } from "../../integrations/qerko/qerko-rpc.ts"
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
  applyQerkoPaidLines,
  checkQerkoTablePaymentStart,
  createQerkoTableBill,
  createQerkoTableList,
  deriveQerkoTableOffer,
  type QerkoAttemptPaidLines,
  type QerkoTableOffer,
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

const beers = summary("Beer", 15_000, { quantity: 3 })
const soup = summary("Soup", 9_000)
const cheese = summary("Cheese", 4_550, { quantity: 0.35 })
const discount = summary("Discount", -1_000)

const offerOf = (
  summaries: ReadonlyArray<BillLineSummary>,
  {
    claimedSum = 0,
    attempts = [],
  }: {
    readonly claimedSum?: number
    readonly attempts?: ReadonlyArray<QerkoAttemptPaidLines>
  } = {}
) =>
  deriveQerkoTableOffer({
    summaries,
    ledger: summaries,
    claimedSum,
    attempts,
  })

const linesOffer = (
  summaries: ReadonlyArray<BillLineSummary>
): Extract<QerkoTableOffer, { kind: "lines" }> => {
  const offer = offerOf(summaries)
  if (offer?.kind !== "lines") throw new Error("not a lines offer")
  return offer
}

const wire = (
  items: QerkoWirePayment["items"]
): Pick<QerkoWirePayment, "currency" | "items" | "discount"> => ({
  currency: "CZK",
  items,
  discount: null,
})

const check = (offer: QerkoTableOffer, items: QerkoWirePayment["items"]) =>
  checkQerkoTablePaymentStart({
    wire: wire(items),
    offer,
    billId,
    currency: "CZK",
  })

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
  test("offers an unpaid bill's lines, goods before the discount; a bill with a discount is paid whole", () => {
    expect(
      deriveQerkoTableOffer({
        summaries: [discount, soup],
        ledger: [discount, soup],
        claimedSum: 0,
        attempts: [],
      })
    ).toMatchObject({
      kind: "lines",
      splittable: false,
      restAmount: 8_000,
      lines: [{ name: "Soup" }, { name: "Discount" }],
    })
    expect(offerOf([beers, soup])).toMatchObject({
      kind: "lines",
      splittable: true,
    })
  })

  test("offers what is left of each line once Qerko paid part of it", () => {
    expect(
      offerOf([beers, soup], {
        claimedSum: 14_000,
        attempts: [
          {
            paid: true,
            lines: [
              { lineId: beers.id, quantity: 1, amount: 5_000 },
              { lineId: soup.id, quantity: 1, amount: 9_000 },
            ],
          },
        ],
      })
    ).toMatchObject({
      kind: "lines",
      splittable: true,
      restAmount: 10_000,
      lines: [{ id: beers.id, quantity: 2, totalAmount: 10_000 }],
    })
  })

  test("leaves out what an attempt in progress is paying", () => {
    expect(
      offerOf([beers, soup], {
        attempts: [
          {
            paid: false,
            lines: [{ lineId: soup.id, quantity: 1, amount: 9_000 }],
          },
        ],
      })
    ).toMatchObject({ lines: [{ id: beers.id }], restAmount: 15_000 })
  })

  test("offers the rest as one amount once money not tied to lines paid part of it", () => {
    expect(offerOf([beers, soup], { claimedSum: 5_000 })).toEqual({
      kind: "rest",
      restAmount: 19_000,
    })
    expect(
      offerOf([beers, soup], {
        claimedSum: 9_000 + 2_000,
        attempts: [
          {
            paid: true,
            lines: [{ lineId: soup.id, quantity: 1, amount: 9_000 }],
          },
        ],
      })
    ).toEqual({ kind: "rest", restAmount: 13_000 })
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
    expect(offerOf(summaries, { claimedSum })).toBeNull()
  })
})

describe("createQerkoTableBill", () => {
  test("lets the guest pay part of a splittable bill, a whole quantity at a time", () => {
    expect(
      createQerkoTableBill({ bill, offer: linesOffer([beers, cheese]) })
    ).toEqual({
      id: billId,
      name: "#7",
      currency: "CZK",
      items: [
        {
          id: beers.id,
          name: "Beer",
          price: "150",
          quantity: "3",
          minQuantity: "1",
        },
        {
          id: cheese.id,
          name: "Cheese (0,35)",
          price: "45.5",
          quantity: "1",
          minQuantity: "0",
        },
      ],
      allowPartialPayment: true,
      allowTip: true,
      denyDiscounts: true,
      denyMenus: true,
    })
  })

  test("a bill with a discount, or its rest, is paid whole, and a label names it", () => {
    const discounted = createQerkoTableBill({
      bill: { ...bill, label: NonEmptyString255("Anna") },
      offer: linesOffer([beers, discount]),
    })
    expect(discounted).toMatchObject({
      name: "Anna",
      allowPartialPayment: false,
      items: [{ minQuantity: "0" }, { minQuantity: "0" }],
    })
    expect(
      createQerkoTableBill({
        bill,
        offer: { kind: "rest", restAmount: NonNegativeInteger(12_900) },
      })
    ).toMatchObject({
      allowPartialPayment: false,
      items: [{ id: billId, name: "Zbývá zaplatit", price: "129" }],
    })
  })
})

describe("checkQerkoTablePaymentStart", () => {
  const offer = linesOffer([beers, soup, cheese])

  test("pays part of a bill: some lines, part of a line within Qerko's rounding", () => {
    const thirds = linesOffer([summary("Wine", 10_000, { quantity: 3 })])
    const [wine] = thirds.lines
    if (wine === undefined) throw new Error("no line")

    expect(
      check(offer, [
        { id: beers.id, name: "Beer", price: "50", quantity: "1" },
        { id: soup.id, name: "Soup", price: "90", quantity: "1" },
      ])
    ).toEqual({
      ok: true,
      value: {
        amount: 14_000,
        paidLines: [
          { lineId: beers.id, quantity: 1, amount: 5_000 },
          { lineId: soup.id, quantity: 1, amount: 9_000 },
        ],
      },
    })
    for (const price of ["33.33", "33.34"]) {
      expect(
        check(thirds, [{ id: wine.id, name: "Wine", price, quantity: "1" }])
      ).toMatchObject({ ok: true })
    }
  })

  test("pays a fractional line only whole, at its total", () => {
    expect(
      check(offer, [
        { id: cheese.id, name: "Cheese (0,35)", price: "45.5", quantity: "1" },
      ])
    ).toMatchObject({
      ok: true,
      value: { paidLines: [{ lineId: cheese.id, quantity: 0.35 }] },
    })
  })

  test.each<readonly [string, QerkoWirePayment["items"]]>([
    [
      "more than is left of a line",
      [{ id: "beer", name: "Beer", price: "200", quantity: "4" }],
    ],
    [
      "part of a line at another price",
      [{ id: "beer", name: "Beer", price: "45", quantity: "1" }],
    ],
    [
      "a whole line at another price",
      [{ id: "beer", name: "Beer", price: "149", quantity: "3" }],
    ],
    [
      "part of a fractional line",
      [{ id: "cheese", name: "Cheese", price: "20", quantity: "0.15" }],
    ],
    [
      "a line twice",
      [
        { id: "beer", name: "Beer", price: "50", quantity: "1" },
        { id: "beer", name: "Beer", price: "50", quantity: "1" },
      ],
    ],
    ["an unknown line", [{ id: "x", name: "X", price: "50", quantity: "1" }]],
    ["no line", []],
  ])("refuses %s", (_case, items) => {
    const ids: Record<string, string> = { beer: beers.id, cheese: cheese.id }
    expect(
      check(
        offer,
        items.map((item) => ({ ...item, id: ids[item.id ?? ""] ?? item.id }))
      )
    ).toEqual({ ok: false, error: "items" })
  })

  test("refuses part of a bill that is not splittable", () => {
    const discounted = linesOffer([beers, discount])
    expect(
      check(discounted, [
        { id: beers.id, name: "Beer", price: "150", quantity: "3" },
      ])
    ).toEqual({ ok: false, error: "items" })
    expect(
      check(discounted, [
        { id: beers.id, name: "Beer", price: "150", quantity: "3" },
        { id: discount.id, name: "Discount", price: "-10", quantity: "1" },
      ])
    ).toMatchObject({ ok: true, value: { amount: 14_000 } })
  })

  test("pays the rest as its one item", () => {
    const rest: QerkoTableOffer = {
      kind: "rest",
      restAmount: NonNegativeInteger(12_900),
    }
    expect(
      check(rest, [{ id: billId, name: "Zbývá", price: "129", quantity: "1" }])
    ).toEqual({ ok: true, value: { amount: 12_900, paidLines: null } })
    expect(
      check(rest, [{ id: billId, name: "Zbývá", price: "100", quantity: "1" }])
    ).toEqual({ ok: false, error: "items" })
  })

  test("refuses another currency or a discount", () => {
    expect(
      checkQerkoTablePaymentStart({
        wire: { ...wire([]), currency: "EUR" },
        offer,
        billId,
        currency: "CZK",
      })
    ).toEqual({ ok: false, error: "currency" })
    expect(
      checkQerkoTablePaymentStart({
        wire: { ...wire([]), discount: { value: "5" } },
        offer,
        billId,
        currency: "CZK",
      })
    ).toEqual({ ok: false, error: "discount" })
  })
})

describe("applyQerkoPaidLines", () => {
  test("keeps the frozen lines paid, at what Qerko charged, in their order", () => {
    const frozen = [beers, soup].map((line) => ({
      ...line,
      discountShare: null,
    }))
    expect(
      applyQerkoPaidLines(frozen, [
        { lineId: soup.id, quantity: 1, amount: 9_000 },
        { lineId: beers.id, quantity: 2, amount: 10_000 },
      ])
    ).toMatchObject([
      { name: "Beer", quantity: 2, totalAmount: 10_000 },
      { name: "Soup", quantity: 1, totalAmount: 9_000 },
    ])
  })
})
