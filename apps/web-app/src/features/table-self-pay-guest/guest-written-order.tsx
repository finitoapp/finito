import {
  isWrittenAmountInRange,
  MAX_WRITTEN_AMOUNT,
  MAX_WRITTEN_LINES,
  MAX_WRITTEN_TEXT_LENGTH,
  type SelfPayMenu,
  type WrittenOrderLine,
  WrittenOrderTextSchema,
  writtenOrderTotal,
} from "@payky/core/modules/menu-order/menu-order-utils"
import { decimalAmountToMinorUnits } from "@payky/core/modules/shared/money"
import { selfPayMinimum } from "@payky/core/modules/table-self-pay/table-self-pay-share-utils"
import { LoaderCircleIcon, PlusIcon, XIcon } from "lucide-react"
import { type FocusEvent, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Label } from "@/components/ui/label.tsx"
import { Textarea } from "@/components/ui/textarea.tsx"
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
  useTipReveal,
} from "./guest-tip-picker.tsx"
import { useGuestTranslation } from "./use-guest-translation.ts"

export interface GuestWrittenChoice {
  readonly lines: ReadonlyArray<WrittenOrderLine>
  readonly named: number
  readonly amount: number
}

interface TypedLine {
  readonly id: number
  readonly text: string
  readonly amount: string
}

const TEXT_LENGTH_SHOWN_FROM = 200

const emptyLine = (id: number): TypedLine => ({ id, text: "", amount: "" })

const needsAmount = (line: TypedLine, currency: SelfPayMenu["currency"]) =>
  line.text.trim() !== "" &&
  decimalAmountToMinorUnits({ currency, value: line.amount }) === null

export function GuestWrittenOrder({
  menu,
  hidden,
  isPreparing,
  onBillOpen,
  onOrder,
}: {
  readonly menu: SelfPayMenu
  readonly hidden: boolean
  readonly isPreparing: boolean
  readonly onBillOpen: (() => void) | null
  readonly onOrder: (order: GuestWrittenChoice) => void
}) {
  const { t, locale } = useGuestTranslation()
  const announce = useGuestStatus()
  const [typedLines, setTypedLines] = useState<ReadonlyArray<TypedLine>>([
    emptyLine(0),
  ])
  const [tipChoice, setTipChoice] = useState<GuestTipChoice>(NO_TIP)
  const payBar = usePayBarScrollPadding()
  const { tipPicker, revealTipsAfterTyping } = useTipReveal()
  const { currency } = menu
  const format = (amount: number) => formatGuestAmount(amount, menu, locale)

  const lines = typedLines
    .map((line) => ({
      text: line.text.trim(),
      amount: decimalAmountToMinorUnits({ currency, value: line.amount }) ?? 0,
    }))
    .filter(({ text, amount }) => text !== "" || amount > 0)
  const named = writtenOrderTotal(lines)
  const tipAmount = guestTipAmount(named, resolveGuestTip(tipChoice, currency))
  const amount = named + tipAmount
  const isAmountTooLow = named > 0 && named < selfPayMinimum(currency)
  const isAmountTooHigh = amount > MAX_WRITTEN_AMOUNT
  const canPay =
    lines.every(
      (line) =>
        WrittenOrderTextSchema.safeParse(line.text).success && line.amount > 0
    ) &&
    isWrittenAmountInRange(named, currency) &&
    !isAmountTooHigh &&
    !isCustomTipUnreadable(tipChoice, currency)
  const unfilledIndex = typedLines.findIndex((line) =>
    needsAmount(line, currency)
  )
  const hint =
    unfilledIndex === -1
      ? t("selfPay.written.nothing")
      : t("selfPay.written.amount.missing.item", { number: unfilledIndex + 1 })
  const payLabel = canPay
    ? t("selfPay.pay.total", { amount: format(amount) })
    : hint
  const announced = useRef(payLabel)

  useEffect(() => {
    if (hidden || announced.current === payLabel) return
    announced.current = payLabel
    announce(payLabel)
  }, [announce, payLabel, hidden])

  const change = (id: number, typed: Partial<Omit<TypedLine, "id">>) => {
    setTypedLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...typed } : line))
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6" hidden={hidden}>
      {onBillOpen === null ? null : (
        <div className="flex flex-col items-start">
          <p className="text-sm text-muted-foreground">
            {t("selfPay.written.onBill")}
          </p>
          <Button
            type="button"
            variant="link"
            className="h-11 px-0"
            onClick={onBillOpen}
          >
            {t("selfPay.written.onBill.open")}
          </Button>
        </div>
      )}
      <section className="flex flex-col gap-4">
        <ol className="flex flex-col gap-5">
          {typedLines.map((line, index) => (
            <GuestWrittenLine
              key={line.id}
              line={line}
              number={index + 1}
              currency={currency}
              onChange={(typed) => {
                change(line.id, typed)
              }}
              onRemove={
                typedLines.length > 1
                  ? () => {
                      setTypedLines((current) =>
                        current.filter(({ id }) => id !== line.id)
                      )
                    }
                  : null
              }
              onAmountBlur={(event) => {
                if (named > 0) revealTipsAfterTyping(event)
              }}
            />
          ))}
        </ol>
        {typedLines.length < MAX_WRITTEN_LINES ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 self-start"
            onClick={() => {
              setTypedLines((current) => [
                ...current,
                emptyLine(Math.max(...current.map(({ id }) => id)) + 1),
              ])
            }}
          >
            <PlusIcon aria-hidden="true" />
            {t("selfPay.written.add")}
          </Button>
        ) : null}
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
      </section>

      <GuestTipPicker
        ref={tipPicker}
        currency={currency}
        share={named}
        choice={tipChoice}
        onChange={setTipChoice}
      />

      <footer
        ref={payBar}
        className="sticky bottom-0 z-20 -mx-4 mt-auto flex flex-col gap-2 border-t bg-background px-4 pt-3 pb-4"
      >
        <div className="flex justify-between gap-3 text-sm text-muted-foreground tabular-nums">
          <span>
            {canPay
              ? t("selfPay.written.summary", { amount: format(named) })
              : hint}
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
              onOrder({ lines, named, amount })
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

