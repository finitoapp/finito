import { sqliteTrue } from "@evolu/common"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import {
  parseTipFixedAmounts,
  parseTipPercentages,
} from "@payky/core/modules/app-settings/app-settings-tips"
import type { BillId } from "@payky/core/modules/bill/bill-types"
import {
  calculatePaymentAmounts,
  calculatePercentageTipAmount,
} from "@payky/core/modules/payment/payment-tip-utils"
import { decimalAmountToMinorUnits } from "@payky/core/modules/shared/money"
import {
  type FiatCurrency,
  NonNegativeInteger,
} from "@payky/core/modules/shared/schema"
import { Redirect, useLocalSearchParams } from "expo-router"
import { useRef, useState } from "react"
import { Text, YStack } from "tamagui"
import { FadeHeader } from "../../components/fade-header.tsx"
import { RouteMessage } from "../../components/route-message.tsx"
import { Screen } from "../../components/screen.tsx"
import { Button } from "../../components/ui/button.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "../../components/ui/field.tsx"
import { Input } from "../../components/ui/input.tsx"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "../../components/ui/toggle-group.tsx"
import { useCreateTerminalPayment } from "../../hooks/use-create-terminal-payment.ts"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney } from "../../lib/format-money.ts"
import { fontSize, fontWeight } from "../../theme/tokens.ts"
import { parseTipSearch } from "./tip-search.ts"

/** Web's tip step: the order total, preset tips, custom tip or none. */
export function PaymentTipPage() {
  const { t } = useTranslation()
  const params = useLocalSearchParams()
  const search = parseTipSearch(params)
  const [settings] = useEvoluQuery(settingsQuery).data

  if (search === null)
    return <RouteMessage>{t("paymentTip.invalidLink")}</RouteMessage>
  if (settings === undefined) return null
  // Tips switched off: nothing to choose, back to the keypad (as web).
  if (settings.tipsEnabled !== sqliteTrue) return <Redirect href="/" />

  return (
    <PaymentTipForm
      {...search}
      fixedAmounts={parseTipFixedAmounts(settings.presetTipFixedAmountsJson)}
      percentages={parseTipPercentages(settings.presetTipPercentagesJson)}
    />
  )
}

