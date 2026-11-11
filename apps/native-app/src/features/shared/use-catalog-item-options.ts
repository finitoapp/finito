import { NO_OPTION } from "@payky/app-shared/inline-edit-codecs"
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
 * The tax-rate option list both item forms build the same way, as web's
 * `useCatalogItemOptions`: the "not set" entry, then the rates that are
 * still selectable (an archived one only while the item holds it). A
 * category is picked from `CategoryCombobox` instead (catalog/0004).
 */
export const useCatalogItemOptions = (currentTaxRateId?: TaxRateId | null) => {
  const { t } = useTranslation()
  const { data: taxRates } = useEvoluQuery(taxRatesQuery)

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
    taxRateOptions,
    defaultTaxRate: taxRates.find(
      (rate) => rate.isDefault === 1 && rate.deactivatedAt === null
    ),
  }
}
