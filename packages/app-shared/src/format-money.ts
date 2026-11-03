import {
  currencyFractionDigits,
  type Money,
  minorUnitsToDecimalString,
  SATS_PER_BTC,
} from "@payky/core/modules/shared/money"
import type { Currency } from "@payky/core/modules/shared/schema"

/**
 * How the fraction is shown: `always` writes the currency's digits even
 * when they are zero ("120,00 Kč"), `whenNonZero` leaves a whole amount
 * whole ("120 Kč", but still "120,50 Kč").
 */
export interface FormatMoneyOptions {
  readonly fraction?: "always" | "whenNonZero"
}

export function formatAmount(
  amount: number,
  currency?: Currency | undefined,
  locale: string = "en-US",
  { fraction = "always" }: FormatMoneyOptions = {}
) {
  if (currency === "BTC") {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currencyDisplay: "code",
      currency: "USD", // Use USD as base but replace symbol
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(amount * SATS_PER_BTC)
      .replace("USD", "Sats")
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      ...(currency === undefined
        ? {}
        : {
            minimumFractionDigits:
              fraction === "whenNonZero" && Number.isInteger(amount)
                ? 0
                : currencyFractionDigits[currency],
          }),
    }).format(amount)
  } catch (_error) {
    return `${amount.toLocaleString()}${currency ? ` ${currency}` : ""}`
  }
}

export function formatMoney(
  money: Money,
  locale: string = "en-US",
  options: FormatMoneyOptions = {}
) {
  const value = minorUnitsToDecimalString(money)
  return formatAmount(Number(value), money.currency, locale, options)
}

/** A satoshi amount with the locale's digit grouping, and no currency label. */
export const formatSatsAmount = (sats: number, locale: string): string =>
  new Intl.NumberFormat(locale).format(sats)
