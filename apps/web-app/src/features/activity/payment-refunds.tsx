import type { InferRow } from "@evolu/common"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  isQerkoKeyRejected,
  qerkoStepKeys,
} from "@payky/app-shared/qerko-terminal-flow"
import { refundMethodLabelKey } from "@payky/app-shared/refund-form"
import type { EetDeliveryOutcome } from "@payky/core/integrations/eet/eet-client"
import {
  type DeliverEetReversalError,
  deliverEetReversal,
} from "@payky/core/modules/eet/eet-actions"
import { eetReversalsByPaymentIdQuery } from "@payky/core/modules/eet/eet-queries"
import type { EetUnsupportedReason } from "@payky/core/modules/eet/eet-types"
import {
  getEetReversalStartsAt,
  parseEetDateTime,
} from "@payky/core/modules/eet/eet-utils"
import {
  dismissQerkoTerminalRefundAttempt,
  syncQerkoTerminalRefund,
} from "@payky/core/modules/refund/refund-qerko-actions"
import type { qerkoTerminalRefundAttemptsByPaymentIdQuery } from "@payky/core/modules/refund/refund-queries"
import type { RefundId } from "@payky/core/modules/refund/refund-types"
import {
  isTipRefund,
  sumGoodsRefundAmounts,
  sumRefundAmounts,
} from "@payky/core/modules/refund/refund-utils"
import { Integer, NonNegativeInteger } from "@payky/core/modules/shared/schema"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { parseISO } from "date-fns"
import { useAtomValue } from "jotai"
import { LoaderCircleIcon, RotateCwIcon, Undo2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { accountAtom } from "@/atoms/account.ts"
import { Button } from "@/components/ui/button.tsx"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import {
  type RefundablePayment,
  usePaymentRefundState,
} from "@/features/activity/use-payment-refund-state.ts"
import {
  EetSaleStatusBadge,
  useEetRecordingDeviceWait,
  useEetSaleStatus,
} from "@/features/shared/eet-sale-status.tsx"
import { RefundBadge } from "@/features/shared/refund-badge.tsx"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useLocale } from "@/hooks/use-locale.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatDateTime, formatMoney, formatTime } from "@/lib/format-utils.ts"

/**
 * The refunds already recorded (refund/0001), the refunds to the card the
 * Qerko terminal has not settled, and one button that opens the refund
 * screen (`RefundPage`) whenever anything is left to refund and no refund to
 * the card is running. What is left comes from `usePaymentRefundState`
 * (refund/0002, 0004, 0005).
 */
