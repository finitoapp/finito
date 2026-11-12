import type { MenuOrderId } from "@payky/core/modules/menu-order/menu-order-types"
import {
  type WrittenOrderColumns,
  writtenOrderOf,
} from "@payky/core/modules/menu-order/menu-order-utils"
import type { Money } from "@payky/core/modules/shared/money"
import type { TimestampMs } from "@payky/core/modules/shared/schema"
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

export const toServeOrderMoney = (
  {
    isFullyPaid,
    paid,
    total,
  }: {
    readonly isFullyPaid: boolean
    readonly paid: Money
    readonly total: Money
  },
  t: Translate,
  formatMoney: FormatMoney
): string =>
  isFullyPaid
    ? formatMoney(total)
    : t("orders.paidOf", {
        paid: formatMoney(paid),
        total: formatMoney(total),
      })

export const waitingMenuOrdersNotice = ({
  orders,
  tables,
  t,
  formatMoney,
}: {
  readonly orders: ReadonlyArray<
    WrittenOrderColumns & {
      readonly id: MenuOrderId
      readonly number: number
      readonly tableId: TableId | null
      readonly acceptedAt: TimestampMs | null
    }
  >
  readonly tables: ReadonlyArray<{
    readonly id: TableId
    readonly name: string
  }>
  readonly t: Translate
  readonly formatMoney: FormatMoney
}): string | null => {
  const waiting = orders.filter(({ acceptedAt }) => acceptedAt === null)
  const [order] = waiting
  if (order === undefined) return null
  if (waiting.length > 1) return t("orders.waiting", { count: waiting.length })

  const table =
    order.tableId === null
      ? undefined
      : tables.find(({ id }) => id === order.tableId)?.name
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
}
