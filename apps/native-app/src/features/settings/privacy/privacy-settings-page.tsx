import { Platform } from "react-native"
import { Text, YStack } from "tamagui"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import { useRequirePermission } from "../../../core/use-access.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { AiAssistantCard } from "./ai-assistant-card.tsx"
import { ConsentCard } from "./consent-card.tsx"
import { usePrivacySettings } from "./use-privacy-settings.ts"

/** The device's consents, as web's `PrivacySettingsPage`: they come first. */
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
      <YStack gap="5">
        <ConsentCard
          title={t("settings.privacy.errorReporting.title")}
          description={t("settings.privacy.errorReporting.description")}
          enabled={reporting}
          status={t(
            reporting
              ? "settings.privacy.errorReporting.enabled"
              : "settings.privacy.errorReporting.disabled"
          )}
          actionLabel={t(
            reporting
              ? "settings.privacy.errorReporting.disable"
              : "settings.privacy.errorReporting.enable"
          )}
          onPress={() => settings.setErrorReportingEnabled(!reporting)}
        />
        <ConsentCard
          title={t("settings.privacy.productLookup.title")}
          description={t("settings.privacy.productLookup.description")}
          enabled={lookup}
          status={t(
            lookup
              ? "settings.privacy.productLookup.enabled"
              : "settings.privacy.productLookup.disabled"
          )}
          actionLabel={t(
            lookup
              ? "settings.privacy.productLookup.disable"
              : "settings.privacy.productLookup.enable"
          )}
          onPress={() => settings.setProductLookupEnabled(!lookup)}
        />
        <AiAssistantCard />
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
          status={t(
            proxy
              ? "settings.privacy.serviceProxy.enabled"
              : "settings.privacy.serviceProxy.disabled"
          )}
          actionLabel={t(
            proxy
              ? "settings.privacy.serviceProxy.disable"
              : "settings.privacy.serviceProxy.enable"
          )}
          // On or off, it decides where the bank tokens go, on a `free` page:
          // `admin` either way, as the AI data access (service-proxy/0001).
          onPress={() => {
            void (async () => {
              if (await require("admin", "access.action.serviceProxy")) {
                settings.setServiceProxyEnabled(!proxy)
              }
            })()
          }}
        />
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.about.privacy.heading")}</CardTitle>
            <CardDescription>
              {t("settings.about.privacy.summary")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Text color="muted-foreground" fontSize="sm" lineHeight="sm">
              {t("settings.about.privacy.body")}
            </Text>
          </CardContent>
        </Card>
      </YStack>
    </Screen>
  )
}
