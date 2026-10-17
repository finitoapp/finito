import type { InferRow } from "@evolu/common"
import { derivePaymentDetailState } from "@payky/app-shared/activity-detail"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { qerkoStepKeys } from "@payky/app-shared/qerko-terminal-flow"
import {
  deriveGoodsPartOfReturn,
  deriveRefundAmountText,
  deriveRefundForm,
  describeQerkoRefundError,
  describeRefundOutcome,
  qerkoPaymentRefundErrorKeys,
  type RefundablePaymentLine,
  type RefundChoice,
  type RefundMode,
  type RefundQuantities,
  refundChoiceLabelKey,
  refundErrorKeys,
  refundOptionMethodLabelKey,
  selectRefundMethod,
  stepRefundQuantity,
  tipRefundErrorKeys,
  wholeRefundErrorKeys,
} from "@payky/app-shared/refund-form"
import { useNow } from "@payky/app-shared/use-now"
import {
  paymentDetailQuery,
  paymentReconciliationsQuery,
} from "@payky/core/modules/payment/payment-queries"
import { PaymentId } from "@payky/core/modules/payment/payment-types"
import { paymentNumberByPaymentIdQuery } from "@payky/core/modules/payment-number/payment-number-queries"
import {
  type RefundLineInput,
  refundPayment,
  refundPaymentTip,
  refundWholePayment,
} from "@payky/core/modules/refund/refund-actions"
import { startQerkoTerminalRefund } from "@payky/core/modules/refund/refund-qerko-actions"
import { refundQerkoPayment } from "@payky/core/modules/refund/refund-qerko-payment-actions"
import type { qerkoTerminalRefundAttemptsByPaymentIdQuery } from "@payky/core/modules/refund/refund-queries"
import type { RefundMethod } from "@payky/core/modules/refund/refund-types"
import type { RefundableLine } from "@payky/core/modules/refund/refund-utils"
import { NonNegativeInteger } from "@payky/core/modules/shared/schema"
import { useNavigate, useRouter } from "@tanstack/react-router"
import { useAtomValue } from "jotai"
import {
  AlertTriangleIcon,
  BanknoteIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  LoaderCircleIcon,
  type LucideIcon,
  MinusIcon,
  PlusIcon,
} from "lucide-react"
import {
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import { toast } from "sonner"
import { accountAtom } from "@/atoms/account.ts"
import { FadeHeader } from "@/components/fade-header.tsx"
import { NotFoundCard } from "@/components/not-found-card.tsx"
import { QerkoIcon } from "@/components/qerko-icon.tsx"
import { Alert, AlertDescription } from "@/components/reui/alert.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field.tsx"
import { Input } from "@/components/ui/input.tsx"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group.tsx"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx"
import { PaymentDetailSkeleton } from "@/features/activity/payment-detail.tsx"
import {
  QerkoKeyRejected,
  useQerkoRefundPoll,
} from "@/features/activity/payment-refunds.tsx"
import {
  paymentRefundsQueries,
  type RefundablePayment,
  usePaymentRefundState,
} from "@/features/activity/use-payment-refund-state.ts"
import {
  useEvoluQuery,
  usePreloadEvoluQueries,
} from "@/hooks/use-evolu-query.ts"
import { useLocale } from "@/hooks/use-locale.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatMoney } from "@/lib/format-utils.ts"

/**
 * `/activity/$paymentId/refund`: the one screen every refund starts from
 * (refund-flow): what to refund (the money above the bill, the whole
 * payment, a part of the goods or the tip alone), how much of the money above
 * the bill or of a part, and how the money goes back, each
 * method saying what confirming it does. Its route asks for `refund`
 * (access/0002), so its actions ask nothing more. `initialChoice` starts it
 * on a choice other than the default, as the payment's collision does.
 */
export function RefundPage({
  paymentId,
  initialChoice,
}: {
  readonly paymentId: string
  readonly initialChoice: RefundChoice | undefined
}) {
  const { t } = useTranslation()
  const parsed = PaymentId.safeParse(paymentId)

  return (
    <>
      <FadeHeader title={t("refund.page.title")} />

      <section className="pt-16">
        {parsed.success ? (
          <Suspense fallback={<PaymentDetailSkeleton />}>
            <RefundScreen
              paymentId={parsed.data}
              initialChoice={initialChoice}
            />
          </Suspense>
        ) : (
          <NotFoundCard messageKey="paymentDetail.invalidId" />
        )}
      </section>
    </>
  )
}

function RefundScreen({
  paymentId,
  initialChoice,
}: {
  readonly paymentId: PaymentId
  readonly initialChoice: RefundChoice | undefined
}) {
  usePreloadEvoluQueries(
    useMemo(
      () => [
        paymentDetailQuery(paymentId),
        paymentReconciliationsQuery(paymentId),
        paymentNumberByPaymentIdQuery(paymentId),
        ...paymentRefundsQueries(paymentId),
      ],
      [paymentId]
    )
  )
  const [payment] = useEvoluQuery(paymentDetailQuery(paymentId)).data
  const reconciliations = useEvoluQuery(
    paymentReconciliationsQuery(paymentId)
  ).data
  const [paymentNumber] = useEvoluQuery(
    paymentNumberByPaymentIdQuery(paymentId)
  ).data
  // Nothing writes a row when a payment expires; see `useNow`.
  const now = useNow([payment?.expiresAt ?? null])

  if (payment === undefined)
    return <NotFoundCard messageKey="paymentDetail.notFound" />
  const { status, excess, paymentMethodKinds } = derivePaymentDetailState({
    payment,
    reconciliations,
    now,
  })

  return (
    <RefundForm
      payment={payment}
      paymentNumber={paymentNumber?.serialNumber ?? null}
      excess={excess}
      isPaid={status === "paid"}
      paymentMethodKinds={paymentMethodKinds}
      initialChoice={initialChoice}
    />
  )
}

/**
 * Where a refund to the card stands while the screen waits for it: the
 * Qerko terminal's attempt started at `startedAt`.
 */
type CardStep =
  | { readonly kind: "idle" }
  | { readonly kind: "qerko"; readonly startedAt: number }

/** What a refund gives back, in the shape every refund action takes. */
type RefundWhat =
  | { readonly whole: true }
  | { readonly tip: true }
  | { readonly amount: NonNegativeInteger }
  | { readonly lines: ReadonlyArray<RefundLineInput> }

/** Each method's mark on its choice card. */
const refundMethodIcons = {
  cardSwitchio: CreditCardIcon,
  qerkoTerminal: CreditCardIcon,
  qerkoPayment: QerkoIcon,
  cashRegister: BanknoteIcon,
  outside: ExternalLinkIcon,
} satisfies Record<RefundMethod, LucideIcon>

/**
 * A choice card's row (`FieldLabel` around a `Field`): at least 56 high,
 * its radio, icon and text centered whether the text takes one line or two.
 */
const choiceCardClassName =
  "min-h-14 gap-3 has-[>[data-slot=field-content]]:items-center"

/** The success toast of each choice refunded by a recorded method. */
const recordedRefundDoneKeys = {
  overpayment: "refund.created",
  whole: "refund.created",
  part: "refund.created",
  tip: "refund.tipCreated",
} satisfies Record<RefundChoice, TranslationKey>

function RefundForm({
  payment,
  paymentNumber,
  excess,
  isPaid,
  paymentMethodKinds,
  initialChoice,
}: {
  readonly payment: RefundablePayment
  readonly paymentNumber: number | null
  readonly excess: NonNegativeInteger
  readonly isPaid: boolean
  readonly paymentMethodKinds: ReadonlyArray<string>
  readonly initialChoice: RefundChoice | undefined
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const runToast = useRunToast()
  const router = useRouter()
  const navigate = useNavigate()
  const { device } = useAtomValue(accountAtom)
  const {
    refunds,
    availability,
    qerkoTerminalTid,
    qerkoAttempts,
    options,
    overpaymentInput,
    returnableOverpayment,
    overpaidBy,
  } = usePaymentRefundState({ payment, excess, isPaid, paymentMethodKinds })
  const { remainingAmount, refundableTipAmount, refundableLines } = availability
  const money = (value: NonNegativeInteger) =>
    formatMoney({ value, currency: payment.currency }, locale)

  const [pickedChoice, setPickedChoice] = useState<RefundChoice | undefined>(
    initialChoice
  )
  const [pickedMethod, setPickedMethod] = useState<RefundMethod | null>(null)
  const [pickedMode, setMode] = useState<RefundMode>("amount")
  const [typedAmountText, setTypedAmountText] = useState<string | null>(null)
  const [quantities, setQuantities] = useState<RefundQuantities>({})
  const [pending, setPending] = useState(false)
  const [step, setStep] = useState<CardStep>({ kind: "idle" })

  const choiceOption =
    options.choices.find(({ choice }) => choice === pickedChoice) ??
    options.choices.find(({ choice }) => choice === options.defaultChoice)
  const choice = choiceOption?.choice ?? null
  const method =
    choice === null
      ? null
      : selectRefundMethod({
          options,
          choice,
          method: pickedMethod ?? options.defaultMethod ?? "outside",
        })
  const mode =
    choice !== "overpayment" && options.partModes.includes(pickedMode)
      ? pickedMode
      : "amount"
  /** The amount field and the form as they stand for a method. */
  const formOf = (forMethod: RefundMethod) => {
    const text = deriveRefundAmountText({
      typedAmountText,
      remainingAmount,
      returnableOverpayment:
        choice === "overpayment"
          ? returnableOverpayment
          : NonNegativeInteger(0),
      method: forMethod,
      currency: payment.currency,
    })
    return {
      amountText: text,
      ...deriveRefundForm({
        mode,
        amountText: text,
        quantities,
        refundableLines,
        remainingAmount,
        currency: payment.currency,
      }),
    }
  }
  /** What confirming refunds by a method, `null` while the form is invalid. */
  const refundAmountOf = (forMethod: RefundMethod) =>
    choiceOption === undefined
      ? null
      : choiceOption.choice === "part" || choiceOption.choice === "overpayment"
        ? formOf(forMethod).refundAmount
        : choiceOption.amount
  const form = formOf(method ?? "outside")
  const { amountText } = form
  const refundAmount = refundAmountOf(method ?? "outside")
  const goodsPartOfReturn =
    choice === "overpayment"
      ? deriveGoodsPartOfReturn({
          overpaymentInput,
          paymentId: payment.id,
          amount: refundAmount,
        })
      : NonNegativeInteger(0)

  const backToPayment = useCallback(() => {
    if (router.history.canGoBack()) router.history.back()
    else
      void navigate({
        to: "/activity/$paymentId",
        params: { paymentId: payment.id },
        replace: true,
      })
  }, [router, navigate, payment.id])
  /** Closes the screen with a toast: success, or the warning of an unknown result. */
  const leave = useCallback(
    (variant: "success" | "error", key: TranslationKey) => {
      toast[variant](t(key))
      backToPayment()
    },
    [t, backToPayment]
  )

  const qerko = useQerkoRefundSettlement({
    startedAt: step.kind === "qerko" ? step.startedAt : null,
    attempts: qerkoAttempts,
    refunds,
  })
  useEffect(() => {
    if (qerko.settled === null) return
    setStep({ kind: "idle" })
    if (qerko.settled.type === "refunded") {
      leave("success", "refund.page.qerko.done")
    } else if (qerko.settled.type === "unresolved") {
      leave("error", "refund.qerko.unresolved")
    } else if (qerko.settled.type === "failed") {
      // The attempt card on the payment offers to dismiss it.
      toast.error(t(qerko.settled.key))
    } else {
      backToPayment()
    }
  }, [qerko.settled, leave, t, backToPayment])

  const changeChoice = (next: RefundChoice) => {
    setPickedChoice(next)
    setTypedAmountText(null)
    if (method !== null) {
      setPickedMethod(selectRefundMethod({ options, choice: next, method }))
    }
  }

  const runQerkoTerminal = async (what: RefundWhat) => {
    const startedAt = Date.now()
    let progress = null as "refunded" | "unresolved" | "pending" | null
    setPending(true)
    await runToast(async (run) => {
      const result = await run(
        startQerkoTerminalRefund({
          paymentId: payment.id,
          deviceId: device.id,
          ...what,
        })
      )
      if (!result.ok) return describeQerkoRefundError(result.error)
      progress =
        result.value.status === "refunded" ||
        result.value.status === "unresolved"
          ? result.value.status
          : "pending"
      return undefined
    })
    setPending(false)
    if (progress === "refunded") leave("success", "refund.page.qerko.done")
    if (progress === "unresolved") leave("error", "refund.qerko.unresolved")
    if (progress === "pending") setStep({ kind: "qerko", startedAt })
  }

  const runRecorded = async (
    recordedMethod: "cashRegister" | "outside",
    what: RefundWhat
  ) => {
    if (choice === null) return
    setPending(true)
    const refunded = await runToast(async (run) => {
      const base = {
        paymentId: payment.id,
        method: recordedMethod,
        deviceId: device.id,
      }
      if ("whole" in what) {
        const result = await run(refundWholePayment(base))
        return result.ok ? undefined : wholeRefundErrorKeys[result.error.type]
      }
      if ("tip" in what) {
        const result = await run(refundPaymentTip(base))
        return result.ok ? undefined : tipRefundErrorKeys[result.error.type]
      }
      const result = await run(
        refundPayment(
          "amount" in what
            ? {
                ...base,
                amount: what.amount,
                purpose: choice === "overpayment" ? "overpayment" : "goods",
              }
            : { ...base, lines: what.lines }
        )
      )
      return result.ok ? undefined : refundErrorKeys[result.error.type]
    })
    setPending(false)
    if (refunded) leave("success", recordedRefundDoneKeys[choice])
  }

  const runQerkoPayment = async () => {
    setPending(true)
    const refunded = await runToast(async (run) => {
      const result = await run(
        refundQerkoPayment({ paymentId: payment.id, deviceId: device.id })
      )
      return result.ok
        ? undefined
        : qerkoPaymentRefundErrorKeys[result.error.type]
    })
    setPending(false)
    if (refunded) leave("success", "refund.qerkoPayment.done")
  }

  const busy = pending || step.kind !== "idle"
  const confirm = async () => {
    if (busy || choice === null || method === null || refundAmount === null)
      return
    const what: RefundWhat =
      choice === "whole"
        ? { whole: true }
        : choice === "tip"
          ? { tip: true }
          : mode === "amount"
            ? { amount: refundAmount }
            : {
                lines: form.chosenLines.map(({ paymentLineId, quantity }) => ({
                  paymentLineId,
                  quantity,
                })),
              }
    if (method === "qerkoTerminal") {
      await runQerkoTerminal(what)
    } else if (method === "qerkoPayment") {
      await runQerkoPayment()
    } else if (method === "cashRegister" || method === "outside") {
      await runRecorded(method, what)
    }
    // SwitchioPay is Finito's (refund/0007): `usePaymentRefundState` never
    // offers it here.
  }

  const header = (
    <p className="text-sm text-muted-foreground">
      {paymentNumber === null
        ? money(payment.amount)
        : `${t("paymentDetail.number", { number: paymentNumber })} · ${money(payment.amount)}`}
    </p>
  )

  if (choiceOption === undefined || choice === null || method === null) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <p className="text-muted-foreground">{t("refund.page.empty")}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {header}
      <div className="flex flex-col gap-8">
        {options.choices.length > 1 ? (
          <FieldSet>
            <FieldLegend variant="label">
              {t("refund.dialog.mode.label")}
            </FieldLegend>
            <RadioGroup
              aria-label={t("refund.dialog.mode.label")}
              disabled={busy}
              value={choice}
              onValueChange={(value) => {
                const next = options.choices.find(
                  (option) => option.choice === value
                )
                if (next !== undefined) changeChoice(next.choice)
              }}
            >
              {options.choices.map((option) => (
                <FieldLabel
                  key={option.choice}
                  htmlFor={`refund-choice-${option.choice}`}
                >
                  <Field
                    orientation="horizontal"
                    data-disabled={busy}
                    className={choiceCardClassName}
                  >
                    <RadioGroupItem
                      value={option.choice}
                      id={`refund-choice-${option.choice}`}
                    />
                    <FieldContent>
                      <FieldTitle>
                        {t(refundChoiceLabelKey[option.choice])}
                      </FieldTitle>
                      {option.choice === "whole" && option.tipAmount > 0 ? (
                        <FieldDescription>
                          {t("refund.page.choice.whole.tipIncluded", {
                            amount: money(option.tipAmount),
                          })}
                        </FieldDescription>
                      ) : null}
                    </FieldContent>
                    <span className="text-sm tabular-nums">
                      {option.choice === "part"
                        ? t("refund.page.choice.part.left", {
                            amount: money(option.amount),
                          })
                        : money(option.amount)}
                    </span>
                  </Field>
                </FieldLabel>
              ))}
            </RadioGroup>
          </FieldSet>
        ) : null}

        {choice === "part" || choice === "overpayment" ? (
          <FieldSet>
            <FieldLegend variant="label">
              {t("refund.page.amount.label")}
            </FieldLegend>
            {choice === "overpayment" && overpaidBy > 0 ? (
              <p className="text-sm font-semibold">
                {t("overpayment.title", { amount: money(overpaidBy) })}
              </p>
            ) : null}
            {choice === "part" && refundableTipAmount > 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("refund.dialog.tipHint", {
                  amount: money(refundableTipAmount),
                })}
              </p>
            ) : null}
            {choice === "part" && options.partModes.includes("items") ? (
              <ToggleGroup
                aria-label={t("refund.page.amount.label")}
                className="grid w-full grid-cols-2"
                variant="outline"
                disabled={busy}
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
              <Field data-invalid={form.typedAmount === null}>
                <FieldLabel htmlFor="refund-amount">
                  {t("refund.dialog.amount.label")}
                </FieldLabel>
                <Input
                  id="refund-amount"
                  value={amountText}
                  inputMode="decimal"
                  autoComplete="off"
                  disabled={busy}
                  aria-invalid={form.typedAmount === null}
                  onChange={(event) =>
                    setTypedAmountText(event.currentTarget.value)
                  }
                />
                <FieldError>
                  {form.typedAmount === null
                    ? t("refund.dialog.amount.invalid", {
                        amount: money(remainingAmount),
                      })
                    : null}
                </FieldError>
                {goodsPartOfReturn > 0 ? (
                  <Alert variant="warning">
                    <AlertTriangleIcon />
                    <AlertDescription>
                      {t("refund.dialog.goodsPart", {
                        amount: money(goodsPartOfReturn),
                      })}
                    </AlertDescription>
                  </Alert>
                ) : null}
              </Field>
            ) : (
              <div className="flex flex-col gap-2">
                {refundableLines.map((refundable) => (
                  <RefundItemRow
                    key={refundable.line.id}
                    refundable={refundable}
                    quantity={quantities[refundable.line.id] ?? 0}
                    disabled={busy}
                    onStep={(direction) =>
                      setQuantities(
                        stepRefundQuantity(quantities, refundable, direction)
                      )
                    }
                  />
                ))}
              </div>
            )}
          </FieldSet>
        ) : null}

        <FieldSet>
          <FieldLegend variant="label">
            {t("refund.dialog.method.label")}
          </FieldLegend>
          <RadioGroup
            aria-label={t("refund.dialog.method.label")}
            disabled={busy}
            value={method}
            onValueChange={(value) => {
              const next = options.methods[choice].find(
                (option) => option === value
              )
              if (next !== undefined) setPickedMethod(next)
            }}
          >
            {options.methods[choice].map((option) => {
              const MethodIcon = refundMethodIcons[option]
              const outcome = describeRefundOutcome({
                choice,
                method: option,
                // Web offers no refund through SwitchioPay (refund/0007).
                switchioRefundKind: null,
                amount: refundAmountOf(option) ?? choiceOption.amount,
                tipAmount: choiceOption.tipAmount,
                currency: payment.currency,
                formatAmount: money,
              })
              return (
                <FieldLabel key={option} htmlFor={`refund-method-${option}`}>
                  <Field
                    orientation="horizontal"
                    data-disabled={busy}
                    className={choiceCardClassName}
                  >
                    <RadioGroupItem
                      value={option}
                      id={`refund-method-${option}`}
                    />
                    <MethodIcon className="size-5 shrink-0 text-muted-foreground" />
                    <FieldContent>
                      <FieldTitle>
                        {option === "qerkoTerminal" && qerkoTerminalTid !== null
                          ? t("refund.dialog.method.qerkoTerminalTid", {
                              tid: qerkoTerminalTid,
                            })
                          : t(refundOptionMethodLabelKey[option])}
                      </FieldTitle>
                      <FieldDescription>
                        {t(outcome.key, outcome.params)}
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                </FieldLabel>
              )
            })}
          </RadioGroup>
        </FieldSet>
      </div>

      {step.kind === "qerko" ? (
        <CardProgress
          title={t("refund.qerko.pending")}
          detail={t(qerkoStepKeys[qerko.step])}
        >
          {qerko.keyRejected ? <QerkoKeyRejected /> : null}
        </CardProgress>
      ) : null}

      <Button
        size="lg"
        className="h-12"
        disabled={busy || refundAmount === null}
        data-testid="refund-confirm"
        onClick={() => void confirm()}
      >
        {pending ? (
          <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
        ) : null}
        {refundAmount === null
          ? t("refund.dialog.confirmEmpty")
          : t("refund.dialog.confirm", { amount: money(refundAmount) })}
      </Button>
    </div>
  )
}

