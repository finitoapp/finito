import {
  type BillChange,
  guestPaidQuestion,
} from "@payky/app-shared/bill-edit-question"
import type { CartLine } from "@payky/app-shared/cart-lines"
import { loadGuestPaidRemoval } from "@payky/core/modules/bill/bill-overpayment-guards"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import type { FiatCurrency } from "@payky/core/modules/shared/schema"
import { useAppRun } from "../../hooks/use-app-run.ts"
import { useConfirm } from "../../hooks/use-confirm.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney } from "../../lib/format-money.ts"

/** Web's `useGuestPaidQuestion`: asks before an edit removes what guests paid for. */
export function useGuestPaidQuestion(currency: FiatCurrency) {
  const { t } = useTranslation()
  const locale = useLocale()
  const appRun = useAppRun()
  const confirm = useConfirm()

  return async (
    billId: BillId,
    lines: ReadonlyArray<CartLine>,
    change: BillChange
  ): Promise<boolean> => {
    if (!lines.some(({ kind }) => kind === "remove")) return true
    await using run = appRun()
    const result = await run(loadGuestPaidRemoval(billId, lines))
    if (!result.ok || result.value === null) return true

    return await confirm({
      ...guestPaidQuestion(result.value, change, {
        t,
        format: (value) => formatMoney({ value, currency }, locale),
        formatList: (items) =>
          typeof Intl.ListFormat === "function"
            ? new Intl.ListFormat(locale).format(items)
            : items.join(", "),
      }),
      confirmLabel: t("bill.guestPaid.confirm"),
      cancelLabel: t("bill.guestPaid.cancel"),
    })
  }
}
