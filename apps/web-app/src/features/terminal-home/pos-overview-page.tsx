import { useTimestamp } from "@dedalik/use-react"
import { formatElapsed } from "@payky/app-shared/format-elapsed"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  type BillPaymentState,
  type BillWithStats,
  billPaymentState,
  buildBillRows,
  elapsedSeverity,
  formatRowsSum,
  groupBillRowsByTableId,
  matchesTableFilter,
  type TableFilter,
  TableFilterSchema,
  tablePaymentState,
} from "@payky/app-shared/pos-overview"
import { selfPaySettingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { offersOrders } from "@payky/core/modules/app-settings/app-settings-utils"
import {
  type OpenBillRow,
  openBillsQuery,
} from "@payky/core/modules/bill/bill-queries"
import { createRandomBillId } from "@payky/core/modules/bill/bill-types"
import { menuOrdersToServeQuery } from "@payky/core/modules/menu-order/menu-order-queries"
import type { TableRow } from "@payky/core/modules/table/table"
import { tablesQuery } from "@payky/core/modules/table/table-queries"
import type { TableId } from "@payky/core/modules/table/table-types"
import { useLocalStorageState } from "@payky/web-shared/use-local-storage-state"
import { Link } from "@tanstack/react-router"
import {
  ChartPieIcon,
  ChevronRightIcon,
  HourglassIcon,
  type LucideIcon,
  PlusIcon,
  UsersIcon,
} from "lucide-react"
import { type ReactNode, useMemo, useState } from "react"
import { buttonVariants } from "@/components/ui/button.tsx"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx"
import { TableTileShell } from "@/features/shared/table-tile.tsx"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useLocale } from "@/hooks/use-locale.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatMoney } from "@/lib/format-utils.ts"
import { cn } from "@/lib/utils.ts"

const TABLE_FILTER_STORAGE_KEY = "payky.posTableFilter"

const tableFilterLabelKeys = {
  all: "home.pos.filter.all",
  occupied: "home.pos.filter.occupied",
  free: "home.pos.filter.free",
} as const satisfies Record<TableFilter, TranslationKey>

const elapsedClassNames = {
  veryLong: "rounded-sm bg-destructive/10 px-1 font-semibold text-destructive",
  long: "rounded-sm bg-warning/10 px-1 font-semibold text-warning",
  normal: "text-muted-foreground",
} satisfies Record<ReturnType<typeof elapsedSeverity>, string>

const elapsedClassName = (elapsedMs: number) =>
  elapsedClassNames[elapsedSeverity(elapsedMs)]

/**
 * The POS home screen, laid out as tills usually do: a strip of floor
 * stats with a free/occupied filter, a "no table" strip that starts a quick
 * bill and lists the open bills on no table, and below it one tile per
 * table. The strip sits above the grid rather than as its last tile because
 * a quick bill is a till's everyday action, not the exception.
 */
