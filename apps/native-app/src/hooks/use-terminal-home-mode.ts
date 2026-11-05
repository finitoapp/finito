import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import {
  type TerminalHomeMode,
  TerminalHomeModeSchema,
} from "@payky/core/modules/app-settings/app-settings-types"
import {
  parseEnabledHomeModes,
  resolveTerminalHomeMode,
} from "@payky/core/modules/app-settings/app-settings-utils"
import { useAtom } from "jotai"
import { viewStateAtom } from "../platform/view-state-atom.ts"
import { useEvoluQuery } from "./use-evolu-query.ts"

/** Per-device view state under web's `localStorage` key, as web does. */
const terminalHomeModeAtom = viewStateAtom<TerminalHomeMode>(
  "payky.terminalHomeMode",
  TerminalHomeModeSchema,
  "numpad"
)

/**
 * Which view home shows, and which views it offers (navigation/0004), as
 * web's `useTerminalHomeMode`. The remembered view is this device's; the
 * offered views are a synced app setting (`enabledHomeModesJson`); while
 * the remembered one is not among them, the first offered one shows
 * instead, and the remembered value is left alone, so re-enabling its mode
 * brings it back.
 */
export function useTerminalHomeMode() {
  const [remembered, setMode] = useAtom(terminalHomeModeAtom)
  const [settings] = useEvoluQuery(settingsQuery).data
  const enabledModes = parseEnabledHomeModes(settings?.enabledHomeModesJson)

  return {
    mode: resolveTerminalHomeMode(remembered, enabledModes),
    enabledModes,
    setMode,
  }
}
