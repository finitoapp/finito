import { currencyFractionDigits } from "@payky/core/modules/shared/money"
import type { Currency } from "@payky/core/modules/shared/schema"
import { type AmountParts, splitCurrencyParts } from "./format-money.ts"

export const amountKeypadKeys = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  ".",
  "0",
  "<",
] as const

export type AmountKeypadKey = (typeof amountKeypadKeys)[number]

const maxIntegerDigits = 9

const currencyNumberPartTypes = new Set<Intl.NumberFormatPartTypes>([
  "integer",
  "group",
  "decimal",
  "fraction",
])

/**
 * The entered amount as a plain decimal string ("" , "12", "12.5", "0."),
 * after one keypad press. Decimals are capped at the currency's fraction
 * digits and the integer part at nine digits; a leading zero is never typed.
 * Convert the result with `decimalAmountToMinorUnits`.
 */
export function applyAmountKey(
  current: string,
  key: AmountKeypadKey,
  currency: Currency
): string {
  if (key === "<") return current.slice(0, -1)

  if (key === ".") {
    if (current.includes(".")) return current
    return current === "" ? "0." : `${current}.`
  }

  const [integerPart = "", fractionPart] = current.split(".")

  if (fractionPart !== undefined) {
    if (fractionPart.length >= currencyFractionDigits[currency]) return current
    return `${current}${key}`
  }

  if (integerPart.length >= maxIntegerDigits) return current
  if (current === "" && key === "0") return ""

  return `${current}${key}`
}

export function getDecimalSeparator(locale: string): string {
  return (
    new Intl.NumberFormat(locale)
      .formatToParts(1.1)
      .find((part) => part.type === "decimal")?.value ?? "."
  )
}

/** The typed input as a number in the locale's layout, keeping a trailing separator. */
function formatAmountNumber(amountInput: string, locale: string): string {
  const [integerPart = "0", fractionPart = ""] = amountInput.split(".")
  const hasDecimalSeparator = amountInput.includes(".")
  const formattedIntegerPart = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(Number(integerPart === "" ? "0" : integerPart))
  const decimalSeparator = getDecimalSeparator(locale)
  return hasDecimalSeparator
    ? `${formattedIntegerPart}${decimalSeparator}${fractionPart}`
    : formattedIntegerPart
}

const currencyLayoutParts = (currency: Currency, locale: string) =>
  new Intl.NumberFormat(locale, {
    currency,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    style: "currency",
  }).formatToParts(0)

/** The typed input in the locale's currency layout, keeping a trailing separator. */
export function formatAmountInput(
  amountInput: string,
  currency: Currency,
  locale: string
): string {
  const amountText = formatAmountNumber(amountInput, locale)
  let hasRenderedAmount = false

  return currencyLayoutParts(currency, locale)
    .map((part) => {
      if (!currencyNumberPartTypes.has(part.type)) return part.value
      if (hasRenderedAmount) return ""

      hasRenderedAmount = true
      return amountText
    })
    .join("")
}

/**
 * `formatAmountInput` in two pieces, for a display that draws the unit
 * smaller than the number: the number in the locale's layout, the currency
 * as the locale writes it ("Kč", "$", "CZK"), whether the currency comes
 * first there ("$0", "CZK 0") or last ("0 Kč"), and the whole as one text.
 */
export function formatAmountInputParts(
  amountInput: string,
  currency: Currency,
  locale: string
): AmountParts {
  const parts = splitCurrencyParts(
    currencyLayoutParts(currency, locale),
    currency
  )
  const number = formatAmountNumber(amountInput, locale)
  return {
    ...parts,
    number,
    text: formatAmountInput(amountInput, currency, locale),
  }
}
