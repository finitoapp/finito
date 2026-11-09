import { useNow } from "@payky/app-shared/use-now"
import type { SelfPayOrderConfirmation } from "@payky/core/modules/menu-order/menu-order-utils"
import { TimestampMs } from "@payky/core/modules/shared/schema"
import {
  CircleCheckIcon,
  CircleXIcon,
  ClockIcon,
  CookingPotIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { type Ref, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button.tsx"
import { cn } from "@/lib/utils.ts"
import { formatGuestAmount, formatGuestTime } from "./guest-format.ts"
import type { GuestOrder } from "./guest-orders.ts"
import { useGuestStatus } from "./guest-status.tsx"
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

const guestOrderStep = (
  confirmation: SelfPayOrderConfirmation
): GuestOrderStep =>
  confirmation.served !== undefined
    ? "served"
    : confirmation.accepted !== undefined
      ? "preparing"
      : "paid"

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
  const keys = guestOrderStatusKeys[guestOrderStep(confirmation)]
  const left = guestOrderLeft(shown)
  return left > 0
    ? t(keys.owing, {
        number,
        amount: formatGuestAmount(left, order, locale),
      })
    : t(keys.paid, { number })
}

type GuestOrderTone = GuestOrderStep | "rejected" | "waiting" | "attention"

const guestOrderTones = {
  rejected: {
    card: "bg-destructive/10 ring-1 ring-destructive/40",
    Icon: CircleXIcon,
    icon: "text-destructive",
    title: "text-destructive",
  },
  paid: {
    card: "bg-muted",
    Icon: ClockIcon,
    icon: "text-muted-foreground",
    title: "",
  },
  preparing: {
    card: "bg-muted",
    Icon: CookingPotIcon,
    icon: "text-muted-foreground",
    title: "",
  },
  served: {
    card: "bg-primary/10",
    Icon: CircleCheckIcon,
    icon: "text-primary",
    title: "",
  },
  waiting: {
    card: "bg-amber-500/10",
    Icon: ClockIcon,
    icon: "text-muted-foreground",
    title: "",
  },
  attention: {
    card: "bg-amber-500/10",
    Icon: TriangleAlertIcon,
    icon: "text-amber-600",
    title: "",
  },
} satisfies Record<
  GuestOrderTone,
  {
    readonly card: string
    readonly Icon: typeof CircleCheckIcon
    readonly icon: string
    readonly title: string
  }
>

function GuestOrderCard({
  shown,
  canAct,
  onPayRest,
  onForget,
}: {
  readonly shown: ShownGuestOrder
  readonly canAct: boolean
  readonly onPayRest: (shown: ShownGuestOrder) => void
  readonly onForget: (shown: ShownGuestOrder) => void
}) {
  const { t, locale } = useGuestTranslation()
  const announce = useGuestStatus()
  const { order, confirmation } = shown
  const status = guestOrderStatus(shown, t, locale)
  const step =
    confirmation === null
      ? null
      : confirmation.rejected !== undefined
        ? "rejected"
        : guestOrderStep(confirmation)
  const shownStep = useRef(step)
  useEffect(() => {
    if (step === shownStep.current) return
    if (shownStep.current !== null) announce(status)
    shownStep.current = step
  }, [announce, status, step])
  const waitEndsAt = paymentWaitEndsAt(order.startedAt)
  const now = useNow([TimestampMs(waitEndsAt)])
  const left = guestOrderLeft(shown)
  const isWaitOver = confirmation === null && now.getTime() >= waitEndsAt
  const tone: GuestOrderTone =
    confirmation?.rejected !== undefined
      ? "rejected"
      : confirmation !== null && left <= 0
        ? guestOrderStep(confirmation)
        : confirmation === null && !isWaitOver
          ? "waiting"
          : "attention"
  const { card, Icon, icon, title } = guestOrderTones[tone]
  const payLabel = !canAct
    ? null
    : confirmation === null
      ? t("selfPay.pay.total", {
          amount: formatGuestAmount(order.total, order, locale),
        })
      : left > 0
        ? t("selfPay.order.payRest", {
            amount: formatGuestAmount(left, order, locale),
          })
        : null
  const forgetLabel = !canAct
    ? null
    : confirmation === null
      ? t("selfPay.order.remove")
      : confirmation.served !== undefined && left <= 0
        ? t("selfPay.order.hide")
        : null

  return (
    <li className={cn("flex items-start gap-2 rounded-xl p-3 text-sm", card)}>
      <Icon aria-hidden="true" className={cn("size-5 shrink-0", icon)} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className={cn("font-semibold", title)}>
          {isWaitOver ? t("selfPay.order.unseen") : status}
        </p>
        <p className="text-muted-foreground">
          {confirmation === null
            ? t("selfPay.order.items", {
                summary: order.summary,
                total: formatGuestAmount(order.total, order, locale),
              })
            : t("selfPay.order.items.paid", {
                summary: order.summary,
                amount: formatGuestAmount(confirmation.covered, order, locale),
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
          </>
        ) : confirmation === null && canAct ? (
          <p>{t("selfPay.order.waiting.description")}</p>
        ) : null}
        {payLabel === null && forgetLabel === null ? null : (
          <div className="mt-2 flex flex-wrap gap-2">
            {payLabel === null ? null : (
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => {
                  onPayRest(shown)
                }}
              >
                {payLabel}
              </Button>
            )}
            {forgetLabel === null ? null : (
              <Button
                type="button"
                variant="ghost"
                className="h-11"
                onClick={() => {
                  onForget(shown)
                }}
              >
                {forgetLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

export function GuestOrderList({
  ref,
  orders,
  canAct,
  onPayRest,
  onForget,
}: {
  readonly ref: Ref<HTMLElement>
  readonly orders: ReadonlyArray<ShownGuestOrder>
  readonly canAct: (shown: ShownGuestOrder) => boolean
  readonly onPayRest: (shown: ShownGuestOrder) => void
  readonly onForget: (shown: ShownGuestOrder) => void
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
            canAct={canAct(shown)}
            onPayRest={onPayRest}
            onForget={onForget}
          />
        ))}
      </ul>
    </section>
  )
}
