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
import { useNavigate } from "@tanstack/react-router"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog.ts"
import { useLocale } from "@/hooks/use-locale.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatMoney } from "@/lib/format-utils.ts"

const staysOpen: BillEditOutcome = { type: "staysOpen" }

export function useCoveringEditQuestion(currency: FiatCurrency) {
  const { t } = useTranslation()
  const locale = useLocale()
  const appRun = useAppRun()
  const confirm = useConfirmDialog()
  const navigate = useNavigate()

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
      formatList: (items) => new Intl.ListFormat(locale).format(items),
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

  const followUp = async (billId: BillId, outcome: BillEditOutcome) => {
    if (outcome.type !== "overpaid") return
    await navigate({
      to: "/activity/bills/$billId",
      params: { billId },
      search: { afterEdit: true },
      replace: true,
    })
  }

  return { ask, followUp }
}
