import type { InferRow } from "@evolu/common"
import { derivePaymentDetailState } from "@payky/app-shared/activity-detail"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { qerkoStepKeys } from "@payky/app-shared/qerko-terminal-flow"
import {
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
import { cardSwitchioClosuresOfDeviceSinceQuery } from "@payky/core/modules/card-switchio-closure/card-switchio-closure-queries"
import type { DeviceId } from "@payky/core/modules/device/device-types"
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
import {
  type StartCardSwitchioRefundError,
  type StartCardSwitchioRefundInput,
  startCardSwitchioRefund,
} from "@payky/core/modules/refund/refund-switchio-actions"
import { chooseSwitchioRefundKind } from "@payky/core/modules/refund/refund-switchio-utils"
import type { RefundMethod } from "@payky/core/modules/refund/refund-types"
import type { RefundableLine } from "@payky/core/modules/refund/refund-utils"
import type { NonNegativeInteger } from "@payky/core/modules/shared/schema"
import { router, useLocalSearchParams } from "expo-router"
import { useAtomValue } from "jotai"
import type { LucideIcon } from "lucide-react-native"
import Banknote from "lucide-react-native/icons/banknote"
import CreditCard from "lucide-react-native/icons/credit-card"
import ExternalLink from "lucide-react-native/icons/external-link"
import Minus from "lucide-react-native/icons/minus"
import Plus from "lucide-react-native/icons/plus"
import {
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import { ActivityIndicator } from "react-native"
import { Text, XStack, YStack } from "tamagui"
import { z } from "zod"
import { accountAtom } from "../../atoms/account.ts"
import { NotFoundCard } from "../../components/not-found-card.tsx"
import { QerkoIcon } from "../../components/qerko-icon.tsx"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "../../components/ui/alert.tsx"
import { Button } from "../../components/ui/button.tsx"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "../../components/ui/field.tsx"
import { Icon } from "../../components/ui/icon.tsx"
import { Input } from "../../components/ui/input.tsx"
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group.tsx"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "../../components/ui/toggle-group.tsx"
import {
  useEvoluQuery,
  useOptionalEvoluQuery,
  usePreloadEvoluQueries,
} from "../../hooks/use-evolu-query.ts"
import { useRunToast } from "../../hooks/use-run-toast.ts"
import { useToast } from "../../hooks/use-toast.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney } from "../../lib/format-money.ts"
import { fontSize, fontWeight } from "../../theme/tokens.ts"
import { DetailScreen } from "./detail-parts.tsx"
import { PaymentDetailSkeleton } from "./payment-detail-page.tsx"
import { QerkoKeyRejected, useQerkoRefundPoll } from "./payment-refunds.tsx"
import {
  paymentRefundsQueries,
  type RefundablePayment,
  usePaymentRefundState,
} from "./use-payment-refund-state.ts"

/** The `choice` search param the payment's collision opens the screen with. */
const RefundChoiceParam = z.enum(["whole", "part", "tip"]).optional()

/**
 * `/activity/[paymentId]/refund`: the one screen every refund starts from
 * (refund-flow): what to refund (the whole payment, a part of the goods or
 * the tip alone), how much of a part, and how the money goes back, each
 * method saying what confirming it does. Its route asks for `refund`
 * (access/0002), so its actions ask nothing more. `?choice=` starts it on
 * a choice other than the default, as the payment's collision does.
 */
export function RefundPage() {
  const { t } = useTranslation()
  const { paymentId, choice } = useLocalSearchParams<{
    paymentId: string
    choice?: string
  }>()
  const parsed = PaymentId.safeParse(paymentId)
  const initialChoice = RefundChoiceParam.safeParse(choice).data

  return (
    <DetailScreen title={t("refund.page.title")}>
      {parsed.success ? (
        <Suspense fallback={<PaymentDetailSkeleton />}>
          <RefundScreen paymentId={parsed.data} initialChoice={initialChoice} />
        </Suspense>
      ) : (
        <NotFoundCard messageKey="paymentDetail.invalidId" />
      )}
    </DetailScreen>
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
 * phone's SwitchioPay in the foreground, a reversal the terminal declined
 * (refund/0008), or the Qerko terminal's attempt started at `startedAt`.
 */
type CardStep =
  | { readonly kind: "idle" }
  | { readonly kind: "switchio" }
  | {
      readonly kind: "reversalDeclined"
      readonly input: StartCardSwitchioRefundInput
    }
  | { readonly kind: "qerko"; readonly startedAt: number }

/** What a refund gives back, in the shape every refund action takes. */
type RefundWhat =
  | { readonly whole: true }
  | { readonly tip: true }
  | { readonly amount: NonNegativeInteger }
  | { readonly lines: ReadonlyArray<RefundLineInput> }

const switchioRefundErrorKeys = {
  PaymentNotFound: "paymentDetail.notFound",
  RefundPaymentNotPaid: "refund.error.notPaid",
  RefundAmountInvalid: "refund.error.amount",
  RefundItemsUnavailable: "refund.error.items",
  RefundLineUnavailable: "refund.error.items",
  RefundTipUnavailable: "refund.error.tip",
  CardSwitchioRefundNotAvailable: "refund.switchio.error.notAvailable",
  CardSwitchioRefundAttemptRunning: "refund.switchio.error.running",
  CardSwitchioRefundDeclined: "refund.switchio.failed",
  CardSwitchioReversalDeclined: "refund.switchio.reversalDeclined.title",
  SwitchioRefundNotStarted: "refund.switchio.error.notStarted",
  SwitchioLaunchRefused: "refund.switchio.error.notStarted",
  SwitchioUnavailable: "paymentWait.cardPaid.error.unavailable",
} satisfies Record<StartCardSwitchioRefundError["type"], TranslationKey>

/** Each method's mark on its choice card. */
const refundMethodIcons = {
  cardSwitchio: CreditCard,
  qerkoTerminal: CreditCard,
  qerkoPayment: QerkoIcon,
  cashRegister: Banknote,
  outside: ExternalLink,
} satisfies Record<RefundMethod, LucideIcon>

/** The success toast of each choice refunded by a recorded method. */
const recordedRefundDoneKeys = {
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
  const toast = useToast()
  const runToast = useRunToast()
  const { device } = useAtomValue(accountAtom)
  const {
    refunds,
    availability,
    qerkoTerminalTid,
    qerkoAttempts,
    switchioSource,
    options,
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
  const mode = options.partModes.includes(pickedMode) ? pickedMode : "amount"
  /** The amount field and the form as they stand for a method. */
  const formOf = (forMethod: RefundMethod) => {
    const text = deriveRefundAmountText({
      typedAmountText,
      remainingAmount,
      excess,
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
      : choiceOption.choice === "part"
        ? formOf(forMethod).refundAmount
        : choiceOption.amount
  const form = formOf(method ?? "outside")
  const { amountText } = form
  const refundAmount = refundAmountOf(method ?? "outside")
  const switchioRefundKind = useSwitchioRefundKind(
    choiceOption?.choice === "whole" &&
      options.methods.whole.includes("cardSwitchio") &&
      switchioSource !== undefined
      ? {
          deviceId: device.id,
          charged: payment.amount,
          goods: remainingAmount,
          tip: choiceOption.tipAmount,
          refundCount: refunds.length,
          source: switchioSource,
        }
      : null
  )

  const backToPayment = useCallback(() => {
    if (router.canGoBack()) router.back()
    else
      router.replace({
        pathname: "/activity/[paymentId]",
        params: { paymentId: payment.id },
      })
  }, [payment.id])
  /** Closes the screen with a toast: success, or the warning of an unknown result. */
  const leave = useCallback(
    (variant: "success" | "error", key: TranslationKey) => {
      toast[variant](t(key))
      backToPayment()
    },
    [toast, t, backToPayment]
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
  }, [qerko.settled, leave, toast, t, backToPayment])

  const changeChoice = (next: RefundChoice) => {
    setPickedChoice(next)
    if (method !== null) {
      setPickedMethod(selectRefundMethod({ options, choice: next, method }))
    }
  }

  const runSwitchio = async (input: StartCardSwitchioRefundInput) => {
    setStep({ kind: "switchio" })
    let next: CardStep = { kind: "idle" }
    let settled = null as "refunded" | "unresolved" | null
    await runToast(async (run) => {
      const result = await run(startCardSwitchioRefund(input))
      if (result.ok) {
        settled = result.value.status === "refunded" ? "refunded" : "unresolved"
        return undefined
      }
      // Staff choose on the screen whether to refund to the card instead.
      if (result.error.type === "CardSwitchioReversalDeclined") {
        next = { kind: "reversalDeclined", input }
        return undefined
      }
      return switchioRefundErrorKeys[result.error.type]
    })
    setStep(next)
    if (settled === "refunded") leave("success", "refund.switchio.done")
    if (settled === "unresolved") leave("error", "refund.switchio.unresolved")
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
            ? { ...base, amount: what.amount }
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
    if (method === "cardSwitchio") {
      await runSwitchio({ paymentId: payment.id, deviceId: device.id, ...what })
    } else if (method === "qerkoTerminal") {
      await runQerkoTerminal(what)
    } else if (method === "qerkoPayment") {
      await runQerkoPayment()
    } else {
      await runRecorded(method, what)
    }
  }

  const header = (
    <Text
      fontSize={fontSize.sm}
      lineHeight={fontSize.sm}
      color="muted-foreground"
    >
      {paymentNumber === null
        ? money(payment.amount)
        : `${t("paymentDetail.number", { number: paymentNumber })} · ${money(payment.amount)}`}
    </Text>
  )

  if (choiceOption === undefined || choice === null || method === null) {
    return (
      <YStack gap={16}>
        {header}
        <Text color="muted-foreground">{t("refund.page.empty")}</Text>
      </YStack>
    )
  }

  return (
    <YStack gap={16}>
      {header}
      <YStack gap={32}>
        {options.choices.length > 1 ? (
          <FieldSet>
            <FieldLegend variant="label">
              {t("refund.dialog.mode.label")}
            </FieldLegend>
            <RadioGroup
              aria-label={t("refund.dialog.mode.label")}
              value={choice}
              onValueChange={changeChoice}
              disabled={busy}
            >
              {options.choices.map((option) => (
                <FieldLabel key={option.choice}>
                  <Field orientation="horizontal" gap={12}>
                    <RadioGroupItem value={option.choice} />
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
                    <Text
                      fontSize={fontSize.sm}
                      lineHeight={fontSize.sm}
                      fontVariant={["tabular-nums"]}
                    >
                      {option.choice === "part"
                        ? t("refund.page.choice.part.left", {
                            amount: money(option.amount),
                          })
                        : money(option.amount)}
                    </Text>
                  </Field>
                </FieldLabel>
              ))}
            </RadioGroup>
          </FieldSet>
        ) : null}

        {choice === "part" ? (
          <FieldSet>
            <FieldLegend variant="label">
              {t("refund.page.amount.label")}
            </FieldLegend>
            {refundableTipAmount > 0 ? (
              <Text
                fontSize={fontSize.sm}
                lineHeight={fontSize.sm}
                color="muted-foreground"
              >
                {t("refund.dialog.tipHint", {
                  amount: money(refundableTipAmount),
                })}
              </Text>
            ) : null}
            {options.partModes.includes("items") ? (
              <ToggleGroup
                aria-label={t("refund.page.amount.label")}
                value={mode}
                onValueChange={setMode}
                variant="outline"
                columns={2}
                disabled={busy}
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
              <Field>
                <FieldLabel>{t("refund.dialog.amount.label")}</FieldLabel>
                <Input
                  value={amountText}
                  keyboardType="decimal-pad"
                  autoComplete="off"
                  disabled={busy}
                  invalid={form.typedAmount === null}
                  onChangeText={setTypedAmountText}
                />
                <FieldError>
                  {form.typedAmount === null
                    ? t("refund.dialog.amount.invalid", {
                        amount: money(remainingAmount),
                      })
                    : undefined}
                </FieldError>
              </Field>
            ) : (
              <YStack gap={8}>
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
              </YStack>
            )}
          </FieldSet>
        ) : null}

        <FieldSet>
          <FieldLegend variant="label">
            {t("refund.dialog.method.label")}
          </FieldLegend>
          <RadioGroup
            aria-label={t("refund.dialog.method.label")}
            value={method}
            onValueChange={setPickedMethod}
            disabled={busy}
          >
            {options.methods[choice].map((option) => {
              const outcome = describeRefundOutcome({
                choice,
                method: option,
                switchioRefundKind,
                amount: refundAmountOf(option) ?? choiceOption.amount,
                tipAmount: choiceOption.tipAmount,
                currency: payment.currency,
                formatAmount: money,
              })
              return (
                <FieldLabel key={option}>
                  <Field orientation="horizontal" gap={12}>
                    <RadioGroupItem value={option} />
                    <Icon
                      icon={refundMethodIcons[option]}
                      color="muted-foreground"
                    />
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
      </YStack>

      {step.kind === "switchio" ? (
        <CardProgress
          title={t("refund.switchio.pending")}
          detail={t("refund.page.switchio.waiting")}
        />
      ) : null}
      {step.kind === "qerko" ? (
        <CardProgress
          title={t("refund.qerko.pending")}
          detail={t(qerkoStepKeys[qerko.step])}
        >
          {qerko.keyRejected ? <QerkoKeyRejected /> : null}
        </CardProgress>
      ) : null}
      {step.kind === "reversalDeclined" ? (
        <Alert variant="destructive">
          <AlertTitle numberOfLines={2}>
            {t("refund.switchio.reversalDeclined.title")}
          </AlertTitle>
          <AlertDescription>
            {t("refund.switchio.reversalDeclined.description")}
          </AlertDescription>
          <AlertAction>
            <Button
              label={t("refund.switchio.reversalDeclined.confirm")}
              onPress={() =>
                void runSwitchio({ ...step.input, referral: true })
              }
            />
            <Button
              variant="outline"
              label={t("refund.switchio.reversalDeclined.cancel")}
              onPress={() => setStep({ kind: "idle" })}
            />
          </AlertAction>
        </Alert>
      ) : null}

      {step.kind === "reversalDeclined" ? null : (
        <Button
          size="lg"
          label={
            refundAmount === null
              ? t("refund.dialog.confirmEmpty")
              : t("refund.dialog.confirm", { amount: money(refundAmount) })
          }
          pending={pending || step.kind === "switchio"}
          disabled={refundAmount === null || step.kind === "qerko"}
          onPress={() => void confirm()}
        />
      )}
    </YStack>
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
    <YStack
      testID="refund-card-progress"
      gap={8}
      bg="tile"
      rounded={12}
      px={12}
      py={12}
    >
      <Text
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
        fontWeight={fontWeight.semibold}
      >
        {title}
      </Text>
      <XStack items="center" gap={8}>
        <ActivityIndicator />
        <Text
          flex={1}
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          color="muted-foreground"
        >
          {detail}
        </Text>
      </XStack>
      {children}
    </YStack>
  )
}

/**
 * Whether SwitchioPay can still take the whole payment back
 * (`chooseSwitchioRefundKind`, refund/0008), which the SwitchioPay card's
 * sentence tells (`describeRefundOutcome`); `null` while the screen offers
 * no whole refund through it. It needs the closures of the phone that
 * charged the payment.
 */
function useSwitchioRefundKind(
  switchio: {
    readonly deviceId: DeviceId
    readonly charged: NonNegativeInteger
    readonly goods: NonNegativeInteger
    readonly tip: NonNegativeInteger
    readonly refundCount: number
    readonly source: Parameters<typeof chooseSwitchioRefundKind>[0]["source"]
  } | null
) {
  const { source } = switchio ?? {}
  const closures = useOptionalEvoluQuery(
    source?.deviceId === null ||
      source?.deviceId === undefined ||
      source.approvedAt === null
      ? null
      : cardSwitchioClosuresOfDeviceSinceQuery({
          deviceId: source.deviceId,
          since: source.approvedAt,
        })
  ).data
  return switchio === null
    ? null
    : chooseSwitchioRefundKind({
        deviceId: switchio.deviceId,
        charged: switchio.charged,
        requested: { goods: switchio.goods, tip: switchio.tip },
        refundCount: switchio.refundCount,
        source: switchio.source,
        closedSinceApproval:
          switchio.source.deviceId === null ||
          switchio.source.approvedAt === null ||
          closures.length > 0,
      })
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
    <XStack
      items="center"
      justify="space-between"
      gap={12}
      bg="surface-raised"
      rounded={12}
      px={12}
      py={8}
    >
      <YStack flex={1} minW={0}>
        <Text
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          fontWeight={fontWeight.medium}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text
          fontSize={fontSize.xs}
          lineHeight={fontSize.xs}
          color="muted-foreground"
        >
          {t("refund.dialog.items.available", {
            quantity: String(refundable.remainingQuantity),
          })}
        </Text>
      </YStack>
      <XStack items="center" gap={8}>
        <Button
          variant="outline"
          size="icon-lg"
          iconStart={Minus}
          aria-label={t("refund.dialog.items.decrease", { name })}
          disabled={disabled || quantity === 0}
          onPress={() => onStep(-1)}
        />
        <Text
          w={32}
          text="center"
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          fontWeight={fontWeight.semibold}
          fontVariant={["tabular-nums"]}
        >
          {quantity}
        </Text>
        <Button
          variant="outline"
          size="icon-lg"
          iconStart={Plus}
          aria-label={t("refund.dialog.items.increase", { name })}
          disabled={disabled || quantity >= refundable.remainingQuantity}
          onPress={() => onStep(1)}
        />
      </XStack>
    </XStack>
  )
}
