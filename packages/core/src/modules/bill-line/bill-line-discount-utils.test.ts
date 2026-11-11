import { describe, expect, test } from "vitest"

import type { ItemLineType } from "../item/item-types.ts"
import { Integer } from "../shared/schema.ts"
import {
  allocateDiscount,
  deriveLineNetAmount,
} from "./bill-line-discount-utils.ts"

const line = (
  id: string,
  totalAmount: number,
  type: ItemLineType = "catalogItem"
) => ({ id, type, totalAmount: Integer(totalAmount) })

/** Each line's id and share, the form the expectations are written in. */
const sharesOf = (lines: Parameters<typeof allocateDiscount>[0]) =>
  Object.fromEntries(
    allocateDiscount(lines).map((allocated) => [
      allocated.id,
      allocated.discountShare,
    ])
  )

describe("allocateDiscount", () => {
  test("shares a discount over lines of several VAT rates in proportion to their amounts", () => {
    expect(
      sharesOf([
        line("beer", 6_000),
        line("soup", 3_000),
        line("stamp", 1_000),
        line("discount", -1_000),
      ])
    ).toEqual({ beer: -600, soup: -300, stamp: -100, discount: null })
  })

  test("gives a manual amount and an item without a VAT rate their share too", () => {
    // `allocateDiscount` reads no VAT rate at all: a line without one is goods
    // like any other.
    expect(
      sharesOf([
        line("corkage", 1_000, "manualAmount"),
        line("stamp", 1_000),
        line("discount", -500),
      ])
    ).toEqual({ corkage: -250, stamp: -250, discount: null })
  })

  test("leaves a tip out", () => {
    expect(
      sharesOf([
        line("coffee", 1_000),
        line("tip", 5_000, "tip"),
        line("discount", -100),
      ])
    ).toEqual({ coffee: -100, tip: null, discount: null })
  })

  test("rounds by the largest remainder, the shares adding up to the discount", () => {
    // Exact shares 3.5, 2.1 and 1.4: the floors leave one unit, which goes to
    // the largest remainder.
    expect(
      sharesOf([
        line("a", 500),
        line("b", 300),
        line("c", 200),
        line("discount", -7),
      ])
    ).toEqual({ a: -4, b: -2, c: -1, discount: null })
    // Equal remainders: the unit goes to the line whose id sorts first.
    expect(
      sharesOf([
        line("b", 1_000),
        line("c", 1_000),
        line("a", 1_000),
        line("discount", -100),
      ])
    ).toEqual({ a: -34, b: -33, c: -33, discount: null })
  })

  test("never takes a line below zero", () => {
    // The small line's exact share is 0.9999: rounding takes it to its whole
    // amount, never past it.
    const nearlyAll = allocateDiscount([
      line("small", 1),
      line("large", 9_999),
      line("discount", -9_999),
    ])
    expect(nearlyAll.map(deriveLineNetAmount)).toEqual([0, 1, -9_999])

    // A discount above the goods takes them to zero and no further.
    const moreThanAll = allocateDiscount([
      line("a", 700),
      line("b", 300),
      line("discount", -1_500),
    ])
    expect(moreThanAll.map((allocated) => allocated.discountShare)).toEqual([
      -700,
      -300,
      null,
    ])

    for (const discount of [1, 2, 99, 1_000, 2_999, 3_000]) {
      const lines = allocateDiscount([
        line("a", 1),
        line("b", 2),
        line("c", 2_997),
        line("discount", -discount),
      ])
      const goods = lines.slice(0, 3)
      expect(
        goods.every((goodsLine) => deriveLineNetAmount(goodsLine) >= 0)
      ).toBe(true)
      expect(
        goods.reduce(
          (sum, goodsLine) => sum + (goodsLine.discountShare ?? 0),
          0
        )
      ).toBe(-discount)
    }
  })

  test("comes to the same shares whatever order the lines come in", () => {
    const lines = [
      line("e", 333),
      line("a", 1_000),
      line("d", 333),
      line("b", 1_000),
      line("discount-1", -50),
      line("c", 334),
      line("discount-2", -51),
    ]
    const expected = sharesOf(lines)

    expect(sharesOf([...lines].reverse())).toEqual(expected)
    expect(
      sharesOf([...lines].sort((x, y) => x.totalAmount - y.totalAmount))
    ).toEqual(expected)
    // The order the lines came in is the order they are returned in.
    expect(allocateDiscount(lines).map((allocated) => allocated.id)).toEqual(
      lines.map((given) => given.id)
    )
  })

  test("shares nothing without a discount, or without goods above zero", () => {
    expect(sharesOf([line("a", 1_000), line("b", 0)])).toEqual({
      a: null,
      b: null,
    })
    expect(
      sharesOf([line("free", 0), line("tip", 500, "tip"), line("d", -100)])
    ).toEqual({ free: null, tip: null, d: null })
  })
})

describe("deriveLineNetAmount", () => {
  test("takes a line's share off its amount, and a line without one as it is", () => {
    expect(
      deriveLineNetAmount({
        totalAmount: Integer(1_000),
        discountShare: Integer(-150),
      })
    ).toBe(850)
    expect(
      deriveLineNetAmount({ totalAmount: Integer(1_000), discountShare: null })
    ).toBe(1_000)
  })
})
