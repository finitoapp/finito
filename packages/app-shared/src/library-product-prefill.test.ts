import { findLibraryProduct } from "@payky/core/integrations/product-library/product-library-utils"
import type { CatalogCategoryId } from "@payky/core/modules/catalog-category/catalog-category-types"
import { TimestampMs } from "@payky/core/modules/shared/schema"
import {
  type TaxRateId,
  TaxRatePercentage,
} from "@payky/core/modules/tax-rate/tax-rate-types"
import {
  createTestLibraryProduct,
  testProductLibrary,
} from "@payky/core/testing/product-library"
import { describe, expect, test } from "vitest"

import type { CategoryChoice } from "./catalog-category-choice.ts"
import {
  type LibraryPrefillFields,
  libraryCategoryChoice,
  libraryPrefillFields,
  libraryProductPrefill,
  nameKeepsLibraryProduct,
  relatedItemCategoryId,
} from "./library-product-prefill.ts"

const product = (id: string) => {
  const found = findLibraryProduct(testProductLibrary, id)
  if (found === undefined) throw new Error(`No ${id} in the fixture`)
  return found
}

const coffee = "coffee" as CatalogCategoryId
const drinks = "drinks" as CatalogCategoryId
const reduced = "reduced" as TaxRateId
const standard = "standard" as TaxRateId
const taxRates = [
  { id: reduced, rate: TaxRatePercentage(1200), deactivatedAt: null },
  { id: standard, rate: TaxRatePercentage(2100), deactivatedAt: null },
]

const prefill = (
  id: string,
  overrides: Partial<Parameters<typeof libraryProductPrefill>[0]> = {}
) =>
  libraryProductPrefill({
    library: testProductLibrary,
    product: product(id),
    language: "cs",
    country: "CZ",
    taxRates,
    categories: [],
    ...overrides,
  })

describe("a picked library product fills the create form", () => {
  test("fills the name in the device's language and the library product's id", () => {
    expect(prefill("draft-lager-large", { language: "sk" })).toMatchObject({
      name: "Čapované pivo 0,5 l",
      libraryProductId: "draft-lager-large",
    })
  })

  test("picks the account's active VAT rate the library gives for its country", () => {
    expect(prefill("espresso")?.taxRateId).toBe(reduced)
    expect(prefill("draft-lager-large")?.taxRateId).toBe(standard)
  })

  test("keeps the form's VAT rate when the account has no rate of that percentage", () => {
    expect(prefill("espresso", { country: "SK" })?.taxRateId).toBeUndefined()
    expect(prefill("espresso", { country: null })?.taxRateId).toBeUndefined()
    expect(
      prefill("espresso", {
        taxRates: [
          {
            id: reduced,
            rate: TaxRatePercentage(1200),
            deactivatedAt: TimestampMs(1_700_000_000_000),
          },
        ],
      })?.taxRateId
    ).toBeUndefined()
  })

  test("chooses the merchant's category of the library category's name", () => {
    expect(
      prefill("espresso", { categories: [{ id: coffee, name: "KÁVA " }] })
        ?.category
    ).toEqual({ kind: "existing", id: coffee })
  })

  test("adds the library category's name when no category spells it", () => {
    expect(
      prefill("espresso", { categories: [{ id: drinks, name: "Nápoje" }] })
        ?.category
    ).toEqual({ kind: "new", name: "Káva" })
  })

  test("leaves the category alone for a category the library does not name", () => {
    expect(
      libraryProductPrefill({
        library: testProductLibrary,
        product: createTestLibraryProduct({ id: "tea", category: "tea" }),
        language: "en",
        country: "CZ",
        taxRates,
        categories: [],
      })?.category
    ).toBeUndefined()
  })
})

