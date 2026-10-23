import { describe, expect, test } from "vitest"
import { NonEmptyString255, NonNegativeInteger } from "../shared/schema.ts"
import type { CatalogItemRow } from "./catalog-item.ts"
import type { CatalogItemId } from "./catalog-item-types.ts"
import {
  findCatalogItemsByScanCode,
  getStaffDisplayDescription,
  getStaffDisplayName,
} from "./catalog-item-utils.ts"

const makeItem = (
  overrides: Partial<CatalogItemRow> & Pick<CatalogItemRow, "id">
): CatalogItemRow => ({
  deviceId: null,
  categoryId: null,
  name: NonEmptyString255("Coffee"),
  description: null,
  internalName: null,
  internalDescription: null,
  sku: null,
  currency: "CZK",
  unitAmount: NonNegativeInteger(5900),
  sortOrder: NonNegativeInteger(0),
  scanCode: null,
  taxRateId: null,
  inMenu: null,
  soldOut: null,
  ...overrides,
})

describe("getStaffDisplayName", () => {
  test("prefers the internal name when set", () => {
    const item = makeItem({
      id: "cat-1" as CatalogItemId,
      name: NonEmptyString255("Coffee"),
      internalName: NonEmptyString255("COF-01"),
    })

    expect(getStaffDisplayName(item)).toBe("COF-01")
  })

  test("falls back to the public name when no internal name is set", () => {
    const item = makeItem({
      id: "cat-1" as CatalogItemId,
      name: NonEmptyString255("Coffee"),
      internalName: null,
    })

    expect(getStaffDisplayName(item)).toBe("Coffee")
  })
})

describe("getStaffDisplayDescription", () => {
  test("prefers the internal description when set", () => {
    const item = makeItem({
      id: "cat-1" as CatalogItemId,
      description: NonEmptyString255("Double espresso"),
      internalDescription: NonEmptyString255("Uses the cheap beans"),
    })

    expect(getStaffDisplayDescription(item)).toBe("Uses the cheap beans")
  })

  test("falls back to the public description when no internal description is set", () => {
    const item = makeItem({
      id: "cat-1" as CatalogItemId,
      description: NonEmptyString255("Double espresso"),
      internalDescription: null,
    })

    expect(getStaffDisplayDescription(item)).toBe("Double espresso")
  })

  test("returns null when neither description is set", () => {
    const item = makeItem({
      id: "cat-1" as CatalogItemId,
      description: null,
      internalDescription: null,
    })

    expect(getStaffDisplayDescription(item)).toBeNull()
  })
})

describe("findCatalogItemsByScanCode", () => {
  test("returns the single item matching the raw scanned value", () => {
    const coffee = makeItem({
      id: "cat-1" as CatalogItemId,
      name: NonEmptyString255("Coffee"),
      scanCode: NonEmptyString255("8594001234567"),
    })
    const tea = makeItem({
      id: "cat-2" as CatalogItemId,
      name: NonEmptyString255("Tea"),
      scanCode: NonEmptyString255("8594007654321"),
    })

    expect(findCatalogItemsByScanCode([coffee, tea], "8594001234567")).toEqual([
      coffee,
    ])
  })

  test("trims surrounding whitespace from the raw scanned value", () => {
    const coffee = makeItem({
      id: "cat-1" as CatalogItemId,
      scanCode: NonEmptyString255("8594001234567"),
    })

    expect(findCatalogItemsByScanCode([coffee], "  8594001234567\n")).toEqual([
      coffee,
    ])
  })

  test("returns an empty array when no item matches", () => {
    const coffee = makeItem({
      id: "cat-1" as CatalogItemId,
      scanCode: NonEmptyString255("8594001234567"),
    })

    expect(findCatalogItemsByScanCode([coffee], "unknown-code")).toEqual([])
  })

  test("returns an empty array for an empty raw value", () => {
    const coffee = makeItem({
      id: "cat-1" as CatalogItemId,
      scanCode: NonEmptyString255("8594001234567"),
    })

    expect(findCatalogItemsByScanCode([coffee], "   ")).toEqual([])
  })

  test("returns every item sharing a colliding scan code", () => {
    const coffee = makeItem({
      id: "cat-1" as CatalogItemId,
      name: NonEmptyString255("Coffee"),
      scanCode: NonEmptyString255("8594001234567"),
    })
    const cocoa = makeItem({
      id: "cat-2" as CatalogItemId,
      name: NonEmptyString255("Cocoa"),
      scanCode: NonEmptyString255("8594001234567"),
    })

    expect(
      findCatalogItemsByScanCode([coffee, cocoa], "8594001234567")
    ).toEqual([coffee, cocoa])
  })

  test("ignores items with no scan code assigned", () => {
    const coffee = makeItem({ id: "cat-1" as CatalogItemId, scanCode: null })

    expect(findCatalogItemsByScanCode([coffee], "")).toEqual([])
  })
})
