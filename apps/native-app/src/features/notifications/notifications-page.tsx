import Bell from "lucide-react-native/icons/bell"
import { Text, YStack } from "tamagui"
import { FadeHeader } from "../../components/fade-header.tsx"
import { Screen } from "../../components/screen.tsx"
import { Icon } from "../../components/ui/icon.tsx"
import { useTranslation } from "../../hooks/use-translation.ts"
import { fontSize, fontWeight } from "../../theme/tokens.ts"

/**
 * Notifications, behind home's bell, as web's `NotificationsPage`
 * (navigation/0001): a screen of its own with Back, not a tab of the menu.
 * Nothing raises a notification yet, so the bell carries no count and the
 * screen is
 * its empty state, drawn like a catalog list's.
 *
 * Tailwind mirrored: `py-10 gap-2 text-center`, the bell `size-10
 * text-muted-foreground` (stroke 1.5) with `mb-2`, the title `text-lg
 * font-semibold`, the description `text-sm text-muted-foreground`.
 */
export function NotificationsPage() {
  const { t } = useTranslation()

  return (
    <Screen>
      <FadeHeader title={t("notifications.title")} />
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