function GuestWrittenLine({
  line,
  number,
  currency,
  onChange,
  onRemove,
  onAmountBlur,
}: {
  readonly line: TypedLine
  readonly number: number
  readonly currency: SelfPayMenu["currency"]
  readonly onChange: (typed: Partial<Omit<TypedLine, "id">>) => void
  readonly onRemove: (() => void) | null
  readonly onAmountBlur: (event: FocusEvent) => void
}) {
  const { t, locale } = useGuestTranslation()
  const [hasLeftAmount, setHasLeftAmount] = useState(false)
  const amountField = useRef<HTMLInputElement>(null)
  const text = line.text.trim()
  const isLengthShown = line.text.length >= TEXT_LENGTH_SHOWN_FROM
  const textId = `guest-written-text-${line.id}`
  const lengthId = `guest-written-text-length-${line.id}`
  const amountId = `guest-written-amount-${line.id}`
  const amountErrorId = `guest-written-amount-error-${line.id}`
  const amountError =
    !hasLeftAmount || !needsAmount(line, currency)
      ? null
      : line.amount.trim() === ""
        ? t("selfPay.written.amount.missing")
        : t("selfPay.amount.unreadable")

  return (
    <li className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={textId}>{t("selfPay.written.text.label")}</Label>
          {onRemove === null ? null : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 rounded-full"
              aria-label={t("selfPay.written.remove", { number })}
              onClick={onRemove}
            >
              <XIcon />
            </Button>
          )}
        </div>
        <Textarea
          id={textId}
          rows={1}
          className="field-sizing-content min-h-11 resize-none"
          maxLength={MAX_WRITTEN_TEXT_LENGTH}
          autoComplete="off"
          enterKeyHint="next"
          aria-describedby={isLengthShown ? lengthId : undefined}
          value={line.text}
          onChange={(event) => {
            onChange({
              text: event.currentTarget.value.replace(/[\r\n]+/gu, " "),
            })
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            event.preventDefault()
            amountField.current?.focus()
          }}
        />
        {isLengthShown ? (
          <p
            id={lengthId}
            className="text-sm text-muted-foreground tabular-nums"
          >
            {t("selfPay.order.note.length", {
              length: line.text.length,
              max: MAX_WRITTEN_TEXT_LENGTH,
            })}
          </p>
        ) : null}
        {text !== "" && !WrittenOrderTextSchema.safeParse(text).success ? (
          <p className="text-sm text-destructive" role="alert">
            {t("selfPay.written.text.unreadable")}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={amountId}>{t("selfPay.written.amount.label")}</Label>
        <div className="flex items-center gap-2">
          <Input
            ref={amountField}
            id={amountId}
            className="h-11"
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            aria-invalid={amountError !== null}
            aria-describedby={amountError === null ? undefined : amountErrorId}
            value={line.amount}
            onChange={(event) => {
              onChange({ amount: event.currentTarget.value })
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur()
            }}
            onBlur={(event) => {
              setHasLeftAmount(true)
              onAmountBlur(event)
            }}
          />
          <span className="text-muted-foreground">
            {guestCurrencySymbol(currency, locale)}
          </span>
        </div>
        {amountError === null ? null : (
          <p id={amountErrorId} className="text-sm text-destructive">
            {amountError}
          </p>
        )}
      </div>
    </li>
  )
}
