import type { PaymentStatus } from "@payky/core/modules/payment/payment-types"
import {
  AlertTriangleIcon,
  CheckIcon,
  ClockIcon,
  RotateCwIcon,
  XIcon,
} from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils.ts"

/**
 * How a `PaymentStatus` renders, shared by the payment detail page, the bill
 * detail page's payments list, and the activity list.
 *
 * Two maps, not one, because a badge and an icon disagree on purpose about
 * `canceled`: the text badge omits it entirely (`null`), while the icon still
 * has to draw something, so it draws a destructive X.
 */
export const paymentStatusBadgeClassName = {
  canceled: null,
  paid: "bg-success/10 text-success",
  expired: "bg-muted text-muted-foreground",
  pending: "bg-muted text-muted-foreground",
} satisfies Record<PaymentStatus, string | null>

const paymentStatusIconData = {
  canceled: ["bg-destructive/10 text-destructive", <XIcon key="canceled" />],
  paid: ["bg-success/10 text-success", <CheckIcon key="paid" />],
  expired: ["bg-muted text-muted-foreground", <ClockIcon key="expired" />],
  pending: ["bg-muted text-muted-foreground", <RotateCwIcon key="pending" />],
} satisfies Record<PaymentStatus, readonly [string, ReactNode]>

/**
 * A payment's status as a filled circle. `hasCancellationCollision` overrides
 * the status entirely with a warning triangle: a payment individually caught
 * in the canceled+claimed collision from docs/bill-payment-states.md is
 * flagged the same way wherever it appears, regardless of its bill's own
 * collision status.
 */
export function PaymentStatusIcon({
  status,
  hasCancellationCollision,
}: {
  readonly status: PaymentStatus
  readonly hasCancellationCollision: boolean
}) {
  const [className, icon] = hasCancellationCollision
    ? ["bg-warning/10 text-warning", <AlertTriangleIcon key="collision" />]
    : paymentStatusIconData[status]

  return (
    <div
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full",
        className
      )}
    >
      {icon}
    </div>
  )
}
