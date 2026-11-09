import { formatDateTime, formatTime } from "@payky/app-shared/format-date"
import { toServeOrderMoney } from "@payky/app-shared/menu-order-announcement"
import {
  acceptMenuOrder,
  loadMenuOrdersNotFoundYet,
  loadMenuOrdersServedToday,
  loadMenuOrdersToReturn,
  loadMenuOrdersToServe,
  type MenuOrderNotFoundYet,
  type MenuOrderToReturn,
  type MenuOrderToServe,
  markMenuOrderServed,
  type RejectedMenuOrderRefund,
  rejectMenuOrder,
} from "@payky/core/modules/menu-order/menu-order-actions"
import { evoluHistoryMaxRowidQuery } from "@payky/core/modules/shared/evolu-history-queries"
import type { Money } from "@payky/core/modules/shared/money"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { router } from "expo-router"
import { type ReactNode, Suspense } from "react"
import { Text, XStack, YStack } from "tamagui"
import { FadeHeader } from "../../components/fade-header.tsx"
import { ListSkeleton } from "../../components/list-skeleton.tsx"
import { Screen } from "../../components/screen.tsx"
import { Badge } from "../../components/ui/badge.tsx"
import { Button } from "../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/ui/card.tsx"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs.tsx"
import { useRequirePermission } from "../../core/use-access.ts"
import { useAppRun } from "../../hooks/use-app-run.ts"
import { useConfirm } from "../../hooks/use-confirm.ts"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useRunToast } from "../../hooks/use-run-toast.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney } from "../../lib/format-money.ts"
import { fontSize, fontWeight } from "../../theme/tokens.ts"

/** Paid orders waiting to be served, as web's `OrdersToServePage`. */
export function OrdersToServePage() {
  const { t } = useTranslation()

  return (
    <Screen>
      <FadeHeader title={t("orders.title")} />
      <Tabs defaultValue="toServe">
        <TabsList>
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
    </Screen>
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
    <Text
      py="6"
      text="center"
      fontSize={fontSize.sm}
      lineHeight={fontSize.sm}
      color="muted-foreground"
    >
      {t("orders.served.empty")}
    </Text>
  ) : (
    <YStack gap={12}>
      {served.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </YStack>
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
      const [orders, notFoundYet, toReturn] = await Promise.all([
        run.ok(loadMenuOrdersToServe()),
        run.ok(loadMenuOrdersNotFoundYet()),
        run.ok(loadMenuOrdersToReturn()),
      ])
      return { orders, notFoundYet, toReturn }
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
  const paidAfterRejection = toServe.notFoundYet.flatMap(
    ({ rejectedOrderNumber, ...money }) =>
      rejectedOrderNumber === null ? [] : [{ ...money, rejectedOrderNumber }]
  )

  return (
    <YStack gap={16}>
      {toServe.orders.length === 0 ? (
        <Text
          py="6"
          text="center"
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          color="muted-foreground"
        >
          {t("orders.empty")}
        </Text>
      ) : (
        <YStack gap={12}>
          {toServe.orders.map((order) => (
            <OrderToServe key={order.id} order={order} />
          ))}
        </YStack>
      )}
      {notFoundYet.length > 0 && (
        <UnmatchedOrderMoney
          title={t("orders.notFoundYet.title")}
          description={t("orders.notFoundYet.description")}
          entries={notFoundYet}
        />
      )}
      {(toServe.toReturn.length > 0 || paidAfterRejection.length > 0) && (
        <MoneyToReturn
          toReturn={toServe.toReturn}
          paidAfterRejection={paidAfterRejection}
        />
      )}
    </YStack>
  )
}

function OrderToServe({ order }: { readonly order: MenuOrderToServe }) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const confirm = useConfirm()
  const { require } = useRequirePermission()
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
      router.push(refundDestination(await run.ok(rejectMenuOrder(order))))
    })
  }

  return (
    <OrderCard order={order}>
      <CardFooter flexDirection="column" gap={8}>
        <Button
          self="stretch"
          label={nextStep.label}
          onPress={() => {
            void runToast(async (run) => {
              await run.ok(nextStep.task)
            })
          }}
        />
        <Button
          self="stretch"
          variant="ghost"
          labelColor="destructive"
          label={t("orders.reject")}
          onPress={() => {
            void reject()
          }}
        />
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
    <YStack testID={order.isServed ? "served-order" : "order-to-serve"}>
      <Card>
        <CardHeader>
          <CardTitle>
            <Text
              fontSize="4xl"
              lineHeight="4xl"
              fontWeight={fontWeight.semibold}
              fontVariant={["tabular-nums"]}
            >
              {t("orders.number", { number: order.number })}
            </Text>
            <Text fontSize={fontSize.lg} lineHeight={fontSize.lg}>
              {` ${order.tableName ?? t("orders.noTable")}`}
            </Text>
          </CardTitle>
          <CardDescription>
            {`${formatTime(new Date(order.createdAt), locale)} · ${toServeOrderMoney(
              order,
              t,
              (money) => formatMoney(money, locale)
            )}`}
          </CardDescription>
          <XStack gap={4} flexWrap="wrap">
            {order.isFullyPaid ? (
              <Badge variant="secondary" label={t("orders.paid")} />
            ) : (
              <Badge variant="destructive" label={t("orders.notFullyPaid")} />
            )}
            {!order.isAccepted && !order.isServed && (
              <Badge label={t("orders.waiting.badge")} />
            )}
            {order.isAccepted && !order.isServed && (
              <Badge variant="outline" label={t("orders.preparing")} />
            )}
          </XStack>
        </CardHeader>
        <CardContent gap={12}>
          <YStack gap={4}>
            {order.lines.map((line) => (
              <XStack key={line.id} items="center" gap={8}>
                <Text
                  shrink={1}
                  fontSize={fontSize.lg}
                  lineHeight={fontSize.lg}
                  fontWeight={fontWeight.medium}
                >
                  {t("orders.line", {
                    name: line.name,
                    quantity: line.quantity,
                  })}
                </Text>
                {line.isSoldOut && (
                  <Badge variant="destructive" label={t("orders.soldOut")} />
                )}
              </XStack>
            ))}
          </YStack>
          {order.note !== null && (
            <Text fontSize={fontSize.sm} lineHeight={fontSize.sm}>
              {t("orders.note", { note: order.note })}
            </Text>
          )}
        </CardContent>
        {children}
      </Card>
    </YStack>
  )
}

