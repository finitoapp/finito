import { formatElapsed } from "@payky/app-shared/format-elapsed"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  type BillPaymentState,
  type BillWithStats,
  billPaymentState,
  buildBillRows,
  elapsedSeverity,
  formatRowsSum,
  groupBillRowsByTableId,
  matchesTableFilter,
  type TableFilter,
  TableFilterSchema,
  tablePaymentState,
} from "@payky/app-shared/pos-overview"
import { selfPaySettingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { offersOrders } from "@payky/core/modules/app-settings/app-settings-utils"
import type { OpenBillRow } from "@payky/core/modules/bill/bill-queries"
import { openBillsQuery } from "@payky/core/modules/bill/bill-queries"
import { createRandomBillId } from "@payky/core/modules/bill/bill-types"
import { menuOrdersToServeQuery } from "@payky/core/modules/menu-order/menu-order-queries"
import type { TableRow } from "@payky/core/modules/table/table"
import { tablesQuery } from "@payky/core/modules/table/table-queries"
import type { TableId } from "@payky/core/modules/table/table-types"
import { router, useFocusEffect } from "expo-router"
import { useAtom } from "jotai"
import type { LucideIcon } from "lucide-react-native"
import ChartPie from "lucide-react-native/icons/chart-pie"
import ChevronRight from "lucide-react-native/icons/chevron-right"
import Hourglass from "lucide-react-native/icons/hourglass"
import Plus from "lucide-react-native/icons/plus"
import Users from "lucide-react-native/icons/users"
import { useCallback, useEffect, useMemo, useState } from "react"
import { FlatList, Pressable, ScrollView, View } from "react-native"
import { Text, XStack, YStack } from "tamagui"
import { screenPaddingX } from "../../components/screen.tsx"
import { TableTileShell } from "../../components/table-tile-shell.tsx"
import { Button } from "../../components/ui/button.tsx"
import { Icon } from "../../components/ui/icon.tsx"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "../../components/ui/toggle-group.tsx"
import { useColumnScroll } from "../../components/web-column.tsx"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney } from "../../lib/format-money.ts"
import { viewStateAtom } from "../../platform/view-state-atom.ts"
import { fontSize, fontWeight, radius } from "../../theme/tokens.ts"

const tableFilterLabelKeys = {
  all: "home.pos.filter.all",
  occupied: "home.pos.filter.occupied",
  free: "home.pos.filter.free",
} as const satisfies Record<TableFilter, TranslationKey>

const elapsedColors = {
  normal: "muted-foreground",
  long: "warning",
  veryLong: "destructive",
} as const satisfies Record<ReturnType<typeof elapsedSeverity>, string>

const billPaymentStateIcons = {
  paymentPending: Hourglass,
  partiallyPaid: ChartPie,
} satisfies Record<BillPaymentState, LucideIcon>

type TFn = ReturnType<typeof useTranslation>["t"]

const billLabel = (bill: OpenBillRow, t: TFn) =>
  bill.label ?? t("bill.list.label", { number: bill.displayNumber })

/** Per-device view state under web's `localStorage` key, as web does. */
const tableFilterAtom = viewStateAtom<TableFilter>(
  "payky.posTableFilter",
  TableFilterSchema,
  "all"
)

const openBill = (billId: string) =>
  router.push({ pathname: "/bill", params: { billId } })

/**
 * The id is minted once per mounted button, as web's `NewBillLink`, so the
 * `/bill` URL is stable before the first tap and a bill left empty is
 * reopened rather than abandoned. Web's home unmounts behind the bill and
 * mints anew on return; native's stays mounted under the stack, so it mints
 * anew once the home loses focus — otherwise the next "New bill" reopened
 * the bill just charged.
 */
function useNewBill(tableId: TableId | undefined) {
  const [billId, setBillId] = useState(createRandomBillId)
  useFocusEffect(useCallback(() => () => setBillId(createRandomBillId()), []))
  return () =>
    router.push({
      pathname: "/bill",
      params: tableId === undefined ? { billId } : { billId, tableId },
    })
}

/**
 * Web's POS home screen, home's Sales mode (navigation/0004): floor
 * stats with a free/occupied filter, a "no table" strip that starts a quick
 * bill, and one tile per table.
 */
