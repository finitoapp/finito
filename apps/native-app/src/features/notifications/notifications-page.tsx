import Bell from "lucide-react-native/icons/bell"
import { Text, YStack } from "tamagui"
import { FadeHeader } from "../../components/fade-header.tsx"
import { MenuBarSpacer } from "../../components/menu-nav.tsx"
import { Screen } from "../../components/screen.tsx"
import { Icon } from "../../components/ui/icon.tsx"
import { useTranslation } from "../../hooks/use-translation.ts"
import { fontSize, fontWeight } from "../../theme/tokens.ts"

/**
 * Notifications, as web's `NotificationsPage`, which web puts behind
 * home's bell (navigation/0001) and native in a tab of its own
 * (navigation/0004): a root screen, so no Back, with the bar under it.
 * Nothing raises a notification yet, so the screen is its empty state,
 * drawn like a catalog list's.
 *
 * Tailwind mirrored: `py-10 gap-2 text-center`, the bell `size-10
 * text-muted-foreground` (stroke 1.5) with `mb-2`, the title `text-lg
 * font-semibold`, the description `text-sm text-muted-foreground`.
 */
export function NotificationsPage() {
  const { t } = useTranslation()

  return (
    <Screen footer={<MenuBarSpacer />}>
      <FadeHeader title={t("notifications.title")} startAddon={null} />
      <YStack items="center" gap={8} py={40}>
        <YStack mb={8}>
          <Icon
            icon={Bell}
            size={40}
            color="muted-foreground"
            strokeWidth={1.5}
          />
        </YStack>
        <Text
          text="center"
          fontSize={fontSize.lg}
          lineHeight={fontSize.lg}
          fontWeight={fontWeight.semibold}
        >
          {t("notifications.empty.title")}
        </Text>
        <Text
          text="center"
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          color="muted-foreground"
        >
          {t("notifications.empty.description")}
        </Text>
      </YStack>
    </Screen>
  )
}
