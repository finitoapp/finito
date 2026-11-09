import type { InferRow } from "@evolu/common"
import { formatDateTime, formatTime } from "@payky/app-shared/format-date"
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
  paymentCardSwitchioRefundSourceQuery,
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
  cardSwitchioRefundAttemptsByPaymentIdQuery,
  otherClaimedPaymentOfBillQuery,
  qerkoTerminalRefundAttemptsByPaymentIdQuery,
  refundablePaymentLinesQuery,
  refundLinesByPaymentIdQuery,
  refundsByPaymentIdQuery,
} from "@payky/core/modules/refund/refund-queries"
import {
  dismissCardSwitchioRefundAttempt,
  resolveCardSwitchioRefundAttempt,
  type StartCardSwitchioRefundError,
  type StartCardSwitchioRefundInput,
  startCardSwitchioRefund,
} from "@payky/core/modules/refund/refund-switchio-actions"
import {
  isTipRefund,
  type RefundableLine,
  sumGoodsRefundAmounts,
  sumRefundAmounts,
} from "@payky/core/modules/refund/refund-utils"
import {
  type FiatCurrency,
  Integer,
  NonNegativeInteger,
} from "@payky/core/modules/shared/schema"
import { useQuery } from "@tanstack/react-query"
import { parseISO } from "date-fns"
import { router } from "expo-router"
import { useAtomValue } from "jotai"
import Minus from "lucide-react-native/icons/minus"
import Plus from "lucide-react-native/icons/plus"
import RotateCw from "lucide-react-native/icons/rotate-cw"
import Undo2 from "lucide-react-native/icons/undo-2"
import { type ReactNode, useState } from "react"
import { ActivityIndicator } from "react-native"
import { Text, XStack, YStack } from "tamagui"
import { accountAtom } from "../../atoms/account.ts"
import { Button } from "../../components/ui/button.tsx"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card.tsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog.tsx"
import {
  Field,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "../../components/ui/field.tsx"
import { Input } from "../../components/ui/input.tsx"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "../../components/ui/toggle-group.tsx"
import { useRequirePermission } from "../../core/use-access.ts"
import { useAppRun } from "../../hooks/use-app-run.ts"
import { useConfirm } from "../../hooks/use-confirm.ts"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useRunToast } from "../../hooks/use-run-toast.ts"
import { useToast } from "../../hooks/use-toast.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney } from "../../lib/format-money.ts"
import {
  isSwitchioInstalled,
  isSwitchioRefundInFlight,
} from "../../platform/switchio.ts"
import { fontSize, fontWeight, radius } from "../../theme/tokens.ts"
import {
  EetSaleStatusLabel,
  useEetRecordingDeviceWait,
  useEetSaleStatus,
} from "../shared/eet-sale-status.tsx"
import { RefundBadge } from "../shared/refund-badge.tsx"

/**
 * Every query `PaymentRefunds` reads, for the payment screen's
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
  paymentCardSwitchioRefundSourceQuery(paymentId),
  cardSwitchioRefundAttemptsByPaymentIdQuery(paymentId),
]

/**
 * The methods Finito's refund dialogs offer: the shared ones, and the refund
 * to the card through SwitchioPay, which only Finito makes (refund/0007).
 */
type NativeRefundMethod = RefundDialogMethod | "cardSwitchio"

/** The success toast of a method whose refund is not simply recorded. */
const refundCreatedKeys: Partial<Record<NativeRefundMethod, TranslationKey>> = {
  qerkoTerminal: "refund.qerko.started",
  cardSwitchio: "refund.switchio.done",
}

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
  SwitchioUnavailable: "paymentWait.cardPaid.error.unavailable",
} satisfies Record<StartCardSwitchioRefundError["type"], TranslationKey>

/**
 * What a refund to the card through SwitchioPay leaves for `useRunToast`'s
 * action: a failure's toast key, the unknown outcome's warning, or nothing
 * once the terminal approved.
 */
const switchioRefundOutcomeKey = (
  result:
    | { readonly ok: true; readonly value: { readonly status: string } }
    | {
        readonly ok: false
        readonly error: { readonly type: StartCardSwitchioRefundError["type"] }
      }
): TranslationKey | undefined => {
  if (!result.ok) return switchioRefundErrorKeys[result.error.type]
  return result.value.status === "refunded"
    ? undefined
    : "refund.switchio.unresolved"
}

