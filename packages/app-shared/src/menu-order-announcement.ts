import type { MenuOrderId } from "@payky/core/modules/menu-order/menu-order-types"
import {
  type WrittenOrderColumns,
  writtenOrderOf,
} from "@payky/core/modules/menu-order/menu-order-utils"
import type { Money } from "@payky/core/modules/shared/money"
import type { TableId } from "@payky/core/modules/table/table-types"
import type { createTranslate } from "./i18n/translate.ts"

type Translate = ReturnType<typeof createTranslate>
type FormatMoney = (money: Money) => string

const ANNOUNCED_TEXT_LENGTH = 60

const shortenForAnnouncement = (text: string): string => {
  const characters = [...text]
  return characters.length <= ANNOUNCED_TEXT_LENGTH
    ? text
    : `${characters.slice(0, ANNOUNCED_TEXT_LENGTH).join("")}…`
}

export const writtenOrderAmount = (
  { arrived, named }: { readonly arrived: Money; readonly named: Money },
  t: Translate,
  formatMoney: FormatMoney
): string =>
  arrived.value < named.value
    ? t("orders.written.arrivedOf", {
        arrived: formatMoney(arrived),
        named: formatMoney(named),
      })
    : formatMoney(arrived)

/** Messages for orders not in `announced`; null, the first list, announces none. */
export const newMenuOrderAnnouncements = ({
  announced,
  orders,
  tables,
  t,
  formatMoney,
}: {
  readonly announced: ReadonlySet<MenuOrderId> | null
  readonly orders: ReadonlyArray<
    WrittenOrderColumns & {
      readonly id: MenuOrderId
      readonly number: number
      readonly tableId: TableId | null
    }
  >
  readonly tables: ReadonlyArray<{
    readonly id: TableId
    readonly name: string
  }>
  readonly t: Translate
  readonly formatMoney: FormatMoney
}): ReadonlyArray<string> => {
  if (announced === null) return []
  const tableNames = new Map(tables.map(({ id, name }) => [id, name]))
  return orders
    .filter(({ id }) => !announced.has(id))
    .map((order) => {
      const table =
        order.tableId === null ? undefined : tableNames.get(order.tableId)
      const written = writtenOrderOf(order)
      if (written === null) {
        return table === undefined
          ? t("orders.announced.noTable", { number: order.number })
          : t("orders.announced", { number: order.number, table })
      }
      const params = {
        number: order.number,
        amount: writtenOrderAmount(written, t, formatMoney),
        text: shortenForAnnouncement(written.text),
      }
      return table === undefined
        ? t("orders.announced.written.noTable", params)
        : t("orders.announced.written", { ...params, table })
    })
}