export function PosOverviewPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const { data: tables } = useEvoluQuery(tablesQuery)
  const { data: openBills } = useEvoluQuery(openBillsQuery)
  const [tableFilter, setTableFilter] = useLocalStorageState(
    TABLE_FILTER_STORAGE_KEY,
    "all",
    TableFilterSchema
  )
  // ponytail: 30 s tick, so an expired invoice's "paying" state can outlive
  // `expiresAt` by up to that — use `useNow(expiresAt)` if it ever matters.
  const now = useTimestamp({ interval: 30_000 })
  // Derived from the rows' embedded `lines`/`items`, not a per-bill query:
  // a query per bill meant the floor view opened two more for every bill on
  // screen. Newest first, in every tile.
  const rows = useMemo(() => buildBillRows(openBills), [openBills])
  const rowsByTableId = useMemo(
    () => groupBillRowsByTableId(rows, new Set(tables.map(({ id }) => id))),
    [rows, tables]
  )

  const tableTiles = tables.map((table) => ({
    table,
    rows: rowsByTableId.get(table.id) ?? [],
  }))
  const occupiedCount = tableTiles.filter((tile) => tile.rows.length > 0).length
  const visibleTiles = tableTiles.filter((tile) =>
    matchesTableFilter(tableFilter, tile.rows.length > 0)
  )
  const floorTotal = formatRowsSum(rows, "left", (money) =>
    formatMoney(money, locale)
  )

  return (
    <div className="mt-4 flex flex-col gap-3 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <dl className="flex gap-6">
          {tables.length > 0 && (
            <FloorStat
              label={t("home.pos.stats.tables")}
              value={`${occupiedCount} / ${tables.length}`}
            />
          )}
          <FloorStat label={t("home.pos.stats.bills")} value={rows.length} />
          {floorTotal !== undefined && (
            <FloorStat label={t("home.pos.stats.total")} value={floorTotal} />
          )}
        </dl>
        {tables.length > 0 && (
          <ToggleGroup<TableFilter>
            value={[tableFilter]}
            onValueChange={(nextValue) => {
              const [next] = nextValue
              if (next !== undefined) setTableFilter(next)
            }}
            variant="outline"
          >
            {TableFilterSchema.options.map((filter) => (
              <ToggleGroupItem
                key={filter}
                value={filter}
                className="h-10 px-4"
              >
                {t(tableFilterLabelKeys[filter])}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </div>
      <ToServeStrip />
      <NoTableStrip rows={rowsByTableId.get(null) ?? []} now={now} />
      {visibleTiles.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]">
          {visibleTiles.map((tile) => (
            <TableTile
              key={tile.table.id}
              table={tile.table}
              rows={tile.rows}
              now={now}
            />
          ))}
        </div>
      ) : (
        tables.length > 0 && (
          <p className="px-1 py-6 text-center text-sm text-muted-foreground">
            {t(
              tableFilter === "free"
                ? "home.pos.noneFree"
                : "home.pos.noneOccupied"
            )}
          </p>
        )
      )}
      {tables.length === 0 && (
        <p className="px-1 text-sm text-muted-foreground">
          {t("home.pos.noTables")}{" "}
          <Link
            to="/catalog/tables"
            className="font-medium text-foreground underline underline-offset-4"
          >
            {t("home.pos.addTables")}
          </Link>
        </p>
      )}
    </div>
  )
}

function FloorStat({
  label,
  value,
}: {
  readonly label: string
  readonly value: ReactNode
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

const billPaymentStateIcons = {
  paymentPending: HourglassIcon,
  partiallyPaid: ChartPieIcon,
} satisfies Record<BillPaymentState, LucideIcon>

/** Covers the whole tile, so its most likely next step needs no aiming. */
const stretchedLinkClassName =
  "absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

function ToServeStrip() {
  const { t } = useTranslation()
  const {
    data: [settings],
  } = useEvoluQuery(selfPaySettingsQuery)
  const { data: orders } = useEvoluQuery(menuOrdersToServeQuery)

  if (!offersOrders(settings) && orders.length === 0) return null

  return (
    <Link
      to="/orders"
      className="flex items-center gap-3 rounded-xl bg-card p-3 pl-4 ring-1 ring-foreground/10 ring-inset"
    >
      <span className="flex-1 text-sm font-semibold">{t("nav.orders")}</span>
      <span className="text-lg font-semibold tabular-nums">
        {orders.length}
      </span>
      <ChevronRightIcon className="size-4 text-muted-foreground" />
    </Link>
  )
}

/**
 * The open bills on no table and the quick bill that starts another. Always
 * shown, empty or not, so the quick bill is always one tap away.
 */
function NoTableStrip({
  rows,
  now,
}: {
  readonly rows: ReadonlyArray<BillWithStats>
  readonly now: number
}) {
  const { t } = useTranslation()

  return (
    <div
      data-testid="no-table-tile"
      className="flex items-center gap-3 rounded-xl bg-card p-2 pl-4 ring-1 ring-foreground/10 ring-inset"
    >
      <p className="shrink-0 text-sm font-semibold">
        {t("bill.table.dialog.none")}
      </p>
      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
        {rows.length > 0 ? (
          rows.map((row) => <BillChip key={row.bill.id} {...row} now={now} />)
        ) : (
          <p className="truncate text-sm text-muted-foreground">
            {t("home.pos.noTable.empty")}
          </p>
        )}
      </div>
      <NewBillLink
        tableId={undefined}
        aria-label={t("tables.tile.newBill")}
        className={cn(buttonVariants({ size: "lg" }), "h-11 shrink-0")}
      >
        <PlusIcon data-icon="inline-start" />
        {t("tables.tile.newBill")}
      </NewBillLink>
    </div>
  )
}

/**
 * One table. Tiles share a minimum height so the floor reads as a grid:
 * the table's name, then — on an occupied one — its running total large in
 * the corner, with how long it has been open (flagged once that is long),
 * the pieces on it and where its payment stands. A free tile starts a bill
 * anywhere it is tapped and a tile with exactly one bill opens it; with two
 * or more, each bill is a chip of its own. The "+" for another bill on the
 * same table (a split check) sits in the corner above the tile-wide link.
 */
function TableTile({
  table,
  rows,
  now,
}: {
  readonly table: TableRow
  readonly rows: ReadonlyArray<BillWithStats>
  readonly now: number
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const occupied = rows.length > 0
  const onlyBill = rows.length === 1 ? rows[0]?.bill : undefined
  const left = formatRowsSum(rows, "left", (money) =>
    formatMoney(money, locale)
  )
  const isPartlyPaid = rows.some(({ paid }) => paid > 0)
  const paid = isPartlyPaid
    ? formatRowsSum(rows, "paid", (money) => formatMoney(money, locale))
    : undefined
  const openedAt = Math.min(
    ...rows.map(({ bill }) => new Date(bill.createdAt).getTime())
  )
  const itemCount = rows.reduce((sum, { stats }) => sum + stats.itemCount, 0)
  const paymentState = tablePaymentState(rows, now)

  return (
    <div data-testid="table-tile" className="relative h-full">
      <TableTileShell
        name={table.name}
        occupied={occupied}
        attention={paymentState !== undefined}
        // A minimum, not a fixed height: a row grows together, as a grid
        // row stretches its tiles, when one of them lists several bills.
        className="min-h-36 justify-between gap-2"
        icon={
          occupied ? null : (
            <PlusIcon className="size-5 shrink-0 text-muted-foreground" />
          )
        }
      >
        {rows.length > 1 && (
          <div className="relative z-10 flex gap-1.5 overflow-x-auto">
            {rows.map((row) => (
              <BillChip
                key={row.bill.id}
                {...row}
                now={now}
                showElapsed={false}
              />
            ))}
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          {left !== undefined && (
            <p
              className={cn(
                "text-xl font-bold tabular-nums",
                isPartlyPaid ? "line-clamp-2" : "truncate"
              )}
            >
              {isPartlyPaid ? t("tables.tile.left", { amount: left }) : left}
            </p>
          )}
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-sm tabular-nums text-muted-foreground">
              {occupied ? (
                <>
                  <span className={elapsedClassName(now - openedAt)}>
                    {formatElapsed(now - openedAt, locale)}
                  </span>
                  <span>
                    {t("tables.tile.itemCount", { value: itemCount })}
                  </span>
                  {paymentState !== undefined && (
                    <BillPaymentStateBadge
                      paymentState={paymentState}
                      paid={paymentState === "partiallyPaid" ? paid : undefined}
                    />
                  )}
                </>
              ) : (
                <>
                  <span>{t("tables.tile.free")}</span>
                  <span className="flex items-center gap-0.5">
                    <UsersIcon aria-hidden className="size-3.5" />
                    <span aria-hidden>{table.seatCount}</span>
                    <span className="sr-only">
                      {t("tables.seatCount", { value: table.seatCount })}
                    </span>
                  </span>
                </>
              )}
            </div>
            {occupied && (
              <NewBillLink
                tableId={table.id}
                aria-label={t("tables.tile.newBill")}
                className="relative z-10 -m-1.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-background/60 transition-colors hover:bg-background"
              >
                <PlusIcon className="size-4" />
              </NewBillLink>
            )}
          </div>
        </div>
      </TableTileShell>
      {!occupied && (
        <NewBillLink
          tableId={table.id}
          aria-label={t("tables.tile.newBill")}
          className={stretchedLinkClassName}
        />
      )}
      {onlyBill !== undefined && (
        <Link
          to="/bill"
          search={{ billId: onlyBill.id }}
          aria-label={billLabel(onlyBill, t)}
          className={stretchedLinkClassName}
        />
      )}
    </div>
  )
}

function BillPaymentStateBadge({
  paymentState,
  paid,
}: {
  readonly paymentState: BillPaymentState
  readonly paid?: string | undefined
}) {
  const { t } = useTranslation()
  const Icon = billPaymentStateIcons[paymentState]

  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-info/15 px-1 text-xs font-semibold text-info-foreground">
      <Icon aria-hidden className="size-3.5 shrink-0" />
      {paid === undefined
        ? t(`tables.tile.${paymentState}`)
        : t("tables.tile.partiallyPaidAmount", { amount: paid })}
    </span>
  )
}

function NewBillLink({
  tableId,
  className,
  children,
  "aria-label": ariaLabel,
}: {
  readonly tableId: TableId | undefined
  readonly className: string
  readonly children?: ReactNode
  readonly "aria-label": string
}) {
  // Generated once per mount, put in the link's href up front so `/bill`'s
  // URL is already stable before the first tap — no post-tap redirect once
  // the bill row is lazily created (see `bill-page.tsx`, `use-cart-bill.ts`).
  const [billId] = useState(createRandomBillId)

  return (
    <Link
      to="/bill"
      search={tableId === undefined ? { billId } : { billId, tableId }}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </Link>
  )
}

const billLabel = (
  bill: OpenBillRow,
  t: ReturnType<typeof useTranslation>["t"]
) => bill.label ?? t("bill.list.label", { number: bill.displayNumber })

/**
 * One open bill as a chip, where a table holds several or the bill is on
 * no table: what is left to pay on it and, off a table, how long it has been open, and its label when it has one.
 */
function BillChip({
  bill,
  left,
  now,
  showElapsed = true,
}: BillWithStats & {
  readonly now: number
  /** Off on a table tile, whose footer already says how long it is open. */
  readonly showElapsed?: boolean
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const elapsedMs = now - new Date(bill.createdAt).getTime()
  const paymentState = billPaymentState(bill, now)
  const PaymentStateIcon =
    paymentState === undefined ? undefined : billPaymentStateIcons[paymentState]

  return (
    <Link
      to="/bill"
      search={{ billId: bill.id }}
      aria-label={
        paymentState === undefined
          ? billLabel(bill, t)
          : t("tables.tile.billWithState", {
              label: billLabel(bill, t),
              state: t(`tables.tile.${paymentState}`),
            })
      }
      className="relative flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-background/70 px-2.5 text-sm ring-1 ring-foreground/10 ring-inset transition-colors hover:bg-background"
    >
      {PaymentStateIcon !== undefined && (
        <PaymentStateIcon aria-hidden className="size-4 shrink-0 text-info" />
      )}
      {bill.label !== null && (
        <span className="max-w-24 truncate text-muted-foreground">
          {bill.label}
        </span>
      )}
      <span className="font-semibold tabular-nums">
        {formatMoney({ value: left, currency: bill.currency }, locale)}
      </span>
      {showElapsed && (
        <span
          className={cn("text-xs tabular-nums", elapsedClassName(elapsedMs))}
        >
          {formatElapsed(elapsedMs, locale)}
        </span>
      )}
    </Link>
  )
}