function PaymentTipForm({
  amount,
  currency,
  billId,
  fixedAmounts,
  percentages,
}: {
  readonly amount: NonNegativeInteger
  readonly currency: FiatCurrency
  readonly billId: BillId | null
  readonly fixedAmounts: ReadonlyArray<number>
  readonly percentages: ReadonlyArray<number>
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const createTerminalPayment = useCreateTerminalPayment()
  const [customOpen, setCustomOpen] = useState(false)
  const [customTip, setCustomTip] = useState("")
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)

  const formatMinor = (value: number) =>
    formatMoney({ value: NonNegativeInteger(value), currency }, locale)
  const customMinor = decimalAmountToMinorUnits({
    currency,
    value: customTip,
  })
  const customInvalid = customTip.length > 0 && customMinor === null

  // One tap confirms: the ref closes the window before `pending` re-renders,
  // so a double tap cannot create two payments.
  const confirm = async (tipAmount: NonNegativeInteger) => {
    if (pendingRef.current) return
    pendingRef.current = true
    setPending(true)
    try {
      await createTerminalPayment({
        ...calculatePaymentAmounts({ amount, tipAmount }),
        currency,
        billId,
      })
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  const tipTotal = (tipAmount: NonNegativeInteger) =>
    formatMinor(calculatePaymentAmounts({ amount, tipAmount }).amount)
  const percentageOptions = percentages.map((percentage) => ({
    value: String(percentage),
    label: t("settings.tips.percentages.value", { value: percentage }),
    tipAmount: calculatePercentageTipAmount({ amount, percentage }),
  }))
  const fixedOptions = fixedAmounts.map((fixed) => ({
    value: String(fixed),
    label: `+${formatMinor(fixed)}`,
    tipAmount: NonNegativeInteger(fixed),
  }))

  return (
    <Screen
      footer={
        customOpen ? (
          <YStack px={16} pb={16}>
            <Button
              size="lg"
              h={56}
              label={
                pending ? t("paymentTip.creating") : t("paymentTip.continue")
              }
              pending={pending}
              disabled={customMinor === null}
              onPress={() => {
                if (customMinor !== null)
                  void confirm(NonNegativeInteger(customMinor))
              }}
            />
          </YStack>
        ) : null
      }
    >
      <FadeHeader />
      <YStack items="center" gap={8}>
        <Text
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          fontWeight={fontWeight.medium}
          color="muted-foreground"
        >
          {t("paymentTip.orderTotal")}
        </Text>
        <Text
          fontSize="4xl"
          lineHeight="4xl"
          fontWeight={fontWeight.semibold}
          fontVariant={["tabular-nums"]}
          role="heading"
          aria-level={1}
        >
          {formatMinor(amount)}
        </Text>
      </YStack>

      <YStack flex={1} justify="center" gap={16} py={16}>
        <Text text="center" fontWeight={fontWeight.semibold}>
          {t("paymentTip.title")}
        </Text>
        {/* One tap confirms a preset, as web: the group never holds a value. */}
        {[percentageOptions, fixedOptions].map((group) =>
          group.length === 0 ? null : (
            <ToggleGroup
              key={group === percentageOptions ? "percentages" : "fixed"}
              aria-label={t(
                group === percentageOptions
                  ? "paymentTip.percentages"
                  : "paymentTip.fixedAmounts"
              )}
              value={null}
              onValueChange={(value) => {
                const option = group.find(
                  (candidate) => candidate.value === value
                )
                if (option !== undefined) void confirm(option.tipAmount)
              }}
              variant="outline"
              columns={2}
              spacing={3}
              disabled={pending}
            >
              {group.map((option) => (
                <TipOption
                  key={option.value}
                  value={option.value}
                  label={option.label}
                  detail={tipTotal(option.tipAmount)}
                />
              ))}
            </ToggleGroup>
          )
        )}
        <ToggleGroup
          aria-label={t("paymentTip.title")}
          value={customOpen ? "custom" : null}
          onValueChange={(value) => {
            if (value === "custom") setCustomOpen(true)
            else void confirm(NonNegativeInteger(0))
          }}
          variant="outline"
          columns={2}
          spacing={3}
          disabled={pending}
        >
          <TipOption
            value="custom"
            label={t("paymentTip.custom.label")}
            detail={t("paymentTip.custom.actionDescription")}
          />
          <TipOption
            value="none"
            label={t("paymentTip.none")}
            detail={formatMinor(amount)}
          />
        </ToggleGroup>

        {customOpen ? (
          <FieldGroup>
            <Field>
              <FieldLabel>{t("paymentTip.custom.label")}</FieldLabel>
              <FieldDescription>
                {t("paymentTip.custom.description")}
              </FieldDescription>
              <Input
                value={customTip}
                keyboardType="decimal-pad"
                autoComplete="off"
                autoFocus
                disabled={pending}
                invalid={customInvalid}
                placeholder={t("paymentTip.custom.placeholder")}
                onChangeText={setCustomTip}
              />
              <FieldError>
                {customInvalid ? t("paymentTip.custom.invalid") : undefined}
              </FieldError>
            </Field>
          </FieldGroup>
        ) : null}
      </YStack>
    </Screen>
  )
}

/** Web's tip option: `h-[clamp(4.5rem,10dvh,6rem)] flex-col gap-1 py-3 text-lg`. */
function TipOption({
  value,
  label,
  detail,
}: {
  readonly value: string
  readonly label: string
  readonly detail: string
}) {
  return (
    <ToggleGroupItem
      value={value}
      aria-label={`${label} ${detail}`}
      flexDirection="column"
      h={80}
      gap={4}
      py={12}
    >
      <Text
        fontSize={fontSize.lg}
        lineHeight={fontSize.lg}
        fontWeight={fontWeight.semibold}
      >
        {label}
      </Text>
      <Text
        fontSize={fontSize.sm}
        lineHeight={fontSize.sm}
        color="muted-foreground"
      >
        {detail}
      </Text>
    </ToggleGroupItem>
  )
}