type RefundRun = Parameters<Parameters<ReturnType<typeof useRunToast>>[0]>[0]

/**
 * Refunds to the card through SwitchioPay inside `useRunToast`'s action,
 * a reversal first wherever one can be made (refund/0008). When the terminal
 * declines the reversal, staff are asked whether to refund to the card
 * instead.
 */
function useStartSwitchioRefund() {
  const { t } = useTranslation()
  const confirm = useConfirm()
  return async (
    run: RefundRun,
    input: StartCardSwitchioRefundInput
  ): Promise<TranslationKey | undefined> => {
    const result = await run(startCardSwitchioRefund(input))
    if (result.ok || result.error.type !== "CardSwitchioReversalDeclined") {
      return switchioRefundOutcomeKey(result)
    }
    const referral = await confirm({
      title: t("refund.switchio.reversalDeclined.title"),
      description: t("refund.switchio.reversalDeclined.description"),
      confirmLabel: t("refund.switchio.reversalDeclined.confirm"),
      cancelLabel: t("refund.switchio.reversalDeclined.cancel"),
    })
    if (!referral) return "refund.switchio.reversalDeclined.title"
    return switchioRefundOutcomeKey(
      await run(startCardSwitchioRefund({ ...input, referral: true }))
    )
  }
}

/**
 * Native counterpart of web's `PaymentDetailRefunds`: the refunds already
 * recorded (refund/0001), and the buttons that start a refund of goods
 * (amount or chosen items) or of the tip. Which of them are offered, and the
 * limits, come from `deriveRefundAvailability` (refund/0002, 0004, 0005).
 * The sheets are full-screen modals, as the amount needs the keyboard.
 */
