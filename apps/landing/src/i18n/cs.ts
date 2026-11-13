import { csCommon } from "./cs/common.ts"
import { csLanding } from "./cs/landing.ts"
import { csPrivacy } from "./cs/privacy.ts"
import { csTerminal } from "./cs/terminal.ts"
import type { TranslationKey } from "./en.ts"
export const cs = {
  ...csCommon,
  ...csLanding,
  ...csPrivacy,
  ...csTerminal,
} as const satisfies Record<TranslationKey, string>