type QerkoRefundAttemptRow = InferRow<
  ReturnType<typeof qerkoTerminalRefundAttemptsByPaymentIdQuery>
>

type QerkoSettlement =
  | { readonly type: "refunded" }
  | { readonly type: "unresolved" }
  | { readonly type: "failed"; readonly key: TranslationKey }
  /** Taken away without a refund, by another device or staff. */
  | { readonly type: "gone" }

/**
 * Follows the refund to the Qerko terminal the screen started at
 * `startedAt` (`null` while none is): the attempt's step, polled with the
 * payment's own attempt card, and how it ended — approved (its refund is
 * written under the attempt's id), unknown, declined or cancelled, or taken
 * away.
 */
function useQerkoRefundSettlement({
  startedAt,
  attempts,
  refunds,
}: {
  readonly startedAt: number | null
  readonly attempts: ReadonlyArray<QerkoRefundAttemptRow>
  readonly refunds: ReadonlyArray<{ readonly id: string }>
}) {
  const attempt =
    startedAt === null
      ? undefined
      : attempts.find((candidate) => candidate.startedAt >= startedAt)
  // The attempt is remembered once seen, so its end is told from a start not
  // yet visible in the query.
  const [seenId, setSeenId] = useState<QerkoRefundAttemptRow["id"] | null>(null)
  if (startedAt === null && seenId !== null) setSeenId(null)
  if (attempt !== undefined && attempt.id !== seenId) setSeenId(attempt.id)
  const { progress, step, keyRejected } = useQerkoRefundPoll({
    attemptId: attempt?.id ?? seenId ?? undefined,
    pending: attempt?.status === "pending",
  })
  const settled = useMemo((): QerkoSettlement | null => {
    if (startedAt === null) return null
    if (progress?.status === "refunded") return { type: "refunded" }
    if (progress?.status === "unresolved" || attempt?.status === "unknown")
      return { type: "unresolved" }
    if (attempt?.status === "failed")
      return {
        type: "failed",
        key:
          attempt.failureReason === "cancelled"
            ? "refund.qerko.failed.cancelled"
            : "refund.qerko.failed.declined",
      }
    if (attempt === undefined && seenId !== null)
      return refunds.some(({ id }) => id === seenId)
        ? { type: "refunded" }
        : { type: "gone" }
    return null
  }, [startedAt, progress?.status, attempt, seenId, refunds])
  return { step, keyRejected, settled }
}

