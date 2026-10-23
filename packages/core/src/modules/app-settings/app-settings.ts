import { SqliteBoolean, sqliteTrue } from "@evolu/common"
import { z } from "zod"
import {
  FiatCurrencySchema,
  type InferTable,
  NonEmptyString255Schema,
  TimestampMsSchema,
} from "../shared/schema.ts"
import {
  AppSettingsId,
  DefaultPaymentMethodSchema,
} from "./app-settings-types.ts"

export const appSettings = {
  id: AppSettingsId,
  onboardingCompleted: z.literal(sqliteTrue).nullable(),
  fiatCurrency: FiatCurrencySchema,
  tipsEnabled: SqliteBoolean,
  presetTipPercentagesJson: z.string(),
  presetTipFixedAmountsJson: z.string(),
  paymentMethodOrderJson: z.string(),
  defaultPaymentMethod: DefaultPaymentMethodSchema,
  /**
   * The home-screen modes on offer, as a JSON array; `null` means all of
   * them. Nullable and left out of `settingsQuery`'s filter, so rows written
   * before the column existed still count as onboarded settings.
   */
  enabledHomeModesJson: z.string().nullable(),
  /**
   * When the merchant proved the recovery phrase is written down correctly
   * (account/0007); `null` means not verified. Nullable and left out of
   * `settingsQuery`'s filter like `enabledHomeModesJson`. It lives on the
   * account, so verifying on one device clears the reminder on all of them.
   * Carries a timestamp only, never the phrase or any word of it.
   */
  recoveryPhraseVerifiedAt: TimestampMsSchema.nullable(),
  selfPayGuestName: NonEmptyString255Schema.nullable(),
} as const

export type AppSettingsRow = InferTable<typeof appSettings>
