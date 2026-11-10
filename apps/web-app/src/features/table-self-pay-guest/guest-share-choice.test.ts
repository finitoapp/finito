import {
  calculateChosenSelfPayShare,
  calculateSelfPayShare,
  type SelfPaySplit,
} from "@payky/core/modules/table-self-pay/table-self-pay-share-utils"
import type { SelfPayViewLine } from "@payky/core/modules/table-self-pay/table-self-pay-view-utils"
import { expect, test } from "vitest"
import {
  type GuestLinePick,
  guestPaidLines,
  guestTipAmount,
  parsePercent,
  pickedLinesSplit,
  unpaidUnits,
} from "./guest-share-choice.ts"

const line = (
  overrides: Partial<SelfPayViewLine> & Pick<SelfPayViewLine, "key">
): SelfPayViewLine => ({
  name: "Line",
  quantity: 1,
  totalAmount: 10_100,
  allocatedAmount: 0,
  ...overrides,
})

const beers = line({
  key: "BEERBEER",
  name: "Beer",
  quantity: 3,
  totalAmount: 16_200,
})

const pizza = line({ key: "PIZZAPIZ", name: "Pizza" })

const shareOf = (
  lines: ReadonlyArray<SelfPayViewLine>,
  picks: Readonly<Record<string, GuestLinePick>>
) =>
  calculateChosenSelfPayShare(
    {
      remainder: lines.reduce(
        (sum, { totalAmount, allocatedAmount }) =>
          sum + totalAmount - allocatedAmount,
        0
      ),
      lines,
    },
    pickedLinesSplit(lines, picks)
  ).amount

test("one unit of a line of three beers asks for one beer", () => {
  expect(shareOf([beers], { BEERBEER: { units: 1, people: null } })).toBe(5_400)
})

test("the units of a partly paid line stop at what is left and ask for all of it", () => {
  const partlyPaid = { ...beers, allocatedAmount: 5_400 }

  expect(unpaidUnits(partlyPaid)).toBe(2)
  expect(shareOf([partlyPaid], { BEERBEER: { units: 2, people: null } })).toBe(
    10_800
  )
})

test("a pizza shared by five people asks for a fifth of it", () => {
  expect(shareOf([pizza], { PIZZAPIZ: { units: 1, people: 5 } })).toBe(2_020)
})

test("a line no longer shared asks for its units again", () => {
  expect(
    shareOf([beers, pizza], {
      BEERBEER: { units: 2, people: null },
      PIZZAPIZ: { units: 0, people: null },
    })
  ).toBe(10_800)
})

const paidLinesOf = (
  lines: ReadonlyArray<SelfPayViewLine>,
  split: SelfPaySplit
) => {
  const bill = {
    remainder: lines.reduce(
      (sum, { totalAmount, allocatedAmount }) =>
        sum + totalAmount - allocatedAmount,
      0
    ),
    lines,
  }
  return guestPaidLines(bill, split, calculateSelfPayShare(bill, split, "CZK"))
}

test("picked units and a shared line are named by their units and their part", () => {
  const lines = [beers, pizza]
  const split = pickedLinesSplit(lines, {
    BEERBEER: { units: 2, people: null },
    PIZZAPIZ: { units: 1, people: 2 },
  })

  expect(paidLinesOf(lines, split)).toEqual([
    { key: "BEERBEER", name: "Beer", units: 2, part: null, amount: 10_800 },
    {
      key: "PIZZAPIZ",
      name: "Pizza",
      units: 1,
      part: { numerator: 1, denominator: 2 },
      amount: 5_050,
    },
  ])
})

test("everything left names each line by the units left on it", () => {
  const partlyPaid = { ...beers, allocatedAmount: 5_400 }

  expect(
    paidLinesOf([partlyPaid, pizza], { kind: "remainder" }).map(
      ({ name, units, part }) => ({ name, units, part })
    )
  ).toEqual([
    { name: "Beer", units: 2, part: null },
    { name: "Pizza", units: 1, part: null },
  ])
})

test("a pick that would leave less than the minimum names what is left, not the pick", () => {
  const cheap = line({ key: "MINTMINT", name: "Mint", totalAmount: 50 })
  const split = pickedLinesSplit([pizza, cheap], {
    PIZZAPIZ: { units: 1, people: null },
  })

  expect(paidLinesOf([pizza, cheap], split).map(({ name }) => name)).toEqual([
    "Pizza",
    "Mint",
  ])
})

test("a percent tip is the share times the percent, rounded to the minor unit", () => {
  expect(guestTipAmount(52_500, { kind: "percent", percent: 10 })).toBe(5_250)
  expect(guestTipAmount(52_500, { kind: "percent", percent: 8 })).toBe(4_200)
  expect(guestTipAmount(1_015, { kind: "percent", percent: 5 })).toBe(51)
})

test("a custom tip as an amount is that amount", () => {
  expect(guestTipAmount(52_500, { kind: "amount", amount: 3_000 })).toBe(3_000)
})

test("a percent is read with a comma or a dot and refused when it is not one", () => {
  expect(parsePercent("7,5")).toBe(7.5)
  expect(parsePercent(" 8 ")).toBe(8)
  expect(parsePercent("")).toBeNull()
  expect(parsePercent("-5")).toBeNull()
  expect(parsePercent("abc")).toBeNull()
  expect(parsePercent("1e3")).toBeNull()
  expect(parsePercent("0x10")).toBeNull()
  expect(parsePercent("Infinity")).toBeNull()
})
