import { type Currency, Integer } from "@payky/core/modules/shared/schema"
import type { ReactNode } from "react"
import { Text, XStack, YStack } from "tamagui"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney } from "../../lib/format-money.ts"

/** One block of the statistics screen: a titled card, an optional note under it. */
export function StatsSection({
  title,
  note,
  children,
}: {
  readonly title: string
  readonly note?: ReactNode
  readonly children: ReactNode
}) {
  return (
    <YStack gap="2">
      <YStack bg="card" rounded="md" overflow="hidden">
        <Text
          p="4"
          fontSize="xs"
          lineHeight="xs"
          fontWeight="700"
          color="muted-foreground"
          role="heading"
          aria-level={2}
        >
          {title}
        </Text>
        <YStack px="4" pb="4">
          {children}
        </YStack>
      </YStack>
      {note === undefined ? null : (
        <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
          {note}
        </Text>
      )}
    </YStack>
  )
}

export const useStatsMoney = () => {
  const locale = useLocale()
  return (value: number, currency: Currency) =>
    formatMoney({ value: Integer(value), currency }, locale)
}

/** One currency's rows, headed by the currency when the period has several. */
export function CurrencyGroup({
  currency,
  showCurrency,
  children,
}: {
  readonly currency: Currency
  readonly showCurrency: boolean
  readonly children: ReactNode
}) {
  return (
    <YStack gap="3">
      {showCurrency ? (
        <Text
          fontSize="xs"
          lineHeight="xs"
          fontWeight="700"
          color="muted-foreground"
        >
          {currency}
        </Text>
      ) : null}
      {children}
    </YStack>
  )
}

/**
 * "of which tips" under a row whose amount holds them, the same sub-line
 * the expected cash shows.
 */
export function TipsLine({ children }: { readonly children: string }) {
  const { t } = useTranslation()

  return (
    <XStack justify="space-between" gap="2" pl={24}>
      <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
        {t("stats.tips.ofWhich")}
      </Text>
      <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
        {children}
      </Text>
    </XStack>
  )
}

/**
 * A row's bar: `share` of the full width, its last `tipsShare` in the
 * lighter tips shade the revenue chart stacks on top of its bars. Tall
 * enough for a few-percent tip to show at all.
 */
export function StatsBar({
  share,
  tipsShare = 0,
}: {
  /** 0..1 */
  readonly share: number
  /** 0..1 of the bar */
  readonly tipsShare?: number
}) {
  return (
    <YStack height={10} rounded={5} overflow="hidden" bg="track">
      <XStack
        height={10}
        rounded={5}
        overflow="hidden"
        width={`${(share * 100).toFixed(1)}%`}
      >
        <YStack flex={1} bg="chart-1" />
        {tipsShare > 0 ? (
          <YStack
            bg="chart-1"
            opacity={0.45}
            width={`${(tipsShare * 100).toFixed(1)}%`}
          />
        ) : null}
      </XStack>
    </YStack>
  )
}

export function StatsBarRow({
  label,
  detail,
  value,
  tips,
  share,
  tipsShare,
}: {
  readonly label: string
  readonly detail?: string
  readonly value: string
  /** The tips inside `value`, formatted; the line hides for none. */
  readonly tips?: string
  /** 0..1 */
  readonly share: number
  /** 0..1, the part of the row's own amount that is tips. */
  readonly tipsShare?: number
}) {
  return (
    <YStack gap="1.5">
      <XStack items="center" gap="2">
        <Text flex={1} numberOfLines={1}>
          {label}
        </Text>
        {detail === undefined ? null : (
          <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
            {detail}
          </Text>
        )}
        <Text fontWeight="600">{value}</Text>
      </XStack>
      {tips === undefined ? null : <TipsLine>{tips}</TipsLine>}
      <StatsBar share={share} tipsShare={tipsShare ?? 0} />
    </YStack>
  )
}
