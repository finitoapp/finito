import type { TranslationKey } from "./en.ts"
import { skCommon } from "./sk/common.ts"
import { skLanding } from "./sk/landing.ts"
import { skPrivacy } from "./sk/privacy.ts"
import { skTerminal } from "./sk/terminal.ts"
export const sk = {
  ...skCommon,
  ...skLanding,
  ...skPrivacy,
  ...skTerminal,
} as const satisfies Record<TranslationKey, string>
