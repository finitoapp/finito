import type { InferRow } from "@evolu/common"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  isQerkoKeyRejected,
  qerkoStepKeys,
} from "@payky/app-shared/qerko-terminal-flow"
import {
  defaultRefundMethod,
  deriveQerkoPaymentRefund,
  deriveRefundAmountText,
  deriveRefundAvailability,
  deriveRefundForm,
  describeQerkoRefundError,
  qerkoPaymentRefundErrorKeys,
  type RefundablePaymentLine,
  type RefundDialogMethod,
  type RefundMode,
  type RefundQuantities,
  refundErrorKeys,
  refundMethodLabelKey,
  stepRefundQuantity,
  tipRefundErrorKeys,
} from "@payky/app-shared/refund-form"
import type { EetDeliveryOutcome } from "@payky/core/integrations/eet/eet-client"
import type { BillId } from "@payky/core/modules/bill/bill-types"
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
  paymentQerkoTerminalByIdQuery,
  qerkoPaymentAttemptsByPaymentIdQuery,
} from "@payky/core/modules/payment/payment-queries"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import {
  refundPayment,
  refundPaymentTip,
} from "@payky/core/modules/refund/refund-actions"
import {
  dismissQerkoTerminalRefundAttempt,
  startQerkoTerminalRefund,
  syncQerkoTerminalRefund,
} from "@payky/core/modules/refund/refund-qerko-actions"
import { refundQerkoPayment } from "@payky/core/modules/refund/refund-qerko-payment-actions"
import {
  otherClaimedPaymentOfBillQuery,
  qerkoTerminalRefundAttemptsByPaymentIdQuery,
  refundablePaymentLinesQuery,
  refundLinesByPaymentIdQuery,
  refundsByPaymentIdQuery,
} from "@payky/core/modules/refund/refund-queries"

import {
  isTipRefund,
  type RefundableLine,
  sumGoodsRefundAmounts,
  sumRefundAmounts,
} from "@payky/core/modules/refund/refund-utils"
import {
  type FiatCurrency,
  Integer,
  type NonNegativeInteger,
} from "@payky/core/modules/shared/schema"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { parseISO } from "date-fns"
import { useAtomValue, useStore } from "jotai"
import {
  LoaderCircleIcon,
  MinusIcon,
  PlusIcon,
  RotateCwIcon,
  Undo2Icon,
} from "lucide-react"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx"
import {
  Field,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field.tsx"
import { Input } from "@/components/ui/input.tsx"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx"
import {
  EetSaleStatusBadge,
  useEetRecordingDeviceWait,
  useEetSaleStatus,
} from "@/features/shared/eet-sale-status.tsx"
import { RefundBadge } from "@/features/shared/refund-badge.tsx"
import { useRequirePermission } from "@/hooks/use-access.ts"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useLocale } from "@/hooks/use-locale.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatDateTime, formatMoney, formatTime } from "@/lib/format-utils.ts"

/**
 * Every query `PaymentDetailRefunds` reads, for the payment screen's
 * `usePreloadEvoluQueries`, which knows the payment before this mounts.
 */
export const paymentRefundsQueries = (paymentId: PaymentId) => [
  refundsByPaymentIdQuery(paymentId),
  refundLinesByPaymentIdQuery(paymentId),
  refundablePaymentLinesQuery(paymentId),
  otherClaimedPaymentOfBillQuery(paymentId),
  eetReversalsByPaymentIdQuery(paymentId),
  paymentQerkoTerminalByIdQuery(paymentId),
  qerkoTerminalRefundAttemptsByPaymentIdQuery(paymentId),
  qerkoPaymentAttemptsByPaymentIdQuery(paymentId),
]

