import { satsToFiat } from "@payky/core/modules/shared/money"
import { useAtom } from "jotai"
import { Platform } from "react-native"
import { Text, View, YStack } from "tamagui"
import { bitcoinUnitAtom } from "../../atoms/bitcoin-unit.ts"
import { useBtcFiat } from "../../hooks/use-btc-fiat.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatAmount, formatSatsAmount } from "../../lib/format-money.ts"
import { control, fontSize, fontWeight, shape } from "../../theme/tokens.ts"

/**
 * A bitcoin amount in one unit at a time: the shop's money at today's
 * rate, or sats, whichever every bitcoin amount is currently read in
 * (`bitcoinUnitAtom`); tapping any of them switches all of them. Sats alone
 * while there is no rate. Never both units at once: a merchant reads the
 * app in the unit they set, and asks for sats when they want them.
 */
export function useBitcoinAmount(sats: number) {
  const { t } = useTranslation()
  const locale = useLocale()
  const fiat = useBtcFiat()
  const [unit, setUnit] = useAtom(bitcoinUnitAtom)
  const switchable = fiat.rate !== null
  const inFiat = switchable && unit === "fiat"
  const rate = fiat.rate ?? 0
  return {
    /** The figure alone: "1 234" or "12,30". */
    value: inFiat
      ? formatAmount(
          satsToFiat({ sats, exchangeRate: rate }),
          undefined,
          locale
        )
      : formatSatsAmount(sats, locale),
    /** "Kč" or "sats". */
    unit: inFiat ? fiat.currency : t("withdraw.amount.unitSats"),
    /** The figure with its unit, as one text. */
    text: inFiat
      ? formatAmount(
          satsToFiat({ sats, exchangeRate: rate }),
          fiat.currency,
          locale
        )
      : t("withdraw.sats", { amount: formatSatsAmount(sats, locale) }),
    switchable,
    switchLabel: t("settings.cashuAccount.balance.switchUnit"),
    toggle: () => setUnit((current) => (current === "fiat" ? "sats" : "fiat")),
  }
}

/** An amount in a row or a detail: one line, tapped to switch the unit. */
export function BitcoinAmount({
  sats,
  align = "end",
  size = "base",
}: {
  readonly sats: number
  readonly align?: "start" | "end"
  readonly size?: "base" | "xs"
}) {
  const amount = useBitcoinAmount(sats)
  return (
    <View
      self={align === "start" ? "flex-start" : "flex-end"}
      hitSlop={8}
      cursor={amount.switchable ? "web:pointer" : undefined}
      accessible
      role={amount.switchable ? "button" : undefined}
      aria-label={amount.text}
      {...(Platform.OS === "web" && amount.switchable
        ? { title: amount.switchLabel }
        : {})}
      onPress={amount.switchable ? amount.toggle : undefined}
    >
      <Text
        fontSize={fontSize[size]}
        lineHeight={fontSize[size]}
        color={size === "xs" ? "muted-foreground" : "color"}
        fontVariant={["tabular-nums"]}
      >
        {amount.text}
      </Text>
    </View>
  )
}

/**
 * A wallet's balance, Linky's `Amount`: the figure large with its unit
 * small beneath it, tapped to switch the unit. `caption` sits under the
 * unit (syncing, no rate).
 */
export function BitcoinBalance({
  sats,
  caption,
  testID,
}: {
  readonly sats: number
  readonly caption?: string
  readonly testID?: string
}) {
  const amount = useBitcoinAmount(sats)
  return (
    <YStack
      items="center"
      px={16}
      minH={control.lg}
      justify="center"
      rounded={shape.control}
      bg={amount.switchable ? "transparent press:neutral-soft" : "transparent"}
      cursor={amount.switchable ? "web:pointer" : undefined}
      accessible
      role={amount.switchable ? "button" : undefined}
      aria-label={amount.text}
      {...(Platform.OS === "web" && amount.switchable
        ? { title: amount.switchLabel }
        : {})}
      onPress={amount.switchable ? amount.toggle : undefined}
      testID={testID}
    >
      <Text
        fontSize="3xl"
        lineHeight="3xl"
        fontWeight={fontWeight.bold}
        fontVariant={["tabular-nums"]}
        text="center"
      >
        {amount.value}
      </Text>
      <Text
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
        fontWeight={fontWeight.semibold}
        color="muted-foreground"
      >
        {amount.unit}
      </Text>
      {caption === undefined ? null : (
        <Text
          fontSize={fontSize.xs}
          lineHeight={fontSize.xs}
          color="muted-foreground"
          text="center"
        >
          {caption}
        </Text>
      )}
    </YStack>
  )
}
