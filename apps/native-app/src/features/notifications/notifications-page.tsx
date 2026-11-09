import type { JobNotification } from "@payky/core/background-jobs/notifications"
import Bell from "lucide-react-native/icons/bell"
import { Text, View, XStack, YStack } from "tamagui"
import { FadeHeader } from "../../components/fade-header.tsx"
import { MenuBarSpacer } from "../../components/menu-nav.tsx"
import { Screen } from "../../components/screen.tsx"
import { Button } from "../../components/ui/button.tsx"
import { Card } from "../../components/ui/card.tsx"
import { Icon } from "../../components/ui/icon.tsx"
import { useActiveNotifications } from "../../hooks/use-active-notifications.ts"
import { useTranslation } from "../../hooks/use-translation.ts"
import { fontSize, fontWeight, shape } from "../../theme/tokens.ts"
import { notificationRenderers } from "./notification-renderers.tsx"

/**
 * Notifications, as web's `NotificationsPage`, which web puts behind
 * home's bell (navigation/0001) and native in a tab of its own
 * (navigation/0004): a root screen, so no Back, with the bar under it.
 * A card per notification the background jobs raise and this device may
 * see, drawn by its renderer; the empty state, as a catalog list's, when
 * there is none.
 *
 * Tailwind mirrored (empty state): `py-10 gap-2 text-center`, the bell
 * `size-10 text-muted-foreground` (stroke 1.5) with `mb-2`, the title
 * `text-lg font-semibold`, the description `text-sm text-muted-foreground`.
 */
export function NotificationsPage() {
  const { t } = useTranslation()
  const notifications = useActiveNotifications()

  return (
    <Screen footer={<MenuBarSpacer />}>
      <FadeHeader title={t("notifications.title")} startAddon={null} />
      {notifications.length === 0 ? (
        <NotificationsEmpty />
      ) : (
        <YStack gap={12}>
          {notifications.map((notification) => (
            <NotificationCard
              key={notification.type}
              notification={notification}
            />
          ))}
        </YStack>
      )}
    </Screen>
  )
}

/**
 * One active notification, drawn by its type's renderer: the icon in a soft
 * accent circle beside the title and description, the actions under them.
 *
 * Tailwind mirrored: the card `px-4`; the circle `size-12 rounded-full
 * bg-primary/10 text-primary`, the icon `size-6`; the title
 * `font-semibold`, the description `text-sm text-muted-foreground`; the
 * actions `flex justify-end gap-2`.
 */
function NotificationCard({
  notification,
}: {
  readonly notification: JobNotification
}) {
  const { t } = useTranslation()
  const renderer = notificationRenderers[notification.type]
  const actions = renderer.useActions()

  return (
    <Card testID={`notification-${notification.type}`} px={16}>
      <XStack items="center" gap={16}>
        <View
          w={48}
          h={48}
          shrink={0}
          items="center"
          justify="center"
          rounded={shape.pill}
          bg="primary-10"
        >
          <Icon icon={renderer.icon} size={24} color="primary" />
        </View>
        <YStack flex={1} minW={0}>
          <Text fontWeight={fontWeight.semibold}>{t(renderer.title)}</Text>
          <Text fontSize={fontSize.sm} color="muted-foreground">
            {t(renderer.description)}
          </Text>
        </YStack>
      </XStack>
      <XStack justify="flex-end" gap={8}>
        {actions.map((action) => (
          <Button
            key={action.label}
            variant={action.variant}
            label={t(action.label)}
            onPress={action.run}
          />
        ))}
      </XStack>
    </Card>
  )
}

function NotificationsEmpty() {
  const { t } = useTranslation()
  return (
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
  )
}