export function PaymentDetailRefunds({
  payment,
  excess,
  isPaid,
  paymentMethodKinds,
}: {
  readonly payment: {
    readonly id: PaymentId
    readonly billId: BillId | null
    readonly amount: NonNegativeInteger
    readonly tipAmount: NonNegativeInteger
    readonly currency: FiatCurrency
    readonly cashReceivedAmount: NonNegativeInteger | null
  }
  readonly excess: NonNegativeInteger
  readonly isPaid: boolean
  /** The kinds of the transactions that settled the payment. */
  readonly paymentMethodKinds: ReadonlyArray<string>
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [tipDialogOpen, setTipDialogOpen] = useState(false)
  const { data: refunds } = useEvoluQuery(refundsByPaymentIdQuery(payment.id))
  const { data: refundLines } = useEvoluQuery(
    refundLinesByPaymentIdQuery(payment.id)
  )
  const { data: paymentLines } = useEvoluQuery(
    refundablePaymentLinesQuery(payment.id)
  )
  const { data: otherClaimedPayments } = useEvoluQuery(
    otherClaimedPaymentOfBillQuery(payment.id)
  )
  const { data: reversals } = useEvoluQuery(
    eetReversalsByPaymentIdQuery(payment.id)
  )
  const { data: qerkoPaymentData } = useEvoluQuery(
    paymentQerkoTerminalByIdQuery(payment.id)
  )
  const { data: qerkoAttempts } = useEvoluQuery(
    qerkoTerminalRefundAttemptsByPaymentIdQuery(payment.id)
  )
  const { data: qerkoPaymentAttempts } = useEvoluQuery(
    qerkoPaymentAttemptsByPaymentIdQuery(payment.id)
  )
  // A refund to the card needs the id Qerko's receipt handed out and the
  // terminal the payment was taken on, whichever terminal this device uses
  // now (qerko/0006).
  const [qerkoPayment] = qerkoPaymentData
  const qerkoRefundable =
    qerkoPayment !== undefined &&
    qerkoPayment.qerkoRefundId !== null &&
    qerkoPayment.terminalId !== null
  const qerkoTerminalTid = qerkoPayment?.terminalTid ?? null
  const defaultMethod = defaultRefundMethod(paymentMethodKinds, {
    qerkoRefundable,
  })
  const {
    refundableAmount,
    remainingAmount,
    refundableTipAmount,
    refundableLines,
    canRefund,
    canRefundTip,
  } = deriveRefundAvailability({
    payment,
    excess,
    isPaid,
    refunds,
    refundLines,
    paymentLines,
    hasOtherClaimedPayment: otherClaimedPayments.length > 0,
  })
  // Qerko refunds a Qerko payment whole or not at all (qerko/0010).
  const qerkoPaymentRefundAmount = deriveQerkoPaymentRefund({
    hasPaidQerkoAttempt: qerkoPaymentAttempts.some(
      (attempt) => attempt.outcome === "paid"
    ),
    isPaid,
    refunds,
    refundableAmount,
    refundableTipAmount,
  })
  const formatMinor = (value: NonNegativeInteger) =>
    formatMoney({ value, currency: payment.currency }, locale)

  if (
    refunds.length === 0 &&
    qerkoAttempts.length === 0 &&
    qerkoPaymentRefundAmount === null &&
    !canRefund &&
    !canRefundTip
  ) {
    return null
  }

  const refundButtons =
    canRefund ||
    canRefundTip ||
    qerkoAttempts.length > 0 ||
    qerkoPaymentRefundAmount !== null ? (
      <div className="flex flex-col gap-2">
        {qerkoPaymentRefundAmount === null ? null : (
          <QerkoPaymentRefundButton
            paymentId={payment.id}
            amount={formatMinor(qerkoPaymentRefundAmount)}
          />
        )}
        {qerkoAttempts.map((attempt) => (
          <QerkoRefundAttempt
            key={attempt.id}
            attempt={attempt}
            formatMinor={formatMinor}
          />
        ))}
        {canRefund ? (
          <Button
            type="button"
            variant="outline"
            className="h-12"
            onClick={() => setDialogOpen(true)}
          >
            <Undo2Icon data-icon="inline-start" />
            {t("paymentDetail.refunds.action")}
          </Button>
        ) : null}
        {canRefundTip ? (
          <Button
            type="button"
            variant="outline"
            className="h-12"
            onClick={() => setTipDialogOpen(true)}
          >
            <Undo2Icon data-icon="inline-start" />
            {t("paymentDetail.refunds.tipAction", {
              amount: formatMinor(refundableTipAmount),
            })}
          </Button>
        ) : null}
      </div>
    ) : null

  return (
    <>
      {refunds.length === 0 ? (
        refundButtons
      ) : (
        <Card data-testid="payment-detail-refunds">
          <CardHeader>
            <CardTitle>{t("paymentDetail.refunds.title")}</CardTitle>
            <CardAction>
              <RefundBadge
                summary={{
                  refundedAmount: sumGoodsRefundAmounts(refunds),
                  returnedAmount: sumRefundAmounts(refunds),
                  refundableAmount,
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
                      <span
                        key={line.id}
                        className="text-xs text-muted-foreground"
                      >
                        {line.quantity} × {line.name}
                      </span>
                    ))}
                  {reversals
                    .filter((reversal) => reversal.refundId === refund.id)
                    .map((reversal) => (
                      <RefundEetReversal
                        key={reversal.id}
                        reversal={reversal}
                      />
                    ))}
                </div>
              ))}
            </div>
            {refundButtons}
          </CardContent>
        </Card>
      )}
      {dialogOpen ? (
        <RefundDialog
          paymentId={payment.id}
          currency={payment.currency}
          remainingAmount={remainingAmount}
          excess={excess}
          refundableLines={refundableLines}
          tipAmount={refundableTipAmount}
          defaultMethod={defaultMethod}
          qerkoRefundable={qerkoRefundable}
          qerkoTerminalTid={qerkoTerminalTid}
          onClose={() => setDialogOpen(false)}
        />
      ) : null}
      {tipDialogOpen ? (
        <TipRefundDialog
          paymentId={payment.id}
          currency={payment.currency}
          tipAmount={refundableTipAmount}
          defaultMethod={defaultMethod}
          qerkoRefundable={qerkoRefundable}
          qerkoTerminalTid={qerkoTerminalTid}
          onClose={() => setTipDialogOpen(false)}
        />
      ) : null}
    </>
  )
}

