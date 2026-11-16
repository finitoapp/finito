import { describe, expect, test } from "vitest"
import { TimestampMs } from "../../modules/shared/schema.ts"
import {
  type TaxRateId,
  TaxRatePercentage,
} from "../../modules/tax-rate/tax-rate-types.ts"
import {
  createTestLibraryProduct,
  testProductLibrary,
} from "../../testing/product-library.ts"
import type { LibraryProduct } from "./product-library-client.ts"
import {
  findLibraryProduct,
  libraryCategoryName,
  libraryVatRateFor,
  relatedSuggestions,
  starterPackProducts,
} from "./product-library-utils.ts"

const product = (id: string): LibraryProduct => {
  const found = findLibraryProduct(testProductLibrary, id)
  if (found === undefined) throw new Error(`No ${id} in the test library`)
  return found
}

const ids = (products: ReadonlyArray<LibraryProduct>) =>
  products.map(({ id }) => id)

describe("findLibraryProduct", () => {
  test("finds a product by id, a retired one included", () => {
    expect(findLibraryProduct(testProductLibrary, "espresso")?.id).toBe(
      "espresso"
    )
    expect(findLibraryProduct(testProductLibrary, "irish-coffee")?.id).toBe(
      "irish-coffee"
    )
  })

  test("finds nothing for an unknown id", () => {
    expect(findLibraryProduct(testProductLibrary, "ristretto")).toBeUndefined()
  })
})

describe("relatedSuggestions", () => {
  test("offers the related products in their listed order", () => {
    expect(
      ids(
        relatedSuggestions(testProductLibrary, product("cafe-latte"), new Set())
      )
    ).toEqual(["cappuccino", "flat-white"])
  })

  test("leaves out retired and unknown products", () => {
    expect(
      ids(
        relatedSuggestions(testProductLibrary, product("espresso"), new Set())
      )
    ).toEqual(["cappuccino", "flat-white", "americano", "cafe-latte"])
  })

  test("leaves out products the catalog already has", () => {
    expect(
      ids(
        relatedSuggestions(
          testProductLibrary,
          product("espresso"),
          new Set(["espresso", "cappuccino", "cafe-latte"])
        )
      )
    ).toEqual(["flat-white", "americano"])
  })

  test("offers nothing once the catalog has them all", () => {
    expect(
      relatedSuggestions(
        testProductLibrary,
        product("draft-lager-small"),
        new Set(["draft-lager-large"])
      )
    ).toEqual([])
  })
})

describe("libraryVatRateFor", () => {
  const czechRates = [
    {
      id: "standard" as TaxRateId,
      rate: TaxRatePercentage(2100),
      deactivatedAt: null,
    },
    {
      id: "archived-reduced" as TaxRateId,
      rate: TaxRatePercentage(1200),
      deactivatedAt: TimestampMs(1_700_000_000_000),
    },
    {
      id: "reduced" as TaxRateId,
      rate: TaxRatePercentage(1200),
      deactivatedAt: null,
    },
  ]

  test("picks the account's active rate of the library's percentage for its country", () => {
    expect(
      libraryVatRateFor({
        product: product("espresso"),
        country: "CZ",
        taxRates: czechRates,
      })
    ).toBe("reduced")
    expect(
      libraryVatRateFor({
        product: product("draft-lager-large"),
        country: "CZ",
        taxRates: czechRates,
      })
    ).toBe("standard")
  })

  test("picks nothing when the account has no rate of that percentage", () => {
    expect(
      libraryVatRateFor({
        product: product("espresso"),
        country: "SK",
        taxRates: czechRates,
      })
    ).toBeUndefined()
  })

  test("picks nothing for an account without rates or outside the library's countries", () => {
    expect(
      libraryVatRateFor({
        product: product("espresso"),
        country: "CZ",
        taxRates: [],
      })
    ).toBeUndefined()
    expect(
      libraryVatRateFor({
        product: product("espresso"),
        country: null,
        taxRates: czechRates,
      })
    ).toBeUndefined()
  })

  test("picks nothing when the product has no rate for the country", () => {
    expect(
      libraryVatRateFor({
        product: createTestLibraryProduct({ id: "tonic", vat: { SK: 2300 } }),
        country: "CZ",
        taxRates: czechRates,
      })
    ).toBeUndefined()
  })
})

describe("libraryCategoryName", () => {
  test("names the product's category in the language asked for", () => {
    expect(
      libraryCategoryName(testProductLibrary, product("croissant"), "sk")
    ).toBe("Raňajky a pečivo")
  })

  test("names nothing for a category the library does not list", () => {
    expect(
      libraryCategoryName(
        testProductLibrary,
        createTestLibraryProduct({ id: "nachos", category: "snacks" }),
        "cs"
      )
    ).toBeUndefined()
  })
})

describe("starterPackProducts", () => {
  test("lists a pack's products in order, without the retired ones", () => {
    expect(ids(starterPackProducts(testProductLibrary, "cafe"))).toEqual([
      "espresso",
      "cappuccino",
      "croissant",
    ])
  })

  test("lists nothing for an unknown pack", () => {
    expect(starterPackProducts(testProductLibrary, "bakery")).toEqual([])
  })
})
