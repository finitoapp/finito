import { formatRelativeDate, formatTime } from "@payky/app-shared/format-date"
import { formatSatsAmount } from "@payky/app-shared/format-money"
import { groupByDay } from "@payky/app-shared/group-by-day"
import {
  shortWithdrawalDestination,
  withdrawalKindKeys,
  withdrawalMethod,
  withdrawalStatusKey,
} from "@payky/app-shared/withdraw-display"
import type { WithdrawMethod } from "@payky/app-shared/withdraw-flow"
import type { AccountId } from "@payky/core/modules/account/account-types"
import {
  toWithdrawalView,
  type WithdrawalView,
  withdrawalsByAccountQuery,
} from "@payky/core/modules/withdraw/withdraw-queries"
import { router } from "expo-router"
import Plus from "lucide-react-native/icons/plus"
import { Suspense } from "react"
import { FlatList } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Text, useTheme, XStack, YStack } from "tamagui"
import { FadeHeader } from "../../components/fade-header.tsx"
import { ListSkeleton } from "../../components/list-skeleton.tsx"
import { LoadingView } from "../../components/loading-view.tsx"
import { screenPaddingX } from "../../components/screen.tsx"
import { Button } from "../../components/ui/button.tsx"
import { VerticalNav } from "../../components/vertical-nav.tsx"
import { useBtcFiat } from "../../hooks/use-btc-fiat.ts"
import { useInfiniteEvoluQuery } from "../../hooks/use-infinite-evolu-query.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { useCashuWalletSnapshot } from "../shared/cashu/use-cashu-wallet-snapshot.ts"
import { useCashuAccountId } from "./use-cashu-withdraw-data.ts"
import { useSparkAccountId, useSparkBalance } from "./use-withdraw-data.ts"
import { WithdrawNoAccountCard } from "./withdraw-no-account-card.tsx"
import { WithdrawalStatusBadge } from "./withdraw-parts.tsx"
import { withdrawRoutes } from "./withdraw-routes.ts"

/** `/withdraw`: the Spark wallet's withdrawals, newest first. */
export function WithdrawHistoryPage() {
  return <WithdrawHistoryScreen method="spark" />
}

/** `/cashu-withdraw`: the withdrawals from the shared Cashu wallet. */
export function CashuWithdrawHistoryPage() {
  return <WithdrawHistoryScreen method="cashu" />
}

function WithdrawHistoryScreen({
  method,
}: {
  readonly method: WithdrawMethod
}) {
  const theme = useTheme()
  const { t } = useTranslation()

  return (
    <SafeAreaView
      style={{
        flex: 1,
        paddingHorizontal: screenPaddingX,
        paddingBottom: 16,
        backgroundColor: theme.background.val,
      }}
    >
      <FadeHeader
        title={t(
          method === "spark" ? "withdraw.history.title" : "withdraw.cashu.title"
        )}
      />
      <Suspense fallback={<LoadingView />}>
        <WithdrawHistoryBody method={method} />
      </Suspense>
    </SafeAreaView>
  )
}

function WithdrawHistoryBody({ method }: { readonly method: WithdrawMethod }) {
  const sparkAccountId = useSparkAccountId()
  const cashuAccountId = useCashuAccountId()
  const accountId = method === "spark" ? sparkAccountId : cashuAccountId
  if (accountId === undefined) {
    return <WithdrawNoAccountCard method={method} />
  }
  return <WithdrawHistory method={method} accountId={accountId} />
}

type WithdrawalGroup = {
  readonly key: string
  readonly title: string
  readonly items: ReadonlyArray<WithdrawalView>
}

function SparkBalanceSummary({ accountId }: { readonly accountId: AccountId }) {
  return <BalanceSummary balance={useSparkBalance(accountId)} />
}

/** Its own `Suspense`: a Cashu wallet that is slow to start holds up only this line. */
function CashuBalanceSummary() {
  return (
    <Suspense fallback={null}>
      <CashuBalanceLine />
    </Suspense>
  )
}

function CashuBalanceLine() {
  const { snapshot } = useCashuWalletSnapshot()
  return (
    <BalanceSummary
      balance={
        snapshot === null
          ? null
          : [...snapshot.balances.values()].reduce((sum, sats) => sum + sats, 0)
      }
    />
  )
}

function BalanceSummary({ balance }: { readonly balance: number | null }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const fiat = useBtcFiat()
  if (balance === null) return null
  return (
    <YStack items="flex-end">
      <Text fontWeight="600">
        {t("withdraw.history.balance", {
          amount: formatSatsAmount(balance, locale),
        })}
      </Text>
      <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
        {fiat.approx(balance)}
      </Text>
    </YStack>
  )
}