describe("libraryCategoryChoice", () => {
  test("matches a category spelt without the library's diacritics", () => {
    expect(
      libraryCategoryChoice([{ id: coffee, name: "kava" }], "Káva")
    ).toEqual({ kind: "existing", id: coffee })
  })

  test("prefers the category spelt exactly over one without diacritics", () => {
    expect(
      libraryCategoryChoice(
        [
          { id: drinks, name: "Kava" },
          { id: coffee, name: "káva" },
        ],
        "Káva"
      )
    ).toEqual({ kind: "existing", id: coffee })
  })
})

describe("a related product's chip", () => {
  test("files it under the item just created's category when the library puts both in one", () => {
    expect(
      relatedItemCategoryId({
        created: product("espresso"),
        createdCategoryId: drinks,
        related: product("cappuccino"),
      })
    ).toBe(drinks)
  })

  test("lets the library decide for a product of another library category or an uncategorized item", () => {
    expect(
      relatedItemCategoryId({
        created: product("cappuccino"),
        createdCategoryId: drinks,
        related: product("croissant"),
      })
    ).toBeUndefined()
    expect(
      relatedItemCategoryId({
        created: product("espresso"),
        createdCategoryId: null,
        related: product("cappuccino"),
      })
    ).toBeUndefined()
  })
})

describe("a picked library product's fields in a form the merchant has touched", () => {
  const initial: LibraryPrefillFields = {
    taxRateId: standard,
    category: { kind: "none" },
  }
  const coffeeCategory: CategoryChoice = { kind: "existing", id: coffee }
  const drinksCategory: CategoryChoice = { kind: "existing", id: drinks }
  const untouched = { taxRateId: false, category: false }

  test("fills the VAT rate and category the merchant has not chosen", () => {
    expect(
      libraryPrefillFields({
        prefill: { taxRateId: reduced, category: coffeeCategory },
        current: initial,
        initial,
        chosen: untouched,
      })
    ).toEqual({ taxRateId: reduced, category: coffeeCategory })
  })

  test("keeps a category the merchant already chose", () => {
    expect(
      libraryPrefillFields({
        prefill: { taxRateId: reduced, category: coffeeCategory },
        current: { ...initial, category: drinksCategory },
        initial,
        chosen: { ...untouched, category: true },
      })
    ).toEqual({ taxRateId: reduced, category: drinksCategory })
  })

  test("keeps a VAT rate the merchant already chose", () => {
    expect(
      libraryPrefillFields({
        prefill: { taxRateId: reduced, category: coffeeCategory },
        current: { ...initial, taxRateId: "none" },
        initial,
        chosen: { ...untouched, taxRateId: true },
      })
    ).toEqual({ taxRateId: "none", category: coffeeCategory })
  })

  test("replaces what an earlier pick filled, back to the form's own value where the product has none", () => {
    expect(
      libraryPrefillFields({
        prefill: { taxRateId: undefined, category: undefined },
        current: { taxRateId: reduced, category: coffeeCategory },
        initial,
        chosen: untouched,
      })
    ).toEqual(initial)
  })
})

describe("a create form's link to the library product picked", () => {
  test("holds while the name contains the product's name in any language or a synonym", () => {
    const espresso = product("espresso")
    expect(nameKeepsLibraryProduct("Espresso velké", espresso)).toBe(true)
    expect(nameKeepsLibraryProduct("Dvojité ESPRESSO", espresso)).toBe(true)
    const lager = product("draft-lager-large")
    // Its English name in a Czech catalog, and a synonym without diacritics.
    expect(nameKeepsLibraryProduct("Draught lager 0.5 l", lager)).toBe(true)
    expect(nameKeepsLibraryProduct("Velke pivo 12°", lager)).toBe(true)
  })

  test("drops once the name no longer names the product, or is emptied", () => {
    expect(nameKeepsLibraryProduct("Pivo", product("espresso"))).toBe(false)
    expect(nameKeepsLibraryProduct("Espr", product("espresso"))).toBe(false)
    expect(nameKeepsLibraryProduct("  ", product("espresso"))).toBe(false)
  })
})
