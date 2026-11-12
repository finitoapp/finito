import {
  type OpenBillRow,
  openBillsQuery,
} from "@payky/core/modules/bill/bill-queries"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import {
  calculateBillLineSummaries,
  deriveBillSummaryStats,
} from "@payky/core/modules/bill-line/bill-line-utils"
import type { TableRow } from "@payky/core/modules/table/table"
import { tablesQuery } from "@payky/core/modules/table/table-queries"
import type { TableId } from "@payky/core/modules/table/table-types"
import Ban from "lucide-react-native/icons/ban"
import { type ReactNode, useMemo } from "react"
import { Pressable } from "react-native"
import { Text, View, YStack } from "tamagui"
import { TableTileShell } from "../../components/table-tile-shell.tsx"
import { Card } from "../../components/ui/card.tsx"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog.tsx"
import { Icon } from "../../components/ui/icon.tsx"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney } from "../../lib/format-money.ts"
import { fontSize, fontWeight } from "../../theme/tokens.ts"

/**
 * Table picker for the bill, as web's `AssignTableDialog`: every table as an
 * occupancy tile (free, this bill's current table, or held by other bills),
 * so staff see which tables are free before assigning one. Drawn as web's: a
 * dialog with a two-column grid, "no table" first as a card with a `Ban`
 * icon, each table a `TableTileShell`.
 */
export function AssignTableDialog({
  open,
  onClose,
  billId,
  currentTableId,
  onAssign,
}: {
  readonly open: boolean
  readonly onClose: () => void
  readonly billId: BillId
  readonly currentTableId: TableId | null
  readonly onAssign: (tableId: TableId | null) => void
}) {
  const { t } = useTranslation()
  const tables = useEvoluQuery(tablesQuery).data
  const openBills = useEvoluQuery(openBillsQuery).data

  // Excludes this bill's own row: its current table must not read as
  // "occupied by someone else" while it is the one being assigned.
  const otherBillsByTableId = useMemo(() => {
    const map = new Map<TableId, ReadonlyArray<OpenBillRow>>()
    for (const bill of openBills) {
      if (bill.tableId === null || bill.id === billId) continue
      map.set(bill.tableId, [...(map.get(bill.tableId) ?? []), bill])
    }
    return map
  }, [openBills, billId])
  const tiles: ReadonlyArray<ReactNode> = [
    <NoTableTile
      key="none"
      selected={currentTableId === null}
      onSelect={() => onAssign(null)}
    />,
    ...tables.map((table) => (
      <TableAssignmentTile
        key={table.id}
        table={table}
        bills={otherBillsByTableId.get(table.id) ?? []}
        selected={currentTableId === table.id}
        onSelect={() => onAssign(table.id)}
      />
    )),
  ]
  const rows = Array.from({ length: Math.ceil(tiles.length / 2) }, (_, row) =>
    tiles.slice(row * 2, row * 2 + 2)
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent closeLabel={t("dialog.close")}>
        <DialogHeader>
          <DialogTitle>{t("bill.table.dialog.title")}</DialogTitle>
        </DialogHeader>
        <YStack gap={8}>
          {rows.map((row, rowIndex) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
            <View key={rowIndex} flexDirection="row" gap={8}>
              {row.map((tile, cellIndex) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: cells are positional
                <View key={cellIndex} flex={1}>
                  {tile}
                </View>
              ))}
              {row.length === 1 ? <View flex={1} /> : null}
            </View>
          ))}
        </YStack>
      </DialogContent>
    </Dialog>
  )
}

function NoTableTile({
  selected,
  onSelect,
}: {
  readonly selected: boolean
  readonly onSelect: () => void
}) {
  const { t } = useTranslation()
  return (
    <Pressable
      role="button"
      aria-selected={selected}
      onPress={onSelect}
      style={{ flex: 1 }}
    >
      <Card
        flex={1}
        items="center"
        gap={8}
        p={16}
        bg={selected ? "accent" : "neutral-soft"}
      >
        <Icon icon={Ban} size={20} color="muted-foreground" />
        <Text
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          fontWeight={fontWeight.medium}
        >
          {t("bill.table.dialog.none")}
        </Text>
      </Card>
    </Pressable>
  )
}

function TableAssignmentTile({
  table,
  bills,
  selected,
  onSelect,
}: {
  readonly table: TableRow
  readonly bills: ReadonlyArray<OpenBillRow>
  readonly selected: boolean
  readonly onSelect: () => void
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const [onlyBill] = bills

  return (
    <Pressable
      role="button"
      aria-selected={selected}
      onPress={onSelect}
      style={{ flex: 1 }}
    >
      <TableTileShell
        inDialog
        name={table.name}
        subtitle={t("tables.seatCount", { value: table.seatCount })}
        occupied={bills.length > 0}
        selected={selected}
      >
        {onlyBill === undefined ? (
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            color="muted-foreground"
          >
            {t("tables.tile.free")}
          </Text>
        ) : bills.length === 1 ? (
          // Derived from the row's embedded lines/items: no query of its own.
          <OccupiedSummary bill={onlyBill} locale={locale} />
        ) : (
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            color="muted-foreground"
          >
            {t("tables.tile.multipleBills", { value: bills.length })}
          </Text>
        )}
      </TableTileShell>
    </Pressable>
  )
}

function OccupiedSummary({
  bill,
  locale,
}: {
  readonly bill: OpenBillRow
  readonly locale: string
}) {
  const { t } = useTranslation()
  const { itemCount, totalAmount } = useMemo(
    () =>
      deriveBillSummaryStats(
        calculateBillLineSummaries(bill.lines, bill.items)
      ),
    [bill]
  )
  return (
    <YStack gap={2}>
      <Text
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
        color="muted-foreground"
      >
        {t("bill.itemsCount", { value: itemCount })}
      </Text>
      <Text
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
        fontWeight={fontWeight.semibold}
      >
        {formatMoney({ value: totalAmount, currency: bill.currency }, locale)}
      </Text>
    </YStack>
  )
}
