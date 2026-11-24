import { cs } from "./cs.ts"
import { en } from "./en.ts"
import { sk } from "./sk.ts"
import { vi } from "./vi.ts"

export const resources = { en, cs, sk, vi } as const

export type Language = keyof typeof resources
export type { TranslationKey } from "./en.ts"
