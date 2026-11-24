import type { DeviceLanguage } from "../../evolu/device-client.ts"
import type { CountryCode } from "../../modules/legal-entity/legal-entity-types.ts"
import type { TaxRateRow } from "../../modules/tax-rate/tax-rate.ts"
import {
  type TaxRateId,
  TaxRatePercentage,
} from "../../modules/tax-rate/tax-rate-types.ts"
import { findActiveTaxRateByPercentage } from "../../modules/tax-rate/tax-rate-utils.ts"
import {
  type LibraryProduct,
  libraryLanguage,
  type ProductLibrary,
} from "./product-library-client.ts"

/**
 * The library product of `id`, retired ones included: an item keeps pointing
 * at the product it came from after the library stops suggesting it.
 */
export const findLibraryProduct = (
  library: ProductLibrary,
  id: string
): LibraryProduct | undefined =>
  library.products.find((product) => product.id === id)

/** The library products of `ids` in their order, skipping unknown and retired ones. */
const suggestableProducts = (
  library: ProductLibrary,
  ids: ReadonlyArray<string>
): ReadonlyArray<LibraryProduct> =>
  ids.flatMap((id) => {
    const product = findLibraryProduct(library, id)
    return product === undefined || product.retired ? [] : [product]
  })

/**
 * What to offer next once `product` is in the catalog: its related products
 * in the library's order, leaving out those the catalog already has (by
 * `catalogItem.libraryProductId`) and those the library no longer suggests
 * or does not know.
 */
export const relatedSuggestions = (
  library: ProductLibrary,
  product: LibraryProduct,
  catalogLibraryProductIds: ReadonlySet<string>
): ReadonlyArray<LibraryProduct> =>
  suggestableProducts(library, [...new Set(product.related)]).filter(
    (related) =>
      related.id !== product.id && !catalogLibraryProductIds.has(related.id)
  )

/**
 * The account's tax rate a library product is sold at in `country`: the
 * active rate whose percentage equals the library's. `undefined` when the
 * country is not one the library knows (`null`, "other"), the product has no
 * rate for it, or the account has no such rate — a form then keeps its own
 * default.
 */
export const libraryVatRateFor = ({
  product,
  country,
  taxRates,
}: {
  readonly product: LibraryProduct
  readonly country: CountryCode | null
  readonly taxRates: ReadonlyArray<
    Pick<TaxRateRow, "id" | "rate" | "deactivatedAt">
  >
}): TaxRateId | undefined => {
  if (country === null) return undefined
  const percentage = product.vat[country]
  if (percentage === undefined) return undefined

  return findActiveTaxRateByPercentage(taxRates, TaxRatePercentage(percentage))
}

/** The name of a product's library category, `undefined` for an unknown one. */
export const libraryCategoryName = (
  library: ProductLibrary,
  product: LibraryProduct,
  language: DeviceLanguage
): string | undefined =>
  library.categories.find((category) => category.id === product.category)
    ?.names[libraryLanguage(language)]

/**
 * The products a starter pack offers, in its order, without the ones the
 * library retired or does not know. An unknown pack offers none.
 */
export const starterPackProducts = (
  library: ProductLibrary,
  packId: string
): ReadonlyArray<LibraryProduct> => {
  const pack = library.packs.find((candidate) => candidate.id === packId)
  return pack === undefined ? [] : suggestableProducts(library, pack.products)
}
