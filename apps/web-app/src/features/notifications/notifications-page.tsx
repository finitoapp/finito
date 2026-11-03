import { BellIcon } from "lucide-react"
import { FadeHeader } from "@/components/fade-header.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"

/**
 * Notifications, behind home's bell (navigation/0001): a screen of its own
 * with Back, not a tab of the menu. Nothing raises a notification yet, so
 * the screen is its empty state, drawn like a catalog list's, and the bell
 * carries no count.
 */
export function NotificationsPage() {
  const { t } = useTranslation()

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("notifications.title")} />

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
    </>
  )
}