/**
 * Refunds all of a payment paid through Qerko (qerko/0010), after a
 * confirmation that says so: Qerko returns the whole payment or nothing.
 */
function QerkoPaymentRefundButton({
  paymentId,
  amount,
}: {
  readonly paymentId: PaymentId
  readonly amount: string
}) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const confirm = useConfirmDialog()
  const { require } = useRequirePermission()
  const jotaiStore = useStore()
  const [pending, setPending] = useState(false)

  const refund = async () => {
    if (pending) return
    if (!(await require("refund", "access.action.refund"))) return
    const confirmed = await confirm({
      title: t("refund.qerkoPayment.confirm.title"),
      description: t("refund.qerkoPayment.confirm.description", { amount }),
      confirmLabel: t("refund.qerkoPayment.confirm.confirm"),
      cancelLabel: t("refund.qerkoPayment.confirm.cancel"),
      variant: "destructive",
    })
    if (!confirmed) return
    setPending(true)
    const { device } = await jotaiStore.get(accountAtom)
    const refunded = await runToast(async (run) => {
      const result = await run(
        refundQerkoPayment({ paymentId, deviceId: device.id })
      )
      return result.ok
        ? undefined
        : qerkoPaymentRefundErrorKeys[result.error.type]
    })
    setPending(false)
    if (refunded) toast.success(t("refund.qerkoPayment.done"))
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="h-12"
      disabled={pending}
      onClick={() => {
        void refund()
      }}
    >
      {pending ? (
        <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
      ) : (
        <Undo2Icon data-icon="inline-start" />
      )}
      {t("paymentDetail.refunds.qerkoPaymentAction", { amount })}
    </Button>
  )
}

