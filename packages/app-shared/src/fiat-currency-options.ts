import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  FiatCurrency,
  type FiatCurrency as FiatCurrencyType,
} from "@payky/core/modules/shared/schema"

interface FiatCurrencyOption {
  readonly value: FiatCurrencyType
  readonly label: TranslationKey
  /** The sign the currency reads as where there is no room for its name ("Kč"). */
  readonly symbol: TranslationKey
}

const fiatCurrencyOptionCopy = {
  [FiatCurrency.EUR]: {
    label: "settings.fiat.eur.title",
    symbol: "settings.fiat.eur.symbol",
  },
  [FiatCurrency.USD]: {
    label: "settings.fiat.usd.title",
    symbol: "settings.fiat.usd.symbol",
  },
  [FiatCurrency.CZK]: {
    label: "settings.fiat.czk.title",
    symbol: "settings.fiat.czk.symbol",
  },
} satisfies Record<FiatCurrencyType, Omit<FiatCurrencyOption, "value">>

export const fiatCurrencyOptions: ReadonlyArray<FiatCurrencyOption> = (
  Object.keys(fiatCurrencyOptionCopy) as ReadonlyArray<FiatCurrencyType>
).map((value) => ({ value, ...fiatCurrencyOptionCopy[value] }))
