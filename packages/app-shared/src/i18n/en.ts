import { enBill } from "./en/bill.ts"
import { enCommon } from "./en/common.ts"
import { enOnboarding } from "./en/onboarding.ts"
import { enPayment } from "./en/payment.ts"
import { enSettings } from "./en/settings.ts"
import { enWithdraw } from "./en/withdraw.ts"

/**
 * English is the source of truth for translation keys: `TranslationKey`
 * is derived from it, and the other languages are checked against it per namespace
 * file as well as as a whole.
 */
export const en = {
  ...enSettings,
  ...enBill,
  ...enPayment,
  ...enWithdraw,
  ...enOnboarding,
  ...enCommon,
} as const

export type TranslationKey = keyof typeof en
