import { useNow } from "@payky/app-shared/use-now"
import type { SelfPayOrderConfirmation } from "@payky/core/modules/menu-order/menu-order-utils"
import { TimestampMs } from "@payky/core/modules/shared/schema"
import {
  CircleCheckIcon,
  CircleXIcon,
  ClockIcon,
  TriangleAlertIcon,
} from "lucide-react"
import type { Ref } from "react"
import { Button } from "@/components/ui/button.tsx"
import { cn } from "@/lib/utils.ts"
import { formatGuestAmount, formatGuestTime } from "./guest-format.ts"
import type { GuestOrder } from "./guest-orders.ts"
import {
  type GuestTranslate,
  useGuestTranslation,
} from "./use-guest-translation.ts"
import { paymentWaitEndsAt } from "./use-self-pay-view.ts"

export interface ShownGuestOrder {
  readonly order: GuestOrder
  readonly confirmation: SelfPayOrderConfirmation | null
}

export const guestOrderLeft = ({ confirmation }: ShownGuestOrder): number =>
  confirmation === null || confirmation.rejected !== undefined
    ? 0
    : confirmation.total - confirmation.covered

type GuestOrderStep = "paid" | "preparing" | "served"

const guestOrderStatusKeys = {
  paid: { paid: "selfPay.order.paid", owing: "selfPay.order.left" },
  preparing: {
    paid: "selfPay.order.preparing",
    owing: "selfPay.order.preparing.left",
  },
  served: { paid: "selfPay.order.served", owing: "selfPay.order.served.left" },
} satisfies Record<
  GuestOrderStep,
  {
    readonly paid: Parameters<GuestTranslate>[0]
    readonly owing: Parameters<GuestTranslate>[0]
  }
>

export const guestOrderStatus = (
  shown: ShownGuestOrder,
  t: GuestTranslate,
  locale: string
): string => {
  const { order, confirmation } = shown
  if (confirmation === null) return t("selfPay.order.waiting")
  const { number } = confirmation
  if (confirmation.rejected !== undefined)
    return t("selfPay.order.rejected", { number })
  const keys =
    guestOrderStatusKeys[
      confirmation.served !== undefined
        ? "served"
        : confirmation.accepted !== undefined
          ? "preparing"
          : "paid"
    ]
  const left = guestOrderLeft(shown)
  return left > 0
    ? t(keys.owing, {
        number,
        amount: formatGuestAmount(left, order, locale),
      })
    : t(keys.paid, { number })
}

type GuestOrderTone = "rejected" | "paid" | "waiting" | "attention"

const guestOrderTones = {
  rejected: {
    card: "bg-destructive/10",
    Icon: CircleXIcon,
    icon: "text-destructive",
  },
  paid: { card: "bg-primary/10", Icon: CircleCheckIcon, icon: "text-primary" },
  waiting: {
    card: "bg-amber-500/10",
    Icon: ClockIcon,
    icon: "text-muted-foreground",
  },
  attention: {
    card: "bg-amber-500/10",
    Icon: TriangleAlertIcon,
    icon: "text-amber-600",
  },
} satisfies Record<
  GuestOrderTone,
  {
    readonly card: string
    readonly Icon: typeof CircleCheckIcon
    readonly icon: string
  }
>

function GuestOrderCard({
  shown,
  onPayRest,
  onRemove,
}: {
  readonly shown: ShownGuestOrder
  readonly onPayRest: (shown: ShownGuestOrder) => void
  readonly onRemove: (shown: ShownGuestOrder) => void
}) {
  const { t, locale } = useGuestTranslation()
  const { order, confirmation } = shown
  const waitEndsAt = paymentWaitEndsAt(order.startedAt)
  const now = useNow([TimestampMs(waitEndsAt)])
  const left = guestOrderLeft(shown)
  const isWaitOver = confirmation === null && now.getTime() >= waitEndsAt
  const tone: GuestOrderTone =
    confirmation?.rejected !== undefined
      ? "rejected"
      : confirmation !== null && left <= 0
        ? "paid"
        : confirmation === null && !isWaitOver
          ? "waiting"
          : "attention"
  const { card, Icon, icon } = guestOrderTones[tone]

  return (
    <li className={cn("flex items-start gap-2 rounded-xl p-3 text-sm", card)}>
      <Icon aria-hidden="true" className={cn("size-5 shrink-0", icon)} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="font-semibold">
          {isWaitOver
            ? t("selfPay.order.unseen")
            : guestOrderStatus(shown, t, locale)}
        </p>
        <p className="text-muted-foreground">
          {t("selfPay.order.items", {
            summary: order.summary,
            total: formatGuestAmount(order.total, order, locale),
          })}
        </p>
        {isWaitOver ? (
          <>
            <p>{t("selfPay.order.unseen.description")}</p>
            <p className="text-muted-foreground">
              {t("selfPay.waiting.over.startedAt", {
                time: formatGuestTime(
                  Math.floor(order.startedAt / 1000),
                  locale
                ),
              })}
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-2 h-11 self-start"
              onClick={() => {
                onRemove(shown)
              }}
            >
              {t("selfPay.order.remove")}
            </Button>
          </>
        ) : null}
        {left > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="mt-2 h-11 self-start"
            onClick={() => {
              onPayRest(shown)
            }}
          >
            {t("selfPay.order.payRest", {
              amount: formatGuestAmount(left, order, locale),
            })}
          </Button>
        ) : null}
      </div>
    </li>
  )
}

export function GuestOrderList({
  ref,
  orders,
  onPayRest,
  onRemove,
}: {
  readonly ref: Ref<HTMLElement>
  readonly orders: ReadonlyArray<ShownGuestOrder>
  readonly onPayRest: (shown: ShownGuestOrder) => void
  readonly onRemove: (shown: ShownGuestOrder) => void
}) {
  const { t } = useGuestTranslation()
  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-labelledby="guest-orders-title"
      className="flex flex-col gap-2 outline-none"
    >
      <h2 id="guest-orders-title" className="font-semibold">
        {t("selfPay.order.list.title")}
      </h2>
      <ul className="flex flex-col gap-2">
        {orders.toReversed().map((shown) => (
          <GuestOrderCard
            key={shown.order.pointer}
            shown={shown}
            onPayRest={onPayRest}
            onRemove={onRemove}
          />
        ))}
      </ul>
    </section>
  )
}
