import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type { TerminalHomeMode } from "@payky/core/modules/app-settings/app-settings-types"

/** Home's modes by name, as web's `homeModeLabelKeys` (`i18n/settings-labels.ts`). */
export const homeModeLabelKeys = {
  numpad: "nav.numpad",
  pos: "nav.pos",
} as const satisfies Record<TerminalHomeMode, TranslationKey>
