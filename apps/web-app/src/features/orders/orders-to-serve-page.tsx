import { writtenOrderAmount } from "@payky/app-shared/menu-order-announcement"
import {
  acceptMenuOrder,
  loadMenuOrdersNotFoundYet,
  loadMenuOrdersToServe,
  type MenuOrderNotFoundYet,
  type MenuOrderToServe,
  markMenuOrderServed,
  rejectMenuOrder,
} from "@payky/core/modules/menu-order/menu-order-actions"
import { evoluHistoryMaxRowidQuery } from "@payky/core/modules/shared/evolu-history-queries"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Suspense } from "react"
import { FadeHeader } from "@/components/fade-header.tsx"
import { ListSkeleton } from "@/components/list-skeleton.tsx"
import { Badge } from "@/components/ui/badge.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import { useRequirePermission } from "@/hooks/use-access.ts"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useLocale } from "@/hooks/use-locale.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatDateTime, formatMoney, formatTime } from "@/lib/format-utils.ts"

export function OrdersToServePage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-2">
      <div className="h-6" />
      <FadeHeader title={t("orders.title")} />
      <Suspense fallback={<ListSkeleton />}>
        <OrdersToServe />
      </Suspense>
    </div>
  )
}

function useOrdersToServe() {
  const appRun = useAppRun()
  const {
    data: [history],
  } = useEvoluQuery(evoluHistoryMaxRowidQuery)
  const { data } = useQuery({
    queryKey: ["ordersToServe", history?.maxRowid ?? null],
    queryFn: async () => {
      await using run = appRun()
      const [orders, notFoundYet] = await Promise.all([
        run.ok(loadMenuOrdersToServe()),
        run.ok(loadMenuOrdersNotFoundYet()),
      ])
      return { orders, notFoundYet }
    },
    placeholderData: keepPreviousData,
  })
  return data
}

function OrdersToServe() {
  const { t } = useTranslation()
  const toServe = useOrdersToServe()

  if (toServe === undefined) return <ListSkeleton />

  return (
    <div className="flex flex-col gap-4">
      {toServe.orders.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("orders.empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {toServe.orders.map((order) => (
            <OrderToServe key={order.id} order={order} />
          ))}
        </ul>
      )}
      {toServe.notFoundYet.length > 0 && (
        <NotFoundYet entries={toServe.notFoundYet} />
      )}
    </div>
  )
}

function OrderToServe({ order }: { readonly order: MenuOrderToServe }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const runToast = useRunToast()
  const confirm = useConfirmDialog()
  const { require } = useRequirePermission()
  const navigate = useNavigate()
  const nextStep = order.isAccepted
    ? { label: t("orders.served"), task: markMenuOrderServed(order.id) }
    : { label: t("orders.accept"), task: acceptMenuOrder(order.id) }

  const reject = async () => {
    const confirmed = await confirm({
      title: t("orders.reject.title", { number: order.number }),
      description: t("orders.reject.description"),
      confirmLabel: t("orders.reject.confirm"),
      cancelLabel: t("orders.reject.cancel"),
      variant: "destructive",
    })
    if (!confirmed) return
    if (!(await require("refund", "access.action.rejectOrder"))) return
    await runToast(async (run) => {
      const refund = await run.ok(rejectMenuOrder(order))
      void navigate(
        refund.type === "payment"
          ? {
              to: "/activity/$paymentId",
              params: { paymentId: refund.paymentId },
            }
          : { to: "/activity/bills/$billId", params: { billId: refund.billId } }
      )
    })
  }

  return (
    <li>
      <Card data-testid="order-to-serve">
        <CardHeader>
          <CardTitle className="flex items-baseline gap-3">
            <span className="text-4xl font-semibold tabular-nums">
              {t("orders.number", { number: order.number })}
            </span>
            <span className="text-lg">
              {order.tableName ?? t("orders.noTable")}
            </span>
          </CardTitle>
          <CardDescription>
            {formatTime(new Date(order.createdAt), locale)}
          </CardDescription>
          <CardAction className="flex flex-col items-end gap-1">
            {order.isFullyPaid ? (
              <Badge variant="secondary">{t("orders.paid")}</Badge>
            ) : (
              <Badge variant="destructive">{t("orders.notFullyPaid")}</Badge>
            )}
            {order.isAccepted && <Badge>{t("orders.preparing")}</Badge>}
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {order.written !== null ? (
            <WrittenOrder written={order.written} />
          ) : (
            <ul className="flex flex-col gap-1">
              {order.lines.map((line) => (
                <li key={line.id} className="flex items-center gap-2">
                  <span className="text-lg font-medium">
                    {t("orders.line", {
                      name: line.name,
                      quantity: line.quantity,
                    })}
                  </span>
                  {line.isSoldOut && (
                    <Badge variant="destructive">{t("orders.soldOut")}</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
          {order.note !== null && (
            <p className="text-sm">{t("orders.note", { note: order.note })}</p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button
            className="w-full"
            onClick={() => {
              void runToast(async (run) => {
                await run.ok(nextStep.task)
              })
            }}
          >
            {nextStep.label}
          </Button>
          <Button
            variant="ghost"
            className="w-full text-destructive"
            onClick={() => {
              void reject()
            }}
          >
            {t("orders.reject")}
          </Button>
        </CardFooter>
      </Card>
    </li>
  )
}

function WrittenOrder({
  written,
}: {
  readonly written: NonNullable<MenuOrderToServe["written"]>
}) {
  const { t } = useTranslation()
  const locale = useLocale()

  return (
    <>
      <p className="text-lg font-medium wrap-anywhere">
        {t("orders.written", { text: written.text })}
      </p>
      <p className="text-sm tabular-nums">
        {writtenOrderAmount(written, t, (money) => formatMoney(money, locale))}
      </p>
    </>
  )
}

function NotFoundYet({
  entries,
}: {
  readonly entries: ReadonlyArray<MenuOrderNotFoundYet>
}) {
  const { t } = useTranslation()
  const locale = useLocale()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("orders.notFoundYet.title")}</CardTitle>
        <CardDescription>{t("orders.notFoundYet.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li key={entry.id} className="flex justify-between gap-3 text-sm">
              <span className="font-medium tabular-nums">
                {formatMoney(
                  { value: entry.amount, currency: entry.currency },
                  locale
                )}
              </span>
              <span className="text-muted-foreground">
                {formatDateTime(new Date(entry.occurredAt), locale)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
