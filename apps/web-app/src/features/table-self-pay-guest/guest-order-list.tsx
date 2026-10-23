import { useNow } from "@payky/app-shared/use-now"
import type { SelfPayOrderConfirmation } from "@payky/core/modules/menu-order/menu-order-utils"
import { TimestampMs } from "@payky/core/modules/shared/schema"
import {
  CircleCheckIcon,
  LoaderCircleIcon,
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
  confirmation === null ? 0 : confirmation.total - confirmation.covered

export const guestOrderStatus = (
  shown: ShownGuestOrder,
  t: GuestTranslate,
  locale: string
): string => {
  const { order, confirmation } = shown
  if (confirmation === null) return t("selfPay.order.waiting")
  const left = guestOrderLeft(shown)
  return left > 0
    ? t("selfPay.order.left", {
        number: confirmation.number,
        amount: formatGuestAmount(left, order, locale),
      })
    : t("selfPay.order.paid", { number: confirmation.number })
}

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
  const isPaid = confirmation !== null && left <= 0

  return (
    <li
      className={cn(
        "flex items-start gap-2 rounded-xl p-3 text-sm",
        isPaid ? "bg-primary/10" : "bg-amber-500/10"
      )}
    >
      {isPaid ? (
        <CircleCheckIcon
          aria-hidden="true"
          className="size-5 shrink-0 text-primary"
        />
      ) : confirmation === null && !isWaitOver ? (
        <LoaderCircleIcon
          aria-hidden="true"
          className="size-5 shrink-0 animate-spin text-muted-foreground"
        />
      ) : (
        <TriangleAlertIcon
          aria-hidden="true"
          className="size-5 shrink-0 text-amber-600"
        />
      )}
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
