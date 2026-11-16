import type { CategoryChoice } from "@payky/app-shared/catalog-category-choice"
import type { NO_OPTION } from "@payky/app-shared/inline-edit-codecs"
import {
  type LibraryPrefillFields,
  type LibraryProductPrefill,
  libraryPrefillFields,
  libraryProductPrefill,
  nameKeepsLibraryProduct,
} from "@payky/app-shared/library-product-prefill"
import type { LibraryProduct } from "@payky/core/integrations/product-library/product-library-client"
import { catalogCategoriesQuery } from "@payky/core/modules/catalog-category/catalog-category-queries"
import { legalEntityQuery } from "@payky/core/modules/legal-entity/legal-entity-queries"
import type { NonEmptyString255 } from "@payky/core/modules/shared/schema"
import { taxRatesQuery } from "@payky/core/modules/tax-rate/tax-rate-queries"
import type { TaxRateId } from "@payky/core/modules/tax-rate/tax-rate-types"
import { useState } from "react"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import {
  libraryProductById,
  useProductLibrary,
} from "../../hooks/use-product-library.ts"
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

const noCategory: CategoryChoice = { kind: "none" }

/**
 * The fields of an item's create form a library product fills (catalog/0006,
 * catalog/0007): the name, the library product it links, the VAT rate and
 * the category. A pick fills the VAT rate and category only where the
 * merchant has not set them by hand (`libraryPrefillFields`), and the link
 * lasts only while the typed name still refers to the product
 * (`nameKeepsLibraryProduct`): typed into another product's name, the item
 * would otherwise carry the wrong picture and related products.
 */
export function useLibraryItemFields({
  initialName = "",
  defaultTaxRateId,
}: {
  readonly initialName?: string
  readonly defaultTaxRateId: TaxRateId | typeof NO_OPTION
}) {
  const { library } = useProductLibrary()
  const prefillFor = useLibraryProductPrefill()
  const [name, setName] = useState(initialName)
  const [libraryProductId, setLibraryProductId] =
    useState<NonEmptyString255 | null>(null)
  const [initial] = useState<LibraryPrefillFields>(() => ({
    taxRateId: defaultTaxRateId,
    category: noCategory,
  }))
  const [fields, setFields] = useState(initial)
  const [chosen, setChosen] = useState({ taxRateId: false, category: false })

  /** Fills the form from a prefill, the merchant's own choices kept. */
  const apply = (prefill: LibraryProductPrefill) => {
    setName(prefill.name)
    setLibraryProductId(prefill.libraryProductId)
    setFields((current) =>
      libraryPrefillFields({ prefill, current, initial, chosen })
    )
  }

  return {
    name,
    libraryProductId,
    taxRateId: fields.taxRateId,
    category: fields.category,
    /** The name as typed; the link goes once it stops naming the product. */
    typeName: (next: string) => {
      setName(next)
      if (libraryProductId === null || library === undefined) return
      const product = libraryProductById(library, libraryProductId)
      if (product !== undefined && !nameKeepsLibraryProduct(next, product))
        setLibraryProductId(null)
    },
    /** A name filled in from elsewhere, as an Open Facts lookup's. */
    setName,
    chooseTaxRate: (taxRateId: TaxRateId | typeof NO_OPTION) => {
      setFields((current) => ({ ...current, taxRateId }))
      setChosen((current) => ({ ...current, taxRateId: true }))
    },
    chooseCategory: (category: CategoryChoice) => {
      setFields((current) => ({ ...current, category }))
      setChosen((current) => ({ ...current, category: true }))
    },
    unlink: () => setLibraryProductId(null),
    prefillFor,
    apply,
    /** Fills the form from a picked product; `false` when it cannot. */
    pick: (product: LibraryProduct): boolean => {
      const prefill = prefillFor(product)
      if (prefill === undefined) return false
      apply(prefill)
      return true
    },
  }
}
