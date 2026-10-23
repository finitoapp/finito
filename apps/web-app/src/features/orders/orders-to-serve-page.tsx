import {
  acceptMenuOrder,
  loadMenuOrdersNotFoundYet,
  loadMenuOrdersServedToday,
  loadMenuOrdersToServe,
  type MenuOrderNotFoundYet,
  type MenuOrderToServe,
  markMenuOrderServed,
  rejectMenuOrder,
} from "@payky/core/modules/menu-order/menu-order-actions"
import { evoluHistoryMaxRowidQuery } from "@payky/core/modules/shared/evolu-history-queries"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { type ReactNode, Suspense } from "react"
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs.tsx"
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
      <Tabs defaultValue="toServe" className="gap-4">
        <TabsList className="w-full">
          <TabsTrigger value="toServe">{t("orders.tabs.toServe")}</TabsTrigger>
          <TabsTrigger value="served">{t("orders.tabs.served")}</TabsTrigger>
        </TabsList>
        <TabsContent value="toServe">
          <Suspense fallback={<ListSkeleton />}>
            <OrdersToServe />
          </Suspense>
        </TabsContent>
        <TabsContent value="served">
          <Suspense fallback={<ListSkeleton />}>
            <OrdersServedToday />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function useOrdersServedToday() {
  const appRun = useAppRun()
  const {
    data: [history],
  } = useEvoluQuery(evoluHistoryMaxRowidQuery)
  const { data } = useQuery({
    queryKey: ["ordersServedToday", history?.maxRowid ?? null],
    queryFn: async () => {
      await using run = appRun()
      return await run.ok(loadMenuOrdersServedToday())
    },
    placeholderData: keepPreviousData,
  })
  return data
}

function OrdersServedToday() {
  const { t } = useTranslation()
  const served = useOrdersServedToday()

  if (served === undefined) return <ListSkeleton />

  return served.length === 0 ? (
    <p className="py-6 text-center text-sm text-muted-foreground">
      {t("orders.served.empty")}
    </p>
  ) : (
    <ul className="flex flex-col gap-3">
      {served.map((order) => (
        <li key={order.id}>
          <OrderCard order={order} />
        </li>
      ))}
    </ul>
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

  const notFoundYet = toServe.notFoundYet.filter(
    ({ rejectedOrderNumber }) => rejectedOrderNumber === null
  )
  const paidAfterRejection = toServe.notFoundYet.filter(
    ({ rejectedOrderNumber }) => rejectedOrderNumber !== null
  )

  return (
    <div className="flex flex-col gap-4">
      {toServe.orders.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("orders.empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {toServe.orders.map((order) => (
            <li key={order.id}>
              <OrderToServe order={order} />
            </li>
          ))}
        </ul>
      )}
      {notFoundYet.length > 0 && (
        <UnmatchedOrderMoney
          title={t("orders.notFoundYet.title")}
          description={t("orders.notFoundYet.description")}
          entries={notFoundYet}
        />
      )}
      {paidAfterRejection.length > 0 && (
        <UnmatchedOrderMoney
          title={t("orders.paidAfterRejection.title")}
          description={t("orders.paidAfterRejection.description")}
          entries={paidAfterRejection}
        />
      )}
    </div>
  )
}

function OrderToServe({ order }: { readonly order: MenuOrderToServe }) {
  const { t } = useTranslation()
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
    if (
      !order.isFullyPaid &&
      !(await require("discard", "access.action.discardBill"))
    ) {
      return
    }
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
    <OrderCard order={order}>
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
    </OrderCard>
  )
}

function OrderCard({
  order,
  children,
}: {
  readonly order: MenuOrderToServe
  readonly children?: ReactNode
}) {
  const { t } = useTranslation()
  const locale = useLocale()

  return (
    <Card data-testid={order.isServed ? "served-order" : "order-to-serve"}>
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
          {order.isAccepted && !order.isServed && (
            <Badge>{t("orders.preparing")}</Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
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
        {order.note !== null && (
          <p className="text-sm">{t("orders.note", { note: order.note })}</p>
        )}
      </CardContent>
      {children}
    </Card>
  )
}

function UnmatchedOrderMoney({
  title,
  description,
  entries,
}: {
  readonly title: string
  readonly description: string
  readonly entries: ReadonlyArray<MenuOrderNotFoundYet>
}) {
  const { t } = useTranslation()
  const locale = useLocale()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => {
            const amount = formatMoney(
              { value: entry.amount, currency: entry.currency },
              locale
            )
            return (
              <li key={entry.id} className="flex justify-between gap-3 text-sm">
                <span className="font-medium tabular-nums">
                  {entry.rejectedOrderNumber === null
                    ? amount
                    : t("orders.paidAfterRejection.entry", {
                        number: entry.rejectedOrderNumber,
                        amount,
                      })}
                </span>
                <span className="text-muted-foreground">
                  {formatDateTime(new Date(entry.occurredAt), locale)}
                </span>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
