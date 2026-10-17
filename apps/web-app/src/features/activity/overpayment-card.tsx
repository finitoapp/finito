import {
  answerLabelKeys,
  deriveResolveForm,
  type OverpaymentCardPayment,
  partitionOverpaymentPayments,
  paymentOptionLabel,
  type Resolution,
  recordErrorKeys,
  resolutionKeys,
  resolvableFrom,
  withdrawErrorKeys,
} from "@payky/app-shared/overpayment-card"
import type { OverpaymentScope } from "@payky/core/modules/bill/bill-types"
import {
  type BillOverpayment,
  deriveBillOverpayment,
  type OverpaymentAnswer,
} from "@payky/core/modules/bill/bill-utils"
import {
  recordOverpaymentResolution,
  withdrawOverpaymentResolution,
} from "@payky/core/modules/overpayment-resolution/overpayment-resolution-actions"
import { confirmPaymentPaidDespiteCancellation } from "@payky/core/modules/payment/payment-actions"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import {
  type FiatCurrency,
  NonNegativeInteger,
} from "@payky/core/modules/shared/schema"
import { useNavigate } from "@tanstack/react-router"
import { useStore } from "jotai"
import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { accountAtom } from "@/atoms/account.ts"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/reui/alert.tsx"
import { Badge } from "@/components/ui/badge.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Checkbox } from "@/components/ui/checkbox.tsx"
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
  FieldContent,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field.tsx"
import { Input } from "@/components/ui/input.tsx"
import { ToggleGroup } from "@/components/ui/toggle-group.tsx"
import { ChoiceToggleItem } from "@/features/activity/choice-toggle-item.tsx"
import { useOverpaymentInput } from "@/features/shared/use-overpayment-input.ts"
import { useRequirePermission } from "@/hooks/use-access.ts"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog.ts"
import { useLocale } from "@/hooks/use-locale.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatMoney } from "@/lib/format-utils.ts"
import { cn } from "@/lib/utils.ts"

const resolutionActionClassName = "h-auto min-h-11 whitespace-normal"

export function OverpaymentCard({
  scope,
  billLabel,
  currency,
  payments,
  onDecideLater,
}: {
  readonly scope: OverpaymentScope
  readonly billLabel: string
  readonly currency: FiatCurrency
  readonly payments: ReadonlyArray<OverpaymentCardPayment>
  readonly onDecideLater?: () => void
}) {
  const input = useOverpaymentInput(scope)
  if (input === undefined) return null
  const overpayment = deriveBillOverpayment(input)
  if (overpayment.unresolved === 0 && overpayment.answers.length === 0) {
    return null
  }
  const paymentIdsWithMoney = new Set(
    input.transactions.map(({ paymentId }) => paymentId)
  )

  return (
    <OverpaymentAlert
      overpayment={overpayment}
      billLabel={billLabel}
      currency={currency}
      payments={payments.filter(({ id }) => paymentIdsWithMoney.has(id))}
      onDecideLater={onDecideLater}
    />
  )
}

