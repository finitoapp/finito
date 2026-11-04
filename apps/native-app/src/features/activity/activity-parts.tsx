import { paymentMethodLabelKey } from "@payky/app-shared/activity-labels"
import type { AccountTransactionKind } from "@payky/core/modules/account-transaction/account-transaction-types"
import type { Href } from "expo-router"
import Receipt from "lucide-react-native/icons/receipt"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import type { ReactNode } from "react"
import { Animated } from "react-native"
import { Text, View, XStack, YStack } from "tamagui"
import { ListSkeleton } from "../../components/list-skeleton.tsx"
import {
  screenPadding,
  screenPaddingX,
  useScreenScroll,
  useScrollAwayHeaderInset,
} from "../../components/screen.tsx"
import { Badge } from "../../components/ui/badge.tsx"
import { Icon } from "../../components/ui/icon.tsx"
import { VerticalNav } from "../../components/vertical-nav.tsx"
import { useColumnScroll } from "../../components/web-column.tsx"
import { useTranslation } from "../../hooks/use-translation.ts"
import { fontSize, fontWeight } from "../../theme/tokens.ts"
import { paymentMethodIcon } from "../shared/payment-method-display.ts"

/**
 * The pieces the payment and bill lists share, so the two activity tabs read
 * the same way, as web's `activity-row.tsx`: each day is a `VerticalNav`
 * card titled with the day and its total; a row has its status icon, the
 * title over a muted details line with the settling methods' icons, the
 * issue badges, and the amount over its status label.
 */

export function ActivityIssueBadges({
  issues,
}: {
  readonly issues: ReadonlyArray<string>
}) {
  if (issues.length === 0) return null
  return (
    <XStack flexWrap="wrap" gap={4}>
      {issues.map((issue) => (
        <Badge
          key={issue}
          icon={TriangleAlert}
          bg="warning-10"
          labelColor="warning"
          label={issue}
        />
      ))}
    </XStack>
  )
}

export function PaymentMethodIcons({
  kinds,
}: {
  readonly kinds: ReadonlyArray<AccountTransactionKind>
}) {
  const { t } = useTranslation()
  if (kinds.length === 0) return null
  return (
    <XStack items="center" gap={4}>
      {Array.from(new Set(kinds), (kind) => (
        <View key={kind} accessible aria-label={t(paymentMethodLabelKey[kind])}>
          <Icon
            icon={paymentMethodIcon[kind]}
            size={14}
            color="muted-foreground"
          />
        </View>
      ))}
    </XStack>
  )
}

/** The row's right column: the amount, bold, over its status label. */
export function ActivityAmount({
  amount,
  isVoid,
  statusLabel,
}: {
  readonly amount: string
  /** Struck through: money that never arrived and never will. */
  readonly isVoid: boolean
  readonly statusLabel: string
}) {
  return (
    <YStack items="flex-end" gap={4}>
      <Text
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
        fontWeight={fontWeight.semibold}
        fontVariant={["tabular-nums"]}
        color={isVoid ? "muted-foreground" : "color"}
        textDecorationLine={isVoid ? "line-through" : "none"}
      >
        {amount}
      </Text>
      <Text
        fontSize={fontSize.xs}
        lineHeight={fontSize.xs}
        fontWeight={fontWeight.medium}
        color="muted-foreground"
      >
        {statusLabel}
      </Text>
    </YStack>
  )
}

export interface ActivityRowData {
  readonly id: string
  /** Already translated or user-entered. */
  readonly title: string
  /** Time, table, tip: the parts of the muted details line. */
  readonly details: ReadonlyArray<string>
  readonly methodKinds: ReadonlyArray<AccountTransactionKind>
  readonly issues: ReadonlyArray<string>
  /** A badge under the details, such as the refund badge. */
  readonly extra?: ReactNode
  readonly statusIcon: ReactNode
  readonly amount: string
  readonly isVoid: boolean
  readonly statusLabel: string
  readonly href: Href
}

