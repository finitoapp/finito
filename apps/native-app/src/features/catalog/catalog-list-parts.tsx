import type { Query, QueryRows, Row } from "@evolu/common"
import type { EvoluSchema } from "@payky/core/evolu/schema"
import type { Href } from "expo-router"
import type { LucideIcon } from "lucide-react-native"
import Plus from "lucide-react-native/icons/plus"
import { type ReactNode, Suspense } from "react"
import { ActivityIndicator, FlatList } from "react-native"
import { Text, useTheme, XStack, YStack } from "tamagui"
import { FadeHeader } from "../../components/fade-header.tsx"
import { LoadingView } from "../../components/loading-view.tsx"
import { SafeAreaView } from "../../components/safe-area-view.tsx"
import { screenPaddingX } from "../../components/screen.tsx"
import { Button } from "../../components/ui/button.tsx"
import { Icon } from "../../components/ui/icon.tsx"
import {
  VerticalNav,
  type VerticalNavItem,
  VerticalNavRow,
} from "../../components/vertical-nav.tsx"
import { useInfiniteEvoluQuery } from "../../hooks/use-infinite-evolu-query.ts"
import { useOpenDetail } from "../../hooks/use-open-detail.ts"

/**
 * The frame every catalog list screen shares, as web's `CatalogListPage`: a
 * title, a "+" to the create route, and a non-scrolling body so the list
 * inside can be a virtualized `FlatList`, under Back: the items and tables
 * lists sit under Settings (navigation/0004). `addLabel` is already
 * translated.
 */
export function CatalogListShell({
  title,
  addLabel,
  addHref,
  children,
}: {
  readonly title: string
  readonly addLabel: string
  readonly addHref?: Href
  readonly children: ReactNode
}) {
  const theme = useTheme()
  // Beside a form on a wide window the "+" replaces it (navigation/0002).
  const openDetail = useOpenDetail()
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
        title={title}
        endAddon={
          addHref === undefined ? null : (
            <Button
              variant="ghost"
              size="default"
              aria-label={addLabel}
              onPress={() => openDetail(addHref)}
            >
              <Icon icon={Plus} size={20} color="primary" strokeWidth={3} />
            </Button>
          )
        }
      />
      <Suspense fallback={<LoadingView />}>{children}</Suspense>
    </SafeAreaView>
  )
}

/** What a list row shows; every text is already translated. */
export interface CatalogListRowData {
  readonly id: string
  readonly title: string
  readonly subtitle?: string | undefined
  readonly trailing?: string | undefined
  readonly badge?: ReactNode
  /** The edit screen the row opens. */
  readonly href?: Href | undefined
}

function toVerticalNavItem(
  row: CatalogListRowData,
  icon: LucideIcon
): VerticalNavItem {
  const titleText = (
    <Text fontWeight="600" numberOfLines={1}>
      {row.title}
    </Text>
  )
  const label = (
    // No flex={1}: it would grow to the row's height and, wrapping, pack
    // a one-line label at the top instead of the row's center.
    <XStack
      minW={0}
      flexWrap="wrap"
      items="center"
      justify="space-between"
      gap={8}
    >
      <YStack flex={1} minW={0} gap={4}>
        {row.badge === undefined ? (
          titleText
        ) : (
          <XStack flexWrap="wrap" items="center" columnGap={8} rowGap={4}>
            {titleText}
            {row.badge}
          </XStack>
        )}
        {row.subtitle === undefined ? null : (
          <Text fontSize={13} color="muted-foreground" numberOfLines={1}>
            {row.subtitle}
          </Text>
        )}
      </YStack>
      {row.trailing === undefined ? null : (
        <Text color="muted-foreground" numberOfLines={1}>
          {row.trailing}
        </Text>
      )}
    </XStack>
  )

  // Web's lucide icon without a size class: the 24 px default.
  const rowIcon = <Icon icon={icon} size={24} color="muted-foreground" />
  return row.href === undefined
    ? { kind: "static", id: row.id, icon: rowIcon, label, disableAction: true }
    : { kind: "link", id: row.id, href: row.href, icon: rowIcon, label }
}

/**
 * Paginated, virtualized list of a settings entity, as web's
 * `CatalogEntityList`: filtering runs in SQL inside `createPageQuery`, and
 * `deps` lists what it closes over. `hasAny` tells a screen with no records
 * (the pitch for the first one) from a search that matched nothing.
 */
export function CatalogEntityList<R extends Row>({
  deps,
  createPageQuery,
  renderRow,
  icon,
  hasAny,
  emptyTitle,
  emptyDescription,
  emptySearchLabel,
  scrollEnabled,
}: {
  readonly deps: readonly unknown[]
  readonly createPageQuery: (limit: number) => Query<EvoluSchema, R>
  readonly renderRow: (row: QueryRows<R>[number]) => CatalogListRowData
  /** Leads every row, as web's lists pass one icon per row. */
  readonly icon: LucideIcon
  readonly hasAny: boolean
  /** Already translated. */
  readonly emptyTitle: string
  readonly emptyDescription: string
  readonly emptySearchLabel: string
  readonly scrollEnabled?: boolean
}) {
  const { rows, hasMore, isPending, loadMore } = useInfiniteEvoluQuery(
    deps,
    createPageQuery
  )

  return (
    <VerticalNav items={[]} shrink>
      <FlatList
        // RN's ScrollView grows by default; the card ends with the last row.
        style={{ flexGrow: 0 }}
        scrollEnabled={scrollEnabled}
        keyboardShouldPersistTaps="handled"
        data={rows.map(renderRow)}
        keyExtractor={(row) => row.id}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (hasMore && !isPending) loadMore()
        }}
        ListEmptyComponent={
          hasAny ? (
            <Text color="muted-foreground" text="center" py="6">
              {emptySearchLabel}
            </Text>
          ) : (
            <YStack items="center" gap="2" py="6">
              <Text
                fontSize="lg"
                lineHeight="lg"
                fontWeight="700"
                text="center"
              >
                {emptyTitle}
              </Text>
              <Text color="muted-foreground" text="center">
                {emptyDescription}
              </Text>
            </YStack>
          )
        }
        ListFooterComponent={
          hasMore ? <ActivityIndicator style={{ padding: 16 }} /> : undefined
        }
        renderItem={({ item, index }) => (
          <VerticalNavRow
            item={toVerticalNavItem(item, icon)}
            first={index === 0}
          />
        )}
      />
    </VerticalNav>
  )
}
