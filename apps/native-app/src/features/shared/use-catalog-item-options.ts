import { NO_OPTION } from "@payky/app-shared/inline-edit-codecs"
import { catalogCategoriesQuery } from "@payky/core/modules/catalog-category/catalog-category-queries"
import type { CatalogCategoryId } from "@payky/core/modules/catalog-category/catalog-category-types"
import { taxRatesQuery } from "@payky/core/modules/tax-rate/tax-rate-queries"
import type { TaxRateId } from "@payky/core/modules/tax-rate/tax-rate-types"
import {
  filterSelectableTaxRates,
  formatTaxRateLabel,
} from "@payky/core/modules/tax-rate/tax-rate-utils"
import type { OptionToggleGroupOption } from "../../components/option-toggle-group.tsx"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useTranslation } from "../../hooks/use-translation.ts"

/**
 * The category and tax-rate option lists both item forms build the same way,
 * as web's `useCatalogItemOptions`: the "not set" entry, then the rows that
 * are still selectable (an archived tax rate only while the item holds it).
 */
export const useCatalogItemOptions = (currentTaxRateId?: TaxRateId | null) => {
  const { t } = useTranslation()
  const { data: categories } = useEvoluQuery(catalogCategoriesQuery)
  const { data: taxRates } = useEvoluQuery(taxRatesQuery)

  const categoryOptions: ReadonlyArray<
    OptionToggleGroupOption<CatalogCategoryId | typeof NO_OPTION>
  > = [
    { value: NO_OPTION, title: t("catalog.items.form.category.none") },
    ...categories.map((category) => ({
      value: category.id,
      title: category.name,
    })),
  ]
  const taxRateOptions: ReadonlyArray<
    OptionToggleGroupOption<TaxRateId | typeof NO_OPTION>
  > = [
    { value: NO_OPTION, title: t("catalog.items.form.taxRate.none") },
    ...filterSelectableTaxRates(taxRates, currentTaxRateId).map((taxRate) => ({
      value: taxRate.id,
      title: `${formatTaxRateLabel(taxRate)}${
        taxRate.deactivatedAt === null
          ? ""
          : ` — ${t("settings.taxRates.archived.title")}`
      }`,
    })),
  ]

  return {
    categoryOptions,
    taxRateOptions,
    defaultTaxRate: taxRates.find(
      (rate) => rate.isDefault === 1 && rate.deactivatedAt === null
    ),
  }
}