export interface ActivityGroup {
  readonly key: string
  /** The day heading with its total. */
  readonly title: string
  readonly rows: ReadonlyArray<ActivityRowData>
}

/** One day card: web's per-day `VerticalNav` of activity rows. */
function ActivityDay({ group }: { readonly group: ActivityGroup }) {
  return (
    <VerticalNav
      title={group.title}
      items={group.rows.map((row) => ({
        id: row.id,
        kind: "link" as const,
        href: row.href,
        accessibilityLabel: `${row.title}, ${row.amount}, ${row.statusLabel}`,
        stripeColor: row.issues.length > 0 ? ("warning" as const) : undefined,
        icon: <View p={8}>{row.statusIcon}</View>,
        label: (
          <YStack w="100%" gap={4} items="flex-start">
            <Text fontWeight={fontWeight.bold} numberOfLines={1}>
              {row.title}
            </Text>
            <XStack flexWrap="wrap" items="center" gap={8}>
              <Text
                fontSize={fontSize.xs}
                lineHeight={fontSize.xs}
                color="muted-foreground"
              >
                {row.details.join(" · ")}
              </Text>
              <PaymentMethodIcons kinds={row.methodKinds} />
            </XStack>
            <ActivityIssueBadges issues={row.issues} />
            {row.extra}
          </YStack>
        ),
        action: (
          <ActivityAmount
            amount={row.amount}
            isVoid={row.isVoid}
            statusLabel={row.statusLabel}
          />
        ),
      }))}
    />
  )
}

/**
 * Day-grouped, paginated list (`useInfinitePages`) as one `FlatList` of day
 * cards with stable keys, so live updates move rows instead of remounting
 * the list. An empty history is the titled card with web's empty state.
 * It starts below `ActivityLayout`'s header and tabs and scrolls them away
 * with it (`ScrollAwayHeader`).
 */
export function ActivityList({
  groups,
  emptyListTitle,
  emptyTitle,
  emptyDescription,
  hasMore,
  isPending,
  loadMore,
}: {
  readonly groups: ReadonlyArray<ActivityGroup>
  /** The card title of the empty list, e.g. "Payments". */
  readonly emptyListTitle: string
  readonly emptyTitle: string
  readonly emptyDescription: string
  readonly hasMore: boolean
  readonly isPending: boolean
  readonly loadMore: () => void
}) {
  const headerInset = useScrollAwayHeaderInset()
  const scrollY = useScreenScroll()
  const column = useColumnScroll()
  return (
    <Animated.FlatList
      style={[{ flex: 1 }, column.style]}
      contentContainerStyle={{
        gap: 16,
        // Padded inside the scroll, so the list and its scrollbar span the
        // screen's full width.
        padding: screenPadding,
        paddingTop: headerInset ?? screenPadding,
        paddingHorizontal: screenPaddingX + column.padding,
      }}
      scrollEventThrottle={16}
      onScroll={
        scrollY === null
          ? undefined
          : Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true }
            )
      }
      data={groups}
      keyExtractor={(group) => group.key}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (hasMore && !isPending) loadMore()
      }}
      ListEmptyComponent={
        <VerticalNav
          title={emptyListTitle}
          items={[]}
          empty={
            <YStack items="center" gap={32} py={40} w="100%">
              <Icon icon={Receipt} size={40} color="muted-foreground" />
              <Text fontSize={fontSize.lg} lineHeight={fontSize.lg}>
                {emptyTitle}
              </Text>
              <Text
                fontSize={fontSize.sm}
                lineHeight={fontSize.sm}
                color="muted-foreground"
                text="center"
              >
                {emptyDescription}
              </Text>
            </YStack>
          }
        />
      }
      ListFooterComponent={
        hasMore && isPending ? <ListSkeleton rows={5} /> : undefined
      }
      renderItem={({ item }) => <ActivityDay group={item} />}
    />
  )
}
