import type { InferRow } from "@evolu/common"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type { EetDeliveryOutcome } from "@payky/core/integrations/eet/eet-client"
import {
  type DeliverEetReversalError,
  deliverEetReversal,
} from "@payky/core/modules/eet/eet-actions"
import type { eetReversalByRefundIdQuery } from "@payky/core/modules/eet/eet-queries"
import type { EetUnsupportedReason } from "@payky/core/modules/eet/eet-types"
import {
  getEetReversalStartsAt,
  parseEetDateTime,
} from "@payky/core/modules/eet/eet-utils"
import { Integer } from "@payky/core/modules/shared/schema"
import { parseISO } from "date-fns"
import { useAtomValue } from "jotai"
import { RotateCwIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { accountAtom } from "@/atoms/account.ts"
import { Button } from "@/components/ui/button.tsx"
import {
  EetSaleStatusBadge,
  useEetRecordingDeviceWait,
  useEetSaleStatus,
} from "@/features/shared/eet-sale-status.tsx"
import { useLocale } from "@/hooks/use-locale.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatDateTime, formatMoney, formatTime } from "@/lib/format-utils.ts"

export type RefundEetReversalRow = InferRow<
  ReturnType<typeof eetReversalByRefundIdQuery>
>

const reversalRetryErrorKeys = {
  EetSaleNotFoundError: "paymentDetail.eet.retry.failed",
  EetSaleAlreadyConfirmedError: "paymentDetail.eet.retry.alreadyConfirmed",
  EetSaleUnsupportedError: "paymentDetail.eet.retry.unsupported",
  EetSaleBusyError: "paymentDetail.eet.retry.busy",
  EetSigningCertificateMissingError: "paymentDetail.eet.retry.noCertificate",
  EetReversalWaitingForSaleError: "paymentDetail.eet.reversal.waiting",
} satisfies Record<DeliverEetReversalError["type"], TranslationKey>

const reversalRetryOutcomeKeys = {
  accepted: "paymentDetail.eet.reversal.retry.confirmed",
  verified: "paymentDetail.eet.reversal.retry.confirmed",
  retry: "paymentDetail.eet.retry.pending",
  rejected: "paymentDetail.eet.reversal.retry.rejected",
} satisfies Record<EetDeliveryOutcome["type"], TranslationKey>

const reversalUnsupportedKeys = {
  currency: "paymentDetail.eet.unsupported",
  amount: "paymentDetail.eet.unsupported",
  disabled: "paymentDetail.eet.reversal.unsupported.disabled",
  environment: "paymentDetail.eet.reversal.unsupported.environment",
  taxpayer: "paymentDetail.eet.reversal.unsupported.taxpayer",
} satisfies Record<EetUnsupportedReason, TranslationKey>

/**
 * The EET reversal a refund sends (eet/0007), its status, POK and last
 * error, with a manual resend once the sale it negates is confirmed and no
 * other device holds its priority. The refund detail draws it; the payment
 * detail's refund row shows only its status.
 */
export function RefundEetReversal({
  reversal,
}: {
  readonly reversal: RefundEetReversalRow
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const runToast = useRunToast()
  const [retrying, setRetrying] = useState(false)
  const deviceId = useAtomValue(accountAtom).device.id
  const { status, isOverdue } = useEetSaleStatus(reversal)
  const isWaitingForSale =
    status === "pending" && reversal.saleConfirmedAt === null
  const waitEndsAt = useEetRecordingDeviceWait({
    attempts: reversal,
    recordingDeviceId: reversal.deviceId,
    deviceId,
    startsAt:
      reversal.saleConfirmedAt === null
        ? null
        : getEetReversalStartsAt({
            refundedAt: parseEetDateTime(reversal.saleAt),
            saleConfirmedAt: reversal.saleConfirmedAt,
          }),
  })
  const canRetry =
    !isWaitingForSale &&
    waitEndsAt === null &&
    (status === "pending" || status === "rejected")
  const lastError =
    reversal.pok !== null || reversal.lastErrorMessage === null
      ? null
      : reversal.lastErrorCode === null
        ? reversal.lastErrorMessage
        : t("paymentDetail.eet.errorCode", {
            code: String(reversal.lastErrorCode),
            message: reversal.lastErrorMessage,
          })

  const retry = async () => {
    setRetrying(true)
    await runToast(async (run) => {
      const result = await run(
        deliverEetReversal({ id: reversal.id, deviceId })
      )
      if (!result.ok) return reversalRetryErrorKeys[result.error.type]
      const outcomeKey = reversalRetryOutcomeKeys[result.value.type]
      if (result.value.type === "rejected") return outcomeKey
      toast.success(t(outcomeKey))
      return undefined
    })
    setRetrying(false)
  }

  return (
    <div
      className="mt-1 flex flex-col gap-1.5 rounded-lg border bg-muted/20 p-3 text-xs"
      data-testid="payment-detail-eet-reversal"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">
          {t("paymentDetail.eet.reversal.title", {
            amount: formatMoney(
              {
                value: Integer(-reversal.amount),
                currency: reversal.currency,
              },
              locale
            ),
          })}
        </span>
        <EetSaleStatusBadge sale={reversal} />
      </div>
      {isWaitingForSale ? (
        <p className="text-muted-foreground">
          {t("paymentDetail.eet.reversal.waiting")}
        </p>
      ) : null}
      {waitEndsAt === null ? null : (
        <p className="text-muted-foreground">
          {t("paymentDetail.eet.reversal.waitingForDevice", {
            time: formatTime(new Date(waitEndsAt), locale),
          })}
        </p>
      )}
      {isOverdue ? (
        <p className="text-destructive">{t("paymentDetail.eet.overdue")}</p>
      ) : null}
      {reversal.unsupportedReason === null ? null : (
        <p className="text-destructive">
          {t(reversalUnsupportedKeys[reversal.unsupportedReason])}
        </p>
      )}
      {reversal.pok === null ? null : (
        <p className="break-all text-muted-foreground">
          {t("paymentDetail.eet.pok")}:{" "}
          <span className="font-mono">{reversal.pok}</span>
        </p>
      )}
      {reversal.receivedAt === null ? null : (
        <p className="text-muted-foreground">
          {t("paymentDetail.eet.receivedAt")}:{" "}
          {formatDateTime(parseISO(reversal.receivedAt), locale)}
        </p>
      )}
      {lastError === null ? null : (
        <p className="text-muted-foreground">
          {t("paymentDetail.eet.lastError")}: {lastError}
        </p>
      )}
      {canRetry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={retrying}
          onClick={() => void retry()}
        >
          <RotateCwIcon data-icon="inline-start" />
          {t("paymentDetail.eet.retry")}
        </Button>
      ) : null}
    </div>
  )
}
