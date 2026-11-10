import { formatDateTime, formatTime } from "@payky/app-shared/format-date"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { writtenOrderAmount } from "@payky/app-shared/menu-order-announcement"
import { selfPaySettingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { remembersWrittenItems } from "@payky/core/modules/app-settings/app-settings-utils"
import { legalEntityQuery } from "@payky/core/modules/legal-entity/legal-entity-queries"
import { isVatPayer } from "@payky/core/modules/legal-entity/legal-entity-utils"
import {
  acceptMenuOrder,
  loadMenuOrdersNotFoundYet,
  loadMenuOrdersServedToday,
  loadMenuOrdersToServe,
  type MenuOrderDecidedError,
  type MenuOrderNotFoundYet,
  type MenuOrderToServe,
  markMenuOrderServed,
  rejectMenuOrder,
  setWrittenOrderLineTaxRate,
  type TaxRateNotOfferedError,
  type WrittenOrderLineNotFoundError,
} from "@payky/core/modules/menu-order/menu-order-actions"
import { evoluHistoryMaxRowidQuery } from "@payky/core/modules/shared/evolu-history-queries"
import { taxRatesQuery } from "@payky/core/modules/tax-rate/tax-rate-queries"
import {
  filterSelectableTaxRates,
  formatTaxRateLabel,
} from "@payky/core/modules/tax-rate/tax-rate-utils"
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
import {
  ToggleGroup,
  ToggleGroupItem,
} from "../../components/ui/toggle-group.tsx"
import { useRequirePermission } from "../../core/use-access.ts"
import { useAppRun } from "../../hooks/use-app-run.ts"
import { useConfirm } from "../../hooks/use-confirm.ts"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useRunToast } from "../../hooks/use-run-toast.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney } from "../../lib/format-money.ts"
import { fontSize, fontWeight } from "../../theme/tokens.ts"
import { RememberWrittenItem } from "./remember-written-item.tsx"

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
      {paidAfterRejection.length > 0 && (
        <UnmatchedOrderMoney
          title={t("orders.paidAfterRejection.title")}
          description={t("orders.paidAfterRejection.description")}
          entries={paidAfterRejection}
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
            {formatTime(new Date(order.createdAt), locale)}
          </CardDescription>
          <XStack gap={4} flexWrap="wrap">
            {order.isFullyPaid ? (
              <Badge variant="secondary" label={t("orders.paid")} />
            ) : (
              <Badge variant="destructive" label={t("orders.notFullyPaid")} />
            )}
            {order.isAccepted && !order.isServed && (
              <Badge label={t("orders.preparing")} />
            )}
          </XStack>
        </CardHeader>
        <CardContent gap={12}>
          {order.written !== null ? (
            <WrittenOrder
              billId={order.billId}
              written={order.written}
              isAccepted={order.isAccepted}
            />
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
        {children}
      </Card>
    </YStack>
  )
}

function WrittenOrder({
  billId,
  written,
  isAccepted,
}: {
  readonly billId: MenuOrderToServe["billId"]
  readonly written: NonNullable<MenuOrderToServe["written"]>
  readonly isAccepted: boolean
}) {
  const {
    data: [legalEntity],
  } = useEvoluQuery(legalEntityQuery)
  const {
    data: [selfPaySettings],
  } = useEvoluQuery(selfPaySettingsQuery)
  const { t } = useTranslation()
  const locale = useLocale()
  const amount = (money: Pick<typeof written, "arrived" | "named">) =>
    writtenOrderAmount(money, t, (value) => formatMoney(value, locale))

  return (
    <>
      {written.lines.map((line) => (
        <YStack key={line.id} gap={2}>
          <Text
            fontSize={fontSize.lg}
            lineHeight={fontSize.lg}
            fontWeight={fontWeight.medium}
          >
            {t("orders.written", { text: line.text })}
          </Text>
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            fontVariant={["tabular-nums"]}
          >
            {amount(line)}
          </Text>
          {isVatPayer(legalEntity) ? (
            <WrittenLineTaxRate
              billId={billId}
              line={line}
              isAccepted={isAccepted}
            />
          ) : null}
          {remembersWrittenItems(selfPaySettings) ? (
            <RememberWrittenItem billId={billId} line={line} />
          ) : null}
        </YStack>
      ))}
      {written.lines.length > 1 ? (
        <Text
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          fontWeight={fontWeight.medium}
          fontVariant={["tabular-nums"]}
        >
          {t("orders.written.total", { amount: amount(written) })}
        </Text>
      ) : null}
    </>
  )
}

const taxRateErrorKeys = {
  MenuOrderDecided: "orders.written.taxRate.locked",
  WrittenOrderLineNotFound: "app.saveFailed",
  TaxRateNotOffered: "app.saveFailed",
} satisfies Record<
  | MenuOrderDecidedError["type"]
  | WrittenOrderLineNotFoundError["type"]
  | TaxRateNotOfferedError["type"],
  TranslationKey
>

function WrittenLineTaxRate({
  billId,
  line,
  isAccepted,
}: {
  readonly billId: MenuOrderToServe["billId"]
  readonly line: NonNullable<MenuOrderToServe["written"]>["lines"][number]
  readonly isAccepted: boolean
}) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const { data: taxRates } = useEvoluQuery(taxRatesQuery)
  const rates = filterSelectableTaxRates(taxRates, line.taxRateId)

  if (isAccepted) {
    const rate = rates.find(({ id }) => id === line.taxRateId)
    return (
      <Text
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
        color="muted-foreground"
      >
        {rate === undefined
          ? t("catalog.items.form.taxRate.none")
          : formatTaxRateLabel(rate)}
      </Text>
    )
  }

  return (
    <ToggleGroup
      aria-label={t("orders.written.taxRate", { text: line.text })}
      variant="outline"
      size="sm"
      orientation="vertical"
      value={line.taxRateId}
      onValueChange={(value) => {
        const rate = rates.find(({ id }) => id === value)
        if (rate === undefined) return
        void runToast(async (run) => {
          const result = await run(
            setWrittenOrderLineTaxRate({
              billId,
              lineId: line.id,
              taxRateId: rate.id,
            })
          )
          if (!result.ok) return taxRateErrorKeys[result.error.type]
        })
      }}
    >
      {rates.map((rate) => (
        <ToggleGroupItem key={rate.id} value={rate.id}>
          {formatTaxRateLabel(rate)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
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
                {entry.rejectedOrderNumber === null
                  ? amount
                  : t("orders.paidAfterRejection.entry", {
                      number: entry.rejectedOrderNumber,
                      amount,
                    })}
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