export function PosOverviewPage() {
  // Home's SafeAreaView pads the screen's sides.
  const column = useColumnScroll(screenPaddingX)
  const { t } = useTranslation()
  const locale = useLocale()
  const tables = useEvoluQuery(tablesQuery).data
  const openBills = useEvoluQuery(openBillsQuery).data
  const [tableFilter, setTableFilter] = useAtom(tableFilterAtom)
  // ponytail: 30 s tick, as web — an expired invoice's "paying" state can
  // outlive `expiresAt` by up to that.
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const rows = useMemo(() => buildBillRows(openBills), [openBills])
  const rowsByTableId = useMemo(
    () => groupBillRowsByTableId(rows, new Set(tables.map(({ id }) => id))),
    [rows, tables]
  )
  const tiles = tables.map((table) => ({
    table,
    rows: rowsByTableId.get(table.id) ?? [],
  }))
  const occupiedCount = tiles.filter((tile) => tile.rows.length > 0).length
  const visibleTiles = tiles.filter((tile) =>
    matchesTableFilter(tableFilter, tile.rows.length > 0)
  )
  const floorTotal = formatRowsSum(rows, "left", (money) =>
    formatMoney(money, locale)
  )

  return (
    <FlatList
      style={[{ flex: 1 }, column.style]}
      contentContainerStyle={{ paddingHorizontal: column.padding }}
      numColumns={2}
      data={visibleTiles}
      keyExtractor={(tile) => tile.table.id}
      ListHeaderComponent={
        <YStack gap={12} pb={8}>
          <XStack
            flexWrap="wrap"
            items="flex-end"
            justify="space-between"
            gap={12}
            px={4}
          >
            <XStack gap={24}>
              {tables.length > 0 && (
                <FloorStat
                  label={t("home.pos.stats.tables")}
                  value={`${occupiedCount} / ${tables.length}`}
                />
              )}
              <FloorStat
                label={t("home.pos.stats.bills")}
                value={rows.length}
              />
              {floorTotal !== undefined && (
                <FloorStat
                  label={t("home.pos.stats.total")}
                  value={floorTotal}
                />
              )}
            </XStack>
            {tables.length > 0 && (
              <ToggleGroup
                value={tableFilter}
                onValueChange={setTableFilter}
                variant="outline"
              >
                {TableFilterSchema.options.map((filter) => (
                  <ToggleGroupItem key={filter} value={filter} h={40} px={16}>
                    {t(tableFilterLabelKeys[filter])}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
          </XStack>
          <ToServeStrip />
          <NoTableStrip rows={rowsByTableId.get(null) ?? []} now={now} />
        </YStack>
      }
      ListEmptyComponent={
        tables.length === 0 ? (
          <Text
            px={4}
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            color="muted-foreground"
          >
            {`${t("home.pos.noTables")} `}
            <Text
              fontSize={fontSize.sm}
              lineHeight={fontSize.sm}
              fontWeight={fontWeight.medium}
              textDecorationLine="underline"
              role="link"
              cursor="web:pointer"
              onPress={() => router.push("/settings/tables")}
            >
              {t("home.pos.addTables")}
            </Text>
          </Text>
        ) : (
          <Text
            px={4}
            py={24}
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            color="muted-foreground"
            text="center"
          >
            {t(
              tableFilter === "free"
                ? "home.pos.noneFree"
                : "home.pos.noneOccupied"
            )}
          </Text>
        )
      }
      renderItem={({ item }) => (
        <View style={{ width: "50%", padding: 4 }}>
          <TableTile table={item.table} rows={item.rows} now={now} />
        </View>
      )}
    />
  )
}

function FloorStat({
  label,
  value,
}: {
  readonly label: string
  readonly value: string | number
}) {
  return (
    <YStack>
      <Text
        fontSize={fontSize.xs}
        lineHeight={fontSize.xs}
        color="muted-foreground"
      >
        {label}
      </Text>
      <Text
        fontSize={fontSize.lg}
        lineHeight={fontSize.lg}
        fontWeight={fontWeight.semibold}
        fontVariant={["tabular-nums"]}
      >
        {value}
      </Text>
    </YStack>
  )
}

function ToServeStrip() {
  const { t } = useTranslation()
  const [settings] = useEvoluQuery(selfPaySettingsQuery).data
  const orders = useEvoluQuery(menuOrdersToServeQuery).data

  if (!offersOrders(settings) && orders.length === 0) return null

  return (
    <Pressable role="link" onPress={() => router.push("/orders")}>
      <XStack
        items="center"
        gap={12}
        p={12}
        pl={16}
        rounded={radius.xl}
        borderWidth={1}
        borderColor="card-ring"
        bg="card"
      >
        <Text
          flex={1}
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          fontWeight={fontWeight.semibold}
        >
          {t("nav.orders")}
        </Text>
        <Text
          fontSize={fontSize.lg}
          lineHeight={fontSize.lg}
          fontWeight={fontWeight.semibold}
          fontVariant={["tabular-nums"]}
        >
          {orders.length}
        </Text>
        <Icon icon={ChevronRight} size={16} color="muted-foreground" />
      </XStack>
    </Pressable>
  )
}

/** The open bills on no table, and the quick bill that starts another. */
function NoTableStrip({
  rows,
  now,
}: {
  readonly rows: ReadonlyArray<BillWithStats>
  readonly now: number
}) {
  const { t } = useTranslation()
  const newBill = useNewBill(undefined)

  return (
    <XStack
      testID="no-table-tile"
      items="center"
      gap={12}
      p={8}
      pl={16}
      rounded={radius.xl}
      bg="card"
    >
      <Text
        shrink={0}
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
        fontWeight={fontWeight.semibold}
      >
        {t("bill.table.dialog.none")}
      </Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        {rows.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <XStack gap={6}>
              {rows.map((row) => (
                <BillChip key={row.bill.id} {...row} now={now} />
              ))}
            </XStack>
          </ScrollView>
        ) : (
          <Text
            numberOfLines={1}
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            color="muted-foreground"
          >
            {t("home.pos.noTable.empty")}
          </Text>
        )}
      </View>
      <Button
        size="lg"
        h={44}
        minH={44}
        shrink={0}
        iconStart={Plus}
        label={t("tables.tile.newBill")}
        onPress={newBill}
      />
    </XStack>
  )
}

/**
 * One table: its name, then on an occupied one the running total, how long it
 * has been open, the pieces and where payment stands. A free tile starts a
 * bill anywhere it is tapped and a tile with one bill opens it; with several,
 * each is a chip. The "+" starts another bill on the same table (a split check).
 */
function TableTile({
  table,
  rows,
  now,
}: {
  readonly table: TableRow
  readonly rows: ReadonlyArray<BillWithStats>
  readonly now: number
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const newBill = useNewBill(table.id)
  const occupied = rows.length > 0
  const onlyBill = rows.length === 1 ? rows[0]?.bill : undefined
  const left = formatRowsSum(rows, "left", (money) =>
    formatMoney(money, locale)
  )
  const isPartlyPaid = rows.some(({ paid }) => paid > 0)
  const paid = isPartlyPaid
    ? formatRowsSum(rows, "paid", (money) => formatMoney(money, locale))
    : undefined
  const elapsedMs =
    now -
    Math.min(...rows.map(({ bill }) => new Date(bill.createdAt).getTime()))
  const itemCount = rows.reduce((sum, { stats }) => sum + stats.itemCount, 0)
  const paymentState = tablePaymentState(rows, now)

  const tile = (
    <TableTileShell
      name={table.name}
      occupied={occupied}
      attention={paymentState !== undefined}
      // A minimum, not a fixed height: a row grows together when one tile
      // lists several bills.
      minH={144}
      justify="space-between"
      gap={8}
      icon={
        occupied ? (
          <Button
            variant="ghost"
            size="icon-lg"
            m={-6}
            rounded={radius.full}
            bg="background-60 press:background"
            iconStart={Plus}
            aria-label={t("tables.tile.newBill")}
            onPress={newBill}
          />
        ) : (
          <Icon icon={Plus} size={20} color="muted-foreground" />
        )
      }
    >
      {rows.length > 1 && (
        // flexShrink 0: React Native Web's ScrollView shrinks in a column
        // when the tile is short, down to a few pixels.
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
        >
          <XStack gap={6}>
            {rows.map((row) => (
              <BillChip
                key={row.bill.id}
                {...row}
                now={now}
                showElapsed={false}
              />
            ))}
          </XStack>
        </ScrollView>
      )}
      <YStack gap={2}>
        {left !== undefined && (
          <Text
            fontSize={fontSize.xl}
            lineHeight={fontSize.xl}
            fontWeight={fontWeight.bold}
            fontVariant={["tabular-nums"]}
            numberOfLines={isPartlyPaid ? 2 : 1}
          >
            {isPartlyPaid ? t("tables.tile.left", { amount: left }) : left}
          </Text>
        )}
        {occupied ? (
          <XStack gap={6} flexWrap="wrap" items="center">
            <Text
              fontSize={fontSize.sm}
              lineHeight={fontSize.sm}
              color={elapsedColors[elapsedSeverity(elapsedMs)]}
            >
              {formatElapsed(elapsedMs, locale)}
            </Text>
            <Text
              fontSize={fontSize.sm}
              lineHeight={fontSize.sm}
              color="muted-foreground"
            >
              {t("tables.tile.itemCount", { value: itemCount })}
            </Text>
            {paymentState !== undefined && (
              <BillPaymentStateBadge
                paymentState={paymentState}
                paid={paymentState === "partiallyPaid" ? paid : undefined}
              />
            )}
          </XStack>
        ) : (
          <XStack gap={6} items="center">
            <Text
              fontSize={fontSize.sm}
              lineHeight={fontSize.sm}
              color="muted-foreground"
            >
              {t("tables.tile.free")}
            </Text>
            <XStack
              gap={2}
              items="center"
              accessible
              aria-label={t("tables.seatCount", {
                value: table.seatCount,
              })}
            >
              <Icon icon={Users} size={14} color="muted-foreground" />
              <Text
                fontSize={fontSize.sm}
                lineHeight={fontSize.sm}
                color="muted-foreground"
              >
                {table.seatCount}
              </Text>
            </XStack>
          </XStack>
        )}
      </YStack>
    </TableTileShell>
  )

  // A tile with several bills has no single target: its chips and "+" act.
  const onPress = !occupied
    ? newBill
    : onlyBill === undefined
      ? undefined
      : () => openBill(onlyBill.id)

  return (
    <View style={{ flex: 1 }} testID="table-tile">
      {onPress === undefined ? (
        tile
      ) : (
        <Pressable
          role="button"
          aria-label={
            onlyBill === undefined
              ? t("tables.tile.newBill")
              : billLabel(onlyBill, t)
          }
          onPress={onPress}
          style={{ flex: 1 }}
        >
          {tile}
        </Pressable>
      )}
    </View>
  )
}

function BillPaymentStateBadge({
  paymentState,
  paid,
}: {
  readonly paymentState: BillPaymentState
  readonly paid?: string | undefined
}) {
  const { t } = useTranslation()
  return (
    <XStack items="center" gap={4} rounded={radius.sm} bg="info-15" px={4}>
      <Icon
        icon={billPaymentStateIcons[paymentState]}
        size={14}
        color="info-foreground"
      />
      <Text
        fontSize={fontSize.xs}
        lineHeight={fontSize.xs}
        fontWeight={fontWeight.semibold}
        color="info-foreground"
      >
        {paid === undefined
          ? t(`tables.tile.${paymentState}`)
          : t("tables.tile.partiallyPaidAmount", { amount: paid })}
      </Text>
    </XStack>
  )
}

/**
 * One open bill as a chip: what is left to pay on it and, off a table, how
 * long it has been open, and its label when it has one.
 */
function BillChip({
  bill,
  left,
  now,
  showElapsed = true,
}: BillWithStats & {
  readonly now: number
  readonly showElapsed?: boolean
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const elapsedMs = now - new Date(bill.createdAt).getTime()
  const paymentState = billPaymentState(bill, now)

  return (
    <Pressable
      role="button"
      aria-label={
        paymentState === undefined
          ? billLabel(bill, t)
          : t("tables.tile.billWithState", {
              label: billLabel(bill, t),
              state: t(`tables.tile.${paymentState}`),
            })
      }
      onPress={() => openBill(bill.id)}
      style={{ minHeight: 44, justifyContent: "center" }}
    >
      <XStack
        items="center"
        gap={6}
        h={36}
        px={10}
        rounded={radius.lg}
        bg="background-70"
      >
        {paymentState !== undefined && (
          <Icon icon={billPaymentStateIcons[paymentState]} color="info" />
        )}
        {bill.label !== null && (
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            color="muted-foreground"
            numberOfLines={1}
            maxW={96}
          >
            {bill.label}
          </Text>
        )}
        <Text
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          fontWeight={fontWeight.semibold}
          fontVariant={["tabular-nums"]}
        >
          {formatMoney({ value: left, currency: bill.currency }, locale)}
        </Text>
        {showElapsed && (
          <Text
            color={elapsedColors[elapsedSeverity(elapsedMs)]}
            fontSize={fontSize.xs}
            lineHeight={fontSize.xs}
            fontVariant={["tabular-nums"]}
          >
            {formatElapsed(elapsedMs, locale)}
          </Text>
        )}
      </XStack>
    </Pressable>
  )
}
