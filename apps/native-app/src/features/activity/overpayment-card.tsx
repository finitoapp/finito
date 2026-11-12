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
import { router } from "expo-router"
import { useAtomValue } from "jotai"
import CircleCheck from "lucide-react-native/icons/circle-check"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { useState } from "react"
import { Text, View, XStack, YStack } from "tamagui"
import { accountAtom } from "../../atoms/account.ts"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../components/ui/alert.tsx"
import { Badge } from "../../components/ui/badge.tsx"
import { Button } from "../../components/ui/button.tsx"
import { Checkbox } from "../../components/ui/checkbox.tsx"
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
  FieldContent,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "../../components/ui/field.tsx"
import { Input } from "../../components/ui/input.tsx"
import { ToggleGroup } from "../../components/ui/toggle-group.tsx"
import { useRequirePermission } from "../../core/use-access.ts"
import { useConfirm } from "../../hooks/use-confirm.ts"
import { useRunToast } from "../../hooks/use-run-toast.ts"
import { useToast } from "../../hooks/use-toast.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney } from "../../lib/format-money.ts"
import { fontSize, fontWeight } from "../../theme/tokens.ts"
import { useOverpaymentInput } from "../shared/use-overpayment-input.ts"
import { ChoiceToggleItem } from "./choice-toggle-item.tsx"

