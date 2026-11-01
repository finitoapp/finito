import Constants from "expo-constants"
import Bug from "lucide-react-native/icons/bug"
import DatabaseBackup from "lucide-react-native/icons/database-backup"
import DatabaseZap from "lucide-react-native/icons/database-zap"
import GitFork from "lucide-react-native/icons/git-fork"
import ScrollText from "lucide-react-native/icons/scroll-text"
import ShieldCheck from "lucide-react-native/icons/shield-check"
import { Image, Platform } from "react-native"
import { Text, YStack } from "tamagui"
import appIcon from "../../../../assets/app-icon.png"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import { Icon } from "../../../components/ui/icon.tsx"
import { VerticalNav } from "../../../components/vertical-nav.tsx"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { fontSize } from "../../../theme/tokens.ts"

export function AboutPage() {
  const { t } = useTranslation()
  const version = Constants.expoConfig?.version
  const versionCode = Constants.expoConfig?.android?.versionCode

  const label = (title: string, description: string) => (
    <YStack gap="1">
      <Text fontSize="sm" lineHeight="sm" fontWeight="600">
        {title}
      </Text>
      <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
        {description}
      </Text>
    </YStack>
  )

  return (
    <Screen>
      <FadeHeader title={t("settings.about.title")} />
      {/* Web's icon-animated.svg; RN cannot play an SVG animation, so this
          is the static app icon. No shadow: native cards have none. */}
      <YStack items="center" gap={32} pt={32} pb={16}>
        <Image
          source={appIcon}
          style={{ width: 160, height: 160, borderRadius: 24 }}
          aria-label={t("settings.about.app.title")}
          accessibilityIgnoresInvertColors
        />
        {version === undefined ? null : (
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            color="muted-foreground"
          >
            {t("settings.appVersion")} <Text fontWeight="700">{version}</Text>
          </Text>
        )}
        {Platform.OS === "android" && versionCode !== undefined ? (
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            color="muted-foreground"
          >
            {t("settings.appVersionCode")}{" "}
            <Text fontWeight="700">{versionCode}</Text>
          </Text>
        ) : null}
      </YStack>
      <VerticalNav
        title={t("settings.about.app.title")}
        items={[
          {
            kind: "link",
            href: "/settings/about/privacy",
            label: label(
              t("settings.about.privacy.title"),
              t("settings.about.privacy.description")
            ),
            icon: <Icon icon={ShieldCheck} color="muted-foreground" />,
          },
          {
            kind: "link",
            href: "/settings/about/terms",
            label: label(
              t("settings.about.terms.title"),
              t("settings.about.terms.description")
            ),
            icon: <Icon icon={ScrollText} color="muted-foreground" />,
          },
          {
            kind: "href",
            href: "https://github.com/finitoapp/payky",
            label: label(
              t("settings.about.github.title"),
              t("settings.about.github.description")
            ),
            icon: <Icon icon={GitFork} color="muted-foreground" />,
          },
        ]}
      />
      <VerticalNav
        title={t("settings.developers")}
        items={[
          {
            kind: "link",
            href: "/settings/evolu-export",
            label: label(
              t("settings.evoluExport.title"),
              t("settings.evoluExport.description")
            ),
            icon: <Icon icon={DatabaseBackup} color="muted-foreground" />,
          },
          {
            kind: "link",
            href: "/settings/demo-data",
            label: label(
              t("settings.demoData.title"),
              t("settings.demoData.description")
            ),
            icon: <Icon icon={DatabaseZap} color="muted-foreground" />,
          },
          {
            kind: "link",
            href: "/settings/debug-console",
            label: label(
              t("settings.debugConsole.title"),
              t("settings.debugConsole.description")
            ),
            icon: <Icon icon={Bug} color="muted-foreground" />,
          },
        ]}
      />
    </Screen>
  )
}
