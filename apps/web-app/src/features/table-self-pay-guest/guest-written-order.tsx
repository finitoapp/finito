import {
  isWrittenAmountInRange,
  MAX_WRITTEN_AMOUNT,
  MAX_WRITTEN_TEXT_LENGTH,
  type SelfPayMenu,
  WrittenOrderTextSchema,
} from "@payky/core/modules/menu-order/menu-order-utils"
import { decimalAmountToMinorUnits } from "@payky/core/modules/shared/money"
import { selfPayMinimum } from "@payky/core/modules/table-self-pay/table-self-pay-share-utils"
import { LoaderCircleIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Label } from "@/components/ui/label.tsx"
import { usePayBarScrollPadding } from "./guest-checkout.tsx"
import { formatGuestAmount, guestCurrencySymbol } from "./guest-format.ts"
import { guestTipAmount } from "./guest-share-choice.ts"
import { useGuestStatus } from "./guest-status.tsx"
import {
  type GuestTipChoice,
  GuestTipPicker,
  isCustomTipUnreadable,
  NO_TIP,
  resolveGuestTip,
} from "./guest-tip-picker.tsx"
import { useGuestTranslation } from "./use-guest-translation.ts"

export interface GuestWrittenChoice {
  readonly text: string
  readonly named: number
  readonly amount: number
}

export function GuestWrittenOrder({
  menu,
  isPreparing,
  onOrder,
}: {
  readonly menu: SelfPayMenu
  readonly isPreparing: boolean
  readonly onOrder: (order: GuestWrittenChoice) => void
}) {
  const { t, locale } = useGuestTranslation()
  const announce = useGuestStatus()
  const [typedText, setTypedText] = useState("")
  const [typedAmount, setTypedAmount] = useState("")
  const [tipChoice, setTipChoice] = useState<GuestTipChoice>(NO_TIP)
  const payBar = usePayBarScrollPadding()
  const { currency } = menu
  const format = (amount: number) => formatGuestAmount(amount, menu, locale)

  const text = typedText.trim()
  const isTextValid = WrittenOrderTextSchema.safeParse(text).success
  const named = decimalAmountToMinorUnits({ currency, value: typedAmount }) ?? 0
  const tipAmount = guestTipAmount(named, resolveGuestTip(tipChoice, currency))
  const amount = named + tipAmount
  const isAmountTooLow = named > 0 && named < selfPayMinimum(currency)
  const isAmountTooHigh = amount > MAX_WRITTEN_AMOUNT
  const canPay =
    isTextValid &&
    isWrittenAmountInRange(named, currency) &&
    !isAmountTooHigh &&
    !isCustomTipUnreadable(tipChoice, currency)
  const payLabel = canPay
    ? t("selfPay.pay.total", { amount: format(amount) })
    : t("selfPay.written.nothing")
  const announced = useRef(payLabel)

  useEffect(() => {
    if (announced.current === payLabel) return
    announced.current = payLabel
    announce(payLabel)
  }, [announce, payLabel])

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="guest-written-text">
            {t("selfPay.written.text.label")}
          </Label>
          <Input
            id="guest-written-text"
            className="h-11"
            maxLength={MAX_WRITTEN_TEXT_LENGTH}
            autoComplete="off"
            aria-describedby="guest-written-text-length"
            value={typedText}
            onChange={(event) => {
              setTypedText(event.currentTarget.value)
            }}
          />
          <p
            id="guest-written-text-length"
            className="text-sm text-muted-foreground tabular-nums"
          >
            {t("selfPay.order.note.length", {
              length: typedText.length,
              max: MAX_WRITTEN_TEXT_LENGTH,
            })}
          </p>
          {text !== "" && !isTextValid ? (
            <p className="text-sm text-destructive" role="alert">
              {t("selfPay.written.text.unreadable")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="guest-written-amount">
            {t("selfPay.written.amount.label")}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="guest-written-amount"
              className="h-11"
              inputMode="decimal"
              autoComplete="off"
              value={typedAmount}
              onChange={(event) => {
                setTypedAmount(event.currentTarget.value)
              }}
            />
            <span className="text-muted-foreground">
              {guestCurrencySymbol(currency, locale)}
            </span>
          </div>
          {isAmountTooLow ? (
            <p className="text-sm text-destructive" role="alert">
              {t("selfPay.written.amount.tooLow", {
                amount: format(selfPayMinimum(currency)),
              })}
            </p>
          ) : isAmountTooHigh ? (
            <p className="text-sm text-destructive" role="alert">
              {t("selfPay.written.amount.tooHigh", {
                amount: format(MAX_WRITTEN_AMOUNT),
              })}
            </p>
          ) : null}
        </div>
      </section>

      <GuestTipPicker
        currency={currency}
        share={named}
        choice={tipChoice}
        onChange={setTipChoice}
      />

      <footer
        ref={payBar}
        className="sticky bottom-0 z-20 -mx-4 flex flex-col gap-2 border-t bg-background px-4 pt-3 pb-4"
      >
        <div className="flex justify-between gap-3 text-sm text-muted-foreground tabular-nums">
          <span>
            {canPay
              ? t("selfPay.written.summary", { amount: format(named) })
              : t("selfPay.written.nothing")}
          </span>
          {canPay ? (
            <span>
              {tipAmount > 0
                ? t("selfPay.summary.tip", { amount: format(tipAmount) })
                : t("selfPay.summary.noTip")}
            </span>
          ) : null}
        </div>
        {canPay ? (
          <Button
            type="button"
            size="lg"
            className="h-12 text-base"
            disabled={isPreparing}
            onClick={() => {
              onOrder({ text, named, amount })
            }}
          >
            {isPreparing ? (
              <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
            ) : null}
            {isPreparing ? t("selfPay.pay.preparing") : payLabel}
          </Button>
        ) : null}
      </footer>
    </div>
  )
}