export function PaymentRefunds({
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
  const [sheet, setSheet] = useState<"goods" | "tip" | null>(null)
  const refunds = useEvoluQuery(refundsByPaymentIdQuery(payment.id)).data
  const refundLines = useEvoluQuery(
    refundLinesByPaymentIdQuery(payment.id)
  ).data
  const paymentLines = useEvoluQuery(
    refundablePaymentLinesQuery(payment.id)
  ).data
  const otherClaimedPayments = useEvoluQuery(
    otherClaimedPaymentOfBillQuery(payment.id)
  ).data
  const reversals = useEvoluQuery(eetReversalsByPaymentIdQuery(payment.id)).data
  const qerkoPayment = useEvoluQuery(paymentQerkoTerminalByIdQuery(payment.id))
    .data[0]
  const qerkoAttempts = useEvoluQuery(
    qerkoTerminalRefundAttemptsByPaymentIdQuery(payment.id)
  ).data
  const qerkoPaymentAttempts = useEvoluQuery(
    qerkoPaymentAttemptsByPaymentIdQuery(payment.id)
  ).data
  // A refund to the card needs the id Qerko's receipt handed out and the
  // terminal the payment was taken on, whichever terminal this device uses
  // now (qerko/0006).
  const qerkoRefundable =
    qerkoPayment !== undefined &&
    qerkoPayment.qerkoRefundId !== null &&
    qerkoPayment.terminalId !== null
  const qerkoTerminalTid = qerkoPayment?.terminalTid ?? null
  const switchioSource = useEvoluQuery(
    paymentCardSwitchioRefundSourceQuery(payment.id)
  ).data[0]
  const switchioAttempts = useEvoluQuery(
    cardSwitchioRefundAttemptsByPaymentIdQuery(payment.id)
  ).data
  // A refund to the card needs the id the terminal gave the payment
  // (payment/0009) and a SwitchioPay on this phone to send it from.
  const switchioRefundable =
    switchioSource !== undefined &&
    switchioSource.refundId !== null &&
    isSwitchioInstalled()
  const defaultMethod: NativeRefundMethod =
    switchioRefundable && paymentMethodKinds.includes("cardSwitchio")
      ? "cardSwitchio"
      : defaultRefundMethod(paymentMethodKinds, { qerkoRefundable })
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
  // A payment nothing was refunded of yet goes back whole in one step,
  // taken back on the terminal wherever it can be (refund/0008).
  const canRefundWholeToCard =
    switchioRefundable &&
    canRefund &&
    refunds.length === 0 &&
    !switchioAttempts.some(({ status }) => status !== "failed")
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
  const money = (value: NonNegativeInteger) =>
    formatMoney({ value, currency: payment.currency }, locale)

  if (
    refunds.length === 0 &&
    qerkoAttempts.length === 0 &&
    switchioAttempts.length === 0 &&
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
    switchioAttempts.length > 0 ||
    canRefundWholeToCard ||
    qerkoPaymentRefundAmount !== null ? (
      <YStack gap={8}>
        {qerkoPaymentRefundAmount === null ? null : (
          <QerkoPaymentRefundButton
            paymentId={payment.id}
            amount={money(qerkoPaymentRefundAmount)}
          />
        )}
        {qerkoAttempts.map((attempt) => (
          <QerkoRefundAttempt
            key={attempt.id}
            attempt={attempt}
            formatMinor={money}
          />
        ))}
        {switchioAttempts.map((attempt) => (
          <SwitchioRefundAttempt
            key={attempt.id}
            attempt={attempt}
            formatMinor={money}
          />
        ))}
        {canRefundWholeToCard ? (
          <SwitchioWholeRefundButton
            paymentId={payment.id}
            amount={money(
              NonNegativeInteger(remainingAmount + refundableTipAmount)
            )}
          />
        ) : null}
        {canRefund ? (
          <Button
            variant="outline"
            h={48}
            iconStart={Undo2}
            label={t("paymentDetail.refunds.action")}
            onPress={() => setSheet("goods")}
          />
        ) : null}
        {canRefundTip ? (
          <Button
            variant="outline"
            h={48}
            iconStart={Undo2}
            label={t("paymentDetail.refunds.tipAction", {
              amount: money(refundableTipAmount),
            })}
            onPress={() => setSheet("tip")}
          />
        ) : null}
      </YStack>
    ) : null

  return (
    <>
      {refunds.length === 0 ? (
        refundButtons
      ) : (
        <Card testID="payment-detail-refunds">
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
          <CardContent gap={12}>
            <YStack>
              {refunds.map((refund, index) => (
                <YStack
                  key={refund.id}
                  testID="payment-detail-refund"
                  gap={4}
                  py={8}
                  pt={index === 0 ? 0 : 8}
                >
                  <Text
                    fontSize={fontSize.sm}
                    lineHeight={fontSize.sm}
                    fontWeight={fontWeight.semibold}
                  >
                    {money(refund.amount)}
                  </Text>
                  <Text
                    fontSize={fontSize.xs}
                    lineHeight={fontSize.xs}
                    color="muted-foreground"
                  >
                    {isTipRefund(refund)
                      ? `${t("paymentDetail.refunds.tip")} · `
                      : ""}
                    {t(refundMethodLabelKey[refund.method])} ·{" "}
                    {formatDateTime(new Date(refund.refundedAt), locale)}
                  </Text>
                  {refundLines
                    .filter((line) => line.refundId === refund.id)
                    .map((line) => (
                      <Text
                        key={line.id}
                        fontSize={fontSize.xs}
                        lineHeight={fontSize.xs}
                        color="muted-foreground"
                      >
                        {line.quantity} × {line.name}
                      </Text>
                    ))}
                  {reversals
                    .filter((reversal) => reversal.refundId === refund.id)
                    .map((reversal) => (
                      <RefundEetReversal
                        key={reversal.id}
                        reversal={reversal}
                      />
                    ))}
                </YStack>
              ))}
            </YStack>
            {refundButtons}
          </CardContent>
        </Card>
      )}
      {sheet === "goods" ? (
        <RefundSheet
          paymentId={payment.id}
          currency={payment.currency}
          remainingAmount={remainingAmount}
          excess={excess}
          refundableLines={refundableLines}
          tipAmount={refundableTipAmount}
          defaultMethod={defaultMethod}
          qerkoRefundable={qerkoRefundable}
          qerkoTerminalTid={qerkoTerminalTid}
          switchioRefundable={switchioRefundable}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === "tip" ? (
        <TipRefundSheet
          paymentId={payment.id}
          currency={payment.currency}
          tipAmount={refundableTipAmount}
          defaultMethod={defaultMethod}
          qerkoRefundable={qerkoRefundable}
          qerkoTerminalTid={qerkoTerminalTid}
          switchioRefundable={switchioRefundable}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </>
  )
}

/**
 * Web's refund dialogs, on ui/dialog; closing it drops the draft, as
 * cancelling web's dialog does. It cannot be dismissed while a refund is
 * being written.
 */
function Sheet({
  title,
  description,
  pending,
  onClose,
  children,
  footer,
}: {
  readonly title: string
  readonly description: string
  readonly pending: boolean
  readonly onClose: () => void
  readonly children: ReactNode
  readonly footer: ReactNode
}) {
  return (
    <Dialog
      open
      dismissOnOverlayPress={!pending}
      onOpenChange={(next) => {
        if (!next && !pending) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <YStack gap={16}>{children}</YStack>
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RefundSheet({
  paymentId,
  currency,
  remainingAmount,
  excess,
  refundableLines,
  tipAmount,
  defaultMethod,
  qerkoRefundable,
  qerkoTerminalTid,
  switchioRefundable,
  onClose,
}: {
  readonly paymentId: PaymentId
  readonly currency: FiatCurrency
  readonly remainingAmount: NonNegativeInteger
  readonly excess: NonNegativeInteger
  readonly refundableLines: ReadonlyArray<RefundableLine<RefundablePaymentLine>>
  readonly tipAmount: NonNegativeInteger
  readonly defaultMethod: NativeRefundMethod
  /** Set when the card can be refunded from this device. */
  readonly qerkoRefundable: boolean
  readonly qerkoTerminalTid: string | null
  /** Set when the card can be refunded through SwitchioPay from this phone. */
  readonly switchioRefundable: boolean
  readonly onClose: () => void
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const runToast = useRunToast()
  const toast = useToast()
  const { require } = useRequirePermission()
  const { device } = useAtomValue(accountAtom)
  const startSwitchioRefund = useStartSwitchioRefund()
  const [mode, setMode] = useState<RefundMode>("amount")
  const [method, setMethod] = useState<NativeRefundMethod>(defaultMethod)
  const [typedAmountText, setTypedAmountText] = useState<string | null>(null)
  const [quantities, setQuantities] = useState<RefundQuantities>({})
  const [pending, setPending] = useState(false)
  const amountText = deriveRefundAmountText({
    typedAmountText,
    remainingAmount,
    excess,
    method,
    currency,
  })
  const { typedAmount, chosenLines, refundAmount } = deriveRefundForm({
    mode,
    amountText,
    quantities,
    refundableLines,
    remainingAmount,
    currency,
  })
  const money = (value: NonNegativeInteger) =>
    formatMoney({ value, currency }, locale)

  const confirm = async () => {
    if (refundAmount === null || pending) return
    // Here rather than where the sheet opens: every refund ends in this
    // confirm (access/0002).
    if (!(await require("refund", "access.action.refund"))) return
    setPending(true)
    const refunded = await runToast(async (run) => {
      const lines = chosenLines.map(({ paymentLineId, quantity }) => ({
        paymentLineId,
        quantity,
      }))
      if (method === "cardSwitchio") {
        if (!switchioRefundable) return "refund.switchio.error.notAvailable"
        return startSwitchioRefund(
          run,
          mode === "amount"
            ? { paymentId, deviceId: device.id, amount: refundAmount }
            : { paymentId, deviceId: device.id, lines }
        )
      }
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
      toast.success(t(refundCreatedKeys[method] ?? "refund.created"))
      onClose()
    }
  }

  return (
    <Sheet
      title={t("refund.dialog.title")}
      description={t("refund.dialog.description")}
      pending={pending}
      onClose={onClose}
      footer={
        <>
          <Button
            label={
              refundAmount === null
                ? t("refund.dialog.confirmEmpty")
                : t("refund.dialog.confirm", { amount: money(refundAmount) })
            }
            pending={pending}
            disabled={refundAmount === null}
            onPress={() => void confirm()}
          />
          <Button
            variant="outline"
            label={t("refund.dialog.cancel")}
            disabled={pending}
            onPress={onClose}
          />
        </>
      }
    >
      {tipAmount > 0 ? (
        <Text
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          color="muted-foreground"
        >
          {t("refund.dialog.tipHint", { amount: money(tipAmount) })}
        </Text>
      ) : null}
      {refundableLines.length > 0 ? (
        <ToggleGroup
          aria-label={t("refund.dialog.mode.label")}
          value={mode}
          onValueChange={setMode}
          variant="outline"
          columns={2}
          disabled={pending}
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
            disabled={pending}
            invalid={typedAmount === null}
            onChangeText={setTypedAmountText}
          />
          <FieldError>
            {typedAmount === null
              ? t("refund.dialog.amount.invalid", {
                  amount: money(remainingAmount),
                })
              : undefined}
          </FieldError>
        </Field>
      ) : (
        <FieldSet>
          <FieldLegend variant="label">
            {t("refund.dialog.items.label")}
          </FieldLegend>
          <YStack>
            {refundableLines.map((refundable) => (
              <RefundItemRow
                key={refundable.line.id}
                refundable={refundable}
                quantity={quantities[refundable.line.id] ?? 0}
                disabled={pending}
                onStep={(step) =>
                  setQuantities(
                    stepRefundQuantity(quantities, refundable, step)
                  )
                }
              />
            ))}
          </YStack>
        </FieldSet>
      )}

      <MethodChoice
        method={method}
        disabled={pending}
        qerkoAvailable={qerkoRefundable}
        qerkoTerminalTid={qerkoTerminalTid}
        switchioAvailable={switchioRefundable}
        onChange={setMethod}
      />
    </Sheet>
  )
}

function TipRefundSheet({
  paymentId,
  currency,
  tipAmount,
  defaultMethod,
  qerkoRefundable,
  qerkoTerminalTid,
  switchioRefundable,
  onClose,
}: {
  readonly paymentId: PaymentId
  readonly currency: FiatCurrency
  readonly tipAmount: NonNegativeInteger
  readonly defaultMethod: NativeRefundMethod
  /** Set when the card can be refunded from this device. */
  readonly qerkoRefundable: boolean
  readonly qerkoTerminalTid: string | null
  /** Set when the card can be refunded through SwitchioPay from this phone. */
  readonly switchioRefundable: boolean
  readonly onClose: () => void
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const runToast = useRunToast()
  const toast = useToast()
  const { require } = useRequirePermission()
  const { device } = useAtomValue(accountAtom)
  const startSwitchioRefund = useStartSwitchioRefund()
  const [method, setMethod] = useState<NativeRefundMethod>(defaultMethod)
  const [pending, setPending] = useState(false)
  const formattedTip = formatMoney({ value: tipAmount, currency }, locale)

  const confirm = async () => {
    if (pending) return
    // Web's tip dialog skips this check although access/0002 puts every
    // refund behind `refund`; native asks, the stricter reading.
    if (!(await require("refund", "access.action.refund"))) return
    setPending(true)
    const refunded = await runToast(async (run) => {
      if (method === "cardSwitchio") {
        if (!switchioRefundable) return "refund.switchio.error.notAvailable"
        return startSwitchioRefund(run, {
          paymentId,
          deviceId: device.id,
          tip: true,
        })
      }
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
      toast.success(t(refundCreatedKeys[method] ?? "refund.tipCreated"))
      onClose()
    }
  }

  return (
    <Sheet
      title={t("refund.tipDialog.title")}
      description={t("refund.tipDialog.description", { amount: formattedTip })}
      pending={pending}
      onClose={onClose}
      footer={
        <>
          <Button
            label={t("refund.dialog.confirm", { amount: formattedTip })}
            pending={pending}
            onPress={() => void confirm()}
          />
          <Button
            variant="outline"
            label={t("refund.dialog.cancel")}
            disabled={pending}
            onPress={onClose}
          />
        </>
      }
    >
      <MethodChoice
        method={method}
        disabled={pending}
        qerkoAvailable={qerkoRefundable}
        qerkoTerminalTid={qerkoTerminalTid}
        switchioAvailable={switchioRefundable}
        onChange={setMethod}
      />
    </Sheet>
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
    <XStack items="center" justify="space-between" gap={12} py={8}>
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

/** Web's `RefundMethodField`: a labelled one-column outline toggle group. */
function MethodChoice({
  method,
  disabled,
  qerkoAvailable,
  qerkoTerminalTid,
  switchioAvailable,
  onChange,
}: {
  readonly method: NativeRefundMethod
  readonly disabled: boolean
  /** The card can be refunded through the terminal from this device. */
  readonly qerkoAvailable: boolean
  /** Names the terminal the refund must go to, when the payment recorded it. */
  readonly qerkoTerminalTid: string | null
  /** The card can be refunded through SwitchioPay on this phone. */
  readonly switchioAvailable: boolean
  readonly onChange: (method: NativeRefundMethod) => void
}) {
  const { t } = useTranslation()
  return (
    <FieldSet>
      <FieldLegend variant="label">
        {t("refund.dialog.method.label")}
      </FieldLegend>
      <ToggleGroup
        aria-label={t("refund.dialog.method.label")}
        value={method}
        onValueChange={onChange}
        variant="outline"
        orientation="vertical"
        disabled={disabled}
      >
        <ToggleGroupItem value="cashRegister" justify="flex-start">
          {t("refund.dialog.method.cashRegister")}
        </ToggleGroupItem>
        {qerkoAvailable ? (
          <ToggleGroupItem value="qerkoTerminal" justify="flex-start">
            {qerkoTerminalTid === null
              ? t("refund.dialog.method.qerkoTerminal")
              : t("refund.dialog.method.qerkoTerminalTid", {
                  tid: qerkoTerminalTid,
                })}
          </ToggleGroupItem>
        ) : null}
        {switchioAvailable ? (
          <ToggleGroupItem value="cardSwitchio" justify="flex-start">
            {t("refund.dialog.method.cardSwitchio")}
          </ToggleGroupItem>
        ) : null}
        <ToggleGroupItem value="outside" justify="flex-start">
          {t("refund.dialog.method.outside")}
        </ToggleGroupItem>
      </ToggleGroup>
      {method === "cardSwitchio" ? (
        <Text
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          color="muted-foreground"
        >
          {t("refund.switchio.hint")}
        </Text>
      ) : null}
    </FieldSet>
  )
}

/**
 * Refunds all of a payment paid through Qerko, as web's
 * `QerkoPaymentRefundButton` (qerko/0010), after a confirmation that says so.
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
  const toast = useToast()
  const confirm = useConfirm()
  const { require } = useRequirePermission()
  const { device } = useAtomValue(accountAtom)
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
      variant="outline"
      h={48}
      iconStart={Undo2}
      pending={pending}
      label={t("paymentDetail.refunds.qerkoPaymentAction", { amount })}
      onPress={() => void refund()}
    />
  )
}

type QerkoRefundAttemptRow = InferRow<
  ReturnType<typeof qerkoTerminalRefundAttemptsByPaymentIdQuery>
>

/** Web's `QerkoRefundAttempt`: a card refund the terminal has not settled. */
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
    <YStack
      testID="payment-detail-qerko-refund"
      gap={8}
      bg="neutral-soft"
      rounded={8}
      px={12}
      py={8}
    >
      <Text
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
        fontWeight={fontWeight.semibold}
      >
        {t("refund.qerko.pending")} · {formatMinor(attempt.amount)}
      </Text>
      {isPending ? (
        <XStack items="center" gap={8}>
          <ActivityIndicator />
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            color="muted-foreground"
          >
            {t(qerkoStepKeys[step])}
          </Text>
        </XStack>
      ) : null}
      {isPending && keyRejected ? (
        <>
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            fontWeight={fontWeight.medium}
            color="destructive"
          >
            {t("paymentWait.qerko.error.keyRejected")}
          </Text>
          <Button
            variant="link"
            label={t("paymentWait.qerko.error.keyRejected.link")}
            onPress={() => {
              router.push("/settings/payment-accounts/qerko-terminal")
            }}
          />
        </>
      ) : null}
      {attempt.status === "failed" ? (
        <>
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            fontWeight={fontWeight.medium}
            color="destructive"
          >
            {t(
              attempt.failureReason === "cancelled"
                ? "refund.qerko.failed.cancelled"
                : "refund.qerko.failed.declined"
            )}
          </Text>
          <Button
            variant="outline"
            label={t("refund.qerko.dismiss")}
            onPress={() => void dismiss()}
          />
        </>
      ) : null}
      {attempt.status === "unknown" ? (
        <>
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            fontWeight={fontWeight.medium}
            color="destructive"
          >
            {t("refund.qerko.unresolved")}
          </Text>
          <Button
            variant="outline"
            label={t("refund.qerko.dismissUnresolved")}
            onPress={() => void dismiss()}
          />
        </>
      ) : null}
    </YStack>
  )
}

/**
 * Refunds all of a SwitchioPay payment to the card, goods and tip in one
 * step, after a confirmation that says so: a reversal wherever the terminal
 * can still take the payment back, a refund to the card otherwise
 * (refund/0008).
 */
function SwitchioWholeRefundButton({
  paymentId,
  amount,
}: {
  readonly paymentId: PaymentId
  readonly amount: string
}) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const toast = useToast()
  const confirm = useConfirm()
  const { require } = useRequirePermission()
  const { device } = useAtomValue(accountAtom)
  const startSwitchioRefund = useStartSwitchioRefund()
  const [pending, setPending] = useState(false)

  const refund = async () => {
    if (pending) return
    if (!(await require("refund", "access.action.refund"))) return
    const confirmed = await confirm({
      title: t("refund.switchio.whole.title"),
      description: t("refund.switchio.whole.description", { amount }),
      confirmLabel: t("refund.switchio.whole.confirm"),
      cancelLabel: t("refund.switchio.whole.cancel"),
      variant: "destructive",
    })
    if (!confirmed) return
    setPending(true)
    const refunded = await runToast((run) =>
      startSwitchioRefund(run, { paymentId, deviceId: device.id, whole: true })
    )
    setPending(false)
    if (refunded) toast.success(t("refund.switchio.done"))
  }

  return (
    <Button
      variant="outline"
      h={48}
      iconStart={Undo2}
      pending={pending}
      label={t("paymentDetail.refunds.wholeAction", { amount })}
      onPress={() => void refund()}
    />
  )
}

type SwitchioRefundAttemptRow = InferRow<
  ReturnType<typeof cardSwitchioRefundAttemptsByPaymentIdQuery>
>

/**
 * A refund to the card through SwitchioPay that is not written as a refund
 * (refund/0007). Only the phone that launched it can ask its SwitchioPay
 * what became of it; any device can dismiss it once staff checked, a
 * pending one too, since its phone may be gone.
 */
function SwitchioRefundAttempt({
  attempt,
  formatMinor,
}: {
  readonly attempt: SwitchioRefundAttemptRow
  readonly formatMinor: (value: NonNegativeInteger) => string
}) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const toast = useToast()
  const confirm = useConfirm()
  const { device } = useAtomValue(accountAtom)
  const [checking, setChecking] = useState(false)
  const isOwnPhone = attempt.deviceId === device.id
  // On its own phone a pending attempt is waiting on SwitchioPay right now;
  // `SwitchioRestoredRefund` asks about it once nothing is.
  const waitingHere = attempt.status === "pending" && isOwnPhone

  const dismiss = async () => {
    if (attempt.status === "pending") {
      const confirmed = await confirm({
        title: t("refund.switchio.dismissPending.title"),
        description: t("refund.switchio.dismissPending.description"),
        confirmLabel: t("refund.switchio.dismissPending.confirm"),
        cancelLabel: t("refund.switchio.dismissPending.cancel"),
        variant: "destructive",
      })
      if (!confirmed) return
    }
    await runToast(async (run) => {
      await run.ok(dismissCardSwitchioRefundAttempt(attempt.id))
    })
  }

  const check = async () => {
    if (checking || isSwitchioRefundInFlight()) return
    setChecking(true)
    let refunded = false
    await runToast(async (run) => {
      const result = await run(
        resolveCardSwitchioRefundAttempt({
          attemptId: attempt.id,
          deviceId: device.id,
        })
      )
      // Only another phone is refused: its terminal never saw the refund.
      if (!result.ok) return "refund.switchio.error.otherDevice"
      if (result.value.status === "unresolved") {
        return "refund.switchio.unresolved"
      }
      refunded = result.value.status === "refunded"
      return undefined
    })
    setChecking(false)
    if (refunded) toast.success(t("refund.switchio.done"))
  }

  return (
    <YStack
      testID="payment-detail-switchio-refund"
      gap={8}
      bg="neutral-soft"
      rounded={8}
      px={12}
      py={8}
    >
      <Text
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
        fontWeight={fontWeight.semibold}
      >
        {t("refund.switchio.pending")} ·{" "}
        {formatMinor(
          // The tip a whole-payment refund returns beside the goods.
          NonNegativeInteger(attempt.amount + (attempt.tipAmount ?? 0))
        )}
      </Text>
      {waitingHere ? <ActivityIndicator /> : null}
      {attempt.status === "pending" && !isOwnPhone ? (
        <>
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            color="muted-foreground"
          >
            {t("refund.switchio.pendingElsewhere")}
          </Text>
          <Button
            variant="outline"
            label={t("refund.qerko.dismissUnresolved")}
            onPress={() => void dismiss()}
          />
        </>
      ) : null}
      {attempt.status === "failed" ? (
        <>
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            fontWeight={fontWeight.medium}
            color="destructive"
          >
            {t("refund.switchio.failed")}
          </Text>
          <Button
            variant="outline"
            label={t("refund.qerko.dismiss")}
            onPress={() => void dismiss()}
          />
        </>
      ) : null}
      {attempt.status === "unknown" ? (
        <>
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            fontWeight={fontWeight.medium}
            color="destructive"
          >
            {t("refund.switchio.unresolved")}
          </Text>
          {isOwnPhone ? (
            <Button
              variant="outline"
              iconStart={RotateCw}
              pending={checking}
              label={t("refund.switchio.check")}
              onPress={() => void check()}
            />
          ) : null}
          <Button
            variant="outline"
            label={t("refund.qerko.dismissUnresolved")}
            onPress={() => void dismiss()}
          />
        </>
      ) : null}
    </YStack>
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

/**
 * Web's `RefundEetReversal`: the EET reversal a refund sends (eet/0007), its
 * status, POK and last error, with a manual resend once the sale it negates
 * is confirmed and no other device holds its priority.
 */
function RefundEetReversal({
  reversal,
}: {
  readonly reversal: RefundEetReversalRow
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const toast = useToast()
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

  const note = (text: string, color: "muted-foreground" | "destructive") => (
    <Text fontSize={fontSize.xs} lineHeight={fontSize.xs} color={color}>
      {text}
    </Text>
  )

  return (
    <YStack
      testID="payment-detail-eet-reversal"
      mt={4}
      gap={6}
      p={12}
      rounded={radius.lg}
      bg="muted-20"
    >
      <XStack items="center" justify="space-between" gap={8}>
        <Text
          flex={1}
          fontSize={fontSize.xs}
          lineHeight={fontSize.xs}
          fontWeight={fontWeight.medium}
        >
          {t("paymentDetail.eet.reversal.title", {
            amount: formatMoney(
              { value: Integer(-reversal.amount), currency: reversal.currency },
              locale
            ),
          })}
        </Text>
        <EetSaleStatusLabel sale={reversal} />
      </XStack>
      {isWaitingForSale
        ? note(t("paymentDetail.eet.reversal.waiting"), "muted-foreground")
        : null}
      {waitEndsAt === null
        ? null
        : note(
            t("paymentDetail.eet.reversal.waitingForDevice", {
              time: formatTime(new Date(waitEndsAt), locale),
            }),
            "muted-foreground"
          )}
      {isOverdue ? note(t("paymentDetail.eet.overdue"), "destructive") : null}
      {reversal.unsupportedReason === null
        ? null
        : note(
            t(reversalUnsupportedKeys[reversal.unsupportedReason]),
            "destructive"
          )}
      {reversal.pok === null
        ? null
        : note(
            `${t("paymentDetail.eet.pok")}: ${reversal.pok}`,
            "muted-foreground"
          )}
      {reversal.receivedAt === null
        ? null
        : note(
            `${t("paymentDetail.eet.receivedAt")}: ${formatDateTime(
              parseISO(reversal.receivedAt),
              locale
            )}`,
            "muted-foreground"
          )}
      {lastError === null
        ? null
        : note(
            `${t("paymentDetail.eet.lastError")}: ${lastError}`,
            "muted-foreground"
          )}
      {canRetry ? (
        <XStack>
          <Button
            variant="outline"
            size="sm"
            iconStart={RotateCw}
            label={t("paymentDetail.eet.retry")}
            pending={retrying}
            onPress={() => void retry()}
          />
        </XStack>
      ) : null}
    </YStack>
  )
}
