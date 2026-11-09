import type { JobNotification } from "@payky/core/background-jobs/notifications"
import { BellIcon } from "lucide-react"
import { FadeHeader } from "@/components/fade-header.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Card } from "@/components/ui/card.tsx"
import { notificationRenderers } from "@/features/notifications/notification-renderers.tsx"
import { useActiveNotifications } from "@/hooks/use-active-notifications.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

/** One active notification, drawn by its type's renderer. */
function NotificationCard({
  notification,
}: {
  readonly notification: JobNotification
}) {
  const { t } = useTranslation()
  const renderer = notificationRenderers[notification.type]
  const actions = renderer.useActions()
  const Icon = renderer.icon

  return (
    <Card data-testid={`notification-${notification.type}`} className="px-4">
      <div className="flex items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon aria-hidden="true" className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t(renderer.title)}</p>
          <p className="text-sm text-muted-foreground">
            {t(renderer.description)}
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            type="button"
            variant={action.variant}
            onClick={action.run}
          >
            {t(action.label)}
          </Button>
        ))}
      </div>
    </Card>
  )
}

/**
 * Notifications, behind home's bell (navigation/0001): a screen of its own
 * with Back, not a tab of the menu. A card for each notification the
 * background jobs raise and this device may see (notification/0001), or the
 * empty state, drawn like a catalog list's, when there is none.
 */
export function NotificationsPage() {
  const { t } = useTranslation()
  const notifications = useActiveNotifications()

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("notifications.title")} />

      {notifications.length > 0 ? (
        <div className="flex flex-col gap-3 px-4">
          {notifications.map((notification) => (
            <NotificationCard
              key={notification.type}
              notification={notification}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <BellIcon
            className="mb-2 size-10 text-muted-foreground"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <p className="text-lg font-semibold">
            {t("notifications.empty.title")}
          </p>
          <p className="text-balance text-sm text-muted-foreground">
            {t("notifications.empty.description")}
          </p>
        </div>
      )}
    </>
  )
}
