import {
  formatAmount as formatAmountShared,
  formatMoney as formatMoneyShared,
  formatSatsAmount,
} from "@payky/app-shared/format-money"
import type { Money } from "@payky/core/modules/shared/money"
import type { Currency } from "@payky/core/modules/shared/schema"

/**
 * Finito's money: a whole amount is written whole ("120 Kč"), the minor
 * units only when there are any ("120,50 Kč"). Web keeps the currency's
 * digits always; every native screen formats through here.
 */
export const formatMoney = (money: Money, locale: string): string =>
  formatMoneyShared(money, locale, { fraction: "whenNonZero" })

/** `formatMoney` for an amount already in major units (a chart's axis, a fiat estimate). */
export const formatAmount = (
  amount: number,
  currency: Currency | undefined,
  locale: string
): string =>
  formatAmountShared(amount, currency, locale, { fraction: "whenNonZero" })

export { formatSatsAmount }
