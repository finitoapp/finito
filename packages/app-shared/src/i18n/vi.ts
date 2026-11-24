import type { TranslationKey } from "./en.ts"
import { viBill } from "./vi/bill.ts"
import { viCommon } from "./vi/common.ts"
import { viOnboarding } from "./vi/onboarding.ts"
import { viPayment } from "./vi/payment.ts"
import { viSettings } from "./vi/settings.ts"
import { viWithdraw } from "./vi/withdraw.ts"

export const vi = {
  ...viSettings,
  ...viBill,
  ...viPayment,
  ...viWithdraw,
  ...viOnboarding,
  ...viCommon,
} satisfies Record<TranslationKey, string>