export function PaymentDetailRefunds({
  payment,
  excess,
  isPaid,
  paymentMethodKinds,
}: {
  readonly payment: RefundablePayment
  readonly excess: NonNegativeInteger
  readonly isPaid: boolean
  /** The kinds of the transactions that settled the payment. */
  readonly paymentMethodKinds: ReadonlyArray<string>
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const {
    refunds,
    refundLines,
    availability,
    qerkoAttempts,
    options,
    cardAttemptRunning,
  } = usePaymentRefundState({ payment, excess, isPaid, paymentMethodKinds })
  const { data: reversals } = useEvoluQuery(
    eetReversalsByPaymentIdQuery(payment.id)
  )
  const formatMinor = (value: NonNegativeInteger) =>
    formatMoney({ value, currency: payment.currency }, locale)
  const canStartRefund = options.choices.length > 0 && !cardAttemptRunning

  if (refunds.length === 0 && qerkoAttempts.length === 0 && !canStartRefund) {
    return null
  }

  const refundActions =
    qerkoAttempts.length > 0 || canStartRefund ? (
      <div className="flex flex-col gap-2">
        {qerkoAttempts.map((attempt) => (
          <QerkoRefundAttempt
            key={attempt.id}
            attempt={attempt}
            formatMinor={formatMinor}
          />
        ))}
        {canStartRefund ? (
          <Button
            variant="outline"
            className="h-12"
            nativeButton={false}
            render={
              <Link
                to="/activity/$paymentId/refund"
                params={{ paymentId: payment.id }}
              />
            }
          >
            <Undo2Icon data-icon="inline-start" />
            {t("paymentDetail.refunds.action")}
          </Button>
        ) : null}
      </div>
    ) : null

  if (refunds.length === 0) return refundActions

  return (
    <Card data-testid="payment-detail-refunds">
      <CardHeader>
        <CardTitle>{t("paymentDetail.refunds.title")}</CardTitle>
        <CardAction>
          <RefundBadge
            summary={{
              refundedAmount: sumGoodsRefundAmounts(refunds),
              returnedAmount: sumRefundAmounts(refunds),
              refundableAmount: availability.refundableAmount,
              currency: payment.currency,
            }}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col divide-y">
          {refunds.map((refund) => (
            <div
              key={refund.id}
              className="flex flex-col gap-1 py-2 first:pt-0"
              data-testid="payment-detail-refund"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">
                  {formatMinor(refund.amount)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {isTipRefund(refund)
                    ? `${t("paymentDetail.refunds.tip")} · `
                    : null}
                  {t(refundMethodLabelKey[refund.method])} ·{" "}
                  {formatDateTime(new Date(refund.refundedAt), locale)}
                </span>
              </div>
              {refundLines
                .filter((line) => line.refundId === refund.id)
                .map((line) => (
                  <span key={line.id} className="text-xs text-muted-foreground">
                    {line.quantity} × {line.name}
                  </span>
                ))}
              {reversals
                .filter((reversal) => reversal.refundId === refund.id)
                .map((reversal) => (
                  <RefundEetReversal key={reversal.id} reversal={reversal} />
                ))}
            </div>
          ))}
        </div>
        {refundActions}
      </CardContent>
    </Card>
  )
}

/**
 * Polls a refund to the card on the Qerko terminal while it is pending,
 * settling it once the terminal answered (the background job settles it
 * too). The attempt's card here and the refund screen's progress share the
 * one query, so they poll once between them.
 */
export function useQerkoRefundPoll({
  attemptId,
  pending,
}: {
  readonly attemptId: RefundId | undefined
  readonly pending: boolean
}) {
  const appRun = useAppRun()
  const poll = useQuery({
    queryKey: ["qerko", "refund-sync", attemptId],
    enabled: pending && attemptId !== undefined,
    refetchInterval: 1000,
    queryFn: async () => {
      if (attemptId === undefined) return { status: "idle" as const }
      await using run = appRun()
      const result = await run(syncQerkoTerminalRefund(attemptId))
      return result.ok
        ? result.value
        : {
            status: "error" as const,
            keyRejected: isQerkoKeyRejected(result.error),
          }
    },
  })
  return {
    progress: poll.data,
    step: poll.data?.status === "pending" ? poll.data.step : "connecting",
    // A refused key leaves the attempt pending; pairing anew lets the poll go on.
    keyRejected: poll.data?.status === "error" && poll.data.keyRejected,
  }
}

/** Qerko refused the terminal's key: the link to pair it anew. */
export function QerkoKeyRejected() {
  const { t } = useTranslation()
  return (
    <>
      <span className="font-medium text-destructive">
        {t("paymentWait.qerko.error.keyRejected")}
      </span>
      <Link
        to="/settings/payment-accounts/qerko-terminal"
        className="font-medium underline"
      >
        {t("paymentWait.qerko.error.keyRejected.link")}
      </Link>
    </>
  )
}

type QerkoRefundAttemptRow = InferRow<
  ReturnType<typeof qerkoTerminalRefundAttemptsByPaymentIdQuery>
>

/**
 * A refund to the card the terminal has not settled: its step while pending,
 * what to do about an unknown or declined one.
 */
function QerkoRefundAttempt({
  attempt,
  formatMinor,
}: {
  readonly attempt: QerkoRefundAttemptRow
  readonly formatMinor: (value: NonNegativeInteger) => string
}) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const isPending = attempt.status === "pending"
  const { step, keyRejected } = useQerkoRefundPoll({
    attemptId: attempt.id,
    pending: isPending,
  })

  const dismiss = () =>
    runToast(async (run) => {
      await run.ok(dismissQerkoTerminalRefundAttempt(attempt.id))
    })

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm"
      data-testid="payment-detail-qerko-refund"
    >
      <span className="font-semibold">
        {t("refund.qerko.pending")} ·{" "}
        {formatMinor(
          // The tip a whole-payment refund returns beside the goods.
          NonNegativeInteger(attempt.amount + (attempt.tipAmount ?? 0))
        )}
      </span>
      {isPending ? (
        <span className="flex items-center gap-2 text-muted-foreground">
          <LoaderCircleIcon className="size-4 animate-spin" />
          {t(qerkoStepKeys[step])}
        </span>
      ) : null}
      {isPending && keyRejected ? <QerkoKeyRejected /> : null}
      {attempt.status === "failed" ? (
        <>
          <span className="font-medium text-destructive">
            {t(
              attempt.failureReason === "cancelled"
                ? "refund.qerko.failed.cancelled"
                : "refund.qerko.failed.declined"
            )}
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={() => void dismiss()}
          >
            {t("refund.qerko.dismiss")}
          </Button>
        </>
      ) : null}
      {attempt.status === "unknown" ? (
        <>
          <span className="font-medium text-destructive">
            {t("refund.qerko.unresolved")}
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={() => void dismiss()}
          >
            {t("refund.qerko.dismissUnresolved")}
          </Button>
        </>
      ) : null}
    </div>
  )
}

type RefundEetReversalRow = InferRow<
  ReturnType<typeof eetReversalsByPaymentIdQuery>
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

function RefundEetReversal({
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
