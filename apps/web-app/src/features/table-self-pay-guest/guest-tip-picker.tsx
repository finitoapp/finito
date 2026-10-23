import { decimalAmountToMinorUnits } from "@payky/core/modules/shared/money"
import type { SelfPayViewBill } from "@payky/core/modules/table-self-pay/table-self-pay-view-utils"
import { useState } from "react"
import { Input } from "@/components/ui/input.tsx"
import { Label } from "@/components/ui/label.tsx"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx"
import { formatGuestAmount, guestCurrencySymbol } from "./guest-format.ts"
import { guestToggleClassName } from "./guest-pick-styles.ts"
import {
  type GuestTip,
  guestTipAmount,
  parsePercent,
} from "./guest-share-choice.ts"
import { useGuestTranslation } from "./use-guest-translation.ts"

const TIP_PERCENTS = [0, 5, 10, 15, 20] as const
const CUSTOM = "custom"
const NO_TIP_PERCENT: GuestTip = { kind: "percent", percent: 0 }

export interface GuestTipChoice {
  readonly option: number | typeof CUSTOM
  readonly customUnit: "percent" | "amount"
  readonly customText: string
}

export const NO_TIP: GuestTipChoice = {
  option: 0,
  customUnit: "amount",
  customText: "",
}

const readCustomTip = (
  { customUnit, customText }: GuestTipChoice,
  bill: SelfPayViewBill
): GuestTip | null => {
  if (customUnit === "percent") {
    const percent = parsePercent(customText)
    return percent === null ? null : { kind: "percent", percent }
  }
  const amount = decimalAmountToMinorUnits({
    currency: bill.currency,
    value: customText,
  })
  return amount === null ? null : { kind: "amount", amount }
}

export const resolveGuestTip = (
  choice: GuestTipChoice,
  bill: SelfPayViewBill
): GuestTip =>
  choice.option === CUSTOM
    ? (readCustomTip(choice, bill) ?? NO_TIP_PERCENT)
    : { kind: "percent", percent: choice.option }

export const isCustomTipUnreadable = (
  choice: GuestTipChoice,
  bill: SelfPayViewBill
): boolean =>
  choice.option === CUSTOM &&
  choice.customText.trim() !== "" &&
  readCustomTip(choice, bill) === null

export function GuestTipPicker({
  bill,
  share,
  choice,
  onChange,
}: {
  readonly bill: SelfPayViewBill
  readonly share: number
  readonly choice: GuestTipChoice
  readonly onChange: (choice: GuestTipChoice) => void
}) {
  const { t, locale } = useGuestTranslation()
  const [hasLeftCustomTip, setHasLeftCustomTip] = useState(false)
  const customTip = guestTipAmount(share, resolveGuestTip(choice, bill))
  const isCustom = choice.option === CUSTOM
  const currencySymbol = guestCurrencySymbol(bill.currency, locale)
  const showsUnreadable =
    hasLeftCustomTip && isCustomTipUnreadable(choice, bill)

  return (
    <section aria-labelledby="guest-tip-title" className="flex flex-col gap-3">
      <h2 id="guest-tip-title" className="font-semibold">
        {t("selfPay.tip.label")}
      </h2>
      <ToggleGroup<string>
        aria-labelledby="guest-tip-title"
        className="grid w-full grid-cols-3 gap-2"
        value={[String(choice.option)]}
        onValueChange={([next]) => {
          if (next === undefined) return
          onChange({
            ...choice,
            option: next === CUSTOM ? CUSTOM : Number(next),
          })
        }}
      >
        {TIP_PERCENTS.map((percent) => (
          <ToggleGroupItem
            key={percent}
            value={String(percent)}
            variant="outline"
            className={`${guestToggleClassName} h-16 flex-col gap-0.5`}
          >
            <span className="font-semibold">
              {percent === 0
                ? t("selfPay.tip.none")
                : t("selfPay.tip.percent", { percent })}
            </span>
            <span className="text-sm text-muted-foreground tabular-nums">
              {formatGuestAmount(
                guestTipAmount(share, { kind: "percent", percent }),
                bill,
                locale
              )}
            </span>
          </ToggleGroupItem>
        ))}
        <ToggleGroupItem
          value={CUSTOM}
          variant="outline"
          className={`${guestToggleClassName} h-16 flex-col gap-0.5`}
        >
          <span className="font-semibold">{t("selfPay.tip.custom")}</span>
          <span className="text-sm text-muted-foreground tabular-nums">
            {isCustom && customTip > 0
              ? formatGuestAmount(customTip, bill, locale)
              : t("selfPay.tip.custom.unit")}
          </span>
        </ToggleGroupItem>
      </ToggleGroup>
      {isCustom ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="guest-custom-tip">
            {t("selfPay.tip.custom.label")}
          </Label>
          <div className="flex items-center gap-2">
            <ToggleGroup<string>
              aria-label={t("selfPay.tip.custom.unit.label")}
              value={[choice.customUnit]}
              onValueChange={([next]) => {
                if (next === "percent" || next === "amount") {
                  onChange({ ...choice, customUnit: next })
                }
              }}
            >
              <ToggleGroupItem
                value="amount"
                className={`${guestToggleClassName} px-4`}
              >
                {currencySymbol}
              </ToggleGroupItem>
              <ToggleGroupItem
                value="percent"
                className={`${guestToggleClassName} px-4`}
              >
                %
              </ToggleGroupItem>
            </ToggleGroup>
            <div className="relative flex-1">
              <Input
                id="guest-custom-tip"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                className="h-11 pr-10"
                aria-invalid={showsUnreadable}
                aria-describedby={
                  showsUnreadable ? "guest-custom-tip-error" : undefined
                }
                value={choice.customText}
                onChange={(event) => {
                  onChange({ ...choice, customText: event.currentTarget.value })
                }}
                onBlur={() => {
                  setHasLeftCustomTip(true)
                }}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
                {choice.customUnit === "percent" ? "%" : currencySymbol}
              </span>
            </div>
          </div>
          {showsUnreadable ? (
            <p id="guest-custom-tip-error" className="text-sm text-destructive">
              {choice.customUnit === "percent"
                ? t("selfPay.percent.unreadable")
                : t("selfPay.amount.unreadable")}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
