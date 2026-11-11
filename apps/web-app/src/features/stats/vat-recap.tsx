import { rowsByCurrency } from "@payky/app-shared/stats-sections"
import { hasTaxableLines } from "@payky/core/modules/bill-line/bill-line-tax-utils"
import {
  discountedBillLinesQuery,
  taxRecapQuery,
} from "@payky/core/modules/sales-stats/sales-stats-queries"
import { salesTaxRecap } from "@payky/core/modules/sales-stats/sales-stats-utils"
import { taxRatesQuery } from "@payky/core/modules/tax-rate/tax-rate-queries"
import { verticalNavShellClassName } from "@/components/vertical-nav.tsx"
import { TaxRecap } from "@/features/shared/tax-recap.tsx"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useLocale } from "@/hooks/use-locale.ts"
import { cn } from "@/lib/utils.ts"
import { CurrencyGroup } from "./stats-section.tsx"
import { type SalesStats, useStatsRows } from "./use-sales-stats.ts"

/**
 * The VAT of what closed bills sold, per rate, through the bill's own
 * `TaxRecap`. `TaxRecap` titles itself, so the card has no heading of its
 * own; a shop that is not a VAT payer sees nothing.
 */
export function VatRecap({ stats }: { readonly stats: SalesStats }) {
  const locale = useLocale()
  const { data: rates } = useEvoluQuery(taxRatesQuery)
  const rows = useStatsRows(
    "taxRecap",
    taxRecapQuery,
    stats.ranges.range,
    stats.live
  )
  // Bills with a discount, whose VAT is counted from their net lines
  // (catalog/0003).
  const discountedLines = useStatsRows(
    "discountedBillLines",
    discountedBillLinesQuery,
    stats.ranges.range,
    stats.live
  )

  if (rows === undefined || discountedLines === undefined) return null

  const groups = rowsByCurrency(
    [...rows, ...discountedLines],
    stats.accountCurrency
  )
    .map(({ currency }) => ({
      currency,
      recap: salesTaxRecap({ rows, discountedLines, currency, rates }),
    }))
    .filter((group) => hasTaxableLines(group.recap))

  if (groups.length === 0) return null

  return (
    <section className={cn(verticalNavShellClassName, "gap-4 p-4")}>
      {groups.map((group) => (
        <CurrencyGroup
          key={group.currency}
          currency={group.currency}
          showCurrency={groups.length > 1}
        >
          <TaxRecap
            rows={group.recap}
            currency={group.currency}
            locale={locale}
          />
        </CurrencyGroup>
      ))}
    </section>
  )
}
