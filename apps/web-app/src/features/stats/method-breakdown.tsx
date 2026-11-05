import { paymentMethodLabelKey } from "@payky/app-shared/activity-labels"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type {
  ExpectedCash,
  MethodBreakdown as MethodBreakdownRow,
  MethodShare,
  SalesKpis,
} from "@payky/core/modules/sales-stats/sales-stats-utils"
import { type Currency, Integer } from "@payky/core/modules/shared/schema"
import { CircleHelpIcon } from "lucide-react"
import { Pie, PieChart, type PieSectorShapeProps, Sector } from "recharts"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart.tsx"
import { paymentMethodIcon } from "@/features/shared/payment-method-display.tsx"
import { useLocale } from "@/hooks/use-locale.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatMoney } from "@/lib/format-utils.ts"
import { cn } from "@/lib/utils.ts"
import { BreakdownLine } from "./kpi-tiles.tsx"
import { StatsBar, StatsSection, TipsLine } from "./stats-section.tsx"

const useMoney = () => {
  const locale = useLocale()
  return (value: number, currency: Currency) =>
    formatMoney({ value: Integer(value), currency }, locale)
}

/**
 * One colour per method, the same in every period so a method is
 * recognisable at a glance.
 */
const methodColors = {
  cashRegister: "var(--chart-1)",
  cardSwitchio: "var(--chart-2)",
  // A card too, so the same colour: a shop rarely takes both.
  qerkoTerminal: "var(--chart-2)",
  // Qerko's colour, the terminal's: a shop rarely takes both.
  qerkoPayment: "var(--chart-2)",
  iban: "var(--chart-3)",
  spark: "var(--chart-4)",
  onchain: "var(--chart-5)",
  cashu: "var(--chart-6)",
  // Lightning too, so Spark's colour: a shop rarely takes both.
  lightningAddress: "var(--chart-4)",
  unknown: "var(--muted-foreground)",
} satisfies Record<MethodShare["method"], string>

/**
 * Amount and share per method that settled the period's sales, per
 * currency: a donut of the shares with the total inside, then the methods
 * with a bar each, which also serve as the donut's legend. Under them, how
 * the total comes out of the same sales as net revenue. A duplicate
 * settlement makes the methods exceed revenue; the note names the excess.
 */
export function MethodBreakdown({
  methods,
  kpis,
}: {
  readonly methods: ReadonlyArray<MethodBreakdownRow>
  readonly kpis: ReadonlyArray<SalesKpis>
}) {
  const { t } = useTranslation()
  const money = useMoney()
  const excess = methods.filter((row) => row.excess > 0)

  return (
    <StatsSection
      title={t("stats.methods.title")}
      className="flex flex-col gap-4"
      note={
        excess.length === 0
          ? undefined
          : excess
              .map((row) =>
                t("stats.methods.excess", {
                  amount: money(row.excess, row.currency),
                })
              )
              .join(" ")
      }
    >
      {methods.map((row) => (
        <div key={row.currency} className="flex flex-col gap-3">
          {methods.length > 1 ? (
            <p className="text-xs font-bold text-muted-foreground">
              {row.currency}
            </p>
          ) : null}
          <MethodDonut row={row} />
          {row.methods.map((method) => (
            <MethodRow
              key={method.method}
              method={method}
              currency={row.currency}
            />
          ))}
          <ReceivedBreakdown
            row={row}
            kpis={kpis.find((kpi) => kpi.currency === row.currency)}
          />
        </div>
      ))}
    </StatsSection>
  )
}

/**
 * Sales + tips (+ a duplicate settlement's excess) = the donut's total: the
 * same sales net revenue starts from, before refunds.
 */
function ReceivedBreakdown({
  row,
  kpis,
}: {
  readonly row: MethodBreakdownRow
  readonly kpis: SalesKpis | undefined
}) {
  const { t } = useTranslation()
  const money = useMoney()

  if (kpis === undefined) return null

  return (
    <dl className="mt-1 flex flex-col gap-1 border-t pt-3 text-sm">
      <BreakdownLine label={t("stats.kpi.breakdown.sales")}>
        {money(kpis.gross, row.currency)}
      </BreakdownLine>
      <BreakdownLine label={`+ ${t("stats.kpi.breakdown.tips")}`}>
        {money(kpis.tipsReceived, row.currency)}
      </BreakdownLine>
      {row.excess === 0 ? null : (
        <BreakdownLine label={`+ ${t("stats.kpi.breakdown.excess")}`}>
          {money(row.excess, row.currency)}
        </BreakdownLine>
      )}
      <BreakdownLine label={`= ${t("stats.kpi.breakdown.received")}`} total>
        {money(kpis.gross + kpis.tipsReceived + row.excess, row.currency)}
      </BreakdownLine>
      {kpis.tipRefundAmount === 0 ? null : (
        <p className="text-xs text-muted-foreground">
          {t("stats.kpi.breakdown.tipRefunds", {
            amount: money(kpis.tipRefundAmount, row.currency),
          })}
        </p>
      )}
    </dl>
  )
}

const methodLabelKey = (method: MethodShare["method"]): TranslationKey =>
  method === "unknown" ? "stats.methods.unknown" : paymentMethodLabelKey[method]

interface DonutSlice {
  readonly method: MethodShare["method"]
  readonly amount: number
  readonly tips: number
  readonly share: number
  readonly fill: string
}

/** A slice; the hovered one stands a little proud of the ring. */
const DonutSector = (props: PieSectorShapeProps) => (
  <Sector
    {...props}
    outerRadius={props.isActive ? props.outerRadius + 4 : props.outerRadius}
  />
)