function OverpaymentAlert({
  overpayment,
  billLabel,
  currency,
  payments,
  onDecideLater,
}: {
  readonly overpayment: BillOverpayment
  readonly billLabel: string
  readonly currency: FiatCurrency
  readonly payments: ReadonlyArray<OverpaymentCardPayment>
  readonly onDecideLater: (() => void) | undefined
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const [resolving, setResolving] = useState<Resolution | null>(null)
  const navigate = useNavigate()
  const [choosingReturn, setChoosingReturn] = useState(false)
  const format = (value: number) =>
    formatMoney({ value: NonNegativeInteger(value), currency }, locale)
  const isUnresolved = overpayment.unresolved > 0
  const { collisions, holding, returnable } = partitionOverpaymentPayments(
    overpayment,
    payments
  )

  const returnFrom = (payment: OverpaymentCardPayment) =>
    void navigate({
      to: "/activity/$paymentId/refund",
      params: { paymentId: payment.id },
      search: { choice: "overpayment" },
    })
  const startReturn = () => {
    const [only] = returnable
    if (returnable.length === 1 && only !== undefined) returnFrom(only)
    else setChoosingReturn(true)
  }

  return (
    <Alert
      variant={isUnresolved ? "warning" : "success"}
      data-testid="overpayment-card"
    >
      {isUnresolved ? <AlertTriangleIcon /> : <CheckCircle2Icon />}
      <AlertTitle className="line-clamp-none">
        {isUnresolved ? (
          t("overpayment.title", { amount: format(overpayment.unresolved) })
        ) : (
          <span className="flex flex-wrap justify-between gap-x-2">
            <span>{t("overpayment.resolved.title")}</span>
            <span className="tabular-nums">
              {t("overpayment.resolved.total", {
                amount: format(
                  overpayment.answers
                    .filter(({ isWithdrawn }) => !isWithdrawn)
                    .reduce((sum, { answered }) => sum + answered, 0)
                ),
              })}
            </span>
          </span>
        )}
      </AlertTitle>
      <AlertDescription>
        {isUnresolved ? <p>{t("overpayment.description")}</p> : null}
        {isUnresolved && collisions.length > 0 ? (
          <CollisionStep collisions={collisions} format={format} />
        ) : null}
        {isUnresolved && collisions.length === 0 ? (
          <div className="mt-2 flex w-full flex-col gap-2 sm:grid sm:grid-cols-3">
            <Button
              type="button"
              variant="outline"
              className={resolutionActionClassName}
              onClick={startReturn}
            >
              {t("overpayment.action.return")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className={resolutionActionClassName}
              onClick={() => setResolving("tip")}
            >
              {t("overpayment.action.tip")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className={resolutionActionClassName}
              onClick={() => setResolving("kept")}
            >
              {t("overpayment.action.keep")}
            </Button>
            {onDecideLater === undefined ? null : (
              <Button
                type="button"
                variant="ghost"
                className={cn(resolutionActionClassName, "sm:col-span-3")}
                onClick={onDecideLater}
              >
                {t("overpayment.decideLater")}
              </Button>
            )}
          </div>
        ) : null}
        {overpayment.answers.length > 0 ? (
          <div className="mt-2 flex w-full flex-col divide-y">
            {overpayment.answers.map((answer) => (
              <OverpaymentAnswerRow
                key={`${answer.source.type}:${"id" in answer.source ? answer.source.id : answer.paymentId}`}
                answer={answer}
                billLabel={billLabel}
                format={format}
              />
            ))}
          </div>
        ) : null}
      </AlertDescription>
      {resolving === null ? null : (
        <ResolveOverpaymentDialog
          resolution={resolving}
          overpayment={overpayment}
          billLabel={billLabel}
          currency={currency}
          payments={holding}
          onClose={() => setResolving(null)}
        />
      )}
      {choosingReturn ? (
        <ReturnPaymentPicker
          payments={returnable}
          overpayment={overpayment}
          format={format}
          onPick={(payment) => {
            setChoosingReturn(false)
            returnFrom(payment)
          }}
          onClose={() => setChoosingReturn(false)}
        />
      ) : null}
    </Alert>
  )
}

function CollisionStep({
  collisions,
  format,
}: {
  readonly collisions: ReadonlyArray<OverpaymentCardPayment>
  readonly format: (value: number) => string
}) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const { require } = useRequirePermission()
  const [pending, setPending] = useState(false)

  const confirmPaid = async (paymentId: PaymentId) => {
    if (
      !(await require("sell", "access.action.confirmPaidDespiteCancellation"))
    ) {
      return
    }
    setPending(true)
    await runToast(async (run) => {
      const result = await run(confirmPaymentPaidDespiteCancellation(paymentId))
      if (!result.ok) return "paymentDetail.collision.markPaid.error"
    })
    setPending(false)
  }

  return (
    <div className="mt-2 flex w-full flex-col gap-2">
      <p>{t("overpayment.collision.description")}</p>
      {collisions.map((payment) => (
        <Button
          key={payment.id}
          type="button"
          disabled={pending}
          onClick={() => void confirmPaid(payment.id)}
        >
          {t("overpayment.collision.confirm", {
            amount: format(payment.amount),
          })}
        </Button>
      ))}
    </div>
  )
}

function OverpaymentAnswerRow({
  answer,
  billLabel,
  format,
}: {
  readonly answer: OverpaymentAnswer
  readonly billLabel: string
  readonly format: (value: number) => string
}) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const confirm = useConfirmDialog()
  const jotaiStore = useStore()
  const { require } = useRequirePermission()
  const notCounted = answer.amount - answer.answered
  const canWithdraw =
    !answer.isWithdrawn &&
    (answer.source.type === "tip" || answer.source.type === "kept")

  const withdraw = async () => {
    if (answer.source.type !== "tip" && answer.source.type !== "kept") return
    const resolutionId = answer.source.id
    const detail = t("overpayment.pinDetail", {
      action: t("overpayment.withdraw.amount", {
        amount: format(answer.amount),
      }),
      bill: billLabel,
    })
    if (
      !(await require("refund", "access.action.resolveOverpayment", detail))
    ) {
      return
    }
    const confirmed = await confirm({
      title: t("overpayment.withdraw.title"),
      description: t("overpayment.withdraw.description"),
      confirmLabel: t("overpayment.withdraw"),
      cancelLabel: t("overpayment.dialog.cancel"),
      variant: "destructive",
    })
    if (!confirmed) return
    const { device } = await jotaiStore.get(accountAtom)
    const withdrawn = await runToast(async (run) => {
      const result = await run(
        withdrawOverpaymentResolution({ resolutionId, deviceId: device.id })
      )
      if (!result.ok) return withdrawErrorKeys[result.error.type]
    })
    if (withdrawn) toast.success(t("overpayment.withdrawn"))
  }

  return (
    <div className="flex flex-col gap-1 py-2" data-testid="overpayment-answer">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            {t(answerLabelKeys[answer.source.type])}
            {answer.isWithdrawn ? (
              <Badge variant="secondary">
                {t("overpayment.breakdown.withdrawn")}
              </Badge>
            ) : null}
          </span>
          {!answer.isWithdrawn && notCounted > 0 ? (
            <span className="text-xs">
              {t("overpayment.breakdown.notCounted", {
                amount: format(notCounted),
              })}
            </span>
          ) : null}
        </div>
        <span
          className={cn(
            "shrink-0 text-sm font-semibold tabular-nums",
            answer.isWithdrawn
              ? "text-muted-foreground line-through"
              : "text-foreground"
          )}
        >
          {format(answer.isWithdrawn ? answer.amount : answer.answered)}
        </span>
      </div>
      {canWithdraw ? (
        <Button
          type="button"
          variant="ghost"
          className="h-11 self-start"
          onClick={() => void withdraw()}
        >
          {t("overpayment.withdraw")}
        </Button>
      ) : null}
    </div>
  )
}

function PaymentChoice({
  payments,
  overpayment,
  value,
  disabled,
  format,
  onChange,
}: {
  readonly payments: ReadonlyArray<OverpaymentCardPayment>
  readonly overpayment: BillOverpayment
  readonly value: PaymentId | null
  readonly disabled: boolean
  readonly format: (value: number) => string
  readonly onChange: (payment: OverpaymentCardPayment) => void
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const optionLabel = (payment: OverpaymentCardPayment) =>
    paymentOptionLabel({
      payment,
      overpayment,
      locale,
      t,
      format,
      formatList: (items) => new Intl.ListFormat(locale).format(items),
    })

  return (
    <FieldSet>
      <FieldLegend variant="label">
        {t("overpayment.dialog.payment")}
      </FieldLegend>
      <ToggleGroup
        aria-label={t("overpayment.dialog.payment")}
        className="grid w-full grid-cols-1 gap-2"
        variant="outline"
        disabled={disabled}
        value={value === null ? [] : [value]}
        onValueChange={(values) => {
          const picked = payments.find(({ id }) => id === values[0])
          if (picked !== undefined) onChange(picked)
        }}
      >
        {payments.map((payment) => (
          <ChoiceToggleItem key={payment.id} value={payment.id}>
            {optionLabel(payment)}
          </ChoiceToggleItem>
        ))}
      </ToggleGroup>
    </FieldSet>
  )
}

function ReturnPaymentPicker({
  payments,
  overpayment,
  format,
  onPick,
  onClose,
}: {
  readonly payments: ReadonlyArray<OverpaymentCardPayment>
  readonly overpayment: BillOverpayment
  readonly format: (value: number) => string
  readonly onPick: (payment: OverpaymentCardPayment) => void
  readonly onClose: () => void
}) {
  const { t } = useTranslation()

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("overpayment.action.return")}</DialogTitle>
        </DialogHeader>
        <PaymentChoice
          payments={payments}
          overpayment={overpayment}
          value={null}
          disabled={false}
          format={format}
          onChange={onPick}
        />
      </DialogContent>
    </Dialog>
  )
}

