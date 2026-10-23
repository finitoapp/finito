import {
  loadMenuOrdersNotFoundYet,
  loadMenuOrdersToServe,
  type MenuOrderNotFoundYet,
  type MenuOrderToServe,
  markMenuOrderServed,
} from "@payky/core/modules/menu-order/menu-order-actions"
import { evoluHistoryMaxRowidQuery } from "@payky/core/modules/shared/evolu-history-queries"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
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
import { useAppRun } from "@/hooks/use-app-run.ts"
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
          <CardAction>
            {order.isFullyPaid ? (
              <Badge variant="secondary">{t("orders.paid")}</Badge>
            ) : (
              <Badge variant="destructive">{t("orders.notFullyPaid")}</Badge>
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
        <CardFooter>
          <Button
            className="w-full"
            onClick={() => {
              void runToast(async (run) => {
                await run.ok(markMenuOrderServed(order.id))
              })
            }}
          >
            {t("orders.served")}
          </Button>
        </CardFooter>
      </Card>
    </li>
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
