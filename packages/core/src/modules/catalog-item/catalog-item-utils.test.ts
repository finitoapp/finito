import { createIdFromString } from "@evolu/common"
import { describe, expect, test } from "vitest"
import {
  Integer,
  NonEmptyString255,
  NonNegativeInteger,
} from "../shared/schema.ts"
import type { TaxRateId } from "../tax-rate/tax-rate-types.ts"
import type { CatalogItemRow } from "./catalog-item.ts"
import type { CatalogItemId } from "./catalog-item-types.ts"
import {
  findCatalogItemsByScanCode,
  getStaffDisplayDescription,
  getStaffDisplayName,
  validateCatalogItemPricing,
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

describe("validateCatalogItemPricing", () => {
  const taxRateId = createIdFromString<"TaxRate">("standard") as TaxRateId
  const pricing = (
    overrides: Partial<Parameters<typeof validateCatalogItemPricing>[0]>
  ) =>
    validateCatalogItemPricing({
      unitAmount: Integer(0),
      taxRateId: null,
      vatPayer: true,
      originalUnitAmount: null,
      ...overrides,
    })

  test("refuses a VAT payer's zero price without a VAT rate", () => {
    expect(pricing({})).toEqual({
      ok: false,
      error: { type: "ZeroPriceWithoutTaxRate" },
    })
    expect(pricing({ originalUnitAmount: Integer(5_900) }).ok).toBe(false)
  })

  test("takes a VAT payer's zero price with a VAT rate", () => {
    expect(pricing({ taxRateId }).ok).toBe(true)
  })

  test("takes a zero price without a VAT rate from an account that is not a VAT payer", () => {
    expect(pricing({ vatPayer: false }).ok).toBe(true)
  })

  test("still takes a VAT payer's positive price without a VAT rate", () => {
    expect(pricing({ unitAmount: Integer(5_900) }).ok).toBe(true)
  })

  test("takes a discount without a VAT rate", () => {
    expect(pricing({ unitAmount: Integer(-500) }).ok).toBe(true)
    expect(pricing({ unitAmount: Integer(-500), vatPayer: false }).ok).toBe(
      true
    )
  })

  test("refuses a discount with a VAT rate", () => {
    expect(pricing({ unitAmount: Integer(-500), taxRateId })).toEqual({
      ok: false,
      error: { type: "DiscountWithTaxRate" },
    })
    expect(
      pricing({
        unitAmount: Integer(-500),
        taxRateId,
        vatPayer: false,
        originalUnitAmount: Integer(-300),
      })
    ).toEqual({ ok: false, error: { type: "DiscountWithTaxRate" } })
  })

  test("refuses an update that moves the price across zero", () => {
    const signChange = {
      ok: false,
      error: { type: "CatalogItemPriceSignChange" },
    }
    // An item into a discount.
    expect(
      pricing({
        unitAmount: Integer(-500),
        originalUnitAmount: Integer(5_900),
      })
    ).toEqual(signChange)
    expect(
      pricing({ unitAmount: Integer(-500), originalUnitAmount: Integer(0) })
    ).toEqual(signChange)
    // A discount into an item, a free one included: zero is no discount.
    expect(
      pricing({
        unitAmount: Integer(5_900),
        taxRateId,
        originalUnitAmount: Integer(-500),
      })
    ).toEqual(signChange)
    expect(
      pricing({
        unitAmount: Integer(0),
        taxRateId,
        originalUnitAmount: Integer(-500),
      })
    ).toEqual(signChange)
  })

  test("takes an update that keeps the sign", () => {
    expect(
      pricing({ unitAmount: Integer(-800), originalUnitAmount: Integer(-500) })
        .ok
    ).toBe(true)
    expect(
      pricing({
        unitAmount: Integer(0),
        taxRateId,
        originalUnitAmount: Integer(5_900),
      }).ok
    ).toBe(true)
  })
})
