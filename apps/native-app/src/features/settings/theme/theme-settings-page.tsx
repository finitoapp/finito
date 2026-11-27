import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type {
  DeviceAnimations,
  DeviceTheme,
} from "@payky/core/evolu/device-client"
import Laptop from "lucide-react-native/icons/laptop"
import Moon from "lucide-react-native/icons/moon"
import Sparkles from "lucide-react-native/icons/sparkles"
import Sun from "lucide-react-native/icons/sun"
import Zap from "lucide-react-native/icons/zap"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { OptionToggleGroup } from "../../../components/option-toggle-group.tsx"
import { Screen } from "../../../components/screen.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import {
  useAnimationsPreference,
  useSetAnimationsPreference,
} from "../../../hooks/use-animations-preference.ts"
import {
  useSetThemePreference,
  useThemePreference,
} from "../../../hooks/use-theme-preference.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"

export const themeLabelKeys = {
  light: "settings.theme.light.title",
  dark: "settings.theme.dark.title",
  system: "settings.theme.system.title",
} satisfies Record<DeviceTheme, TranslationKey>

const themeDescriptionKeys = {
  light: "settings.theme.light.description",
  dark: "settings.theme.dark.description",
  system: "settings.theme.system.description",
} satisfies Record<DeviceTheme, TranslationKey>

const themes: ReadonlyArray<DeviceTheme> = ["light", "dark", "system"]

const themeIcons = {
  light: Sun,
  dark: Moon,
  system: Laptop,
} satisfies Record<DeviceTheme, typeof Sun>

const animationsOptions: ReadonlyArray<DeviceAnimations> = [
  "system",
  "on",
  "off",
]

const animationsLabelKeys = {
  system: "settings.theme.animations.system.title",
  on: "settings.theme.animations.on.title",
  off: "settings.theme.animations.off.title",
} satisfies Record<DeviceAnimations, TranslationKey>

const animationsDescriptionKeys = {
  system: "settings.theme.animations.system.description",
  on: "settings.theme.animations.on.description",
  off: "settings.theme.animations.off.description",
} satisfies Record<DeviceAnimations, TranslationKey>

const animationsIcons = {
  system: Laptop,
  on: Sparkles,
  off: Zap,
} satisfies Record<DeviceAnimations, typeof Sun>

/**
 * Light, dark or the system's, as web's `ThemeSettingsPage`; applied at once
 * by the root layout. Below it, whether the device animates (settings/0007),
 * which web leaves to the browser.
 */
export function ThemeSettingsPage() {
  const { t } = useTranslation()
  const theme = useThemePreference()
  const setTheme = useSetThemePreference()
  const animations = useAnimationsPreference()
  const setAnimations = useSetAnimationsPreference()

  return (
    <Screen>
      <FadeHeader title={t("settings.theme.title")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.theme.mode.title")}</CardTitle>
          <CardDescription>
            {t("settings.theme.mode.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OptionToggleGroup
            value={theme}
            options={themes.map((value) => ({
              value,
              icon: themeIcons[value],
              title: t(themeLabelKeys[value]),
              description: t(themeDescriptionKeys[value]),
            }))}
            onChange={setTheme}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.theme.animations.title")}</CardTitle>
          <CardDescription>
            {t("settings.theme.animations.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OptionToggleGroup
            value={animations}
            options={animationsOptions.map((value) => ({
              value,
              icon: animationsIcons[value],
              title: t(animationsLabelKeys[value]),
              description: t(animationsDescriptionKeys[value]),
            }))}
            onChange={setAnimations}
          />
        </CardContent>
      </Card>
    </Screen>
  )
}
