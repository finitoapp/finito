import { Platform } from "react-native"
import { Text } from "tamagui"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import { appBrand } from "../../../core/app-brand.ts"
import { useRequirePermission } from "../../../core/use-access.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { fontSize } from "../../../theme/tokens.ts"
import { AiAssistantCard } from "./ai-assistant-card.tsx"
import { ConsentCard } from "./consent-card.tsx"
import { usePrivacySettings } from "./use-privacy-settings.ts"

/**
 * The device's consents, as web's `PrivacySettingsPage`: they come first,
 * each a switch that saves at once.
 */
export function PrivacySettingsPage() {
  const { t } = useTranslation()
  const settings = usePrivacySettings()
  const { require } = useRequirePermission()
  const reporting = settings.errorReportingEnabled
  const lookup = settings.productLookupEnabled
  const proxy = settings.serviceProxyEnabled

  return (
    <Screen>
      <FadeHeader title={t("settings.about.privacy.title")} />
      <ConsentCard
        title={t("settings.privacy.errorReporting.title")}
        description={t("settings.privacy.errorReporting.description")}
        enabled={reporting}
        onCheckedChange={(enabled) =>
          settings.setErrorReportingEnabled(enabled)
        }
      />
      <ConsentCard
        title={t("settings.privacy.serviceProxy.title")}
        description={t("settings.privacy.serviceProxy.description")}
        // The APK calls the banks directly; the PWA is what the proxy is for.
        note={
          Platform.OS === "web"
            ? undefined
            : t("settings.privacy.serviceProxy.nativeNote")
        }
        enabled={proxy}
        // On or off, it decides where the bank tokens go, on a `free` page:
        // `admin` either way, as the AI data access (service-proxy/0001).
        onCheckedChange={(enabled) => {
          void (async () => {
            if (await require("admin", "access.action.serviceProxy")) {
              settings.setServiceProxyEnabled(enabled)
            }
          })()
        }}
      />
      <ConsentCard
        title={t("settings.privacy.productLookup.title")}
        description={t("settings.privacy.productLookup.description")}
        enabled={lookup}
        onCheckedChange={(enabled) => settings.setProductLookupEnabled(enabled)}
      />
      <AiAssistantCard />
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.about.privacy.heading")}</CardTitle>
          <CardDescription>
            {t("settings.about.privacy.summary")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Text
            color="muted-foreground"
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
          >
            {t("settings.about.privacy.body", {
              websiteUrl: appBrand.websiteUrl,
            })}
          </Text>
        </CardContent>
      </Card>
    </Screen>
  )
}
