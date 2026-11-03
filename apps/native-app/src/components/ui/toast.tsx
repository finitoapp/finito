import type { LucideIcon } from "lucide-react-native"
import CircleCheck from "lucide-react-native/icons/circle-check"
import Info from "lucide-react-native/icons/info"
import OctagonX from "lucide-react-native/icons/octagon-x"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { styled, Text, View } from "tamagui"
import { fontWeight, shape } from "../../theme/tokens.ts"
import { Icon } from "./icon.tsx"

/**
 * The look of one toast from web `apps/web-app/src/components/ui/sonner.tsx`:
 * sonner's toast on `--normal-bg: popover`, `--normal-text:
 * popover-foreground`, `--normal-border: border`, `--border-radius:
 * radius` (8.8), 16 px padding, 13 px text and a 16 px icon per type
 * (`CircleCheck`, `OctagonX`, `Info`, `TriangleAlert`), none for sonner's
 * plain `toast()`. An action is sonner's action button: 24 high, 8 px side
 * padding, 12 px medium text in `--normal-bg` on `--normal-text`, radius 4.
 * The queue and the timing stay in `components/app/toast-host.tsx`.
 * Sonner's shadow is left out; the border separates the toast from the
 * screen.
 */

type ToastVariant = "default" | "success" | "error" | "info" | "warning"

const icons = {
  default: null,
  success: CircleCheck,
  error: OctagonX,
  info: Info,
  warning: TriangleAlert,
} as const satisfies Record<ToastVariant, LucideIcon | null>

const ToastFrame = styled(View, {
  name: "Toast",
  flexDirection: "row",
  items: "center",
  gap: 6,
  minH: 48,
  p: 16,
  // fazole.fit's toast: a 12-round raised surface, no border.
  rounded: shape.control,
  bg: "popover",
})

export function Toast({
  variant,
  message,
  onPress,
  action,
}: {
  readonly variant: ToastVariant
  /** Already translated. */
  readonly message: string
  readonly onPress?: () => void
  readonly action?: { readonly label: string; readonly onPress: () => void }
}) {
  const icon = icons[variant]
  return (
    <ToastFrame
      onPress={onPress}
      cursor={onPress === undefined ? undefined : "web:pointer"}
      role="alert"
      aria-live="assertive"
    >
      {icon === null ? null : <Icon icon={icon} color="popover-foreground" />}
      <Text flex={1} fontSize={13} color="popover-foreground">
        {message}
      </Text>
      {action === undefined ? null : (
        <View
          h={24}
          px={8}
          rounded={4}
          justify="center"
          bg="popover-foreground"
          role="button"
          hitSlop={12}
          cursor="web:pointer"
          onPress={action.onPress}
        >
          <Text
            fontSize="xs"
            lineHeight="xs"
            fontWeight={fontWeight.medium}
            color="popover"
          >
            {action.label}
          </Text>
        </View>
      )}
    </ToastFrame>
  )
}
