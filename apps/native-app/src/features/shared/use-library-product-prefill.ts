import {
  type LibraryProductPrefill,
  libraryProductPrefill,
} from "@payky/app-shared/library-product-prefill"
import type { LibraryProduct } from "@payky/core/integrations/product-library/product-library-client"
import { catalogCategoriesQuery } from "@payky/core/modules/catalog-category/catalog-category-queries"
import { legalEntityQuery } from "@payky/core/modules/legal-entity/legal-entity-queries"
import { taxRatesQuery } from "@payky/core/modules/tax-rate/tax-rate-queries"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useProductLibrary } from "../../hooks/use-product-library.ts"
import { useTranslation } from "../../hooks/use-translation.ts"

/**
 * What a create form fills in for a library product the merchant picked
 * (`libraryProductPrefill`), against this account's country, VAT rates and
 * categories and the device's language; `undefined` without a loaded
 * library. The forms read these queries already, so they preload them.
 */
export function useLibraryProductPrefill(): (
  product: LibraryProduct
) => LibraryProductPrefill | undefined {
  const { language } = useTranslation()
  const { library } = useProductLibrary()
  const [legalEntity] = useEvoluQuery(legalEntityQuery).data
  const { data: taxRates } = useEvoluQuery(taxRatesQuery)
  const { data: categories } = useEvoluQuery(catalogCategoriesQuery)
  return (product) =>
    library === undefined
      ? undefined
      : libraryProductPrefill({
          library,
          product,
          language,
          country: legalEntity?.country ?? null,
          taxRates,
          categories,
        })
}
