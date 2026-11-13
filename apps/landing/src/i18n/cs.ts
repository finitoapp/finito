import { csCommon } from "./cs/common.ts"
import { csLanding } from "./cs/landing.ts"
import { csPrivacy } from "./cs/privacy.ts"
import type { TranslationKey } from "./en.ts"
export const cs = {
  ...csCommon,
  ...csLanding,
  ...csPrivacy,
} as const satisfies Record<TranslationKey, string>
