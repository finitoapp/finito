import type { OpenBillRow } from "@payky/core/modules/bill/bill-queries"
import {
  calculateBillLineSummaries,
  deriveBillSummaryStats,
} from "@payky/core/modules/bill-line/bill-line-utils"
import { Table2 } from "lucide-react"
import { type ReactNode, useMemo } from "react"
import { Card } from "@/components/ui/card.tsx"
import { useLocale } from "@/hooks/use-locale.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatMoney } from "@/lib/format-utils.ts"
import { cn } from "@/lib/utils.ts"

/**
 * Visual shell shared by every tile in the tables overview grid (real
 * tables and the "no table" bucket alike) and the bill page's table
 * assignment picker, so all three show occupancy the same way. Takes a
 * plain name/subtitle rather than a `TableRow` so a non-table tile can
 * reuse it without faking a table row.
 *
 * The state is the tile's whole surface, as on a till's floor plan: an
 * occupied table is tinted, one that needs a look (`attention`: a payment
 * in flight or partly in) takes the info tone, and a free one is left
 * bare, an empty slot on the background — so on a busy floor the free
 * tables are the ones that stand out, which is what seating looks for.
 * `icon` defaults to the table glyph; pass `null` for none.
 */
export function TableTileShell({
  name,
  subtitle,
  occupied,
  attention = false,
  selected,
  className,
  icon = <Table2 className="size-5 shrink-0 text-muted-foreground" />,
  children,
}: {
  readonly name: string
  readonly subtitle?: ReactNode
  readonly occupied: boolean
  readonly attention?: boolean
  readonly selected?: boolean
  readonly className?: string
  readonly icon?: ReactNode
  readonly children: ReactNode
}) {
  return (
    <Card
      className={cn(
        "h-full gap-3 p-4",
        occupied
          ? attention
            ? "bg-info/10 ring-info/40"
            : "bg-primary/10 ring-primary/30"
          : "bg-transparent",
        // Inset, the selection ring included, so a scrolling grid or
        // dialog does not clip the outer columns.
        "ring-inset",
        selected && "ring-2 ring-primary",
        className
      )}
    >
      <div className="min-w-0">
        <p className="line-clamp-3 text-base font-semibold lg:text-lg">
          {name}
        </p>
        {subtitle !== undefined && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-2">{children}</div>
        {icon}
      </div>
    </Card>
  )
}

export function OccupiedTableSummary({ bill }: { readonly bill: OpenBillRow }) {
  const { t } = useTranslation()
  const locale = useLocale()
  // `lines`/`items` ride along on `openBillsQuery`, so a tile needs no query
  // of its own — a floor view of N open bills used to open 2N of them.
  const { itemCount, totalAmount } = useMemo(
    () =>
      deriveBillSummaryStats(
        calculateBillLineSummaries(bill.lines, bill.items)
      ),
    [bill]
  )

  return (
    <div className="flex flex-col gap-0.5 text-muted-foreground">
      <p className="text-sm">{t("bill.itemsCount", { value: itemCount })}</p>
      <p className="text-sm font-semibold text-foreground">
        {formatMoney({ value: totalAmount, currency: bill.currency }, locale)}
      </p>
    </div>
  )
}
