import type { InferRow } from "@evolu/common"
import {
  isQerkoKeyRejected,
  qerkoStepKeys,
} from "@payky/app-shared/qerko-terminal-flow"
import { refundMethodLabelKey } from "@payky/app-shared/refund-form"
import { eetReversalsByPaymentIdQuery } from "@payky/core/modules/eet/eet-queries"
import {
  dismissQerkoTerminalRefundAttempt,
  syncQerkoTerminalRefund,
} from "@payky/core/modules/refund/refund-qerko-actions"
import type {
  qerkoTerminalRefundAttemptsByPaymentIdQuery,
  refundsByPaymentIdQuery,
} from "@payky/core/modules/refund/refund-queries"
import type { RefundId } from "@payky/core/modules/refund/refund-types"
import {
  isTipRefund,
  sumGoodsRefundAmounts,
  sumRefundAmounts,
} from "@payky/core/modules/refund/refund-utils"
import { NonNegativeInteger } from "@payky/core/modules/shared/schema"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { LoaderCircleIcon, Undo2Icon } from "lucide-react"
import { Button } from "@/components/ui/button.tsx"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import { VerticalNavRow } from "@/components/vertical-nav.tsx"
import {
  type RefundablePayment,
  usePaymentRefundState,
} from "@/features/activity/use-payment-refund-state.ts"
import { EetSaleStatusBadge } from "@/features/shared/eet-sale-status.tsx"
import { RefundBadge } from "@/features/shared/refund-badge.tsx"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useLocale } from "@/hooks/use-locale.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatDateTime, formatMoney } from "@/lib/format-utils.ts"

/**
 * The refunds already recorded (refund/0001), each a link to its detail,
 * the refunds to the card the Qerko terminal has not settled, and one
 * button that opens the refund screen (`RefundPage`) whenever anything is
 * left to refund and no refund to the card is running. What is left comes from `usePaymentRefundState`
 * (refund/0014, 0004, 0005).
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
  const { refunds, availability, qerkoAttempts, options, cardAttemptRunning } =
    usePaymentRefundState({ payment, excess, isPaid, paymentMethodKinds })
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
        <div className="-mx-3 flex flex-col">
          {refunds.map((refund) => (
            <RefundRow
              key={refund.id}
              refund={refund}
              reversal={reversals.find(
                (reversal) => reversal.refundId === refund.id
              )}
            />
          ))}
        </div>
        {refundActions}
      </CardContent>
    </Card>
  )
}

type PaymentRefundRow = InferRow<ReturnType<typeof refundsByPaymentIdQuery>>

type PaymentRefundReversalRow = InferRow<
  ReturnType<typeof eetReversalsByPaymentIdQuery>
>

/**
 * One recorded refund, a link to its detail (`RefundDetailPage`): the amount,
 * "Tip ·", the method and the time, and only the status of its EET reversal,
 * so one pending, refused or overdue shows without opening it. The items and
 * the reversal's POK, errors and resend live on the detail.
 */
function RefundRow({
  refund,
  reversal,
}: {
  readonly refund: PaymentRefundRow
  readonly reversal: PaymentRefundReversalRow | undefined
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  return (
    <div data-testid="payment-detail-refund">
      <VerticalNavRow
        item={{
          kind: "link",
          to: "/activity/$paymentId/refunds/$refundId",
          params: { paymentId: refund.paymentId, refundId: refund.id },
          label: (
            <span className="flex flex-col items-start gap-1">
              <span className="text-sm font-semibold">
                {formatMoney(
                  { value: refund.amount, currency: refund.currency },
                  locale
                )}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {isTipRefund(refund)
                  ? `${t("paymentDetail.refunds.tip")} · `
                  : null}
                {t(refundMethodLabelKey[refund.method])} ·{" "}
                {formatDateTime(new Date(refund.refundedAt), locale)}
              </span>
              {reversal === undefined ? null : (
                <EetSaleStatusBadge sale={reversal} />
              )}
            </span>
          ),
        }}
      />
    </div>
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