function RefundDialog({
  paymentId,
  currency,
  remainingAmount,
  excess,
  refundableLines,
  tipAmount,
  defaultMethod,
  qerkoRefundable,
  qerkoTerminalTid,
  onClose,
}: {
  readonly paymentId: PaymentId
  readonly currency: FiatCurrency
  readonly remainingAmount: NonNegativeInteger
  readonly excess: NonNegativeInteger
  readonly refundableLines: ReadonlyArray<RefundableLine<RefundablePaymentLine>>
  readonly tipAmount: NonNegativeInteger
  readonly defaultMethod: RefundDialogMethod
  /** Set when the card can be refunded from this device. */
  readonly qerkoRefundable: boolean
  readonly qerkoTerminalTid: string | null
  readonly onClose: () => void
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const runToast = useRunToast()
  const { require } = useRequirePermission()
  const jotaiStore = useStore()
  const [mode, setMode] = useState<RefundMode>("amount")
  const [method, setMethod] = useState<RefundDialogMethod>(defaultMethod)
  const [typedAmountText, setTypedAmountText] = useState<string | null>(null)
  const amountText = deriveRefundAmountText({
    typedAmountText,
    remainingAmount,
    excess,
    method,
    currency,
  })
  const [quantities, setQuantities] = useState<RefundQuantities>({})
  const [pending, setPending] = useState(false)
  const formatMinor = (value: NonNegativeInteger) =>
    formatMoney({ value, currency }, locale)

  const { typedAmount, chosenLines, refundAmount } = deriveRefundForm({
    mode,
    amountText,
    quantities,
    refundableLines,
    remainingAmount,
    currency,
  })

  const stepQuantity = (
    refundable: RefundableLine<RefundablePaymentLine>,
    step: 1 | -1
  ) => setQuantities(stepRefundQuantity(quantities, refundable, step))

  const confirm = async () => {
    if (refundAmount === null || pending) return
    // Here rather than where the dialog opens: every refund, the one offered
    // on a collision included, ends in this confirm (access/0002).
    if (!(await require("refund", "access.action.refund"))) return
    setPending(true)
    const { device } = await jotaiStore.get(accountAtom)
    const refunded = await runToast(async (run) => {
      const lines = chosenLines.map(({ paymentLineId, quantity }) => ({
        paymentLineId,
        quantity,
      }))
      if (method === "qerkoTerminal") {
        if (!qerkoRefundable) return "refund.qerko.error.notAvailable"
        const result = await run(
          startQerkoTerminalRefund({
            paymentId,
            deviceId: device.id,
            ...(mode === "amount" ? { amount: refundAmount } : { lines }),
          })
        )
        return result.ok ? undefined : describeQerkoRefundError(result.error)
      }
      const result = await run(
        refundPayment(
          mode === "amount"
            ? { paymentId, method, deviceId: device.id, amount: refundAmount }
            : { paymentId, method, deviceId: device.id, lines }
        )
      )
      if (!result.ok) return refundErrorKeys[result.error.type]
      return undefined
    })
    setPending(false)
    if (refunded) {
      toast.success(
        t(
          method === "qerkoTerminal" ? "refund.qerko.started" : "refund.created"
        )
      )
      onClose()
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("refund.dialog.title")}</DialogTitle>
          <DialogDescription>
            {t("refund.dialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {tipAmount > 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("refund.dialog.tipHint", { amount: formatMinor(tipAmount) })}
            </p>
          ) : null}
          {refundableLines.length > 0 ? (
            <ToggleGroup
              aria-label={t("refund.dialog.mode.label")}
              className="grid w-full grid-cols-2"
              variant="outline"
              disabled={pending}
              value={[mode]}
              onValueChange={(values) => {
                const [value] = values
                if (value === "amount" || value === "items") setMode(value)
              }}
            >
              <ToggleGroupItem value="amount">
                {t("refund.dialog.mode.amount")}
              </ToggleGroupItem>
              <ToggleGroupItem value="items">
                {t("refund.dialog.mode.items")}
              </ToggleGroupItem>
            </ToggleGroup>
          ) : null}

          {mode === "amount" ? (
            <Field data-invalid={typedAmount === null}>
              <FieldLabel htmlFor="refund-amount">
                {t("refund.dialog.amount.label")}
              </FieldLabel>
              <Input
                id="refund-amount"
                value={amountText}
                inputMode="decimal"
                autoComplete="off"
                disabled={pending}
                aria-invalid={typedAmount === null}
                onChange={(event) =>
                  setTypedAmountText(event.currentTarget.value)
                }
              />
              <FieldError>
                {typedAmount === null
                  ? t("refund.dialog.amount.invalid", {
                      amount: formatMinor(remainingAmount),
                    })
                  : null}
              </FieldError>
            </Field>
          ) : (
            <FieldSet>
              <FieldLegend variant="label">
                {t("refund.dialog.items.label")}
              </FieldLegend>
              <div className="flex flex-col divide-y">
                {refundableLines.map((refundable) => {
                  const quantity = quantities[refundable.line.id] ?? 0
                  return (
                    <div
                      key={refundable.line.id}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {refundable.line.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("refund.dialog.items.available", {
                            quantity: String(refundable.remainingQuantity),
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-lg"
                          disabled={pending || quantity === 0}
                          aria-label={t("refund.dialog.items.decrease", {
                            name: refundable.line.name,
                          })}
                          onClick={() => stepQuantity(refundable, -1)}
                        >
                          <MinusIcon />
                        </Button>
                        <span className="w-8 text-center text-sm font-semibold tabular-nums">
                          {quantity}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-lg"
                          disabled={
                            pending || quantity >= refundable.remainingQuantity
                          }
                          aria-label={t("refund.dialog.items.increase", {
                            name: refundable.line.name,
                          })}
                          onClick={() => stepQuantity(refundable, 1)}
                        >
                          <PlusIcon />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </FieldSet>
          )}

          <RefundMethodField
            method={method}
            disabled={pending}
            qerkoAvailable={qerkoRefundable}
            qerkoTerminalTid={qerkoTerminalTid}
            onChange={setMethod}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onClose}
          >
            {t("refund.dialog.cancel")}
          </Button>
          <Button
            type="button"
            disabled={refundAmount === null || pending}
            onClick={() => void confirm()}
          >
            {refundAmount === null
              ? t("refund.dialog.confirmEmpty")
              : t("refund.dialog.confirm", {
                  amount: formatMinor(refundAmount),
                })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TipRefundDialog({
  paymentId,
  currency,
  tipAmount,
  defaultMethod,
  qerkoRefundable,
  qerkoTerminalTid,
  onClose,
}: {
  readonly paymentId: PaymentId
  readonly currency: FiatCurrency
  readonly tipAmount: NonNegativeInteger
  readonly defaultMethod: RefundDialogMethod
  /** Set when the card can be refunded from this device. */
  readonly qerkoRefundable: boolean
  readonly qerkoTerminalTid: string | null
  readonly onClose: () => void
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const runToast = useRunToast()
  const { require } = useRequirePermission()
  const jotaiStore = useStore()
  const [method, setMethod] = useState<RefundDialogMethod>(defaultMethod)
  const [pending, setPending] = useState(false)
  const formattedTip = formatMoney({ value: tipAmount, currency }, locale)

  const confirm = async () => {
    if (pending) return
    // A tip refund is a refund too (access/0002).
    if (!(await require("refund", "access.action.refund"))) return
    setPending(true)
    const { device } = await jotaiStore.get(accountAtom)
    const refunded = await runToast(async (run) => {
      if (method === "qerkoTerminal") {
        if (!qerkoRefundable) return "refund.qerko.error.notAvailable"
        const result = await run(
          startQerkoTerminalRefund({
            paymentId,
            deviceId: device.id,
            tip: true,
          })
        )
        return result.ok ? undefined : describeQerkoRefundError(result.error)
      }
      const result = await run(
        refundPaymentTip({ paymentId, method, deviceId: device.id })
      )
      if (!result.ok) return tipRefundErrorKeys[result.error.type]
      return undefined
    })
    setPending(false)
    if (refunded) {
      toast.success(
        t(
          method === "qerkoTerminal"
            ? "refund.qerko.started"
            : "refund.tipCreated"
        )
      )
      onClose()
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("refund.tipDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("refund.tipDialog.description", { amount: formattedTip })}
          </DialogDescription>
        </DialogHeader>

        <RefundMethodField
          method={method}
          disabled={pending}
          qerkoAvailable={qerkoRefundable}
          qerkoTerminalTid={qerkoTerminalTid}
          onChange={setMethod}
        />

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onClose}
          >
            {t("refund.dialog.cancel")}
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => void confirm()}
          >
            {t("refund.dialog.confirm", { amount: formattedTip })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RefundMethodField({
  method,
  disabled,
  qerkoAvailable,
  qerkoTerminalTid,
  onChange,
}: {
  readonly method: RefundDialogMethod
  readonly disabled: boolean
  /** The card can be refunded through the terminal from this device. */
  readonly qerkoAvailable: boolean
  /** Names the terminal the refund must go to, when the payment recorded it. */
  readonly qerkoTerminalTid: string | null
  readonly onChange: (method: RefundDialogMethod) => void
}) {
  const { t } = useTranslation()

  return (
    <FieldSet>
      <FieldLegend variant="label">
        {t("refund.dialog.method.label")}
      </FieldLegend>
      <ToggleGroup
        aria-label={t("refund.dialog.method.label")}
        className="grid w-full grid-cols-1 gap-2"
        variant="outline"
        disabled={disabled}
        value={[method]}
        onValueChange={(values) => {
          const [value] = values
          if (
            value === "cashRegister" ||
            value === "outside" ||
            (value === "qerkoTerminal" && qerkoAvailable)
          ) {
            onChange(value)
          }
        }}
      >
        <ToggleGroupItem value="cashRegister" className="justify-start">
          {t("refund.dialog.method.cashRegister")}
        </ToggleGroupItem>
        {qerkoAvailable ? (
          <ToggleGroupItem value="qerkoTerminal" className="justify-start">
            {qerkoTerminalTid === null
              ? t("refund.dialog.method.qerkoTerminal")
              : t("refund.dialog.method.qerkoTerminalTid", {
                  tid: qerkoTerminalTid,
                })}
          </ToggleGroupItem>
        ) : null}
        <ToggleGroupItem value="outside" className="justify-start">
          {t("refund.dialog.method.outside")}
        </ToggleGroupItem>
      </ToggleGroup>
    </FieldSet>
  )
}

type QerkoRefundAttemptRow = InferRow<
  ReturnType<typeof qerkoTerminalRefundAttemptsByPaymentIdQuery>
>

/**
 * A refund to the card the terminal has not settled: its step while pending
 * (polled once a second while this screen is open; the background job settles
 * it too), what to do about an unknown or declined one.
 */
function QerkoRefundAttempt({
  attempt,
  formatMinor,
}: {
  readonly attempt: QerkoRefundAttemptRow
  readonly formatMinor: (value: NonNegativeInteger) => string
}) {
  const { t } = useTranslation()
  const appRun = useAppRun()
  const runToast = useRunToast()
  const isPending = attempt.status === "pending"
  const poll = useQuery({
    queryKey: ["qerko", "refund-sync", attempt.id],
    enabled: isPending,
    refetchInterval: 1000,
    queryFn: async () => {
      await using run = appRun()
      const result = await run(syncQerkoTerminalRefund(attempt.id))
      return result.ok
        ? result.value
        : {
            status: "error" as const,
            keyRejected: isQerkoKeyRejected(result.error),
          }
    },
  })
  const step = poll.data?.status === "pending" ? poll.data.step : "connecting"
  // A refused key leaves the attempt pending; pairing anew lets the poll go on.
  const keyRejected = poll.data?.status === "error" && poll.data.keyRejected

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
        {t("refund.qerko.pending")} · {formatMinor(attempt.amount)}
      </span>
      {isPending ? (
        <span className="flex items-center gap-2 text-muted-foreground">
          <LoaderCircleIcon className="size-4 animate-spin" />
          {t(qerkoStepKeys[step])}
        </span>
      ) : null}
      {isPending && keyRejected ? (
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
      ) : null}
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
