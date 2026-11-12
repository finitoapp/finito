import type { PaymentStatus } from "@payky/core/modules/payment/payment-types"
import type { LucideIcon } from "lucide-react-native"
import Check from "lucide-react-native/icons/check"
import Clock from "lucide-react-native/icons/clock"
import RotateCw from "lucide-react-native/icons/rotate-cw"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import X from "lucide-react-native/icons/x"
import { View } from "tamagui"
import { Badge } from "../../components/ui/badge.tsx"
import { Icon } from "../../components/ui/icon.tsx"
import type { ThemeColor } from "../../theme/themes.ts"
import { radius } from "../../theme/tokens.ts"

type Tone = {
  readonly bg: "destructive-10" | "success-10" | "neutral-soft" | "warning-10"
  readonly color: "destructive" | "success" | "muted-foreground" | "warning"
  readonly icon: LucideIcon
}

const statusIcons = {
  canceled: { bg: "destructive-10", color: "destructive", icon: X },
  paid: { bg: "success-10", color: "success", icon: Check },
  expired: { bg: "neutral-soft", color: "muted-foreground", icon: Clock },
  pending: { bg: "warning-10", color: "warning", icon: RotateCw },
} as const satisfies Record<PaymentStatus, Tone>

const collisionIcon = {
  bg: "warning-10",
  color: "warning",
  icon: TriangleAlert,
} as const satisfies Tone

/**
 * Web's `PaymentStatusIcon` (`payment-status-display.tsx`): a payment's
 * status as a filled 32 circle; a cancellation collision overrides it with
 * a warning triangle wherever the payment appears.
 */
export function PaymentStatusIcon({
  status,
  hasCancellationCollision,
}: {
  readonly status: PaymentStatus
  readonly hasCancellationCollision: boolean
}) {
  const tone: Tone = hasCancellationCollision
    ? collisionIcon
    : statusIcons[status]
  return (
    <View
      w={32}
      h={32}
      shrink={0}
      rounded={radius.full}
      bg={tone.bg}
      items="center"
      justify="center"
    >
      <Icon icon={tone.icon} color={tone.color} />
    </View>
  )
}

/**
 * Web's status badge (`paymentStatusBadgeClassName`): a secondary badge
 * tinted by status; a canceled payment gets the plain destructive badge.
 */
const paymentBadgeTints = {
  canceled: null,
  paid: { bg: "success-10", color: "success" },
  expired: { bg: "neutral-soft", color: "muted-foreground" },
  pending: { bg: "warning-10", color: "warning" },
} as const satisfies Record<
  PaymentStatus,
  { readonly bg: ThemeColor; readonly color: ThemeColor } | null
>

export function PaymentStatusBadge({
  status,
  label,
}: {
  readonly status: PaymentStatus
  /** Already translated. */
  readonly label: string
}) {
  const tint = paymentBadgeTints[status]
  return tint === null ? (
    <Badge variant="destructive" label={label} />
  ) : (
    <Badge
      variant="secondary"
      bg={tint.bg}
      labelColor={tint.color}
      label={label}
    />
  )
}
