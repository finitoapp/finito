import { paymentMethodLabelKey } from "@payky/app-shared/activity-labels"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type {
  ExpectedCash,
  MethodBreakdown as MethodBreakdownRow,
  MethodShare,
  SalesKpis,
} from "@payky/core/modules/sales-stats/sales-stats-utils"
import type { Currency } from "@payky/core/modules/shared/schema"
import CircleQuestionMark from "lucide-react-native/icons/circle-question-mark"
import { useState } from "react"
import Svg, { Circle } from "react-native-svg"
import { Text, useTheme, XStack, YStack } from "tamagui"
import { Icon } from "../../components/ui/icon.tsx"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { paymentMethodIcon } from "../shared/payment-method-display.ts"
import { BreakdownLine } from "./kpi-tiles.tsx"
import {
  CurrencyGroup,
  StatsBar,
  StatsSection,
  TipsLine,
  useStatsMoney,
} from "./stats-section.tsx"

/**
 * One shade of the gold per method, the same in every period so a method
 * is recognisable at a glance.
 */
const methodLabelKey = (method: MethodShare["method"]): TranslationKey =>
  method === "unknown" ? "stats.methods.unknown" : paymentMethodLabelKey[method]

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
  const money = useStatsMoney()
  const theme = useTheme()
  const methodColors = {
    cashRegister: theme["chart-1"]?.val ?? "#e36b2c",
    cardSwitchio: theme["chart-2"]?.val ?? "#27ae60",
    qerkoTerminal: theme["chart-2"]?.val ?? "#27ae60",
    iban: theme["chart-3"]?.val ?? "#3daee9",
    spark: theme["chart-4"]?.val ?? "#da4453",
    onchain: theme["chart-5"]?.val ?? "#2980b9",
    cashu: theme["chart-6"]?.val ?? "#ad80dd",
    lightningAddress: theme["chart-4"]?.val ?? "#da4453",
    unknown: theme["muted-foreground"]?.val ?? "#888",
  } satisfies Record<MethodShare["method"], string>
  const excess = methods.filter((row) => row.excess > 0)

  return (
    <StatsSection
      title={t("stats.methods.title")}
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
        <CurrencyGroup
          key={row.currency}
          currency={row.currency}
          showCurrency={methods.length > 1}
        >
          <MethodDonut row={row} methodColors={methodColors} />
          {row.methods.map((method) => (
            <MethodRow
              key={method.method}
              method={method}
              currency={row.currency}
              methodColors={methodColors}
            />
          ))}
          <ReceivedBreakdown
            row={row}
            kpis={kpis.find((kpi) => kpi.currency === row.currency)}
          />
        </CurrencyGroup>
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
  const money = useStatsMoney()

  if (kpis === undefined) return null

  return (
    <YStack gap="1" pt="3">
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
        <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
          {t("stats.kpi.breakdown.tipRefunds", {
            amount: money(kpis.tipRefundAmount, row.currency),
          })}
        </Text>
      )}
    </YStack>
  )
}

const donutSize = 224
const donutStroke = 31

/** The shares as arcs of one ring with the total inside; tap an arc for its figures. */
function MethodDonut({
  row,
  methodColors,
}: {
  readonly row: MethodBreakdownRow
  readonly methodColors: Readonly<Record<MethodShare["method"], string>>
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const theme = useTheme()
  const money = useStatsMoney()
  const [selected, setSelected] = useState<MethodShare["method"] | null>(null)
  const radius = donutSize * 0.41
  const circumference = 2 * Math.PI * radius
  const gap = row.methods.length > 1 ? 4 : 0
  const track = theme.muted?.val ?? "#ddd"
  const chosen = row.methods.find((method) => method.method === selected)

  let offset = 0
  const arcs = row.methods.map((method) => {
    const length = Math.max(0, method.share * circumference - gap)
    const arc = { method, length, offset }
    offset += method.share * circumference
    return arc
  })

  return (
    <YStack items="center" gap="2">
      <YStack width={donutSize} height={donutSize}>
        <Svg width={donutSize} height={donutSize}>
          <Circle
            cx={donutSize / 2}
            cy={donutSize / 2}
            r={radius}
            stroke={track}
            strokeWidth={donutStroke}
            fill="none"
          />
          {arcs.map(({ method, length, offset: start }) => (
            <Circle
              key={method.method}
              cx={donutSize / 2}
              cy={donutSize / 2}
              r={radius}
              stroke={methodColors[method.method]}
              strokeWidth={
                method.method === selected ? donutStroke + 6 : donutStroke
              }
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-start}
              fill="none"
              rotation={-90}
              origin={`${donutSize / 2}, ${donutSize / 2}`}
              onPress={() =>
                setSelected(method.method === selected ? null : method.method)
              }
            />
          ))}
        </Svg>
        <YStack
          position="absolute"
          t={0}
          l={0}
          r={0}
          b={0}
          items="center"
          justify="center"
          pointerEvents="none"
        >
          <Text fontSize="sm" lineHeight="sm" color="muted-foreground">
            {t("stats.kpi.breakdown.received")}
          </Text>
          <Text fontSize="lg" lineHeight="lg" fontWeight="700">
            {money(row.total, row.currency)}
          </Text>
        </YStack>
      </YStack>
      {chosen === undefined ? null : (
        <YStack gap="1" aria-live="polite" width="100%">
          <Text fontWeight="600">{t(methodLabelKey(chosen.method))}</Text>
          <Text fontSize={13}>
            {`${new Intl.NumberFormat(locale, {
              style: "percent",
              maximumFractionDigits: 0,
            }).format(chosen.share)} · ${money(chosen.amount, row.currency)}`}
          </Text>
          {chosen.tips === 0 ? null : (
            <XStack justify="space-between" gap="3" pl="2">
              <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
                {t("stats.tips.ofWhich")}
              </Text>
              <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
                {money(chosen.tips, row.currency)}
              </Text>
            </XStack>
          )}
        </YStack>
      )}
    </YStack>
  )
}

