import {
  derivePaymentHistoryRowState,
  formatActivityDayTitle,
  hasAnyIssue,
  type PaymentHistoryRow,
  paymentHistoryIssueLabels,
  resolvePaymentTitle,
} from "@payky/app-shared/activity-history"
import { paymentStatusLabelKey } from "@payky/app-shared/activity-labels"
import { formatTime } from "@payky/app-shared/format-date"
import { groupByDay } from "@payky/app-shared/group-by-day"
import { useNow } from "@payky/app-shared/use-now"
import { latestPaymentsQuery } from "@payky/core/modules/payment/payment-queries"
import { refundSummariesQuery } from "@payky/core/modules/refund/refund-queries"
import { summarizeRefundsByPayment } from "@payky/core/modules/refund/refund-utils"
import { Suspense } from "react"
import {
  useEvoluQuery,
  usePreloadEvoluQueries,
} from "../../hooks/use-evolu-query.ts"
import { useInfiniteEvoluQuery } from "../../hooks/use-infinite-evolu-query.ts"
import { paymentHistoryQueries } from "../../hooks/use-preload-activity.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney } from "../../lib/format-money.ts"
import { RefundBadge } from "../shared/refund-badge.tsx"
import { ActivityFallback } from "./activity-layout.tsx"
import {
  type ActivityGroup,
  ActivityList,
  type ActivityRowData,
} from "./activity-parts.tsx"
import { PaymentStatusIcon } from "./payment-status-display.tsx"
import { usePreloadPaymentDetail } from "./use-preload-payment-detail.ts"

/**
 * The Activity tab's payments list, under `ActivityLayout`'s header and tabs.
 * Its rows wait behind the list's skeleton, so the tab opens on the header
 * and tabs at once rather than on an empty screen.
 */
export function PaymentHistoryPage() {
  return (
    <Suspense fallback={<ActivityFallback />}>
      <PaymentHistory />
    </Suspense>
  )
}

function PaymentHistory() {
  const { t } = useTranslation()
  const locale = useLocale()
  const preloadPaymentDetail = usePreloadPaymentDetail()
  usePreloadEvoluQueries(paymentHistoryQueries())
  const { rows, hasMore, isPending, loadMore } = useInfiniteEvoluQuery(
    [],
    latestPaymentsQuery
  )
  const refunds = useEvoluQuery(refundSummariesQuery).data
  const refundsByPayment = summarizeRefundsByPayment(refunds)
  // Nothing writes a row when a payment expires, so the clock has to tick on
  // its own or a listed pending payment never becomes Expired.
  const now = useNow(rows.map((row) => row.expiresAt))

  const toRow = (item: PaymentHistoryRow): ActivityRowData => {
    const state = derivePaymentHistoryRowState(item, now)
    const details = [
      formatTime(new Date(item.createdAt), locale),
      item.tableName,
      item.tipAmount > 0
        ? t("paymentHistory.tip", {
            amount: formatMoney(
              { value: item.tipAmount, currency: item.currency },
              locale
            ),
          })
        : null,
    ].filter((part): part is string => part !== null)

    return {
      id: item.id,
      title: resolvePaymentTitle(item, t),
      details,
      methodKinds: item.ownClaimedTransactions.map(
        (transaction) => transaction.transactionKind
      ),
      issues: hasAnyIssue(state.issueFlags)
        ? paymentHistoryIssueLabels(state.issueFlags, t)
        : [],
      extra: <RefundBadge summary={refundsByPayment.get(item.id)} />,
      statusIcon: (
        <PaymentStatusIcon
          status={state.status}
          hasCancellationCollision={state.hasCancellationCollision}
        />
      ),
      amount: formatMoney(
        { value: item.amount, currency: item.currency },
        locale
      ),
      isVoid: state.isVoid,
      statusLabel: t(paymentStatusLabelKey[state.status]),
      href: {
        pathname: "/activity/[paymentId]",
        params: { paymentId: item.id },
      },
      onOpen: () => preloadPaymentDetail(item.id, item.billId),
    }
  }

  const dayGroups = groupByDay(rows, (item) => new Date(item.createdAt))
  const groups: ReadonlyArray<ActivityGroup> = dayGroups.map(
    (group, groupIndex) => ({
      key: group.date.toDateString(),
      // Only paid payments count: a pending, expired or canceled one is money
      // that never arrived. The last group may continue on the next page.
      title: formatActivityDayTitle({
        date: group.date,
        now,
        locale,
        format: (money) => formatMoney(money, locale),
        amounts: group.items
          .filter(
            (item) => derivePaymentHistoryRowState(item, now).status === "paid"
          )
          .map((item) => ({ value: item.amount, currency: item.currency })),
        isComplete: !hasMore || groupIndex < dayGroups.length - 1,
      }),
      rows: group.items.map(toRow),
    })
  )

  return (
    <ActivityList
      groups={groups}
      emptyListTitle={t("paymentHistory.title")}
      emptyTitle={t("paymentHistory.empty.title")}
      emptyDescription={t("paymentHistory.empty.description")}
      hasMore={hasMore}
      isPending={isPending}
      loadMore={loadMore}
    />
  )
}
