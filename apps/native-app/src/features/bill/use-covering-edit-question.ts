import {
  type BillChange,
  billEditQuestion,
} from "@payky/app-shared/bill-edit-question"
import type { CartLine } from "@payky/app-shared/cart-lines"
import {
  type BillEditOutcome,
  loadBillEditOutcome,
} from "@payky/core/modules/bill/bill-overpayment-guards"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import type { FiatCurrency } from "@payky/core/modules/shared/schema"
import { router } from "expo-router"
import { useAppRun } from "../../hooks/use-app-run.ts"
import { useConfirm } from "../../hooks/use-confirm.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney } from "../../lib/format-money.ts"

const staysOpen: BillEditOutcome = { type: "staysOpen" }

/** Web's `useCoveringEditQuestion`: asks before an edit pays or overpays the bill, and opens its detail after an overpaying one. */
export function useCoveringEditQuestion(currency: FiatCurrency) {
  const { t } = useTranslation()
  const locale = useLocale()
  const appRun = useAppRun()
  const confirm = useConfirm()

  const ask = async (
    billId: BillId,
    lines: ReadonlyArray<CartLine>,
    change: BillChange
  ): Promise<BillEditOutcome | null> => {
    await using run = appRun()
    const result = await run(loadBillEditOutcome(billId, lines))
    if (!result.ok) return staysOpen
    const { outcome, question } = billEditQuestion(result.value, change, {
      t,
      format: (value) => formatMoney({ value, currency }, locale),
      formatList: (items) =>
        typeof Intl.ListFormat === "function"
          ? new Intl.ListFormat(locale).format(items)
          : items.join(", "),
    })
    if (question === null) {
      return outcome
    }

    const confirmed = await confirm({
      ...question,
      confirmLabel: t("bill.cover.confirm"),
      cancelLabel: t("bill.cover.cancel"),
    })
    return confirmed ? outcome : null
  }

  const followUp = (billId: BillId, outcome: BillEditOutcome) => {
    if (outcome.type !== "overpaid") return
    router.replace({
      pathname: "/activity/bills/[billId]",
      params: { billId, afterEdit: "1" },
    })
  }

  return { ask, followUp }
}