function MethodRow({
  method,
  currency,
  methodColors,
}: {
  readonly method: MethodShare
  readonly currency: Currency
  readonly methodColors: Readonly<Record<MethodShare["method"], string>>
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const money = useStatsMoney()
  const methodIcon =
    method.method === "unknown"
      ? CircleQuestionMark
      : paymentMethodIcon[method.method]

  return (
    <YStack gap="1.5">
      <XStack items="center" gap="2">
        <YStack
          width={10}
          height={10}
          rounded={2}
          style={{ backgroundColor: methodColors[method.method] }}
        />
        <Icon icon={methodIcon} color="muted-foreground" />
        <Text flex={1} numberOfLines={1}>
          {t(methodLabelKey(method.method))}
        </Text>
        <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
          {new Intl.NumberFormat(locale, {
            style: "percent",
            maximumFractionDigits: 0,
          }).format(method.share)}
        </Text>
        <Text fontWeight="600">{money(method.amount, currency)}</Text>
      </XStack>
      {method.tips === 0 ? null : (
        <TipsLine>{money(method.tips, currency)}</TipsLine>
      )}
      <StatsBar
        share={method.share}
        tipsShare={method.amount === 0 ? 0 : method.tips / method.amount}
      />
    </YStack>
  )
}

/** The drawer's movement over the period, per currency that had any cash. */
export function ExpectedCashSummary({
  cash,
}: {
  readonly cash: ReadonlyArray<ExpectedCash>
}) {
  const { t } = useTranslation()
  const money = useStatsMoney()

  if (cash.length === 0) return null

  return (
    <StatsSection title={t("stats.cash.title")} note={t("stats.cash.note")}>
      {cash.map((row) => (
        <CurrencyGroup
          key={row.currency}
          currency={row.currency}
          showCurrency={cash.length > 1}
        >
          {/* The figure the drawer is counted against, then where it comes from. */}
          <YStack gap="0.5">
            <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
              {t("stats.cash.expected")}
            </Text>
            <Text fontSize="3xl" lineHeight="3xl" fontWeight="700">
              {money(row.expected, row.currency)}
            </Text>
          </YStack>
          <YStack gap="1.5" pt="3">
            <CashLine label={t("stats.cash.in")}>
              {money(row.cashIn, row.currency)}
            </CashLine>
            <CashLine label={t("stats.tips.ofWhich")} sub>
              {money(row.cashTips, row.currency)}
            </CashLine>
            <CashLine label={t("stats.cash.refunds")}>
              {money(-row.cashRefunds, row.currency)}
            </CashLine>
          </YStack>
        </CurrencyGroup>
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
    <XStack justify="space-between" gap="2" pl={sub ? 16 : 0}>
      <Text
        flex={1}
        fontSize={sub ? "xs" : "sm"}
        lineHeight={sub ? "xs" : "sm"}
        color={sub ? "muted-foreground" : "color"}
      >
        {label}
      </Text>
      <Text
        fontSize={sub ? "xs" : "sm"}
        lineHeight={sub ? "xs" : "sm"}
        color={sub ? "muted-foreground" : "color"}
      >
        {children}
      </Text>
    </XStack>
  )
}
