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
import { useNavigate, useRouter } from "@tanstack/react-router"
import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button.tsx"
import { useRequirePermission } from "@/hooks/use-access.ts"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog.ts"
import {
  useEvoluQuery,
  usePreloadEvoluQueries,
} from "@/hooks/use-evolu-query.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

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
  usePreloadEvoluQueries([
    paymentDetailQuery(paymentId),
    paymentReconciliationsQuery(paymentId),
  ])
  const { t } = useTranslation()
  const confirm = useConfirmDialog()
  const runToast = useRunToast()
  const { require } = useRequirePermission()
  const navigate = useNavigate()
  const router = useRouter()
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
      if (router.history.canGoBack()) router.history.back()
      else await navigate({ to: "/activity" })
    })
    setPending(false)
  }

  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={t("paymentDetail.delete")}
      disabled={pending}
      onClick={() => void handleDelete()}
    >
      <Trash2Icon className="size-5" />
    </Button>
  )
}
