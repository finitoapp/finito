import { type FiatCurrency, Integer } from "@payky/core/modules/shared/schema"
import { formatMoney, formatTime } from "@/lib/format-utils.ts"

export const formatGuestAmount = (
  amount: number,
  { currency }: { readonly currency: FiatCurrency },
  locale: string
): string => formatMoney({ value: Integer(amount), currency }, locale)

export const guestCurrencySymbol = (
  currency: FiatCurrency,
  locale: string
): string =>
  new Intl.NumberFormat(locale, { style: "currency", currency })
    .formatToParts(0)
    .find(({ type }) => type === "currency")?.value ?? currency

export const formatGuestTime = (seconds: number, locale: string): string =>
  formatTime(new Date(seconds * 1000), locale)
