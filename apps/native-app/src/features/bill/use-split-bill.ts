import { splitBillErrorKeys } from "@payky/app-shared/bill-checkout"
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