/** Web's `OverpaymentCard`: what is unresolved above a bill or payment, and how staff answer it. */
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
  const [choosingReturn, setChoosingReturn] = useState(false)
  const format = (value: number) =>
    formatMoney({ value: NonNegativeInteger(value), currency }, locale)
  const isUnresolved = overpayment.unresolved > 0
  const { collisions, holding, returnable } = partitionOverpaymentPayments(
    overpayment,
    payments
  )

  const returnFrom = (payment: OverpaymentCardPayment) =>
    router.push({
      pathname: "/activity/[paymentId]/refund",
      params: { paymentId: payment.id, choice: "overpayment" },
    })
  const startReturn = () => {
    const [only] = returnable
    if (returnable.length === 1 && only !== undefined) returnFrom(only)
    else setChoosingReturn(true)
  }

  return (
    <View testID="overpayment-card" w="100%">
      <Alert
        variant={isUnresolved ? "warning" : "success"}
        icon={isUnresolved ? TriangleAlert : CircleCheck}
      >
        {isUnresolved ? (
          <AlertTitle numberOfLines={0}>
            {t("overpayment.title", { amount: format(overpayment.unresolved) })}
          </AlertTitle>
        ) : (
          <XStack flexWrap="wrap" justify="space-between" columnGap={8}>
            <AlertTitle numberOfLines={0}>
              {t("overpayment.resolved.title")}
            </AlertTitle>
            <AlertTitle numberOfLines={0} fontVariant={["tabular-nums"]}>
              {t("overpayment.resolved.total", {
                amount: format(
                  overpayment.answers
                    .filter(({ isWithdrawn }) => !isWithdrawn)
                    .reduce((sum, { answered }) => sum + answered, 0)
                ),
              })}
            </AlertTitle>
          </XStack>
        )}
        <AlertDescription>
          {isUnresolved ? t("overpayment.description") : null}
          {isUnresolved && collisions.length > 0 ? (
            <CollisionStep collisions={collisions} format={format} />
          ) : null}
          {isUnresolved && collisions.length === 0 ? (
            <YStack w="100%" gap={8} mt={8}>
              <Button
                variant="outline"
                size="lg"
                label={t("overpayment.action.return")}
                onPress={startReturn}
              />
              <Button
                variant="outline"
                size="lg"
                label={t("overpayment.action.tip")}
                onPress={() => setResolving("tip")}
              />
              <Button
                variant="outline"
                size="lg"
                label={t("overpayment.action.keep")}
                onPress={() => setResolving("kept")}
              />
              {onDecideLater === undefined ? null : (
                <Button
                  variant="ghost"
                  size="lg"
                  label={t("overpayment.decideLater")}
                  onPress={onDecideLater}
                />
              )}
            </YStack>
          ) : null}
          {overpayment.answers.length > 0 ? (
            <YStack w="100%" mt={8}>
              {overpayment.answers.map((answer) => (
                <OverpaymentAnswerRow
                  key={`${answer.source.type}:${"id" in answer.source ? answer.source.id : answer.paymentId}`}
                  answer={answer}
                  billLabel={billLabel}
                  format={format}
                />
              ))}
            </YStack>
          ) : null}
        </AlertDescription>
      </Alert>
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
    </View>
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
      return undefined
    })
    setPending(false)
  }

  return (
    <YStack w="100%" gap={8} mt={8}>
      <Text fontSize={fontSize.sm} lineHeight={fontSize.sm} color="color">
        {t("overpayment.collision.description")}
      </Text>
      {collisions.map((payment) => (
        <Button
          key={payment.id}
          size="lg"
          disabled={pending}
          label={t("overpayment.collision.confirm", {
            amount: format(payment.amount),
          })}
          onPress={() => void confirmPaid(payment.id)}
        />
      ))}
    </YStack>
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
  const toast = useToast()
  const confirm = useConfirm()
  const { device } = useAtomValue(accountAtom)
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
    const withdrawn = await runToast(async (run) => {
      const result = await run(
        withdrawOverpaymentResolution({ resolutionId, deviceId: device.id })
      )
      if (!result.ok) return withdrawErrorKeys[result.error.type]
      return undefined
    })
    if (withdrawn) toast.success(t("overpayment.withdrawn"))
  }

  return (
    <YStack testID="overpayment-answer" gap={4} py={8}>
      <XStack items="center" justify="space-between" gap={12}>
        <YStack flex={1} minW={0} gap={2}>
          <XStack items="center" gap={8}>
            <Text
              fontSize={fontSize.sm}
              lineHeight={fontSize.sm}
              fontWeight={fontWeight.medium}
              color="color"
            >
              {t(answerLabelKeys[answer.source.type])}
            </Text>
            {answer.isWithdrawn ? (
              <Badge
                variant="secondary"
                label={t("overpayment.breakdown.withdrawn")}
              />
            ) : null}
          </XStack>
          {!answer.isWithdrawn && notCounted > 0 ? (
            <Text
              fontSize={fontSize.xs}
              lineHeight={fontSize.xs}
              color="muted-foreground"
            >
              {t("overpayment.breakdown.notCounted", {
                amount: format(notCounted),
              })}
            </Text>
          ) : null}
        </YStack>
        <Text
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          fontWeight={fontWeight.semibold}
          fontVariant={["tabular-nums"]}
          color={answer.isWithdrawn ? "muted-foreground" : "color"}
          textDecorationLine={answer.isWithdrawn ? "line-through" : "none"}
        >
          {format(answer.isWithdrawn ? answer.amount : answer.answered)}
        </Text>
      </XStack>
      {canWithdraw ? (
        <Button
          variant="ghost"
          size="lg"
          self="flex-start"
          label={t("overpayment.withdraw")}
          onPress={() => void withdraw()}
        />
      ) : null}
    </YStack>
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
  const formatList = (items: ReadonlyArray<string>) =>
    typeof Intl.ListFormat === "function"
      ? new Intl.ListFormat(locale).format(items)
      : items.join(", ")
  const optionLabel = (payment: OverpaymentCardPayment) =>
    paymentOptionLabel({
      payment,
      overpayment,
      locale,
      t,
      format,
      formatList,
    })

  return (
    <FieldSet>
      <FieldLegend variant="label">
        {t("overpayment.dialog.payment")}
      </FieldLegend>
      <ToggleGroup
        aria-label={t("overpayment.dialog.payment")}
        value={value}
        onValueChange={(id) => {
          const picked = payments.find((payment) => payment.id === id)
          if (picked !== undefined) onChange(picked)
        }}
        variant="outline"
        orientation="vertical"
        disabled={disabled}
      >
        {payments.map((payment) => (
          <ChoiceToggleItem
            key={payment.id}
            value={payment.id}
            selected={payment.id === value}
          >
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
      <DialogContent closeLabel={t("dialog.close")}>
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
  const toast = useToast()
  const { device } = useAtomValue(accountAtom)
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
    amountErrorKey === null
      ? undefined
      : t(amountErrorKey, { amount: format(room) })

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
      return undefined
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
      dismissOnOverlayPress={!pending}
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <DialogContent closeLabel={t("dialog.close")}>
        <DialogHeader>
          <DialogTitle>{t(keys.title)}</DialogTitle>
          <DialogDescription>
            {t("overpayment.dialog.description", { amount: format(room) })}
          </DialogDescription>
          <DialogDescription>{t(keys.consequence)}</DialogDescription>
        </DialogHeader>

        <YStack gap={20}>
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
          <Field>
            <FieldLabel>{t("overpayment.dialog.amount")}</FieldLabel>
            <Input
              value={amountText}
              keyboardType="decimal-pad"
              autoComplete="off"
              disabled={pending}
              invalid={amountError !== undefined}
              onChangeText={(text) => {
                setTypedAmountText(text)
                setAmountLeft(false)
              }}
              onBlur={() => setAmountLeft(true)}
            />
            <FieldError>{amountError}</FieldError>
          </Field>
          {resolution === "tip" ? (
            <Field orientation="horizontal">
              <Checkbox
                checked={guestLeftTip}
                disabled={pending}
                aria-label={t("overpayment.dialog.tipConfirm")}
                onCheckedChange={setGuestLeftTip}
              />
              <FieldContent>
                <FieldLabel>{t("overpayment.dialog.tipConfirm")}</FieldLabel>
              </FieldContent>
            </Field>
          ) : null}
        </YStack>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending}
            label={t("overpayment.dialog.cancel")}
            onPress={onClose}
          />
          <Button
            disabled={!canConfirm}
            pending={pending}
            label={
              amount === null
                ? t(keys.confirmEmpty)
                : t(keys.confirm, { amount: format(amount) })
            }
            onPress={() => void confirm()}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
