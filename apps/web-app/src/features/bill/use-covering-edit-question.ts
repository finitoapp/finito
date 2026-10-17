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
    change: "edit" | "split"
  ): Promise<BillEditOutcome | null> => {
    await using run = appRun()
    const result = await run(loadBillEditOutcome(billId, lines))
    if (!result.ok) return staysOpen
    const outcome = result.value
    if (outcome.type === "staysOpen") return outcome
    if (change === "split" && outcome.type === "overpaid") return outcome

    const confirmed = await confirm({
      title:
        outcome.type === "paid"
          ? t("bill.cover.paid.title")
          : t("bill.cover.overpaid.title", {
              amount: formatMoney(
                { value: outcome.unresolved, currency },
                locale
              ),
            }),
      description:
        change === "split"
          ? t("bill.cover.split.description")
          : outcome.type === "paid"
            ? t("bill.cover.paid.description")
            : t("bill.cover.overpaid.description"),
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