function WithdrawHistory({
  method,
  accountId,
}: {
  readonly method: WithdrawMethod
  readonly accountId: AccountId
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const { rows, hasMore, isPending, loadMore } = useInfiniteEvoluQuery(
    [accountId],
    (limit) => withdrawalsByAccountQuery(accountId, limit)
  )
  const views = rows.flatMap((row): ReadonlyArray<WithdrawalView> => {
    const view = toWithdrawalView(row)
    return view === null ? [] : [view]
  })
  const now = new Date()
  const groups: ReadonlyArray<WithdrawalGroup> = groupByDay(
    views,
    (view) => new Date(view.createdAt)
  ).map((group) => ({
    key: group.date.toDateString(),
    title: formatRelativeDate(group.date, now, locale),
    items: group.items,
  }))

  return (
    <YStack flex={1} gap="4">
      <XStack justify="space-between" items="center" gap="2">
        <Button
          size="default"
          iconStart={Plus}
          label={t("withdraw.history.new")}
          onPress={() => router.push(withdrawRoutes[method].new)}
        />
        {method === "spark" ? (
          <SparkBalanceSummary accountId={accountId} />
        ) : (
          <CashuBalanceSummary />
        )}
      </XStack>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 16, paddingBottom: 16 }}
        data={groups}
        keyExtractor={(group) => group.key}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (hasMore && !isPending) loadMore()
        }}
        ListEmptyComponent={
          <VerticalNav
            items={[]}
            empty={
              <Text
                p="4"
                fontSize="sm"
                lineHeight="sm"
                color="muted-foreground"
              >
                {t("withdraw.history.empty")}
              </Text>
            }
          />
        }
        ListFooterComponent={
          <>
            {hasMore && isPending ? <ListSkeleton rows={5} /> : null}
            {method === "spark" ? (
              // The link is its own element, not nested in the note as on
              // web: a nested Text is no separate TalkBack or tap target.
              <YStack gap="1" items="flex-start">
                <Text fontSize="sm" lineHeight="sm" color="muted-foreground">
                  {t("withdraw.history.olderNote")}
                </Text>
                <Text
                  fontSize="sm"
                  lineHeight="sm"
                  textDecorationLine="underline"
                  role="link"
                  cursor="web:pointer"
                  onPress={() =>
                    router.push("/settings/payment-accounts/spark/transactions")
                  }
                >
                  {t("withdraw.history.transactionsLink")}
                </Text>
              </YStack>
            ) : null}
          </>
        }
        renderItem={({ item }) => <WithdrawalDay group={item} />}
      />
    </YStack>
  )
}

function WithdrawalDay({ group }: { readonly group: WithdrawalGroup }) {
  const { t } = useTranslation()
  const locale = useLocale()
  return (
    <VerticalNav
      title={group.title}
      items={group.items.map((view) => {
        const amount = t("withdraw.sats", {
          amount: formatSatsAmount(view.amountSats, locale),
        })
        return {
          id: view.id,
          kind: "button" as const,
          accessibilityLabel: [
            amount,
            t(withdrawalStatusKey(view)),
            shortWithdrawalDestination(view.target),
            view.comment,
            t(withdrawalKindKeys[view.target.kind]),
            formatTime(new Date(view.createdAt), locale),
            view.deviceName,
          ]
            .filter((part) => part !== null)
            .join(", "),
          onPress: () =>
            router.push({
              pathname: withdrawRoutes[withdrawalMethod(view.target)].detail,
              params: { withdrawalId: view.id },
            }),
          label: (
            <YStack w="100%" gap="1" items="flex-start">
              <XStack w="100%" justify="space-between" items="center" gap="2">
                <Text fontSize="sm" lineHeight="sm" fontWeight="600">
                  {amount}
                </Text>
                <WithdrawalStatusBadge view={view} />
              </XStack>
              <Text fontSize="xs" lineHeight="xs" numberOfLines={1}>
                {shortWithdrawalDestination(view.target)}
              </Text>
              {view.comment === null ? null : (
                <Text
                  fontSize="xs"
                  lineHeight="xs"
                  color="muted-foreground"
                  numberOfLines={1}
                >
                  {view.comment}
                </Text>
              )}
              <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
                {[
                  t(withdrawalKindKeys[view.target.kind]),
                  formatTime(new Date(view.createdAt), locale),
                  view.deviceName,
                ]
                  .filter((part) => part !== null)
                  .join(" · ")}
              </Text>
            </YStack>
          ),
        }
      })}
    />
  )
}
