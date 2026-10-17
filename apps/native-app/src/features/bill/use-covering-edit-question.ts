import type { CartLine } from "@payky/app-shared/cart-lines"
import { formatMoney } from "@payky/app-shared/format-money"
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

  const followUp = (billId: BillId, outcome: BillEditOutcome) => {
    if (outcome.type !== "overpaid") return
    router.replace({
      pathname: "/activity/bills/[billId]",
      params: { billId, afterEdit: "1" },
    })
  }

  return { ask, followUp }
}
