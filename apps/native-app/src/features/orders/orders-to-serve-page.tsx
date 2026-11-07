import { formatDateTime, formatTime } from "@payky/app-shared/format-date"
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
import { router } from "expo-router"
import { Suspense } from "react"
import { Text, XStack, YStack } from "tamagui"
import { FadeHeader } from "../../components/fade-header.tsx"
import { ListSkeleton } from "../../components/list-skeleton.tsx"
import { Screen } from "../../components/screen.tsx"
import { Badge } from "../../components/ui/badge.tsx"
import { Button } from "../../components/ui/button.tsx"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/ui/card.tsx"
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
      <Suspense fallback={<ListSkeleton />}>
        <OrdersToServe />
      </Suspense>
    </Screen>
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
      {toServe.notFoundYet.length > 0 && (
        <NotFoundYet entries={toServe.notFoundYet} />
      )}
    </YStack>
  )
}

function OrderToServe({ order }: { readonly order: MenuOrderToServe }) {
  const { t } = useTranslation()
  const locale = useLocale()
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
    await runToast(async (run) => {
      const refund = await run.ok(rejectMenuOrder(order))
      router.push(
        refund.type === "payment"
          ? {
              pathname: "/activity/[paymentId]",
              params: { paymentId: refund.paymentId },
            }
          : {
              pathname: "/activity/bills/[billId]",
              params: { billId: refund.billId },
            }
      )
    })
  }

  return (
    <YStack testID="order-to-serve">
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
            {formatTime(new Date(order.createdAt), locale)}
          </CardDescription>
          <CardAction gap={4} items="flex-end">
            {order.isFullyPaid ? (
              <Badge variant="secondary" label={t("orders.paid")} />
            ) : (
              <Badge variant="destructive" label={t("orders.notFullyPaid")} />
            )}
            {order.isAccepted && <Badge label={t("orders.preparing")} />}
          </CardAction>
        </CardHeader>
        <CardContent gap={12}>
          {order.written !== null ? (
            <WrittenOrder written={order.written} />
          ) : (
            <YStack gap={4}>
              {order.lines.map((line) => (
                <XStack key={line.id} items="center" gap={8}>
                  <Text
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
          )}
          {order.note !== null && (
            <Text fontSize={fontSize.sm} lineHeight={fontSize.sm}>
              {t("orders.note", { note: order.note })}
            </Text>
          )}
        </CardContent>
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
      </Card>
    </YStack>
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
      <Text
        fontSize={fontSize.lg}
        lineHeight={fontSize.lg}
        fontWeight={fontWeight.medium}
      >
        {t("orders.written", { text: written.text })}
      </Text>
      <Text
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
        fontVariant={["tabular-nums"]}
      >
        {writtenOrderAmount(written, t, (money) => formatMoney(money, locale))}
      </Text>
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
      <CardContent gap={8}>
        {entries.map((entry) => (
          <XStack key={entry.id} justify="space-between" gap={12}>
            <Text
              fontSize={fontSize.sm}
              lineHeight={fontSize.sm}
              fontWeight={fontWeight.medium}
              fontVariant={["tabular-nums"]}
            >
              {formatMoney(
                { value: entry.amount, currency: entry.currency },
                locale
              )}
            </Text>
            <Text
              fontSize={fontSize.sm}
              lineHeight={fontSize.sm}
              color="muted-foreground"
            >
              {formatDateTime(new Date(entry.occurredAt), locale)}
            </Text>
          </XStack>
        ))}
      </CardContent>
    </Card>
  )
}
