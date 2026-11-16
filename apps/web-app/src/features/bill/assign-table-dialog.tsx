import {
  type OpenBillRow,
  openBillsQuery,
} from "@payky/core/modules/bill/bill-queries"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import type { TableRow } from "@payky/core/modules/table/table"
import { tablesQuery } from "@payky/core/modules/table/table-queries"
import type { TableId } from "@payky/core/modules/table/table-types"
import { Ban } from "lucide-react"
import { useMemo } from "react"
import { Card } from "@/components/ui/card.tsx"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx"
import {
  OccupiedTableSummary,
  TableTileShell,
} from "@/features/shared/table-tile.tsx"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { cn } from "@/lib/utils.ts"

const tileButtonClassName =
  "block rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

/**
 * Table picker for the bill page. Shows every table as an occupancy tile
 * (free / this bill's own current table / occupied by another bill), the
 * same visual the tables overview uses, so staff can see at a glance which
 * tables are actually free before assigning one.
 */
export function AssignTableDialog({
  open,
  onOpenChange,
  billId,
  currentTableId,
  onAssign,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly billId: BillId | undefined
  readonly currentTableId: TableId | null
  readonly onAssign: (tableId: TableId | null) => void
}) {
  const { t } = useTranslation()
  const { data: tables } = useEvoluQuery(tablesQuery)
  const { data: openBills } = useEvoluQuery(openBillsQuery)

  // Excludes this bill's own row: its current table shouldn't read as
  // "occupied by someone else" while you're the one assigning it.
  const otherBillsByTableId = useMemo(() => {
    const map = new Map<TableId, ReadonlyArray<OpenBillRow>>()
    for (const bill of openBills) {
      if (bill.tableId === null || bill.id === billId) continue
      map.set(bill.tableId, [...(map.get(bill.tableId) ?? []), bill])
    }
    return map
  }, [openBills, billId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("bill.table.dialog.title")}</DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto pb-1">
          <button
            type="button"
            onClick={() => onAssign(null)}
            className={tileButtonClassName}
          >
            <Card
              className={cn(
                "items-center gap-2 p-4 text-center",
                currentTableId === null &&
                  "ring-2 ring-primary ring-offset-2 ring-offset-background"
              )}
            >
              <Ban className="mx-auto size-5 text-muted-foreground" />
              <p className="text-sm font-medium">
                {t("bill.table.dialog.none")}
              </p>
            </Card>
          </button>
          {tables.map((table) => (
            <TableAssignmentTile
              key={table.id}
              table={table}
              bills={otherBillsByTableId.get(table.id) ?? []}
              selected={currentTableId === table.id}
              onSelect={() => onAssign(table.id)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
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
  const subtitle =
    table.seatCount === null
      ? undefined
      : t("tables.seatCount", { value: table.seatCount })

  if (bills.length === 0) {
    return (
      <button type="button" onClick={onSelect} className={tileButtonClassName}>
        <TableTileShell
          name={table.name}
          subtitle={subtitle}
          occupied={false}
          selected={selected}
        >
          <p className="text-sm text-muted-foreground">
            {t("tables.tile.free")}
          </p>
        </TableTileShell>
      </button>
    )
  }

  if (bills.length === 1) {
    const [bill] = bills
    if (bill === undefined) return null

    return (
      <button type="button" onClick={onSelect} className={tileButtonClassName}>
        <TableTileShell
          name={table.name}
          subtitle={subtitle}
          occupied
          selected={selected}
        >
          {/*
           * No Suspense boundary: `OccupiedTableSummary` derives its count
           * and total from the `openBillsQuery` row this dialog already
           * loaded, so it opens no query of its own and cannot suspend. It
           * used to, and a first-time load bubbling to the route boundary
           * remounted `BillPage`/`BillCartView` — closing the picker and
           * taking the search text, scan mode, summary sheet and undo/redo
           * history with it.
           */}
          <OccupiedTableSummary bill={bill} />
        </TableTileShell>
      </button>
    )
  }

  return (
    <button type="button" onClick={onSelect} className={tileButtonClassName}>
      <TableTileShell
        name={table.name}
        subtitle={subtitle}
        occupied
        selected={selected}
      >
        <p className="text-sm text-muted-foreground">
          {t("tables.tile.multipleBills", { value: bills.length })}
        </p>
      </TableTileShell>
    </button>
  )
}
