import { cs } from "./cs.ts"
import { en } from "./en.ts"
import { sk } from "./sk.ts"

/**
 * The copy as written, with its brand placeholders: the app's name in the
 * case each string needs (brand/0002) and the hosts the copy names
 * (landing/0013). `createLandingResources` fills them for a landing.
 */
export const resources = { en, cs, sk } as const

export type Language = keyof typeof resources
export type { TranslationKey } from "./en.ts"
