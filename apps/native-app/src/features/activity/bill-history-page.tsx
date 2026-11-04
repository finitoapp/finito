import {
  type BillHistoryRow,
  billHistoryIssueLabels,
  formatActivityDayTitle,
  summarizeBillHistoryRow,
  sumSettledTips,
} from "@payky/app-shared/activity-history"
import { billStatusLabelKey } from "@payky/app-shared/activity-labels"
import { formatTime } from "@payky/app-shared/format-date"
import { groupByDay } from "@payky/app-shared/group-by-day"
import { useNow } from "@payky/app-shared/use-now"
import { latestBillsQuery } from "@payky/core/modules/bill/bill-queries"
import type { BillStatus } from "@payky/core/modules/bill/bill-types"
import { NonNegativeInteger } from "@payky/core/modules/shared/schema"
import type { LucideIcon } from "lucide-react-native"
import Check from "lucide-react-native/icons/check"
import RotateCw from "lucide-react-native/icons/rotate-cw"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import X from "lucide-react-native/icons/x"
import { View } from "tamagui"
import { Icon } from "../../components/ui/icon.tsx"
import { useInfiniteEvoluQuery } from "../../hooks/use-infinite-evolu-query.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney } from "../../lib/format-money.ts"
import type { ThemeColor } from "../../theme/themes.ts"
import { radius } from "../../theme/tokens.ts"
import {
  type ActivityGroup,
  ActivityList,
  type ActivityRowData,
} from "./activity-parts.tsx"

const billStatusIcons = {
  open: { bg: "warning-10", color: "warning", icon: RotateCw },
  closed: { bg: "success-10", color: "success", icon: Check },
  canceled: { bg: "destructive-10", color: "destructive", icon: X },
} as const satisfies Record<
  BillStatus,
  {
    readonly bg: ThemeColor
    readonly color: ThemeColor
    readonly icon: LucideIcon
  }
>

/** Web's `BillStatusIcon`: the bill's status as a filled 32 circle. */
function BillStatusIcon({
  status,
  hasCancellationCollision,
}: {
  readonly status: BillStatus
  readonly hasCancellationCollision: boolean
}) {
  const tone = hasCancellationCollision
    ? ({ bg: "warning-10", color: "warning", icon: TriangleAlert } as const)
    : billStatusIcons[status]
  return (
    <View
      w={32}
      h={32}
      rounded={radius.full}
      bg={tone.bg}
      items="center"
      justify="center"
    >
      <Icon icon={tone.icon} color={tone.color} />
    </View>
  )
}

/** The Activity tab's bills list, under `ActivityLayout`'s header and tabs. */
export function BillHistoryPage() {
  return <BillHistory />
}

function BillHistory() {
  const { t } = useTranslation()
  const locale = useLocale()
  const now = useNow([])
  const { rows, hasMore, isPending, loadMore } = useInfiniteEvoluQuery(
    [],
    latestBillsQuery
  )

  const summarized = rows.map((bill) => ({
    bill,
    summary: summarizeBillHistoryRow(bill),
  }))

  const toRow = ({
    bill,
    summary,
  }: {
    readonly bill: BillHistoryRow
    readonly summary: ReturnType<typeof summarizeBillHistoryRow>
  }): ActivityRowData => {
    const tips = sumSettledTips(bill)
    const details = [
      formatTime(new Date(bill.createdAt), locale),
      bill.tableName,
      tips > 0
        ? t("billHistory.tip", {
            amount: formatMoney(
              { value: NonNegativeInteger(tips), currency: bill.currency },
              locale
            ),
          })
        : null,
    ].filter((part): part is string => part !== null)

    return {
      id: bill.id,
      title: bill.label ?? t("bill.list.label", { number: bill.displayNumber }),
      details,
      methodKinds: bill.claimedTransactions.map(
        (transaction) => transaction.transactionKind
      ),
      issues: billHistoryIssueLabels(summary, t),
      statusIcon: (
        <BillStatusIcon
          status={summary.status}
          hasCancellationCollision={summary.hasCancellationCollision}
        />
      ),
      amount: formatMoney(
        { value: summary.billTotal, currency: bill.currency },
        locale
      ),
      // A canceled bill whose money arrived anyway is not void — striking its
      // total through would hide exactly that.
      isVoid:
        summary.status === "canceled" && !summary.hasCancellationCollision,
      statusLabel: t(billStatusLabelKey[summary.status]),
      href: {
        pathname: "/activity/bills/[billId]",
        params: { billId: bill.id },
      },
    }
  }

  const dayGroups = groupByDay(
    summarized,
    ({ bill }) => new Date(bill.createdAt)
  )
  const groups: ReadonlyArray<ActivityGroup> = dayGroups.map(
    (group, groupIndex) => ({
      key: group.date.toDateString(),
      title: formatActivityDayTitle({
        date: group.date,
        now,
        locale,
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
      }),
      rows: group.items.map(toRow),
    })
  )

  return (
    <ActivityList
      groups={groups}
      emptyListTitle={t("billHistory.title")}
      emptyTitle={t("billHistory.empty.title")}
      emptyDescription={t("billHistory.empty.description")}
      hasMore={hasMore}
      isPending={isPending}
      loadMore={loadMore}
    />
  )
}
