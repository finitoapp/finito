import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  toServeOrderMoney,
  writtenOrderAmount,
} from "@payky/app-shared/menu-order-announcement"
import { selfPaySettingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { remembersWrittenItems } from "@payky/core/modules/app-settings/app-settings-utils"
import { legalEntityQuery } from "@payky/core/modules/legal-entity/legal-entity-queries"
import { isVatPayer } from "@payky/core/modules/legal-entity/legal-entity-utils"
import {
  acceptMenuOrder,
  loadMenuOrdersNotFoundYet,
  loadMenuOrdersServedToday,
  loadMenuOrdersToReturn,
  loadMenuOrdersToServe,
  type MenuOrderDecidedError,
  type MenuOrderNotFoundYet,
  type MenuOrderToReturn,
  type MenuOrderToServe,
  markMenuOrderServed,
  type RejectedMenuOrderRefund,
  rejectMenuOrder,
  setWrittenOrderLineTaxRate,
  type TaxRateNotOfferedError,
  type WrittenOrderLineNotFoundError,
} from "@payky/core/modules/menu-order/menu-order-actions"
import { evoluHistoryMaxRowidQuery } from "@payky/core/modules/shared/evolu-history-queries"
import type { Money } from "@payky/core/modules/shared/money"
import { taxRatesQuery } from "@payky/core/modules/tax-rate/tax-rate-queries"
import {
  filterSelectableTaxRates,
  formatTaxRateLabel,
  taxRatePercentageToDecimalString,
} from "@payky/core/modules/tax-rate/tax-rate-utils"
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx"
import { useRequirePermission } from "@/hooks/use-access.ts"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useLocale } from "@/hooks/use-locale.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatDateTime, formatMoney, formatTime } from "@/lib/format-utils.ts"
import { RememberWrittenItem } from "./remember-written-item.tsx"

export function OrdersToServePage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-2">
      <div className="h-6" />
      <FadeHeader title={t("orders.title")} />
      <Tabs defaultValue="toServe" className="flex-col gap-4">
        <TabsList className="h-8 w-full">
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
      {(toServe.toReturn.length > 0 || paidAfterRejection.length > 0) && (
        <MoneyToReturn
          toReturn={toServe.toReturn}
          paidAfterRejection={paidAfterRejection}
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
      void navigate(refundDestination(await run.ok(rejectMenuOrder(order))))
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
          {`${formatTime(new Date(order.createdAt), locale)} · ${toServeOrderMoney(
            order,
            t,
            (money) => formatMoney(money, locale)
          )}`}
        </CardDescription>
        <CardAction className="flex flex-col items-end gap-1">
          {order.isFullyPaid ? (
            <Badge variant="secondary">{t("orders.paid")}</Badge>
          ) : (
            <Badge variant="destructive">{t("orders.notFullyPaid")}</Badge>
          )}
          {!order.isAccepted && !order.isServed && (
            <Badge>{t("orders.waiting.badge")}</Badge>
          )}
          {order.isAccepted && !order.isServed && (
            <Badge variant="outline">{t("orders.preparing")}</Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {order.written !== null ? (
          <WrittenOrder
            billId={order.billId}
            written={order.written}
            isAccepted={order.isAccepted}
          />
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
      {children}
    </Card>
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
  const { t } = useTranslation()
  const locale = useLocale()
  const {
    data: [legalEntity],
  } = useEvoluQuery(legalEntityQuery)
  const {
    data: [selfPaySettings],
  } = useEvoluQuery(selfPaySettingsQuery)
  const amount = (money: Pick<typeof written, "arrived" | "named">) =>
    writtenOrderAmount(money, t, (value) => formatMoney(value, locale))

  return (
    <>
      <ul className="flex flex-col gap-2">
        {written.lines.map((line) => (
          <li key={line.id} className="flex flex-col gap-0.5">
            <span className="text-lg font-medium wrap-anywhere">
              {t("orders.written", { text: line.text })}
            </span>
            <span className="text-sm tabular-nums">{amount(line)}</span>
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
          </li>
        ))}
      </ul>
      {written.lines.length > 1 ? (
        <p className="text-sm font-medium tabular-nums">
          {t("orders.written.total", { amount: amount(written) })}
        </p>
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
      <span className="text-sm text-muted-foreground">
        {rate === undefined
          ? t("catalog.items.form.taxRate.none")
          : formatTaxRateLabel(rate)}
      </span>
    )
  }

  return (
    <div className="mt-1 flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">
        {t("catalog.items.form.taxRate.label")}
      </span>
      <ToggleGroup
        aria-label={t("orders.written.taxRate", { text: line.text })}
        className="w-full"
        variant="outline"
        size="sm"
        spacing={0}
        value={line.taxRateId === null ? [] : [line.taxRateId]}
        onValueChange={(values) => {
          const rate = rates.find(({ id }) => id === values[0])
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
          <ToggleGroupItem
            key={rate.id}
            value={rate.id}
            aria-label={formatTaxRateLabel(rate)}
            className="flex-1 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90"
          >
            {`${taxRatePercentageToDecimalString(rate.rate)}%`}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

const refundDestination = (refund: RejectedMenuOrderRefund) =>
  refund.type === "payment"
    ? {
        to: "/activity/$paymentId" as const,
        params: { paymentId: refund.paymentId },
      }
    : {
        to: "/activity/bills/$billId" as const,
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
  const navigate = useNavigate()
  const entry = (number: number, amount: Money) =>
    t("orders.toReturn.entry", {
      number,
      amount: formatMoney(amount, locale),
    })

  return (
    <Card data-testid="money-to-return">
      <CardHeader>
        <CardTitle>{t("orders.toReturn.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {toReturn.length > 0 && (
          <ul className="flex flex-col gap-2">
            {toReturn.map((order) => (
              <li
                key={order.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="font-medium tabular-nums">
                  {entry(order.number, order.amount)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigate(refundDestination(order.refund))
                  }}
                >
                  {t("orders.toReturn.record")}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {paidAfterRejection.length > 0 && (
          <>
            <p className="text-sm text-muted-foreground">
              {t("orders.paidAfterRejection.description")}
            </p>
            <ul className="flex flex-col gap-2">
              {paidAfterRejection.map((money) => (
                <li
                  key={money.id}
                  className="flex justify-between gap-3 text-sm"
                >
                  <span className="font-medium tabular-nums">
                    {entry(money.rejectedOrderNumber, {
                      value: money.amount,
                      currency: money.currency,
                    })}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDateTime(new Date(money.occurredAt), locale)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
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
                <span className="font-medium tabular-nums">{amount}</span>
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
