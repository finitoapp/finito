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
  type NonNegativeInteger as NonNegativeIntegerValue,
} from "@payky/core/modules/shared/schema"
import { useNavigate } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { FadeHeader } from "@/components/fade-header.tsx"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx"
import { useCreateTerminalPayment } from "@/hooks/use-create-terminal-payment.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useLocale } from "@/hooks/use-locale.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatMoney } from "@/lib/format-utils.ts"
import { cn } from "@/lib/utils.ts"

type TipSelection =
  | { readonly kind: "fixed"; readonly tipAmount: NonNegativeIntegerValue }
  | { readonly kind: "none"; readonly tipAmount: NonNegativeIntegerValue }
  | {
      readonly kind: "percentage"
      readonly percentage: number
      readonly tipAmount: NonNegativeIntegerValue
    }

interface PaymentTipPageProps {
  readonly amount: NonNegativeIntegerValue
  readonly currency: FiatCurrency
  readonly billId?: BillId | null
}

const tipOptionClassName = "h-[clamp(4rem,9dvh,4.5rem)] flex-col gap-1 py-3"
const tipPresetClassName =
  "h-[clamp(4.5rem,10dvh,5.5rem)] flex-col gap-1 py-3 text-3xl"

export function PaymentTipPage({
  amount,
  currency,
  billId = null,
}: PaymentTipPageProps) {
  const { data } = useEvoluQuery(settingsQuery)
  const [settings] = data

  if (settings === undefined) return null

  return (
    <PaymentTipForm
      amount={amount}
      currency={currency}
      billId={billId}
      fixedAmounts={parseTipFixedAmounts(settings.presetTipFixedAmountsJson)}
      percentages={parseTipPercentages(settings.presetTipPercentagesJson)}
      tipsEnabled={settings.tipsEnabled === sqliteTrue}
    />
  )
}

/**
 * The tip step: the order total, the presets one under another or in two
 * columns past three, each a percentage over what it adds or a fixed tip
 * over its share of the order, then the custom tip, which has a keypad screen of
 * its own (`PaymentCustomTipPage`), and no tip.
 */
