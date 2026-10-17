import { describe, expect, test } from "vitest"

import type { BillId } from "../bill/bill-types.ts"
import type { CatalogItemId } from "../catalog-item/catalog-item-types.ts"
import type { ItemRow } from "../item/item.ts"
import type { ItemId } from "../item/item-types.ts"
import {
  NonEmptyString255,
  NonNegativeInteger,
  PositiveNumber,
} from "../shared/schema.ts"
import type { BillLineRow } from "./bill-line.ts"
import type { BillLineSummary } from "./bill-line-summary.ts"
import type { BillLineId, BillLineSummaryId } from "./bill-line-types.ts"
import {
  calculateBillLineSummaries,
  createBillLineSummaryId,
  deriveBillLineSummaryDiff,
  deriveBillSummaryTotal,
  deriveBillTotalAfterLines,
  getBillLineSummaryUnitAmount,
  getLatestCatalogItemSummary,
} from "./bill-line-utils.ts"

const billId = "bill-1" as BillId

const makeSummary = (
  overrides: Partial<BillLineSummary> & Pick<BillLineSummary, "itemId" | "name">
): BillLineSummary => ({
  id: `summary-${overrides.itemId}` as BillLineSummaryId,
  billId,
  catalogItemId: null,
  type: "catalogItem",
  description: null,
  currency: "CZK",
  quantity: PositiveNumber(1),
  totalAmount: NonNegativeInteger(500),
  taxRateId: null,
  ...overrides,
})

describe("bill line summaries", () => {
  test("calculates summaries from bill lines without persistence", () => {
    const item: ItemRow = {
      id: "item-1" as ItemId,
      catalogItemId: "catalog-1" as CatalogItemId,
      name: NonEmptyString255("Coffee"),
      description: null,
      currency: "CZK",
      unitAmount: NonNegativeInteger(5900),
      taxRateId: null,
    }
    const lines: ReadonlyArray<BillLineRow> = [
      {
        id: "line-1" as BillLineId,
        billId: "bill-1" as BillId,
        deviceId: null,
        catalogItemId: "catalog-1" as CatalogItemId,
        itemId: item.id,
        type: "catalogItem",
        kind: "add",
        quantity: PositiveNumber(2),
        totalAmount: NonNegativeInteger(11800),
      },
      {
        id: "line-2" as BillLineId,
        billId: "bill-1" as BillId,
        deviceId: null,
        catalogItemId: "catalog-1" as CatalogItemId,
        itemId: item.id,
        type: "catalogItem",
        kind: "remove",
        quantity: PositiveNumber(1),
        totalAmount: NonNegativeInteger(5900),
      },
    ]

    expect(calculateBillLineSummaries(lines, [item])).toMatchObject([
      {
        billId: "bill-1",
        catalogItemId: "catalog-1",
        itemId: "item-1",
        type: "catalogItem",
        name: "Coffee",
        quantity: 1,
        totalAmount: 5900,
      },
    ])
  })

  test("creates stable summary ids from projection identity", () => {
    const identity = {
      billId: "bill-1" as BillId,
      catalogItemId: "catalog-1" as CatalogItemId,
      itemId: "item-1" as ItemId,
      type: "catalogItem" as const,
    }

    expect(createBillLineSummaryId(identity)).toBe(
      createBillLineSummaryId({ ...identity })
    )
    expect(createBillLineSummaryId({ ...identity, type: "tip" })).not.toBe(
      createBillLineSummaryId(identity)
    )
  })
})

describe("deriveBillTotalAfterLines", () => {
  const items: ReadonlyArray<ItemRow> = ["coffee", "cake"].map((name) => ({
    id: `item-${name}` as ItemId,
    catalogItemId: null,
    name: NonEmptyString255(name),
    description: null,
    currency: "CZK",
    unitAmount: NonNegativeInteger(0),
    taxRateId: null,
  }))
  const line = (
    name: string,
    kind: BillLineRow["kind"],
    quantity: number,
    totalAmount: number
  ): BillLineRow => ({
    id: `line-${name}-${kind}-${quantity}` as BillLineId,
    billId,
    deviceId: null,
    catalogItemId: null,
    itemId: `item-${name}` as ItemId,
    type: "manualAmount",
    kind,
    quantity: PositiveNumber(quantity),
    totalAmount: NonNegativeInteger(totalAmount),
  })
  const threeCoffees = [line("coffee", "add", 3, 1_000)]

  test.each([
    { edit: "a partial removal", lines: [line("coffee", "remove", 1, 333)] },
    {
      edit: "a removal that leaves a rounding remainder",
      lines: [line("coffee", "remove", 3, 999)],
    },
    {
      edit: "a removal of more than is left",
      lines: [line("coffee", "remove", 2, 1_200)],
    },
    { edit: "an added line", lines: [line("cake", "add", 1, 450)] },
  ])("totals $edit as the summaries would", ({ lines }) => {
    expect(
      deriveBillTotalAfterLines(
        calculateBillLineSummaries(threeCoffees, items),
        lines
      )
    ).toBe(
      deriveBillSummaryTotal(
        calculateBillLineSummaries([...threeCoffees, ...lines], items)
      )
    )
  })
})

