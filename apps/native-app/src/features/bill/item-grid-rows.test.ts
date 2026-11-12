import { expect, test } from "vitest"
import {
  buildItemGridRows,
  type ItemGridRow,
  itemGridColumns,
} from "./item-grid-rows.ts"

const items = [
  { id: "a", group: "drinks" },
  { id: "b", group: "drinks" },
  { id: "c", group: "drinks" },
  { id: "d", group: null },
]

const manyItems = [
  { id: "a", group: "drinks" },
  { id: "b", group: "drinks" },
  { id: "c", group: "drinks" },
  { id: "d", group: "drinks" },
  { id: "e", group: "drinks" },
  { id: "f", group: "food" },
  { id: "g", group: "food" },
  { id: "h", group: "food" },
  { id: "i", group: "food" },
]

const shape = (
  rows: ReadonlyArray<ItemGridRow<{ readonly id: string }, string | null>>
) =>
  rows.map((row) =>
    row.type === "heading"
      ? `# ${String(row.group)}`
      : row.items.map((item) => item.id).join("")
  )

test("pairs items two per row, starting each group on a new row under its heading", () => {
  expect(
    shape(buildItemGridRows(items, (item) => item.group, true, 2))
  ).toEqual(["# drinks", "ab", "c", "# null", "d"])
})

test("without headings, pairs straight through the groups", () => {
  expect(
    shape(buildItemGridRows(items, (item) => item.group, false, 2))
  ).toEqual(["ab", "cd"])
  expect(buildItemGridRows(items.slice(0, 0), () => null, true, 2)).toEqual([])
})

test("on a wide window, fills each row with as many items as there are columns", () => {
  expect(
    shape(buildItemGridRows(manyItems, (item) => item.group, true, 3))
  ).toEqual(["# drinks", "abc", "de", "# food", "fgh", "i"])
  expect(
    shape(buildItemGridRows(manyItems, (item) => item.group, true, 4))
  ).toEqual(["# drinks", "abcd", "e", "# food", "fghi"])
})

test("without headings, a wide window fills rows straight through the groups", () => {
  expect(
    shape(buildItemGridRows(manyItems, (item) => item.group, false, 3))
  ).toEqual(["abc", "def", "ghi"])
  expect(
    shape(buildItemGridRows(manyItems, (item) => item.group, false, 4))
  ).toEqual(["abcd", "efgh", "i"])
})

test("fits as many 12rem bricks as the width allows, never fewer than two", () => {
  expect(itemGridColumns(0)).toBe(2)
  expect(itemGridColumns(400)).toBe(2)
  expect(itemGridColumns(592)).toBe(3)
  expect(itemGridColumns(600)).toBe(3)
  expect(itemGridColumns(792)).toBe(4)
  expect(itemGridColumns(1000)).toBe(5)
})
