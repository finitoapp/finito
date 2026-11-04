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

/**
 * An amount split for a display that draws the unit smaller than the
 * number: the number in the locale's layout, the currency as the locale
 * writes it ("Kč", "$", "CZK") and whether it comes first there ("$5",
 * "CZK 120") or last ("120 Kč"). `text` is the whole, as `formatAmount`
 * writes it.
 */
export interface AmountParts {
  readonly number: string
  readonly unit: string
  readonly unitFirst: boolean
  readonly text: string
}

export function formatAmountParts(
  amount: number,
  currency: Currency,
  locale: string = "en-US",
  { fraction = "always" }: FormatMoneyOptions = {}
): AmountParts {
  const text = formatAmount(amount, currency, locale, { fraction })
  if (currency === "BTC") {
    return {
      number: text.replace(/\s*Sats$/u, ""),
      unit: "Sats",
      unitFirst: false,
      text,
    }
  }
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits:
        fraction === "whenNonZero" && Number.isInteger(amount)
          ? 0
          : currencyFractionDigits[currency],
    }).formatToParts(amount)
    const unitIndex = parts.findIndex((part) => part.type === "currency")
    const numberIndex = parts.findIndex(
      (part) => part.type !== "currency" && part.type !== "literal"
    )
    return {
      number: parts
        .filter((part) => part.type !== "currency" && part.type !== "literal")
        .map((part) => part.value)
        .join(""),
      unit: parts[unitIndex]?.value ?? currency,
      unitFirst: unitIndex !== -1 && unitIndex < numberIndex,
      text,
    }
  } catch (_error) {
    return {
      number: amount.toLocaleString(),
      unit: currency,
      unitFirst: false,
      text,
    }
  }
}

export const formatMoneyParts = (
  money: Money,
  locale: string = "en-US",
  options: FormatMoneyOptions = {}
): AmountParts =>
  formatAmountParts(
    Number(minorUnitsToDecimalString(money)),
    money.currency,
    locale,
    options
  )
