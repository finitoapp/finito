import { derivePaymentDetailState } from "@payky/app-shared/activity-detail"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { useNow } from "@payky/app-shared/use-now"
import {
  type DeleteUnpaidPaymentError,
  deleteUnpaidPayment,
} from "@payky/core/modules/payment/payment-actions"
import {
  paymentDetailQuery,
  paymentReconciliationsQuery,
} from "@payky/core/modules/payment/payment-queries"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import { router } from "expo-router"
import Trash2 from "lucide-react-native/icons/trash"
import { useMemo, useState } from "react"
import { Button } from "../../components/ui/button.tsx"
import { useRequirePermission } from "../../core/use-access.ts"
import { useConfirm } from "../../hooks/use-confirm.ts"
import {
  useEvoluQuery,
  usePreloadEvoluQueries,
} from "../../hooks/use-evolu-query.ts"
import { useRunToast } from "../../hooks/use-run-toast.ts"
import { useTranslation } from "../../hooks/use-translation.ts"

const deletePaymentErrorKeys = {
  PaymentNotFound: "paymentDetail.delete.error.generic",
  PaymentAlreadyPaid: "paymentDetail.delete.error.notDeletable",
  PaymentNotDeletable: "paymentDetail.delete.error.notDeletable",
  PaymentAttemptOpen: "paymentDetail.delete.error.attemptOpen",
} satisfies Record<DeleteUnpaidPaymentError["type"], TranslationKey>

/**
 * The payment detail's trash button, for a payment `deleteUnpaidPayment`
 * takes (payment/0029); nothing otherwise. Deleting is `discard`, as
 * canceling is.
 */
export function PaymentDeleteButton({
  paymentId,
}: {
  readonly paymentId: PaymentId
}) {
  // The detail below starts the same queries with all of its own.
  usePreloadEvoluQueries(
    useMemo(
      () => [
        paymentDetailQuery(paymentId),
        paymentReconciliationsQuery(paymentId),
      ],
      [paymentId]
    )
  )
  const { t } = useTranslation()
  const confirm = useConfirm()
  const runToast = useRunToast()
  const { require } = useRequirePermission()
  const [pending, setPending] = useState(false)
  const [payment] = useEvoluQuery(paymentDetailQuery(paymentId)).data
  const reconciliations = useEvoluQuery(
    paymentReconciliationsQuery(paymentId)
  ).data
  const now = useNow([payment?.expiresAt ?? null])

  if (
    payment === undefined ||
    !derivePaymentDetailState({ payment, reconciliations, now }).canDelete
  )
    return null

  const handleDelete = async () => {
    if (!(await require("discard", "access.action.deletePayment"))) return
    const confirmed = await confirm({
      title: t("paymentDetail.delete.confirm.title"),
      description: t("paymentDetail.delete.confirm.description"),
      confirmLabel: t("paymentDetail.delete.confirm.confirm"),
      cancelLabel: t("paymentDetail.delete.confirm.cancel"),
      variant: "destructive",
    })
    if (!confirmed) return

    setPending(true)
    await runToast(async (run) => {
      const result = await run(deleteUnpaidPayment(paymentId))
      if (!result.ok) return deletePaymentErrorKeys[result.error.type]
      if (router.canGoBack()) router.back()
      else router.replace("/activity")
    })
    setPending(false)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      iconStart={Trash2}
      aria-label={t("paymentDetail.delete")}
      pending={pending}
      onPress={() => void handleDelete()}
    />
  )
}
