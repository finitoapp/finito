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
  calculateTipPercentage,
} from "@payky/core/modules/payment/payment-tip-utils"
import {
  type FiatCurrency,
  NonNegativeInteger,
} from "@payky/core/modules/shared/schema"
import { Redirect, router, useLocalSearchParams } from "expo-router"
import { useRef, useState } from "react"
import { Text, YStack } from "tamagui"
import { AmountFigure } from "../../components/amount-figure.tsx"
import { FadeHeader } from "../../components/fade-header.tsx"
import { RouteMessage } from "../../components/route-message.tsx"
import { Screen } from "../../components/screen.tsx"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "../../components/ui/toggle-group.tsx"
import { useCreateTerminalPayment } from "../../hooks/use-create-terminal-payment.ts"
import { useEvoluQuery } from "../../hooks/use-evolu-query.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { formatMoney, formatMoneyParts } from "../../lib/format-money.ts"
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

/**
 * Web's `PaymentTipForm`: the presets, one under another or in two columns
 * past three, each a percentage over what it adds or a fixed tip over its
 * share of the order, then the custom tip, which has a keypad screen of its own
 * (`PaymentCustomTipPage`), and no tip.
 */
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
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)

  const formatMinor = (value: number) =>
    formatMoney({ value: NonNegativeInteger(value), currency }, locale)
  const orderTotal = formatMoneyParts({ value: amount, currency }, locale)

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

  // A preset shows what it adds to the order, not the new total.
  const tipIncrease = (tipAmount: number) => `+${formatMinor(tipAmount)}`
  const percentageOptions = percentages.map((percentage) => {
    const tipAmount = calculatePercentageTipAmount({ amount, percentage })
    return {
      value: String(percentage),
      label: t("settings.tips.percentages.value", { value: percentage }),
      detail: tipIncrease(tipAmount),
      tipAmount,
    }
  })
  // A fixed tip, large, says its share of the order beneath.
  const percentFormat = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  })
  const fixedOptions = fixedAmounts.map((fixed) => {
    const tipAmount = NonNegativeInteger(fixed)
    const share = calculateTipPercentage({ amount, tipAmount })
    return {
      value: String(fixed),
      label: tipIncrease(fixed),
      detail:
        share === null
          ? undefined
          : t("settings.tips.percentages.value", {
              value: percentFormat.format(share),
            }),
      tipAmount,
    }
  })
  // Up to three presets stand one under another; more take two columns.
  const presetColumns =
    percentageOptions.length + fixedOptions.length > 3 ? 2 : 1

  return (
    <Screen>
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
        <AmountFigure
          number={orderTotal.number}
          unit={orderTotal.unit}
          unitFirst={orderTotal.unitFirst}
          label={orderTotal.text}
        />
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
              columns={presetColumns}
              spacing={3}
              disabled={pending}
            >
              {group.map((option) => (
                <TipOption
                  key={option.value}
                  value={option.value}
                  label={option.label}
                  detail={option.detail}
                  prominent
                />
              ))}
            </ToggleGroup>
          )
        )}
        <ToggleGroup
          aria-label={t("paymentTip.title")}
          value={null}
          onValueChange={(value) => {
            if (value === "custom")
              router.push({
                pathname: "/payment/custom-tip",
                params: {
                  amount: String(amount),
                  currency,
                  ...(billId === null ? {} : { billId }),
                },
              })
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
            detail={tipIncrease(0)}
          />
        </ToggleGroup>
      </YStack>
    </Screen>
  )
}

/**
 * Web's tip option. A preset is `prominent`: its percentage or amount large,
 * the other small beneath.
 */
function TipOption({
  value,
  label,
  detail,
  prominent = false,
}: {
  readonly value: string
  readonly label: string
  readonly detail?: string | undefined
  readonly prominent?: boolean
}) {
  return (
    <ToggleGroupItem
      value={value}
      aria-label={detail === undefined ? label : `${label} ${detail}`}
      flexDirection="column"
      h={prominent ? 88 : 72}
      gap={4}
      py={12}
    >
      <Text
        fontSize={prominent ? fontSize["3xl"] : fontSize.base}
        lineHeight={prominent ? fontSize["3xl"] : fontSize.base}
        fontWeight={prominent ? fontWeight.bold : fontWeight.semibold}
      >
        {label}
      </Text>
      {detail === undefined ? null : (
        <Text
          fontSize={fontSize.sm}
          lineHeight={fontSize.sm}
          color="muted-foreground"
        >
          {detail}
        </Text>
      )}
    </ToggleGroupItem>
  )
}
