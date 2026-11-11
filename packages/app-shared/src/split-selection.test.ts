import type { BillId } from "@payky/core/modules/bill/bill-types"
import type { BillLineSummary } from "@payky/core/modules/bill-line/bill-line-summary"
import { describe, expect, test } from "vitest"
import {
  canConfirmSplit,
  deriveSplitItems,
  selectAllForSplit,
  setSplitQuantity,
  splitNeedsDiscard,
} from "./split-selection.ts"

const beer = {
  id: "line-1",
  quantity: 3,
  totalAmount: 150,
} as unknown as BillLineSummary
const cake = {
  id: "line-2",
  quantity: 1,
  totalAmount: 90,
} as unknown as BillLineSummary

describe("split selection", () => {
  test("clamps a picked quantity to what the bill holds", () => {
    expect(setSplitQuantity({}, beer, 9)).toEqual({ "line-1": 3 })
    expect(setSplitQuantity({ "line-1": 2 }, beer, -1)).toEqual({ "line-1": 0 })
  })

  test("selects every unit of every line", () => {
    expect(selectAllForSplit([beer, cake])).toEqual({
      "line-1": 3,
      "line-2": 1,
    })
  })

  test("prices the moved portion by the unit amount and skips unpicked lines", () => {
    const items = deriveSplitItems([beer, cake], { "line-1": 2, "line-2": 0 })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: "line-1",
      quantity: 2,
      totalAmount: 100,
    })
  })

  test("moves part of a discount line at its negative unit amount, and a whole line at its own total", () => {
    const discount = {
      id: "line-3",
      quantity: 2,
      totalAmount: -1_000,
    } as unknown as BillLineSummary
    const oddDiscount = {
      id: "line-4",
      quantity: 3,
      totalAmount: -100,
    } as unknown as BillLineSummary

    expect(
      deriveSplitItems([discount, oddDiscount], { "line-3": 1, "line-4": 3 })
    ).toMatchObject([
      { id: "line-3", quantity: 1, totalAmount: -500 },
      // 3 x the rounded −33 would be −99, not the −100 the line holds.
      { id: "line-4", quantity: 3, totalAmount: -100 },
    ])
  })

  test("a selection with a discount line in it needs discard, goods alone do not (access/0012)", () => {
    const discount = {
      id: "line-3",
      quantity: 2,
      totalAmount: -1_000,
    } as unknown as BillLineSummary

    expect(
      splitNeedsDiscard(
        deriveSplitItems([beer, cake], { "line-1": 3, "line-2": 1 })
      )
    ).toBe(false)
    expect(
      splitNeedsDiscard(
        deriveSplitItems([beer, discount], { "line-1": 1, "line-3": 1 })
      )
    ).toBe(true)
  })

  test("needs items, no pending split and a target for an existing bill", () => {
    const target = "bill-2" as unknown as BillId
    const base = { itemCount: 1, pending: false, targetBillId: null }
    expect(canConfirmSplit({ ...base, destination: "new" })).toBe(true)
    expect(canConfirmSplit({ ...base, destination: "existing" })).toBe(false)
    expect(
      canConfirmSplit({
        ...base,
        destination: "existing",
        targetBillId: target,
      })
    ).toBe(true)
    expect(canConfirmSplit({ ...base, itemCount: 0, destination: "new" })).toBe(
      false
    )
    expect(
      canConfirmSplit({ ...base, pending: true, destination: "new" })
    ).toBe(false)
  })
})
