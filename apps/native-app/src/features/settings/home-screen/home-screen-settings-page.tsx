import { setEnabledHomeModes } from "@payky/core/modules/app-settings/app-settings-actions"
import type { TerminalHomeMode } from "@payky/core/modules/app-settings/app-settings-types"
import { terminalHomeModes } from "@payky/core/modules/app-settings/app-settings-utils"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import { SwitchRow } from "../../../components/switch-row.tsx"
import { homeModeLabelKeys } from "../../../core/home-mode-labels.ts"
import { useInlineChoice } from "../../../hooks/use-inline-choice.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTerminalHomeMode } from "../../../hooks/use-terminal-home-mode.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"

/**
 * The modes home offers (navigation/0004), as web's `HomeScreenSettingsPage`
 * without its card and descriptions (fazole-ui-minimal-copy): one switch per
 * mode, written the moment it is touched. Switching off the last one is let
 * through to the save, so its refusal can say why (settings/0001).
 */
export function HomeScreenSettingsPage() {
  const { t } = useTranslation()
  const { enabledModes } = useTerminalHomeMode()

  return (
    <Screen>
      <FadeHeader title={t("settings.homeScreen.title")} />
      {terminalHomeModes.map((mode) => (
        <HomeModeSwitch key={mode} mode={mode} enabledModes={enabledModes} />
      ))}
    </Screen>
  )
}

function HomeModeSwitch({
  mode,
  enabledModes,
}: {
  readonly mode: TerminalHomeMode
  readonly enabledModes: ReadonlyArray<TerminalHomeMode>
}) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const choice = useInlineChoice(enabledModes.includes(mode), (checked) =>
    runToast(async (run) => {
      const result = await run(
        setEnabledHomeModes(
          checked
            ? [...enabledModes, mode]
            : enabledModes.filter((enabled) => enabled !== mode)
        )
      )
      return result.ok ? undefined : "settings.homeScreen.atLeastOneMode"
    })
  )

  return (
    <SwitchRow
      label={t(homeModeLabelKeys[mode])}
      checked={choice.value}
      disabled={choice.saving}
      onCheckedChange={(next) => {
        void choice.choose(next)
      }}
    />
  )
}