describe("deriveBillLineSummaryDiff", () => {
  test("reports nothing when both sides are identical", () => {
    const coffee = makeSummary({
      itemId: "item-coffee" as ItemId,
      name: NonEmptyString255("Coffee"),
    })

    expect(deriveBillLineSummaryDiff([coffee], [coffee])).toEqual({
      added: [],
      removed: [],
      changed: [],
    })
  })

  test("reports a quantity/amount change for the same exact item as changed, not add+remove", () => {
    const before = makeSummary({
      itemId: "item-coffee" as ItemId,
      name: NonEmptyString255("Coffee"),
      quantity: PositiveNumber(1),
      totalAmount: NonNegativeInteger(500),
    })
    const after = {
      ...before,
      quantity: PositiveNumber(2),
      totalAmount: NonNegativeInteger(1000),
    }

    const diff = deriveBillLineSummaryDiff([before], [after])
    expect(diff.added).toEqual([])
    expect(diff.removed).toEqual([])
    expect(diff.changed).toEqual([{ before, after }])
  })

  test("reports a brand-new item (no correlated catalogItemId) as added", () => {
    const sandwich = makeSummary({
      itemId: "item-sandwich" as ItemId,
      name: NonEmptyString255("Sandwich"),
    })

    const diff = deriveBillLineSummaryDiff([], [sandwich])
    expect(diff.added).toEqual([sandwich])
    expect(diff.removed).toEqual([])
    expect(diff.changed).toEqual([])
  })

  test("reports a fully removed item (no correlated catalogItemId) as removed", () => {
    const coffee = makeSummary({
      itemId: "item-coffee" as ItemId,
      name: NonEmptyString255("Coffee"),
    })

    const diff = deriveBillLineSummaryDiff([coffee], [])
    expect(diff.added).toEqual([])
    expect(diff.removed).toEqual([coffee])
    expect(diff.changed).toEqual([])
  })

  test("correlates a price change on the same catalog item as changed, not an unrelated add+remove", () => {
    const before = makeSummary({
      itemId: "item-coffee-old-price" as ItemId,
      catalogItemId: "catalog-coffee" as CatalogItemId,
      name: NonEmptyString255("Coffee"),
      totalAmount: NonNegativeInteger(500),
    })
    const after = makeSummary({
      itemId: "item-coffee-new-price" as ItemId,
      catalogItemId: "catalog-coffee" as CatalogItemId,
      name: NonEmptyString255("Coffee"),
      totalAmount: NonNegativeInteger(600),
    })

    const diff = deriveBillLineSummaryDiff([before], [after])
    expect(diff.added).toEqual([])
    expect(diff.removed).toEqual([])
    expect(diff.changed).toEqual([{ before, after }])
  })

  test("without a shared catalogItemId, an unrelated swap is reported as separate removed and added entries", () => {
    const coffee = makeSummary({
      itemId: "item-coffee" as ItemId,
      name: NonEmptyString255("Coffee"),
    })
    const tea = makeSummary({
      itemId: "item-tea" as ItemId,
      name: NonEmptyString255("Tea"),
    })

    const diff = deriveBillLineSummaryDiff([coffee], [tea])
    expect(diff.added).toEqual([tea])
    expect(diff.removed).toEqual([coffee])
    expect(diff.changed).toEqual([])
  })

  // `item` ids are content-addressed over name/description/currency/
  // unitAmount/taxRateId and exclude the line's `type`, so a tip and a manual
  // amount with the same name and amount share one `itemId` while staying two
  // separate summaries. Only the summary id tells them apart.
  const sharedItemId = "item-shared" as ItemId
  const manualAmount = (totalAmount: number): BillLineSummary =>
    makeSummary({
      id: "summary-manual" as BillLineSummaryId,
      itemId: sharedItemId,
      type: "manualAmount",
      name: NonEmptyString255("Tip"),
      totalAmount: NonNegativeInteger(totalAmount),
    })
  const tip = (totalAmount: number): BillLineSummary =>
    makeSummary({
      id: "summary-tip" as BillLineSummaryId,
      itemId: sharedItemId,
      type: "tip",
      name: NonEmptyString255("Tip"),
      totalAmount: NonNegativeInteger(totalAmount),
    })

  test("tells apart a tip and a manual amount sharing one item snapshot", () => {
    const diff = deriveBillLineSummaryDiff(
      [manualAmount(500), tip(500)],
      [manualAmount(500), tip(900)]
    )

    // Only the tip's amount moved; the manual amount is identical on both
    // sides and must not be reported at all, let alone as having turned into
    // the tip line.
    expect(diff.changed).toEqual([{ before: tip(500), after: tip(900) }])
    expect(diff.added).toEqual([])
    expect(diff.removed).toEqual([])
  })

  test("reports a tip replaced by an equal manual amount as a swap", () => {
    const diff = deriveBillLineSummaryDiff([tip(500)], [manualAmount(500)])

    // Same name, same amount, same `itemId` — but a tip line became a manual
    // amount, which is a real change to the bill, not "nothing happened".
    expect(diff.removed).toEqual([tip(500)])
    expect(diff.added).toEqual([manualAmount(500)])
    expect(diff.changed).toEqual([])
  })

  test("pairs every repriced line of one catalog item, not just the last", () => {
    const coffeeId = "catalog-coffee" as CatalogItemId
    const coffeeAt = (price: number): BillLineSummary =>
      makeSummary({
        id: `summary-coffee-${price}` as BillLineSummaryId,
        itemId: `item-coffee-${price}` as ItemId,
        catalogItemId: coffeeId,
        name: NonEmptyString255("Coffee"),
        totalAmount: NonNegativeInteger(price),
      })

    // Coffee was repriced twice while this payment was outstanding, so the
    // bill carries two snapshots of it and the payment froze two others.
    // Correlating by catalog item should pair both, not pair one and leave
    // the rest as an unrelated-looking add + remove — the exact confusion
    // this pass exists to prevent.
    const diff = deriveBillLineSummaryDiff(
      [coffeeAt(5900), coffeeAt(6200)],
      [coffeeAt(7000), coffeeAt(7500)]
    )

    expect(diff.changed).toEqual([
      { before: coffeeAt(5900), after: coffeeAt(7000) },
      { before: coffeeAt(6200), after: coffeeAt(7500) },
    ])
    expect(diff.added).toEqual([])
    expect(diff.removed).toEqual([])
  })
})

