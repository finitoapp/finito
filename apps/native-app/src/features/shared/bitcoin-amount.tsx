import { formatAmountParts } from "@payky/app-shared/format-money"
import { satsToFiat } from "@payky/core/modules/shared/money"
import { useAtom } from "jotai"
import { Platform } from "react-native"
import { Text, View } from "tamagui"
import { bitcoinUnitAtom } from "../../atoms/bitcoin-unit.ts"
import { AmountFigure } from "../../components/amount-figure.tsx"
import { useBtcFiat } from "../../hooks/use-btc-fiat.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatSatsAmount } from "../../lib/format-money.ts"
import { fontSize } from "../../theme/tokens.ts"

/**
 * A bitcoin amount in one unit at a time: the shop's money at today's
 * rate, or sats, whichever every bitcoin amount is currently read in
 * (`bitcoinUnitAtom`); tapping any of them switches all of them. Sats alone
 * while there is no rate. Never both units at once: a merchant reads the
 * app in the unit they set, and asks for sats when they want them.
 *
 * In the shop's money the amount is an estimate at a rate that moves, so
 * it is written to the whole unit with a "~" before it ("~1 234 Kč"); the
 * sats are exact, and so is nothing: zero has no "~".
 */
export function useBitcoinAmount(sats: number) {
  const { t } = useTranslation()
  const locale = useLocale()
  const fiat = useBtcFiat()
  const [unit, setUnit] = useAtom(bitcoinUnitAtom)
  const switchable = fiat.rate !== null
  const inFiat = switchable && unit === "fiat"
  const rate = fiat.rate ?? 0
  const parts = inFiat
    ? formatAmountParts(
        Math.round(satsToFiat({ sats, exchangeRate: rate })),
        fiat.currency,
        locale,
        { fraction: "whenNonZero" }
      )
    : null
  const satsNumber = formatSatsAmount(sats, locale)
  const about = sats === 0 ? "" : "~"
  return {
    /** The figure alone: "~1 234", "0" or "12 300". */
    number: parts === null ? satsNumber : `${about}${parts.number}`,
    /** "Kč" or "sats". */
    unit: parts === null ? t("withdraw.amount.unitSats") : parts.unit,
    unitFirst: parts === null ? false : parts.unitFirst,
    /** The figure with its unit, as one text. */
    text:
      parts === null
        ? t("withdraw.sats", { amount: satsNumber })
        : `${about}${parts.text}`,
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
 * A wallet's balance: the one amount figure every screen headlines with
 * (`AmountFigure`), tapped to switch the unit. `caption` sits under it
 * (syncing, no rate).
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
    <AmountFigure
      number={amount.number}
      unit={amount.unit}
      unitFirst={amount.unitFirst}
      label={amount.text}
      caption={caption}
      onPress={amount.switchable ? amount.toggle : undefined}
      pressLabel={amount.switchable ? amount.switchLabel : undefined}
      testID={testID}
    />
  )
}
