import type {
  DefaultPaymentMethod,
  OnboardingStarterItem,
  TerminalHomeMode,
} from "@payky/core/modules/app-settings/app-settings-types"
import { PaymentMethodOrderJson } from "@payky/core/modules/app-settings/app-settings-utils"
import {
  BankAccountInputIbanSchema,
  FiatCurrency,
  type Iban,
  type NonEmptyString255,
  NonEmptyString255Schema,
} from "@payky/core/modules/shared/schema"
import { z } from "zod"

/** Every new account is Czech, whatever the UI language (onboarding/0001)… */
export const onboardingCountry = "CZ" as const
/** …and sells in CZK, the currency a starter pack is priced in too. */
export const onboardingCurrency = FiatCurrency.CZK

/** Stored for every new account; only enabled methods appear during payment. */
export const onboardingPaymentMethodOrder = [
  "iban",
  "cardSwitchio",
  "qerkoTerminal",
  "qerkoPayment",
  "spark",
  "cashu",
  "lightningAddress",
  "cashRegister",
] as const satisfies ReadonlyArray<DefaultPaymentMethod>

/**
 * What the business-setup form holds once checked. A blank input is `null`
 * (no bank transfers / no name); a nonblank one is parsed or flagged invalid
 * (onboarding/0006), and the form shows that only after a submit attempt.
 */
export interface OnboardingFormValidation {
  readonly iban: Iban | null
  readonly ibanInvalid: boolean
  readonly businessName: NonEmptyString255 | null
  readonly businessNameInvalid: boolean
}

export const validateOnboardingForm = (form: {
  readonly iban: string
  readonly businessName: string
}): OnboardingFormValidation => {
  const iban =
    form.iban.trim() === ""
      ? null
      : BankAccountInputIbanSchema.safeParse(form.iban)
  const name =
    form.businessName.trim() === ""
      ? null
      : NonEmptyString255Schema.safeParse(form.businessName)
  return {
    iban: iban?.success ? iban.data : null,
    ibanInvalid: iban !== null && !iban.success,
    businessName: name?.success ? name.data : null,
    businessNameInvalid: name !== null && !name.success,
  }
}

/**
 * The `finishOnboarding` input of every new account: Czech, in CZK whatever
 * the UI language (onboarding/0001), the fixed method order whose first
 * entry is the default (onboarding/0007), and how the business sells, with
 * tips on or off, as its last step chose (onboarding/0012), the card
 * terminal on when this device has SwitchioPay (onboarding/0015), and the
 * starter pack's priced products, none when left out.
 */
export const createFinishOnboardingInput = ({
  iban,
  homeMode,
  tipsEnabled,
  cardSwitchio,
  publicName,
  starterItems = [],
}: {
  readonly iban: Iban | null
  readonly homeMode: TerminalHomeMode
  readonly tipsEnabled: boolean
  readonly cardSwitchio: boolean
  readonly publicName: NonEmptyString255 | null
  readonly starterItems?: ReadonlyArray<OnboardingStarterItem>
}) => ({
  country: onboardingCountry,
  currency: onboardingCurrency,
  iban,
  homeMode,
  tipsEnabled,
  cardSwitchio,
  publicName,
  starterItems,
  defaultPaymentMethod: onboardingPaymentMethodOrder[0],
  paymentMethodOrderJson: z.encode(
    PaymentMethodOrderJson,
    onboardingPaymentMethodOrder
  ),
})
