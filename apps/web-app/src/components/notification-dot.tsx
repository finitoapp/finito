import { cn } from "@/lib/utils.ts"

/**
 * The dot in an icon's corner that says a notification is active
 * (navigation/0005). Decorative: the control it sits on names the news in
 * its own label (`nav.notificationsUnread`). The parent must be `relative`.
 */
export function NotificationDot({
  className,
}: {
  readonly className?: string
}) {
  return (
    <span
      aria-hidden="true"
      data-testid="notification-dot"
      className={cn(
        "pointer-events-none absolute top-1 right-1 size-2 rounded-full bg-primary",
        className
      )}
    />
  )
}