function MethodDonut({ row }: { readonly row: MethodBreakdownRow }) {
  const { t } = useTranslation()
  const money = useMoney()
  // The keys only feed ChartContainer's colour variables; nothing reads them.
  const config = Object.fromEntries(
    row.methods.map((method) => [
      method.method,
      { color: methodColors[method.method] },
    ])
  ) satisfies ChartConfig
  const slices: ReadonlyArray<DonutSlice> = row.methods.map((method) => ({
    method: method.method,
    amount: method.amount,
    tips: method.tips,
    share: method.share,
    fill: methodColors[method.method],
  }))

  return (
    <div className="relative mx-auto size-56">
      {/* Before the chart, so the tooltip draws over it. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-sm text-muted-foreground">
          {t("stats.kpi.breakdown.received")}
        </span>
        <span className="text-lg font-semibold tabular-nums">
          {money(row.total, row.currency)}
        </span>
      </div>
      <ChartContainer
        config={config}
        className="relative aspect-square size-full"
      >
        <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <ChartTooltip
            allowEscapeViewBox={{ x: true, y: true }}
            content={({ active, payload }) => {
              const slice: DonutSlice | undefined = payload?.[0]?.payload
              return active === true && slice !== undefined ? (
                <MethodTooltip slice={slice} currency={row.currency} />
              ) : null
            }}
          />
          <Pie
            data={[...slices]}
            dataKey="amount"
            nameKey="method"
            innerRadius="68%"
            outerRadius="96%"
            paddingAngle={row.methods.length > 1 ? 2 : 0}
            stroke="none"
            shape={DonutSector}
            isAnimationActive={false}
          />
        </PieChart>
      </ChartContainer>
    </div>
  )
}

function MethodTooltip({
  slice,
  currency,
}: {
  readonly slice: DonutSlice
  readonly currency: Currency
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const money = useMoney()

  return (
    <div className="grid gap-1 whitespace-nowrap rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="flex items-center gap-1.5 font-medium">
        <span
          className="size-2.5 shrink-0 rounded-[2px]"
          style={{ backgroundColor: slice.fill }}
        />
        {t(methodLabelKey(slice.method))}
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">
          {new Intl.NumberFormat(locale, {
            style: "percent",
            maximumFractionDigits: 0,
          }).format(slice.share)}
        </span>
        <span className="font-mono font-semibold tabular-nums">
          {money(slice.amount, currency)}
        </span>
      </div>
      {slice.tips === 0 ? null : (
        <div className="flex justify-between gap-3 pl-2">
          <span className="text-muted-foreground">
            {t("stats.tips.ofWhich")}
          </span>
          <span className="font-mono tabular-nums">
            {money(slice.tips, currency)}
          </span>
        </div>
      )}
    </div>
  )
}

function MethodRow({
  method,
  currency,
}: {
  readonly method: MethodShare
  readonly currency: Currency
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const money = useMoney()
  const Icon =
    method.method === "unknown"
      ? CircleHelpIcon
      : paymentMethodIcon[method.method]

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-sm">
        <span
          className="size-2.5 shrink-0 rounded-[2px]"
          style={{ backgroundColor: methodColors[method.method] }}
        />
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">
          {t(methodLabelKey(method.method))}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {new Intl.NumberFormat(locale, {
            style: "percent",
            maximumFractionDigits: 0,
          }).format(method.share)}
        </span>
        <span className="w-24 text-right font-medium tabular-nums">
          {money(method.amount, currency)}
        </span>
      </div>
      {method.tips === 0 ? null : (
        <TipsLine>{money(method.tips, currency)}</TipsLine>
      )}
      <StatsBar
        share={method.share}
        tipsShare={method.amount === 0 ? 0 : method.tips / method.amount}
      />
    </div>
  )
}

/** The drawer's movement over the period, per currency that had any cash. */
export function ExpectedCashSummary({
  cash,
}: {
  readonly cash: ReadonlyArray<ExpectedCash>
}) {
  const { t } = useTranslation()
  const money = useMoney()

  if (cash.length === 0) return null

  return (
    <StatsSection
      title={t("stats.cash.title")}
      className="flex flex-col gap-4"
      note={t("stats.cash.note")}
    >
      {cash.map((row) => (
        <div key={row.currency} className="flex flex-col gap-3">
          {cash.length > 1 ? (
            <p className="text-xs font-bold text-muted-foreground">
              {row.currency}
            </p>
          ) : null}
          {/* The figure the drawer is counted against, then where it comes from. */}
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-muted-foreground">
              {t("stats.cash.expected")}
            </p>
            <p className="text-3xl font-semibold tabular-nums">
              {money(row.expected, row.currency)}
            </p>
          </div>
          <dl className="flex flex-col gap-1.5 border-t pt-3 text-sm">
            <CashLine label={t("stats.cash.in")}>
              {money(row.cashIn, row.currency)}
            </CashLine>
            <CashLine label={t("stats.tips.ofWhich")} sub>
              {money(row.cashTips, row.currency)}
            </CashLine>
            <CashLine label={t("stats.cash.refunds")}>
              {money(-row.cashRefunds, row.currency)}
            </CashLine>
          </dl>
        </div>
      ))}
    </StatsSection>
  )
}

function CashLine({
  label,
  sub = false,
  children,
}: {
  readonly label: string
  readonly sub?: boolean
  readonly children: string
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-2",
        sub && "pl-4 text-xs text-muted-foreground"
      )}
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  )
}
