import type { MenuOrderId } from "@payky/core/modules/menu-order/menu-order-types"
import type { TableId } from "@payky/core/modules/table/table-types"
import type { createTranslate } from "./i18n/translate.ts"

type Translate = ReturnType<typeof createTranslate>

/** Messages for orders not in `announced`; null, the first list, announces none. */
export const newMenuOrderAnnouncements = ({
  announced,
  orders,
  tables,
  t,
}: {
  readonly announced: ReadonlySet<MenuOrderId> | null
  readonly orders: ReadonlyArray<{
    readonly id: MenuOrderId
    readonly number: number
    readonly tableId: TableId | null
  }>
  readonly tables: ReadonlyArray<{
    readonly id: TableId
    readonly name: string
  }>
  readonly t: Translate
}): ReadonlyArray<string> => {
  if (announced === null) return []
  const tableNames = new Map(tables.map(({ id, name }) => [id, name]))
  return orders
    .filter(({ id }) => !announced.has(id))
    .map((order) => {
      const table =
        order.tableId === null ? undefined : tableNames.get(order.tableId)
      return table === undefined
        ? t("orders.announced.noTable", { number: order.number })
        : t("orders.announced", { number: order.number, table })
    })
}
