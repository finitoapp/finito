import { setEnabledHomeModes } from "@payky/core/modules/app-settings/app-settings-actions"
import type { TerminalHomeMode } from "@payky/core/modules/app-settings/app-settings-types"
import { terminalHomeModes } from "@payky/core/modules/app-settings/app-settings-utils"
import { XStack } from "tamagui"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import { homeModeLabelKeys } from "../../../core/home-mode-labels.ts"
import { useInlineChoice } from "../../../hooks/use-inline-choice.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTerminalHomeMode } from "../../../hooks/use-terminal-home-mode.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { HomeModeCard } from "../../shared/home-mode-card.tsx"

const modeDescriptionKeys = {
  numpad: "settings.homeScreen.numpad.description",
  pos: "settings.homeScreen.pos.description",
} as const

/**
 * The modes home offers (navigation/0004), as web's `HomeScreenSettingsPage`:
 * in a card that says what turning both on does, each mode as the pictured
 * choice onboarding offers, named as home's switch names it, and turned on
 * or off the moment it is touched. Turning off the last one is let through
 * to the save, so its refusal can say why (settings/0004).
 */
export function HomeScreenSettingsPage() {
  const { t } = useTranslation()
  const { enabledModes } = useTerminalHomeMode()

  return (
    <Screen>
      <FadeHeader title={t("settings.homeScreen.title")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.homeScreen.modes.title")}</CardTitle>
          <CardDescription>
            {t("settings.homeScreen.modes.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <XStack role="group" gap={12} items="stretch">
            {terminalHomeModes.map((mode) => (
              <HomeModeChoice
                key={mode}
                mode={mode}
                enabledModes={enabledModes}
              />
            ))}
          </XStack>
        </CardContent>
      </Card>
    </Screen>
  )
}

function HomeModeChoice({
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
    <HomeModeCard
      mode={mode}
      title={t(homeModeLabelKeys[mode])}
      description={t(modeDescriptionKeys[mode])}
      role="checkbox"
      checked={choice.value}
      disabled={choice.saving}
      onPress={() => {
        void choice.choose(!choice.value)
      }}
    />
  )
}
