import type {
  LibraryProduct,
  ProductLibrary,
} from "../integrations/product-library/product-library-client.ts"

/**
 * A library product with every field set, for a test that cares about a few
 * of them. Its names default to `id` in every language.
 */
export const createTestLibraryProduct = (
  overrides: Partial<LibraryProduct> & Pick<LibraryProduct, "id">
): LibraryProduct => ({
  category: "coffee",
  names: { cs: overrides.id, sk: overrides.id, en: overrides.id },
  synonyms: {},
  related: [],
  vat: { CZ: 1200, SK: 1900 },
  image: null,
  retired: false,
  ...overrides,
})

/**
 * A small library shaped after the published `v1/library.json`: a café's
 * coffees, a pastry and a bar's beers, one retired product, and two packs.
 * Espresso is related to a retired product and to one this library does not
 * have; its synonyms leave out the "esspreso" the real library lists, so a
 * search finding it from that typo proves the typo matching.
 */
export const testProductLibrary: ProductLibrary = {
  version: "26.11.1",
  imageSizes: [256, 512],
  categories: [
    { id: "coffee", names: { cs: "Káva", sk: "Káva", en: "Coffee" } },
    { id: "beer", names: { cs: "Pivo", sk: "Pivo", en: "Beer" } },
    {
      id: "pastry",
      names: {
        cs: "Snídaně a pečivo",
        sk: "Raňajky a pečivo",
        en: "Breakfast and pastry",
      },
    },
  ],
  products: [
    createTestLibraryProduct({
      id: "draft-lager-large",
      category: "beer",
      names: {
        cs: "Točené pivo 0,5 l",
        sk: "Čapované pivo 0,5 l",
        en: "Draught lager 0.5 l",
      },
      synonyms: {
        cs: ["pivo", "velké pivo", "točené", "plzeň"],
        sk: ["pivo", "velke pivo", "capovane"],
      },
      related: ["draft-lager-small", "non-alcoholic-beer"],
      vat: { CZ: 2100, SK: 2300 },
    }),
    createTestLibraryProduct({
      id: "draft-lager-small",
      category: "beer",
      names: {
        cs: "Točené pivo 0,3 l",
        sk: "Čapované pivo 0,3 l",
        en: "Draught lager 0.3 l",
      },
      synonyms: { cs: ["malé pivo", "malé"], sk: ["male pivo"] },
      related: ["draft-lager-large"],
      vat: { CZ: 2100, SK: 2300 },
    }),
    createTestLibraryProduct({
      id: "non-alcoholic-beer",
      category: "beer",
      names: {
        cs: "Nealkoholické pivo",
        sk: "Nealkoholické pivo",
        en: "Non-alcoholic beer",
      },
      synonyms: { cs: ["nealko pivo", "nealko"], sk: ["nealko"] },
      related: ["draft-lager-large"],
    }),
    createTestLibraryProduct({
      id: "americano",
      names: { cs: "Americano", sk: "Americano", en: "Americano" },
      synonyms: { cs: ["amerikano"], sk: ["amerikano"] },
      related: ["espresso", "cafe-latte"],
    }),
    createTestLibraryProduct({
      id: "cafe-latte",
      names: { cs: "Caffè latte", sk: "Caffè latte", en: "Caffè latte" },
      synonyms: { cs: ["latté", "late"], sk: ["latte", "late"] },
      related: ["cappuccino", "flat-white"],
    }),
    createTestLibraryProduct({
      id: "cappuccino",
      names: { cs: "Cappuccino", sk: "Cappuccino", en: "Cappuccino" },
      synonyms: {
        cs: ["kapučíno", "capuccino", "cappucino"],
        sk: ["kapucino", "capuccino"],
      },
      related: ["cafe-latte", "flat-white", "espresso", "croissant"],
    }),
    createTestLibraryProduct({
      id: "espresso",
      names: { cs: "Espresso", sk: "Espresso", en: "Espresso" },
      synonyms: { cs: ["presso", "kafe", "káva"], sk: ["presso", "kava"] },
      related: [
        "cappuccino",
        "irish-coffee",
        "flat-white",
        "ristretto",
        "americano",
        "cafe-latte",
      ],
      image: "espresso.3f9a2c",
    }),
    createTestLibraryProduct({
      id: "flat-white",
      names: { cs: "Flat white", sk: "Flat white", en: "Flat white" },
      synonyms: { cs: ["flatwhite"], sk: ["flatwhite"] },
      related: ["cappuccino", "cafe-latte"],
    }),
    createTestLibraryProduct({
      id: "irish-coffee",
      names: { cs: "Irská káva", sk: "Írska káva", en: "Irish coffee" },
      synonyms: { cs: ["irish coffee"] },
      vat: { CZ: 2100, SK: 2300 },
      retired: true,
    }),
    createTestLibraryProduct({
      id: "croissant",
      category: "pastry",
      names: { cs: "Croissant", sk: "Croissant", en: "Croissant" },
      synonyms: { cs: ["kroasan", "máslový croissant"], sk: ["kroasan"] },
      related: ["cappuccino"],
      image: "croissant.b71e04",
    }),
  ],
  packs: [
    {
      id: "cafe",
      names: { cs: "Kavárna", sk: "Kaviareň", en: "Café" },
      products: ["espresso", "cappuccino", "irish-coffee", "croissant"],
    },
    {
      id: "bar",
      names: { cs: "Bar", sk: "Bar", en: "Bar" },
      products: [
        "draft-lager-large",
        "draft-lager-small",
        "non-alcoholic-beer",
      ],
    },
  ],
}