describe("getLatestCatalogItemSummary", () => {
  test("picks the latest persisted snapshot after a catalog item changes", () => {
    const catalogItemId = "catalog-item-1" as CatalogItemId
    const oldSnapshot = makeSummary({
      itemId: "item-old" as ItemId,
      name: NonEmptyString255("Coffee"),
      catalogItemId,
      quantity: PositiveNumber(1),
      totalAmount: NonNegativeInteger(500),
    })
    const newSnapshot = makeSummary({
      itemId: "item-new" as ItemId,
      name: NonEmptyString255("Coffee"),
      catalogItemId,
      quantity: PositiveNumber(2),
      totalAmount: NonNegativeInteger(1_200),
    })

    expect(
      getLatestCatalogItemSummary([oldSnapshot, newSnapshot], catalogItemId)
    ).toBe(newSnapshot)
  })

  test("returns undefined when no summary carries that catalog item", () => {
    expect(
      getLatestCatalogItemSummary(
        [
          makeSummary({
            itemId: "item-1" as ItemId,
            name: NonEmptyString255("Tea"),
          }),
        ],
        "catalog-item-1" as CatalogItemId
      )
    ).toBeUndefined()
  })
})

describe("getBillLineSummaryUnitAmount", () => {
  test("divides the line total by its quantity", () => {
    expect(
      getBillLineSummaryUnitAmount(
        makeSummary({
          itemId: "item-1" as ItemId,
          name: NonEmptyString255("Coffee"),
          quantity: PositiveNumber(2),
          totalAmount: NonNegativeInteger(1_200),
        })
      )
    ).toBe(600)
  })

  test("survives a fractional quantity whose division does not land on an integer", () => {
    // `bin/cli-bills.ts add-item --quantity 0.7` is accepted
    // (`PositiveNumberFromStringSchema`), and `addCatalogItemToBill` takes a
    // `PositiveNumber` too, so a line of 0.7 x 2000 is a real row: its total
    // of 1400 is a clean integer. Dividing back is not — `1400 / 0.7` is
    // `2000.0000000000002` in IEEE 754 — and this used to decode that
    // straight through `NonNegativeInteger`, throwing while the operator
    // simply tapped "remove" on that line in the cart.
    expect(
      getBillLineSummaryUnitAmount(
        makeSummary({
          itemId: "item-fractional" as ItemId,
          name: NonEmptyString255("Coffee"),
          quantity: PositiveNumber(0.7),
          totalAmount: NonNegativeInteger(1_400),
        })
      )
    ).toBe(2_000)
  })

  test("rounds to the nearest minor unit when a total genuinely does not divide", () => {
    // Not reachable from any current writer — every line's total is
    // `unitAmount x quantity` — but money has no fractional minor unit, so
    // the nearest one is the only answer available.
    expect(
      getBillLineSummaryUnitAmount(
        makeSummary({
          itemId: "item-indivisible" as ItemId,
          name: NonEmptyString255("Coffee"),
          quantity: PositiveNumber(3),
          totalAmount: NonNegativeInteger(100),
        })
      )
    ).toBe(33)
  })
})
