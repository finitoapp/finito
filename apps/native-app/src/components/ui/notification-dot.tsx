import { View } from "tamagui"
import type { ThemeColor } from "../../theme/themes.ts"
import { shape } from "../../theme/tokens.ts"

/**
 * Web `apps/web-app/src/components/notification-dot.tsx`: the small dot in
 * an icon's top-right corner that says a notification is waiting. It draws
 * nothing to read: the control it sits on names it (`nav.notificationsUnread`).
 *
 * Tailwind mirrored: `absolute size-2 rounded-full bg-primary` at the
 * icon's corner. `color` takes another theme key where the icon sits on the
 * primary fill itself (the bottom bar's active pill), which would hide a
 * primary dot.
 */
export function NotificationDot({
  color = "primary",
}: {
  readonly color?: ThemeColor
}) {
  return (
    <View
      position="absolute"
      t={-2}
      r={-2}
      w={8}
      h={8}
      rounded={shape.pill}
      bg={color}
      pointerEvents="none"
      aria-hidden
      testID="notification-dot"
    />
  )
}
