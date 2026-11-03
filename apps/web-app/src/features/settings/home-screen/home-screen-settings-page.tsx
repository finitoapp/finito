import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { setEnabledHomeModes } from "@payky/core/modules/app-settings/app-settings-actions"
import type { TerminalHomeMode } from "@payky/core/modules/app-settings/app-settings-types"
import { terminalHomeModes } from "@payky/core/modules/app-settings/app-settings-utils"
import { FadeHeader } from "@/components/fade-header.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import { FieldGroup } from "@/components/ui/field.tsx"
import { InlineEditSwitch } from "@/features/shared/forms/inline-edit-switch.tsx"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useTerminalHomeMode } from "@/hooks/use-terminal-home-mode.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { homeModeLabelKeys } from "@/i18n/settings-labels.ts"

const homeModeDescriptionKeys = {
  numpad: "settings.homeScreen.numpad.description",
  pos: "settings.homeScreen.pos.description",
} satisfies Record<TerminalHomeMode, TranslationKey>

export function HomeScreenSettingsPage() {
  const { t } = useTranslation()
  const appRun = useAppRun()
  const { enabledModes } = useTerminalHomeMode()

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("settings.homeScreen.title")} />

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.homeScreen.modes.title")}</CardTitle>
          <CardDescription>
            {t("settings.homeScreen.modes.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {terminalHomeModes.map((mode) => (
              <InlineEditSwitch
                key={mode}
                label={t(homeModeLabelKeys[mode])}
                description={t(homeModeDescriptionKeys[mode])}
                defaultValue={enabledModes.includes(mode)}
                // Switching off the last mode is let through to the save, so
                // its refusal can say why instead of the switch just not moving.
                onSave={async (checked) => {
                  await using run = appRun()
                  const result = await run(
                    setEnabledHomeModes(
                      checked
                        ? [...enabledModes, mode]
                        : enabledModes.filter((enabled) => enabled !== mode)
                    )
                  )
                  return result.ok
                    ? undefined
                    : "settings.homeScreen.atLeastOneMode"
                }}
              />
            ))}
          </FieldGroup>
        </CardContent>
      </Card>
    </>
  )
}
