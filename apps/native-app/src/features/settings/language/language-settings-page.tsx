import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type { DeviceLocale } from "@payky/core/evolu/device-client"
import Earth from "lucide-react-native/icons/earth"
import Languages from "lucide-react-native/icons/languages"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { languageOptions } from "../../../components/language-options.ts"
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
  useLocale,
  useSetLanguage,
  useSetLocale,
  useTranslation,
} from "../../../hooks/use-translation.ts"

const localeOptions = [
  { value: "en-US", label: "settings.language.locale.english.title" },
  { value: "cs-CZ", label: "settings.language.locale.czech.title" },
  { value: "sk-SK", label: "settings.language.locale.slovak.title" },
] as const satisfies ReadonlyArray<{
  readonly value: DeviceLocale
  readonly label: TranslationKey
}>

/**
 * App language and regional format, as web's `LanguageSettingsPage`. A choice
 * is written at once; every screen reads the device setting, so the UI follows
 * without a reload.
 */
export function LanguageSettingsPage() {
  const { language, t } = useTranslation()
  const locale = useLocale()
  const setLanguage = useSetLanguage()
  const setLocale = useSetLocale()

  return (
    <Screen>
      <FadeHeader title={t("settings.language.title")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.language.mode.title")}</CardTitle>
          <CardDescription>
            {t("settings.language.mode.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OptionToggleGroup
            value={language}
            options={languageOptions.map(({ value, label }) => ({
              value,
              icon: Languages,
              title: label,
            }))}
            onChange={setLanguage}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.language.locale.title")}</CardTitle>
          <CardDescription>
            {t("settings.language.locale.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OptionToggleGroup
            value={locale}
            options={localeOptions.map(({ value, label }) => ({
              value,
              icon: Earth,
              title: t(label),
            }))}
            onChange={setLocale}
          />
        </CardContent>
      </Card>
    </Screen>
  )
}