function PaymentTipForm({
  amount,
  currency,
  billId = null,
  fixedAmounts,
  percentages,
  tipsEnabled,
}: PaymentTipPageProps & {
  readonly fixedAmounts: ReadonlyArray<number>
  readonly percentages: ReadonlyArray<number>
  readonly tipsEnabled: boolean
}) {
  const navigate = useNavigate()
  const locale = useLocale()
  const { t } = useTranslation()
  const createTerminalPayment = useCreateTerminalPayment()
  const [selection, setSelection] = useState<TipSelection | null>(null)
  const [pending, setPending] = useState(false)
  const confirmPendingRef = useRef(false)

  const formatMinor = (value: NonNegativeIntegerValue) =>
    formatMoney({ value, currency }, locale)
  // A preset shows what it adds to the order, not the new total.
  const formatTipIncrease = (tipAmount: NonNegativeIntegerValue) =>
    `+${formatMinor(tipAmount)}`
  // A fixed tip, large, says its share of the order beneath.
  const percentFormat = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  })
  const formatTipShare = (tipAmount: NonNegativeIntegerValue) => {
    const share = calculateTipPercentage({ amount, tipAmount })
    return share === null
      ? null
      : t("settings.tips.percentages.value", {
          value: percentFormat.format(share),
        })
  }
  // Up to three presets stand one under another; more take two columns.
  const presetGridClassName = cn(
    "grid w-full gap-3",
    percentages.length + fixedAmounts.length > 3 ? "grid-cols-2" : "grid-cols-1"
  )

  useEffect(() => {
    if (!tipsEnabled) void navigate({ to: "/" })
  }, [navigate, tipsEnabled])

  const handleConfirm = async (tipAmount: NonNegativeIntegerValue) => {
    if (confirmPendingRef.current) return

    confirmPendingRef.current = true
    setPending(true)
    try {
      const paymentAmounts = calculatePaymentAmounts({ amount, tipAmount })
      await createTerminalPayment({
        ...paymentAmounts,
        currency,
        billId,
      })
    } finally {
      confirmPendingRef.current = false
      setPending(false)
    }
  }

  if (!tipsEnabled) return null

  return (
    <>
      <FadeHeader />

      <div className="flex h-full min-h-0 flex-col overflow-hidden pt-4">
        <section className="shrink-0 flex flex-col items-center gap-2 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {t("paymentTip.orderTotal")}
          </p>
          <h1 className="text-4xl font-semibold tracking-tight tabular-nums">
            {formatMinor(amount)}
          </h1>
        </section>

        <section className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4">
          <div className="flex min-h-full flex-col justify-center gap-4">
            <h2 className="text-center text-md font-semibold tracking-tight">
              {t("paymentTip.title")}
            </h2>

            {percentages.length > 0 ? (
              <ToggleGroup
                aria-label={t("paymentTip.percentages")}
                className={presetGridClassName}
                disabled={pending}
                value={
                  selection?.kind === "percentage"
                    ? [String(selection.percentage)]
                    : []
                }
                onValueChange={(values) => {
                  const [value] = values
                  const percentage = Number(value)
                  if (!percentages.includes(percentage)) {
                    setSelection(null)
                    return
                  }

                  const tipAmount = calculatePercentageTipAmount({
                    amount,
                    percentage,
                  })
                  setSelection({ kind: "percentage", percentage, tipAmount })
                  void handleConfirm(tipAmount)
                }}
              >
                {percentages.map((percentage) => (
                  <ToggleGroupItem
                    key={percentage}
                    value={String(percentage)}
                    variant="outline"
                    className={tipPresetClassName}
                  >
                    <span className="font-bold">
                      {t("settings.tips.percentages.value", {
                        value: percentage,
                      })}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {formatTipIncrease(
                        calculatePercentageTipAmount({ amount, percentage })
                      )}
                    </span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            ) : null}

            {fixedAmounts.length > 0 ? (
              <ToggleGroup
                aria-label={t("paymentTip.fixedAmounts")}
                className={presetGridClassName}
                disabled={pending}
                value={
                  selection?.kind === "fixed"
                    ? [String(selection.tipAmount)]
                    : []
                }
                onValueChange={(values) => {
                  const [value] = values
                  const fixedAmount = fixedAmounts.find(
                    (preset) => preset === Number(value)
                  )
                  if (fixedAmount === undefined) {
                    setSelection(null)
                    return
                  }

                  const tipAmount = NonNegativeInteger(fixedAmount)
                  setSelection({ kind: "fixed", tipAmount })
                  void handleConfirm(tipAmount)
                }}
              >
                {fixedAmounts.map((fixedAmount) => (
                  <ToggleGroupItem
                    key={fixedAmount}
                    value={String(fixedAmount)}
                    variant="outline"
                    className={tipPresetClassName}
                  >
                    <span className="font-bold">
                      {formatTipIncrease(NonNegativeInteger(fixedAmount))}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {formatTipShare(NonNegativeInteger(fixedAmount))}
                    </span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            ) : null}

            <ToggleGroup<"custom" | "none">
              aria-label={t("paymentTip.title")}
              className="grid w-full grid-cols-2 gap-3"
              disabled={pending}
              value={selection?.kind === "none" ? ["none"] : []}
              onValueChange={(values) => {
                const [value] = values
                if (value === "custom") {
                  void navigate({
                    to: "/payment/custom-tip",
                    search: { amount, currency, billId: billId ?? undefined },
                  })
                  return
                }
                if (value === "none") {
                  const tipAmount = NonNegativeInteger(0)
                  setSelection({ kind: "none", tipAmount })
                  void handleConfirm(tipAmount)
                  return
                }

                setSelection(null)
              }}
            >
              <ToggleGroupItem
                value="custom"
                variant="outline"
                className={tipOptionClassName}
              >
                <span className="font-semibold">
                  {t("paymentTip.custom.label")}
                </span>
                <span className="text-sm text-muted-foreground">
                  {t("paymentTip.custom.actionDescription")}
                </span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="none"
                variant="outline"
                className={tipOptionClassName}
              >
                <span className="font-semibold">{t("paymentTip.none")}</span>
                <span className="text-sm text-muted-foreground">
                  {formatTipIncrease(NonNegativeInteger(0))}
                </span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </section>
      </div>
    </>
  )
}
