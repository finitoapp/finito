import { id } from "@evolu/common"
import { z } from "zod"
import { standardSchemaToZod } from "../../zod-utils.ts"
import type { NonEmptyString255, NonNegativeInteger } from "../shared/schema.ts"
import type { TaxRatePercentage } from "../tax-rate/tax-rate-types.ts"

export const AppSettingsIdRaw = id("AppSettings")
export const AppSettingsId = standardSchemaToZod(AppSettingsIdRaw)
export type AppSettingsId = typeof AppSettingsIdRaw.Output

export const DefaultPaymentMethodSchema = z.enum([
  "cashRegister",
  "spark",
  "iban",
  "cardSwitchio",
  "qerkoTerminal",
  "qerkoPayment",
  "cashu",
  "lightningAddress",
])
export type DefaultPaymentMethod = z.output<typeof DefaultPaymentMethodSchema>

export const TerminalHomeModeSchema = z.enum(["numpad", "pos"])
export type TerminalHomeMode = z.output<typeof TerminalHomeModeSchema>

/**
 * A catalog item onboarding creates from a starter pack's library product.
 * Its price is the one the merchant typed — the library carries none — and
 * never below zero: a starter item is never a discount.
 */
export interface OnboardingStarterItem {
  readonly name: NonEmptyString255
  readonly libraryProductId: NonEmptyString255
  readonly unitAmount: NonNegativeInteger
  /** The library category's name in the merchant's language. */
  readonly categoryName: NonEmptyString255 | null
  /**
   * The library's VAT for the account's country, matched against the rates
   * the account has once onboarding seeded them; `null` for none.
   */
  readonly taxRatePercentage: TaxRatePercentage | null
}
