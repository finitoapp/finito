import { describe, expect, test } from "vitest"

import {
  createTestLibraryProduct,
  testProductLibrary,
} from "../../testing/product-library.ts"
import type { ProductLibrary } from "./product-library-client.ts"
import { searchLibraryProducts } from "./product-library-search.ts"

const searchIds = (
  query: string,
  {
    language = "cs",
    limit = 10,
    library = testProductLibrary,
  }: {
    readonly language?: "cs" | "sk" | "en" | "vi"
    readonly limit?: number
    readonly library?: ProductLibrary
  } = {}
): ReadonlyArray<string> =>
  searchLibraryProducts(library, { query, language, limit }).map(
    (product) => product.id
  )

describe("searchLibraryProducts", () => {
  test("finds Espresso from the typo esspreso", () => {
    expect(searchIds("esspreso")[0]).toBe("espresso")
  })

  test("finds Cappuccino from kapucino, without its diacritics", () => {
    expect(searchIds("kapucino")[0]).toBe("cappuccino")
  })

  test("finds the draught lagers from pivo", () => {
    expect(searchIds("pivo").slice(0, 2)).toEqual([
      "draft-lager-large",
      "draft-lager-small",
    ])
  })

  test("ignores case and diacritics in the query", () => {
    expect(searchIds("TOČENÉ PIVO")).toEqual([
      "draft-lager-large",
      "draft-lager-small",
    ])
    expect(searchIds("kava")).toEqual(["espresso"])
  })

  test("finds a name while it is still being typed with a typo", () => {
    expect(searchIds("esspres")).toEqual(["espresso"])
  })

  test("matches the names and synonyms of the language asked for", () => {
    expect(searchIds("capovane", { language: "sk" })).toEqual([
      "draft-lager-large",
      "draft-lager-small",
    ])
    expect(searchIds("capovane", { language: "cs" })).toEqual([])
    expect(searchIds("draught", { language: "en" })).toEqual([
      "draft-lager-large",
      "draft-lager-small",
    ])
  })

  test("matches the names of the language asked for only", () => {
    // One library searched in turn in each language, as a device switching
    // its language would: what one language indexed never answers another.
    expect(searchIds("plzen", { language: "cs" })).toEqual([
      "draft-lager-large",
    ])
    expect(searchIds("plzen", { language: "sk" })).toEqual([])
    expect(searchIds("capovane", { language: "sk" })).toEqual([
      "draft-lager-large",
      "draft-lager-small",
    ])
    expect(searchIds("capovane", { language: "cs" })).toEqual([])
    expect(searchIds("plzen", { language: "en" })).toEqual([])
    expect(searchIds("plzen", { language: "cs" })).toEqual([
      "draft-lager-large",
    ])
  })

  test("ranks an exact name over a name prefix, a word prefix, a synonym, a substring and a typo", () => {
    const library: ProductLibrary = {
      ...testProductLibrary,
      products: [
        createTestLibraryProduct({ id: "lima" }),
        createTestLibraryProduct({ id: "sublime" }),
        createTestLibraryProduct({
          id: "citrus",
          synonyms: { cs: ["lime juice"] },
        }),
        createTestLibraryProduct({
          id: "pie",
          names: { cs: "Key lime pie", sk: "Key lime pie", en: "Key lime pie" },
        }),
        createTestLibraryProduct({ id: "limeade" }),
        createTestLibraryProduct({ id: "lime" }),
      ],
    }

    expect(searchIds("lime", { library })).toEqual([
      "lime",
      "limeade",
      "pie",
      "citrus",
      "sublime",
      "lima",
    ])
  })

  test("keeps the library's order among equally good matches", () => {
    expect(searchIds("ca")).toEqual(["cafe-latte", "cappuccino", "americano"])
  })

  test("allows one typo from four letters and two from seven", () => {
    expect(searchIds("kafa")).toEqual(["espresso"])
    expect(searchIds("kfa")).toEqual([])
    expect(searchIds("esprso")).toEqual([])
    expect(searchIds("expresso")).toEqual(["espresso"])
  })

  test("a Vietnamese device searches the library's Czech names", () => {
    expect(searchIds("kapucino", { language: "vi" })).toEqual(
      searchIds("kapucino", { language: "cs" })
    )
    expect(searchIds("plzen", { language: "vi" })).toEqual([
      "draft-lager-large",
    ])
  })

  test("never suggests a retired product", () => {
    expect(searchIds("irish")).toEqual([])
    expect(searchIds("irská káva")).toEqual([])
  })

  test("suggests nothing for a blank query", () => {
    expect(searchIds("")).toEqual([])
    expect(searchIds("   ")).toEqual([])
  })

  test("returns at most limit products", () => {
    expect(searchIds("pivo", { limit: 1 })).toEqual(["draft-lager-large"])
  })
})
