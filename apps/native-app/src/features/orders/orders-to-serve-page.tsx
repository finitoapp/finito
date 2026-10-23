import { formatDateTime, formatTime } from "@payky/app-shared/format-date"
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
import { useAppRun } from "../../hooks/use-app-run.ts"
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
          <CardAction>
            {order.isFullyPaid ? (
              <Badge variant="secondary" label={t("orders.paid")} />
            ) : (
              <Badge variant="destructive" label={t("orders.notFullyPaid")} />
            )}
          </CardAction>
        </CardHeader>
        <CardContent gap={12}>
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
          {order.note !== null && (
            <Text fontSize={fontSize.sm} lineHeight={fontSize.sm}>
              {t("orders.note", { note: order.note })}
            </Text>
          )}
        </CardContent>
        <CardFooter>
          <Button
            flex={1}
            label={t("orders.served")}
            onPress={() => {
              void runToast(async (run) => {
                await run.ok(markMenuOrderServed(order.id))
              })
            }}
          />
        </CardFooter>
      </Card>
    </YStack>
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
