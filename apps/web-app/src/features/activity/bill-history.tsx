import {
  billHistoryIssueLabels,
  formatActivityDayTitle,
  summarizeBillHistoryRow,
  sumSettledTips,
} from "@payky/app-shared/activity-history"
import { billStatusLabelKey } from "@payky/app-shared/activity-labels"
import { groupByDay } from "@payky/app-shared/group-by-day"
import { useNow } from "@payky/app-shared/use-now"
import { latestBillsQuery } from "@payky/core/modules/bill/bill-queries"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import {
  type BillHistoryItemSummary,
  deriveBillOverpayment,
} from "@payky/core/modules/bill/bill-utils"
import { NonNegativeInteger } from "@payky/core/modules/shared/schema"
import {
  AlertTriangleIcon,
  CheckIcon,
  ReceiptIcon,
  RotateCwIcon,
  XIcon,
} from "lucide-react"
import type { ReactNode } from "react"
import { VerticalNav } from "@/components/vertical-nav.tsx"
import { ActivityHistorySkeleton } from "@/features/activity/activity-history-skeleton.tsx"
import {
  ActivityAmount,
  ActivityIssueBadges,
  activityIssueRowClassName,
  PaymentMethodIcons,
} from "@/features/activity/activity-row.tsx"
import { useOverpaymentInputs } from "@/features/shared/use-overpayment-input.ts"
import { useInfiniteEvoluQuery } from "@/hooks/use-infinite-evolu-query.ts"
import { useLocale } from "@/hooks/use-locale.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatMoney, formatTime } from "@/lib/format-utils.ts"
import { cn } from "@/lib/utils.ts"

const billStatusIconData = {
  open: ["bg-warning/10 text-warning", <RotateCwIcon key="open" />],
  closed: ["bg-success/10 text-success", <CheckIcon key="closed" />],
  canceled: ["bg-destructive/10 text-destructive", <XIcon key="canceled" />],
} satisfies Record<
  BillHistoryItemSummary["status"],
  readonly [string, ReactNode]
>

function BillStatusIcon({
  status,
  hasCancellationCollision,
}: {
  readonly status: BillHistoryItemSummary["status"]
  readonly hasCancellationCollision: boolean
}) {
  const [className, icon] = hasCancellationCollision
    ? ["bg-warning/10 text-warning", <AlertTriangleIcon key="collision" />]
    : billStatusIconData[status]

  return (
    <div
      className={cn(
        "flex size-8 items-center justify-center rounded-full",
        className
      )}
    >
      {icon}
    </div>
  )
}

export const BillHistory = () => {
  const { t } = useTranslation()
  const locale = useLocale()
  const now = useNow([])
  const {
    rows: items,
    hasMore,
    isPending,
    sentinelRef,
  } = useInfiniteEvoluQuery([], latestBillsQuery)
  const rows = items.map((bill) => ({
    bill,
    summary: summarizeBillHistoryRow(bill),
  }))
  const overpaymentInputs = useOverpaymentInputs(
    rows
      .filter(({ summary }) => summary.coverage === "overpaid")
      .map(({ bill, summary }) => ({
        billId: bill.id,
        billTotal: summary.billTotal,
        isCanceled: summary.status === "canceled",
      }))
  )
  const hasUnresolvedOverpayment = (billId: BillId) => {
    const input = overpaymentInputs.get(billId)
    return input !== undefined && deriveBillOverpayment(input).unresolved > 0
  }

  const empty = (
    <div className={"flex flex-col justify-center items-center gap-8 py-10"}>
      <ReceiptIcon className="h-10 w-10 text-muted-foreground" />
      <h2 className={"text-foreground text-lg"}>
        {t("billHistory.empty.title")}
      </h2>
      <p className="text-balance text-sm text-muted-foreground text-center">
        {t("billHistory.empty.description")}
      </p>
    </div>
  )

  if (items.length === 0) {
    return (
      <VerticalNav title={t("billHistory.title")} empty={empty} items={[]} />
    )
  }

  const dayGroups = groupByDay(rows, ({ bill }) => new Date(bill.createdAt))

  return (
    <div className="flex flex-col gap-4">
      {dayGroups.map((group, groupIndex) => (
        <VerticalNav
          key={group.date.toDateString()}
          title={formatActivityDayTitle({
            date: group.date,
            now,
            locale,
            format: (money) => formatMoney(money, locale),
            // Only closed bills count: an open one isn't settled yet and a
            // canceled one never will be.
            amounts: group.items
              .filter(({ summary }) => summary.status === "closed")
              .map(({ bill, summary }) => ({
                value: summary.billTotal,
                currency: bill.currency,
              })),
            // The last group may continue on the next, not yet loaded page.
            isComplete: !hasMore || groupIndex < dayGroups.length - 1,
          })}
          items={group.items.map(({ bill, summary }) => {
            const issues = billHistoryIssueLabels(
              summary,
              t,
              hasUnresolvedOverpayment(bill.id)
            )
            const tips = sumSettledTips(bill)

            return {
              id: bill.id,
              kind: "link" as const,
              to: "/activity/bills/$billId",
              params: { billId: bill.id },
              className:
                issues.length > 0 ? activityIssueRowClassName : undefined,
              label: (
                <div className={"flex flex-col gap-1 items-start min-w-0"}>
                  <strong className="max-w-full truncate">
                    {bill.label ??
                      t("bill.list.label", { number: bill.displayNumber })}
                  </strong>
                  <div
                    className={
                      "flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground"
                    }
                  >
                    <span>{formatTime(new Date(bill.createdAt), locale)}</span>
                    {bill.tableName !== null && <span>· {bill.tableName}</span>}
                    {tips > 0 && (
                      <span>
                        ·{" "}
                        {t("billHistory.tip", {
                          amount: formatMoney(
                            {
                              value: NonNegativeInteger(tips),
                              currency: bill.currency,
                            },
                            locale
                          ),
                        })}
                      </span>
                    )}
                    <PaymentMethodIcons
                      kinds={bill.claimedTransactions.map(
                        (transaction) => transaction.transactionKind
                      )}
                    />
                  </div>
                  <ActivityIssueBadges issues={issues} />
                </div>
              ),
              icon: (
                <div className={"p-2"}>
                  <BillStatusIcon
                    status={summary.status}
                    hasCancellationCollision={summary.hasCancellationCollision}
                  />
                </div>
              ),
              action: (
                <ActivityAmount
                  money={{ value: summary.billTotal, currency: bill.currency }}
                  // A canceled bill whose money arrived anyway is not void —
                  // striking its total through would hide exactly that.
                  isVoid={
                    summary.status === "canceled" &&
                    !summary.hasCancellationCollision
                  }
                  statusLabel={t(billStatusLabelKey[summary.status])}
                />
              ),
            }
          })}
        />
      ))}
      {hasMore && (
        <>
          {isPending && <ActivityHistorySkeleton rows={5} />}
          <div ref={sentinelRef} aria-hidden className="h-1" />
        </>
      )}
    </div>
  )
}