/** A refund to the card the screen waits for, with what it waits on. */
function CardProgress({
  title,
  detail,
  children,
}: {
  readonly title: string
  readonly detail: string
  readonly children?: ReactNode
}) {
  return (
    <div
      className="flex flex-col gap-2 rounded-xl bg-muted px-3 py-3 text-sm"
      data-testid="refund-card-progress"
    >
      <span className="font-semibold">{title}</span>
      <span className="flex items-center gap-2 text-muted-foreground">
        <LoaderCircleIcon className="size-4 animate-spin" />
        {detail}
      </span>
      {children}
    </div>
  )
}

function RefundItemRow({
  refundable,
  quantity,
  disabled,
  onStep,
}: {
  readonly refundable: RefundableLine<RefundablePaymentLine>
  readonly quantity: number
  readonly disabled: boolean
  readonly onStep: (step: 1 | -1) => void
}) {
  const { t } = useTranslation()
  const { name } = refundable.line

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
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
          disabled={disabled || quantity === 0}
          aria-label={t("refund.dialog.items.decrease", { name })}
          onClick={() => onStep(-1)}
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
          disabled={disabled || quantity >= refundable.remainingQuantity}
          aria-label={t("refund.dialog.items.increase", { name })}
          onClick={() => onStep(1)}
        >
          <PlusIcon />
        </Button>
      </div>
    </div>
  )
}
