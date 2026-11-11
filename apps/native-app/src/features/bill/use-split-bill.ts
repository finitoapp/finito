import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  type SplitBillConfirmInput,
  splitNeedsDiscard,
} from "@payky/app-shared/split-selection"
import {
  type SplitBillError,
  splitBill,
  splitBillIntoNewBill,
} from "@payky/core/modules/bill/bill-actions"
import {
  type BillId,
  createRandomBillId,
} from "@payky/core/modules/bill/bill-types"
import type { FiatCurrency } from "@payky/core/modules/shared/schema"
import type { TableId } from "@payky/core/modules/table/table-types"
import { router } from "expo-router"
import { useAtomValue } from "jotai"
import { useRef, useState } from "react"
import { accountAtom } from "../../atoms/account.ts"
import { nativeConsole } from "../../core/native-runtime.ts"
import { useRequirePermission } from "../../core/use-access.ts"
import { useAppRun } from "../../hooks/use-app-run.ts"
import { useToast } from "../../hooks/use-toast.ts"
import { useTranslation } from "../../hooks/use-translation.ts"

const splitBillErrorKeys = {
  BillNotFound: "bill.split.error",
  BillStatusNotAllowed: "bill.split.error",
  BillLocked: "bill.locked",
  // The selection no longer matches the bill: retrying the same one cannot work.
  BillSplitSelectionStale: "bill.split.staleSelection",
  // Moving lines off a partly paid bill cannot take it below what was paid.
  BillTotalBelowPaid: "bill.totalBelowPaid",
  // A bill left with lines below zero could only be discarded (payment/0015).
  BillSplitTotalNegative: "bill.split.totalNegative",
  // The screens never offer the bill itself as the target.
  BillSplitSameBill: "bill.split.error",
} satisfies Record<SplitBillError["type"], TranslationKey>

/**
 * Runs a confirmed split, as web's `handleConfirmSplit`: a new bill is always
 * followed (it needs a table and a charge), an existing target only when the
 * source emptied out and was canceled. `replace` so Back reaches the floor
 * rather than a bill that may no longer be open. The page's `sell` covers a
 * split; moving a discount asks for `discard` too (access/0012), as on web.
 */
export function useSplitBill({
  billId,
  tableId,
  currency,
  onDone,
}: {
  readonly billId: BillId
  readonly tableId: TableId | null
  readonly currency: FiatCurrency
  /** Called when the split applied, to close the dialog. */
  readonly onDone: () => void
}) {
  const appRun = useAppRun()
  const { device } = useAtomValue(accountAtom)
  const toast = useToast()
  const { t } = useTranslation()
  const { require } = useRequirePermission()
  // The ref closes the window before `pending` re-renders: a double tap would
  // otherwise run the split twice.
  const pendingRef = useRef(false)
  const [pending, setPending] = useState(false)

  const fail = (error: SplitBillError) => {
    nativeConsole.error("Failed to split bill", error)
    toast.error(t(splitBillErrorKeys[error.type]))
  }

  const split = async (input: SplitBillConfirmInput) => {
    if (pendingRef.current) return
    pendingRef.current = true
    setPending(true)
    try {
      if (
        splitNeedsDiscard(input.items) &&
        !(await require("discard", "access.action.moveDiscount"))
      ) {
        return
      }
      await using run = appRun()

      if (input.destination === "new") {
        const newBillId = createRandomBillId()
        const result = await run(
          splitBillIntoNewBill({
            sourceBillId: billId,
            targetBillId: newBillId,
            deviceId: device.id,
            tableId,
            currency,
            items: input.items,
          })
        )
        if (!result.ok) return fail(result.error)

        onDone()
        router.replace({ pathname: "/bill", params: { billId: newBillId } })
        return
      }

      const result = await run(
        splitBill({
          sourceBillId: billId,
          targetBillId: input.targetBillId,
          items: input.items,
        })
      )
      if (!result.ok) return fail(result.error)

      onDone()
      if (result.value.sourceCanceled)
        router.replace({
          pathname: "/bill",
          params: { billId: input.targetBillId },
        })
    } catch (error) {
      nativeConsole.error("Split bill crashed", error)
      toast.error(t("app.saveFailed"))
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  return { split, pending }
}
