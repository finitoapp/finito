import type { DeviceLanguage } from "@payky/core/evolu/device-client"
import type {
  LibraryProduct,
  ProductLibrary,
} from "@payky/core/integrations/product-library/product-library-client"
import {
  libraryCategoryName,
  libraryVatRateFor,
} from "@payky/core/integrations/product-library/product-library-utils"
import type { CatalogCategoryId } from "@payky/core/modules/catalog-category/catalog-category-types"
import { sameCategoryName } from "@payky/core/modules/catalog-category/catalog-category-utils"
import type { CountryCode } from "@payky/core/modules/legal-entity/legal-entity-types"
import {
  type NonEmptyString255,
  NonEmptyString255Schema,
} from "@payky/core/modules/shared/schema"
import type { TaxRateRow } from "@payky/core/modules/tax-rate/tax-rate"
import type { TaxRateId } from "@payky/core/modules/tax-rate/tax-rate-types"
import { foldDiacritics } from "@payky/core/utils/sql-text-search"
import type { CategoryChoice } from "./catalog-category-choice.ts"

interface Category {
  readonly id: CatalogCategoryId
  readonly name: string
}

/**
 * What a create form takes from a library product the merchant picked
 * (`docs/plans/product-library.md`): never a price. `undefined` leaves the
 * form's own value alone.
 */
export interface LibraryProductPrefill {
  /** The product's name in the device's language. */
  readonly name: string
  readonly libraryProductId: NonEmptyString255
  /**
   * The account's active rate of the library's VAT for its country
   * (`libraryVatRateFor`); `undefined` keeps the form's default.
   */
  readonly taxRateId: TaxRateId | undefined
  /**
   * The category of the library's category name: the merchant's own that
   * spells it, case and diacritics aside, else that name to add when the
   * item is saved (catalog/0004); `undefined` when the library does not
   * name the product's category.
   */
  readonly category: CategoryChoice | undefined
}

/**
 * The category a library category name stands for in this catalog: the
 * category spelling it (case and surrounding spaces aside, as
 * `findOrCreateCatalogCategory` reads a name), else one that spells it
 * without diacritics ("Kava" for the library's "Káva"), else the name to add
 * with the item, which the create forms resolve on save
 * (`resolveCategoryChoice`).
 */
export const libraryCategoryChoice = (
  categories: ReadonlyArray<Category>,
  name: string
): CategoryChoice | undefined => {
  const exact = categories.find((category) =>
    sameCategoryName(category.name, name)
  )
  const folded = foldDiacritics(name.trim())
  const match =
    exact ??
    categories.find(
      (category) => foldDiacritics(category.name.trim()) === folded
    )
  if (match !== undefined) return { kind: "existing", id: match.id }

  const parsed = NonEmptyString255Schema.safeParse(name.trim())
  return parsed.success ? { kind: "new", name: parsed.data } : undefined
}

/**
 * What a create form fills in once the merchant picks `product` from the
 * name suggestions or a related product's chip: its name in `language`, its
 * id, the matching VAT rate of the account's `country` and its category. The
 * price stays the merchant's to type.
 */
export const libraryProductPrefill = ({
  library,
  product,
  language,
  country,
  taxRates,
  categories,
}: {
  readonly library: ProductLibrary
  readonly product: LibraryProduct
  readonly language: DeviceLanguage
  readonly country: CountryCode | null
  readonly taxRates: ReadonlyArray<
    Pick<TaxRateRow, "id" | "rate" | "deactivatedAt">
  >
  readonly categories: ReadonlyArray<Category>
}): LibraryProductPrefill | undefined => {
  const libraryProductId = NonEmptyString255Schema.safeParse(product.id)
  if (!libraryProductId.success) return undefined

  const categoryName = libraryCategoryName(library, product, language)
  return {
    name: product.names[language],
    libraryProductId: libraryProductId.data,
    taxRateId: libraryVatRateFor({ product, country, taxRates }),
    category:
      categoryName === undefined
        ? undefined
        : libraryCategoryChoice(categories, categoryName),
  }
}

/**
 * The category a related product's chip opens the create form with: the one
 * the merchant gave the item just created, when both products sit in one
 * library category — the merchant may have filed the library's "Coffee"
 * under a category of their own. `undefined` lets the library's category
 * decide (`libraryProductPrefill`).
 */
export const relatedItemCategoryId = ({
  created,
  createdCategoryId,
  related,
}: {
  /** The library product of the item just created. */
  readonly created: LibraryProduct
  readonly createdCategoryId: CatalogCategoryId | null
  readonly related: LibraryProduct
}): CatalogCategoryId | undefined =>
  related.category === created.category && createdCategoryId !== null
    ? createdCategoryId
    : undefined