function ResolveOverpaymentDialog({
  resolution,
  overpayment,
  billLabel,
  currency,
  payments,
  onClose,
}: {
  readonly resolution: Resolution
  readonly overpayment: BillOverpayment
  readonly billLabel: string
  readonly currency: FiatCurrency
  readonly payments: ReadonlyArray<OverpaymentCardPayment>
  readonly onClose: () => void
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const runToast = useRunToast()
  const jotaiStore = useStore()
  const { require } = useRequirePermission()
  const format = (value: number) =>
    formatMoney({ value: NonNegativeInteger(value), currency }, locale)
  const keys = resolutionKeys[resolution]
  const candidates = payments.filter(
    (payment) => resolvableFrom(overpayment, payment) > 0
  )
  const [payment, setPayment] = useState<OverpaymentCardPayment | null>(
    candidates[0] ?? null
  )
  const [typedAmountText, setTypedAmountText] = useState<string | null>(null)
  const [amountLeft, setAmountLeft] = useState(false)
  const [guestLeftTip, setGuestLeftTip] = useState(false)
  const [pending, setPending] = useState(false)
  const { room, amountText, amount, amountErrorKey, canConfirm } =
    deriveResolveForm({
      resolution,
      overpayment,
      payment,
      typedAmountText,
      amountLeft,
      guestLeftTip,
      pending,
      currency,
    })
  const amountError =
    amountErrorKey === null ? null : t(amountErrorKey, { amount: format(room) })

  const confirm = async () => {
    if (!canConfirm || payment === null || amount === null) return
    const detail = t("overpayment.pinDetail", {
      action: t(keys.confirm, { amount: format(amount) }),
      bill: billLabel,
    })
    if (
      !(await require("refund", "access.action.resolveOverpayment", detail))
    ) {
      return
    }
    setPending(true)
    const { device } = await jotaiStore.get(accountAtom)
    const recorded = await runToast(async (run) => {
      const result = await run(
        recordOverpaymentResolution({
          paymentId: payment.id,
          kind: resolution,
          amount,
          deviceId: device.id,
        })
      )
      if (!result.ok) return recordErrorKeys[result.error.type]
    })
    setPending(false)
    if (recorded) {
      toast.success(t(keys.recorded))
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
          <DialogTitle>{t(keys.title)}</DialogTitle>
          <DialogDescription className="flex flex-col gap-1">
            <span>
              {t("overpayment.dialog.description", { amount: format(room) })}
            </span>
            <span>{t(keys.consequence)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {candidates.length > 1 ? (
            <PaymentChoice
              payments={candidates}
              overpayment={overpayment}
              value={payment?.id ?? null}
              disabled={pending}
              format={format}
              onChange={(picked) => {
                setPayment(picked)
                setTypedAmountText(null)
                setAmountLeft(false)
              }}
            />
          ) : null}
          <Field data-invalid={amountError !== null}>
            <FieldLabel htmlFor="overpayment-amount">
              {t("overpayment.dialog.amount")}
            </FieldLabel>
            <Input
              id="overpayment-amount"
              value={amountText}
              inputMode="decimal"
              autoComplete="off"
              disabled={pending}
              aria-invalid={amountError !== null}
              aria-describedby={
                amountError === null ? undefined : "overpayment-amount-error"
              }
              onChange={(event) => {
                setTypedAmountText(event.currentTarget.value)
                setAmountLeft(false)
              }}
              onBlur={() => setAmountLeft(true)}
            />
            <FieldError id="overpayment-amount-error">{amountError}</FieldError>
          </Field>
          {resolution === "tip" ? (
            <Field orientation="horizontal">
              <Checkbox
                id="overpayment-guest-tip"
                checked={guestLeftTip}
                disabled={pending}
                onCheckedChange={(checked) => setGuestLeftTip(checked === true)}
              />
              <FieldContent>
                <FieldLabel htmlFor="overpayment-guest-tip">
                  {t("overpayment.dialog.tipConfirm")}
                </FieldLabel>
              </FieldContent>
            </Field>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onClose}
          >
            {t("overpayment.dialog.cancel")}
          </Button>
          <Button
            type="button"
            disabled={!canConfirm}
            onClick={() => void confirm()}
          >
            {amount === null
              ? t(keys.confirmEmpty)
              : t(keys.confirm, { amount: format(amount) })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
