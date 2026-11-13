import { enCommon } from "./en/common.ts"
import { enLanding } from "./en/landing.ts"
import { enPrivacy } from "./en/privacy.ts"
import { enTerminal } from "./en/terminal.ts"
export const en = {
  ...enCommon,
  ...enLanding,
  ...enPrivacy,
  ...enTerminal,
} as const
export type TranslationKey = keyof typeof en
