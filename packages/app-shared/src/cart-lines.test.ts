import { Integer } from "@payky/core/modules/shared/schema"
import { describe, expect, test } from "vitest"

import {
  type CartLine,
  cartWriteDiscardAction,
  invertLine,
  linesNeedDiscard,
} from "./cart-lines.ts"

const line = (kind: CartLine["kind"], totalAmount: number) =>
  ({
    kind,
    quantity: 1,
    totalAmount: Integer(totalAmount),
  }) as unknown as CartLine

describe("linesNeedDiscard (access/0012)", () => {
  const add = line("add", 100)
  const remove = line("remove", 100)
  const discount = line("add", -50)

  test("adding a line needs no discard", () => {
    expect(linesNeedDiscard([add, add])).toBe(false)
  })

  test("adding a free line needs no discard", () => {
    expect(linesNeedDiscard([line("add", 0)])).toBe(false)
  })

  test("clearing the cart needs discard", () => {
    expect(linesNeedDiscard([remove, remove])).toBe(true)
  })

  test("undoing an added line needs discard, since it writes a remove", () => {
    expect(linesNeedDiscard([invertLine(add)])).toBe(true)
  })

  test("redoing a removal needs discard as well", () => {
    expect(linesNeedDiscard([add, remove])).toBe(true)
  })

  // What a tap on an item and a scan check: the item's unit price, whose
  // sign the line takes (`use-cart-bill.ts`'s `addQuantity`).
  test("adding a discount by a tap or a scan needs discard", () => {
    expect(linesNeedDiscard([discount])).toBe(true)
  })

  test("undoing and redoing a discount need discard", () => {
    // Undoing the add writes a remove; redoing it writes the discount again.
    expect(linesNeedDiscard([invertLine(discount)])).toBe(true)
    expect(linesNeedDiscard([discount])).toBe(true)
    // Undoing a removed discount puts it back, an add below zero.
    expect(linesNeedDiscard([invertLine(line("remove", -50))])).toBe(true)
  })
})

describe("cartWriteDiscardAction", () => {
  test("names removing items whenever a remove line is written, adding a discount otherwise", () => {
    expect(cartWriteDiscardAction([line("add", 100)])).toBe(null)
    expect(cartWriteDiscardAction([line("remove", 100)])).toBe(
      "access.action.removeLines"
    )
    expect(cartWriteDiscardAction([line("remove", -50)])).toBe(
      "access.action.removeLines"
    )
    expect(cartWriteDiscardAction([line("add", -50)])).toBe(
      "access.action.addDiscount"
    )
  })
})