const refundDestination = (refund: RejectedMenuOrderRefund) =>
  refund.type === "payment"
    ? {
        pathname: "/activity/[paymentId]" as const,
        params: { paymentId: refund.paymentId },
      }
    : {
        pathname: "/activity/bills/[billId]" as const,
        params: { billId: refund.billId },
      }

function MoneyToReturn({
  toReturn,
  paidAfterRejection,
}: {
  readonly toReturn: ReadonlyArray<MenuOrderToReturn>
  readonly paidAfterRejection: ReadonlyArray<
    MenuOrderNotFoundYet & { readonly rejectedOrderNumber: number }
  >
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const entry = (number: number, amount: Money) =>
    t("orders.toReturn.entry", {
      number,
      amount: formatMoney(amount, locale),
    })

  return (
    <YStack testID="money-to-return">
      <Card>
        <CardHeader>
          <CardTitle>{t("orders.toReturn.title")}</CardTitle>
        </CardHeader>
        <CardContent gap={12}>
          {toReturn.map((order) => (
            <XStack
              key={order.id}
              items="center"
              justify="space-between"
              gap={12}
            >
              <Text
                shrink={1}
                fontSize={fontSize.sm}
                lineHeight={fontSize.sm}
                fontWeight={fontWeight.medium}
                fontVariant={["tabular-nums"]}
              >
                {entry(order.number, order.amount)}
              </Text>
              <Button
                size="sm"
                variant="outline"
                label={t("orders.toReturn.record")}
                onPress={() => router.push(refundDestination(order.refund))}
              />
            </XStack>
          ))}
          {paidAfterRejection.length > 0 && (
            <Text
              fontSize={fontSize.sm}
              lineHeight={fontSize.sm}
              color="muted-foreground"
            >
              {t("orders.paidAfterRejection.description")}
            </Text>
          )}
          {paidAfterRejection.map((money) => (
            <XStack key={money.id} justify="space-between" gap={12}>
              <Text
                shrink={1}
                fontSize={fontSize.sm}
                lineHeight={fontSize.sm}
                fontWeight={fontWeight.medium}
                fontVariant={["tabular-nums"]}
              >
                {entry(money.rejectedOrderNumber, {
                  value: money.amount,
                  currency: money.currency,
                })}
              </Text>
              <Text
                fontSize={fontSize.sm}
                lineHeight={fontSize.sm}
                color="muted-foreground"
              >
                {formatDateTime(new Date(money.occurredAt), locale)}
              </Text>
            </XStack>
          ))}
        </CardContent>
      </Card>
    </YStack>
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
  const locale = useLocale()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent gap={8}>
        {entries.map((entry) => {
          const amount = formatMoney(
            { value: entry.amount, currency: entry.currency },
            locale
          )
          return (
            <XStack key={entry.id} justify="space-between" gap={12}>
              <Text
                fontSize={fontSize.sm}
                lineHeight={fontSize.sm}
                fontWeight={fontWeight.medium}
                fontVariant={["tabular-nums"]}
              >
                {amount}
              </Text>
              <Text
                fontSize={fontSize.sm}
                lineHeight={fontSize.sm}
                color="muted-foreground"
              >
                {formatDateTime(new Date(entry.occurredAt), locale)}
              </Text>
            </XStack>
          )
        })}
      </CardContent>
    </Card>
  )
}
