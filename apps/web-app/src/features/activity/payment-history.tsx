import {
  derivePaymentHistoryRowState,
  formatActivityDayTitle,
  hasAnyIssue,
  type PaymentHistoryIssueFlags,
  type PaymentHistoryRow,
  paymentHistoryIssueLabels,
  resolvePaymentTitle,
} from "@payky/app-shared/activity-history"
import { paymentStatusLabelKey } from "@payky/app-shared/activity-labels"
import { groupByDay } from "@payky/app-shared/group-by-day"
import { useNow } from "@payky/app-shared/use-now"
import { latestPaymentsQuery } from "@payky/core/modules/payment/payment-queries"
import { refundSummariesQuery } from "@payky/core/modules/refund/refund-queries"
import { summarizeRefundsByPayment } from "@payky/core/modules/refund/refund-utils"
import { ReceiptIcon } from "lucide-react"
import { VerticalNav } from "@/components/vertical-nav.tsx"
import { ActivityHistorySkeleton } from "@/features/activity/activity-history-skeleton.tsx"
import {
  ActivityAmount,
  ActivityIssueBadges,
  activityIssueRowClassName,
  PaymentMethodIcons,
} from "@/features/activity/activity-row.tsx"
import { PaymentStatusIcon } from "@/features/activity/payment-status-display.tsx"
import { RefundBadge } from "@/features/shared/refund-badge.tsx"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useInfiniteEvoluQuery } from "@/hooks/use-infinite-evolu-query.ts"
import { useLocale } from "@/hooks/use-locale.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatMoney, formatTime } from "@/lib/format-utils.ts"

function PaymentHistoryIssues({
  flags,
}: {
  readonly flags: PaymentHistoryIssueFlags
}) {
  const { t } = useTranslation()

  return <ActivityIssueBadges issues={paymentHistoryIssueLabels(flags, t)} />
}

export const PaymentHistory = () => {
  const { t } = useTranslation()
  const locale = useLocale()
  const {
    rows: items,
    hasMore,
    isPending,
    sentinelRef,
  } = useInfiniteEvoluQuery([], latestPaymentsQuery)
  const { data: refunds } = useEvoluQuery(refundSummariesQuery)
  const refundsByPayment = summarizeRefundsByPayment(refunds)
  // Nothing writes a row when a payment expires, so the clock has to tick on
  // its own or a listed pending payment never becomes Expired.
  const now = useNow(items.map((item) => item.expiresAt))

  const empty = (
    <div className={"flex flex-col justify-center items-center gap-8 py-10"}>
      <ReceiptIcon className="h-10 w-10 text-muted-foreground" />
      <h2 className={"text-foreground text-lg"}>
        {t("paymentHistory.empty.title")}
      </h2>
      <p className="text-balance text-sm text-muted-foreground text-center">
        {t("paymentHistory.empty.description")}
      </p>
    </div>
  )

  if (items.length === 0) {
    return (
      <VerticalNav title={t("paymentHistory.title")} empty={empty} items={[]} />
    )
  }

  const dayGroups = groupByDay(items, (item) => new Date(item.createdAt))
  const stateOf = (item: PaymentHistoryRow) =>
    derivePaymentHistoryRowState(item, now)

  return (
    <div className="flex flex-col gap-4">
      {dayGroups.map((group, groupIndex) => {
        // The last group may continue on the next, not yet loaded page.
        const isComplete = !hasMore || groupIndex < dayGroups.length - 1
        // Only paid payments count: a pending, expired or canceled one is
        // money that never arrived.
        const title = formatActivityDayTitle({
          date: group.date,
          now,
          locale,
          format: (money) => formatMoney(money, locale),
          amounts: group.items
            .filter((item) => stateOf(item).status === "paid")
            .map((item) => ({ value: item.amount, currency: item.currency })),
          isComplete,
        })

        return (
          <VerticalNav
            key={group.date.toDateString()}
            title={title}
            items={group.items.map((item) => {
              const {
                status: paymentStatus,
                hasCancellationCollision,
                issueFlags,
                isVoid,
              } = stateOf(item)

              return {
                id: item.id,
                kind: "link" as const,
                className: hasAnyIssue(issueFlags)
                  ? activityIssueRowClassName
                  : undefined,
                to: "/activity/$paymentId",
                params: {
                  paymentId: item.id,
                },
                label: (
                  <div className={"flex flex-col gap-1 items-start min-w-0"}>
                    <strong className="max-w-full truncate">
                      {resolvePaymentTitle(item, t)}
                    </strong>
                    <div
                      className={
                        "flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground"
                      }
                    >
                      <span>
                        {formatTime(new Date(item.createdAt), locale)}
                      </span>
                      {item.tableName !== null && (
                        <span>· {item.tableName}</span>
                      )}
                      {item.tipAmount > 0 && (
                        <span>
                          ·{" "}
                          {t("paymentHistory.tip", {
                            amount: formatMoney(
                              {
                                value: item.tipAmount,
                                currency: item.currency,
                              },
                              locale
                            ),
                          })}
                        </span>
                      )}
                      <PaymentMethodIcons
                        kinds={item.ownClaimedTransactions.map(
                          (transaction) => transaction.transactionKind
                        )}
                      />
                    </div>
                    <PaymentHistoryIssues flags={issueFlags} />
                    <RefundBadge summary={refundsByPayment.get(item.id)} />
                  </div>
                ),
                icon: (
                  <div className={"p-2"}>
                    <PaymentStatusIcon
                      status={paymentStatus}
                      hasCancellationCollision={hasCancellationCollision}
                    />
                  </div>
                ),
                action: (
                  <ActivityAmount
                    money={{ value: item.amount, currency: item.currency }}
                    isVoid={isVoid}
                    statusLabel={t(paymentStatusLabelKey[paymentStatus])}
                  />
                ),
              }
            })}
          />
        )
      })}
      {hasMore && (
        <>
          {isPending && <ActivityHistorySkeleton rows={5} />}
          <div ref={sentinelRef} aria-hidden className="h-1" />
        </>
      )}
    </div>
  )
}
