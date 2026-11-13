import { enCommon } from "./en/common.ts"
import { enLanding } from "./en/landing.ts"
import { enPrivacy } from "./en/privacy.ts"
export const en = { ...enCommon, ...enLanding, ...enPrivacy } as const
export type TranslationKey = keyof typeof en
