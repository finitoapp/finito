import { useElementSize } from "@dedalik/use-react"
import { decimalAmountToMinorUnits } from "@payky/core/modules/shared/money"
import {
  calculateChosenSelfPayShare,
  calculateSelfPayShare,
  meetsSelfPayMinimum,
  remainingOnLine,
  type SelfPayShare,
  type SelfPaySplit,
  selfPayMinimum,
} from "@payky/core/modules/table-self-pay/table-self-pay-share-utils"
import type {
  SelfPayViewBill,
  SelfPayViewLine,
} from "@payky/core/modules/table-self-pay/table-self-pay-view-utils"
import { LoaderCircleIcon, MinusIcon, PlusIcon } from "lucide-react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { Button } from "@/components/ui/button.tsx"
import { Input } from "@/components/ui/input.tsx"
import { Label } from "@/components/ui/label.tsx"
import { cn } from "@/lib/utils.ts"
import { formatGuestAmount, guestCurrencySymbol } from "./guest-format.ts"
import {
  type GuestLinePick,
  guestTipAmount,
  MAX_PEOPLE_ON_BILL,
  MAX_PEOPLE_ON_LINE,
  MIN_PEOPLE,
  pickedLinesSplit,
  unitsOfLine,
  unpaidUnits,
} from "./guest-share-choice.ts"
import { useGuestStatus } from "./guest-status.tsx"
import {
  type GuestTipChoice,
  GuestTipPicker,
  isCustomTipUnreadable,
  NO_TIP,
  resolveGuestTip,
} from "./guest-tip-picker.tsx"
import { useGuestTranslation } from "./use-guest-translation.ts"

type SplitMode = SelfPaySplit["kind"]

const NOT_PICKED: GuestLinePick = { units: 0, people: null }
const NOTHING_CHOSEN: SelfPaySplit = { kind: "amount", amount: 0 }

export function Stepper({
  value,
  min,
  max,
  label,
  decreaseLabel,
  increaseLabel,
  onChange,
}: {
  readonly value: number
  readonly min: number
  readonly max: number
  readonly label: string
  readonly decreaseLabel: string
  readonly increaseLabel: string
  readonly onChange: (value: number) => void
}) {
  return (
    <fieldset
      aria-label={label}
      className="flex shrink-0 items-center gap-0.5 rounded-xl bg-muted p-0.5"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 rounded-full"
        disabled={value <= min}
        aria-label={decreaseLabel}
        onClick={() => {
          onChange(value - 1)
        }}
      >
        <MinusIcon />
      </Button>
      <span className="min-w-7 text-center font-semibold tabular-nums">
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 rounded-full"
        disabled={value >= max}
        aria-label={increaseLabel}
        onClick={() => {
          onChange(value + 1)
        }}
      >
        <PlusIcon />
      </Button>
    </fieldset>
  )
}

function ShareChoice({
  title,
  description,
  amount,
  selected,
  onPick,
  children,
}: {
  readonly title: string
  readonly description: string
  readonly amount: string
  readonly selected: boolean
  readonly onPick: () => void
  readonly children?: ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border transition-colors",
        selected
          ? "border-primary bg-primary/10"
          : "border-input bg-card dark:border-input/50"
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={onPick}
        className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
            selected ? "border-primary" : "border-muted-foreground"
          )}
        >
          {selected ? (
            <span className="size-2.5 rounded-full bg-primary" />
          ) : null}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold">{title}</span>
          <span className="text-sm text-muted-foreground">{description}</span>
        </span>
        <span className="shrink-0 font-semibold tabular-nums">{amount}</span>
      </button>
      {selected && children !== undefined ? (
        <div className="flex flex-col gap-2 px-4 pb-4">{children}</div>
      ) : null}
    </div>
  )
}

function LinePick({
  bill,
  line,
  pick,
  amount,
  onChange,
}: {
  readonly bill: SelfPayViewBill
  readonly line: SelfPayViewLine
  readonly pick: GuestLinePick
  readonly amount: number
  readonly onChange: (pick: GuestLinePick) => void
}) {
  const { t, locale } = useGuestTranslation()
  const units = unitsOfLine(line)
  const total = formatGuestAmount(line.totalAmount, bill, locale)
  const price = formatGuestAmount(
    Math.round(line.totalAmount / units),
    bill,
    locale
  )
  const details =
    pick.people !== null
      ? t("selfPay.line.shared", { total, people: pick.people })
      : units === 1
        ? total
        : line.allocatedAmount > 0
          ? t("selfPay.line.unitPrice.left", {
              quantity: units,
              price,
              count: unpaidUnits(line),
            })
          : t("selfPay.line.unitPrice", { quantity: units, price })

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-medium">{line.name}</span>
        <span className="shrink-0 tabular-nums">
          {amount > 0 ? formatGuestAmount(amount, bill, locale) : null}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 text-sm text-muted-foreground">{details}</span>
        {pick.people === null ? (
          <Stepper
            value={pick.units}
            min={0}
            max={unpaidUnits(line)}
            label={t("selfPay.line.units.label", { name: line.name })}
            decreaseLabel={t("selfPay.line.units.decrease", {
              name: line.name,
            })}
            increaseLabel={t("selfPay.line.units.increase", {
              name: line.name,
            })}
            onChange={(next) => {
              onChange({ ...pick, units: next })
            }}
          />
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {t("selfPay.line.people")}
            </span>
            <Stepper
              value={pick.people}
              min={MIN_PEOPLE}
              max={MAX_PEOPLE_ON_LINE}
              label={t("selfPay.line.people.label", { name: line.name })}
              decreaseLabel={t("selfPay.people.decrease")}
              increaseLabel={t("selfPay.people.increase")}
              onChange={(next) => {
                onChange({ ...pick, people: next })
              }}
            />
          </div>
        )}
      </div>
      {pick.units > 0 || pick.people !== null ? (
        <Button
          type="button"
          variant="outline"
          className="h-11 self-start"
          aria-label={
            pick.people === null
              ? t("selfPay.line.share.label", { name: line.name })
              : t("selfPay.line.unshare.label", { name: line.name })
          }
          onClick={() => {
            onChange({
              ...pick,
              people: pick.people === null ? MIN_PEOPLE : null,
            })
          }}
        >
          {pick.people === null
            ? t("selfPay.line.share")
            : t("selfPay.line.unshare")}
        </Button>
      ) : null}
    </li>
  )
}

export interface GuestPaymentChoice {
  readonly amount: number
  readonly split: SelfPaySplit
  readonly share: SelfPayShare
  readonly tip: number
}

export const usePayBarScrollPadding = () => {
  const payBar = useRef<HTMLElement>(null)
  const { height } = useElementSize(payBar)
  useEffect(() => {
    document.documentElement.style.scrollPaddingBottom = `${height}px`
    return () => {
      document.documentElement.style.scrollPaddingBottom = ""
    }
  }, [height])
  return payBar
}

export function GuestCheckout({
  bill,
  initialMode,
  hidden,
  isPreparing,
  onContinue,
}: {
  readonly bill: SelfPayViewBill
  readonly initialMode: SplitMode | null
  readonly hidden: boolean
  readonly isPreparing: boolean
  readonly onContinue: (payment: GuestPaymentChoice) => void
}) {
  const { t, locale } = useGuestTranslation()
  const announce = useGuestStatus()
  const [mode, setMode] = useState<SplitMode | null>(initialMode)
  const [people, setPeople] = useState(MIN_PEOPLE)
  const [picks, setPicks] = useState<Readonly<Record<string, GuestLinePick>>>(
    {}
  )
  const [amountText, setAmountText] = useState("")
  const [hasLeftAmount, setHasLeftAmount] = useState(false)
  const [tipChoice, setTipChoice] = useState<GuestTipChoice>(NO_TIP)
  const choiceTitle = useRef<HTMLHeadingElement>(null)
  const amountField = useRef<HTMLInputElement>(null)
  const payBar = usePayBarScrollPadding()
  const format = (amount: number) => formatGuestAmount(amount, bill, locale)
  const payableLines = bill.lines.filter((line) => remainingOnLine(line) > 0)
  const typedAmount = decimalAmountToMinorUnits({
    currency: bill.currency,
    value: amountText,
  })
  const showsUnreadableAmount =
    hasLeftAmount && amountText.trim() !== "" && typedAmount === null

  const splits = {
    remainder: { kind: "remainder" },
    fractionOfBill: { kind: "fractionOfBill", denominator: people },
    lines: pickedLinesSplit(payableLines, picks),
    amount: { kind: "amount", amount: typedAmount ?? 0 },
  } satisfies Record<SplitMode, SelfPaySplit>
  const split = mode === null ? NOTHING_CHOSEN : splits[mode]
  const equalShare = calculateChosenSelfPayShare(bill, splits.fractionOfBill)
  const linesShare = calculateChosenSelfPayShare(bill, splits.lines)
  const share = calculateSelfPayShare(bill, split, bill.currency)
  const addedRest =
    share.amount - calculateChosenSelfPayShare(bill, split).amount
  const tipAmount = guestTipAmount(
    share.amount,
    resolveGuestTip(tipChoice, bill.currency)
  )
  const total = share.amount + tipAmount
  const minimum = selfPayMinimum(bill.currency)
  const isBelowMinimum =
    share.amount > 0 &&
    !meetsSelfPayMinimum({
      amount: total,
      remainder: bill.remainder,
      currency: bill.currency,
    })
  const notice =
    addedRest > 0
      ? t("selfPay.pay.restAdded", { amount: format(addedRest) })
      : addedRest < 0
        ? t("selfPay.pay.capped", { amount: format(share.amount) })
        : isBelowMinimum
          ? t("selfPay.pay.belowMinimum", { amount: format(minimum) })
          : null
  const payLabel =
    share.amount === 0
      ? t("selfPay.summary.nothing")
      : t("selfPay.pay.total", { amount: format(total) })
  const announcement =
    notice === null
      ? payLabel
      : t("selfPay.pay.announcement", { pay: payLabel, notice })
  const announced = useRef(announcement)

  useEffect(() => {
    if (hidden || announced.current === announcement) return
    announced.current = announcement
    announce(announcement)
  }, [announce, announcement, hidden])

  useEffect(() => {
    if (initialMode === null) choiceTitle.current?.focus()
  }, [initialMode])

  return (
    <div className="flex flex-col gap-6" hidden={hidden}>
      <section
        aria-labelledby="guest-choice-title"
        className="flex flex-col gap-3"
      >
        <h2
          ref={choiceTitle}
          id="guest-choice-title"
          tabIndex={-1}
          className="font-semibold outline-none"
        >
          {t("selfPay.choice.title")}
        </h2>
        <ShareChoice
          title={t("selfPay.choice.remainder")}
          description={t("selfPay.choice.remainder.description")}
          amount={format(bill.remainder)}
          selected={mode === "remainder"}
          onPick={() => {
            setMode("remainder")
          }}
        />
        <ShareChoice
          title={t("selfPay.choice.equal")}
          description={t("selfPay.choice.equal.description")}
          amount={format(equalShare.amount)}
          selected={mode === "fractionOfBill"}
          onPick={() => {
            setMode("fractionOfBill")
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">{t("selfPay.choice.equal.people")}</span>
            <Stepper
              value={people}
              min={MIN_PEOPLE}
              max={MAX_PEOPLE_ON_BILL}
              label={t("selfPay.choice.equal.people")}
              decreaseLabel={t("selfPay.people.decrease")}
              increaseLabel={t("selfPay.people.increase")}
              onChange={setPeople}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {t("selfPay.choice.equal.hint", {
              people,
              total: format(bill.total),
            })}
          </p>
        </ShareChoice>
        {payableLines.length === 0 ? null : (
          <ShareChoice
            title={t("selfPay.choice.items")}
            description={t("selfPay.choice.items.description")}
            amount={
              linesShare.amount > 0
                ? format(linesShare.amount)
                : t("selfPay.choice.items.pick")
            }
            selected={mode === "lines"}
            onPick={() => {
              setMode("lines")
            }}
          >
            <ul className="flex flex-col divide-y divide-foreground/10">
              {payableLines.map((line) => (
                <LinePick
                  key={line.key}
                  bill={bill}
                  line={line}
                  pick={picks[line.key] ?? NOT_PICKED}
                  amount={
                    linesShare.lines.find(({ key }) => key === line.key)
                      ?.amount ?? 0
                  }
                  onChange={(pick) => {
                    setPicks((current) => ({ ...current, [line.key]: pick }))
                  }}
                />
              ))}
            </ul>
          </ShareChoice>
        )}
        {mode === "amount" ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="guest-amount">
              {t("selfPay.choice.amount.label")}
            </Label>
            <div className="relative">
              <Input
                ref={amountField}
                id="guest-amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                className="h-11 pr-12"
                aria-invalid={showsUnreadableAmount}
                aria-describedby={
                  showsUnreadableAmount
                    ? "guest-amount-error guest-amount-hint"
                    : "guest-amount-hint"
                }
                value={amountText}
                onChange={(event) => {
                  setAmountText(event.currentTarget.value)
                }}
                onBlur={() => {
                  setHasLeftAmount(true)
                }}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
                {guestCurrencySymbol(bill.currency, locale)}
              </span>
            </div>
            {showsUnreadableAmount ? (
              <p id="guest-amount-error" className="text-sm text-destructive">
                {t("selfPay.amount.unreadable")}
              </p>
            ) : null}
            <p id="guest-amount-hint" className="text-sm text-muted-foreground">
              {t("selfPay.choice.amount.hint", { minimum: format(minimum) })}
            </p>
          </div>
        ) : (
          <Button
            type="button"
            variant="link"
            className="h-11 self-start px-0"
            onClick={() => {
              flushSync(() => {
                setMode("amount")
              })
              amountField.current?.focus()
            }}
          >
            {t("selfPay.choice.amount")}
          </Button>
        )}
      </section>

      <GuestTipPicker
        currency={bill.currency}
        share={share.amount}
        choice={tipChoice}
        onChange={setTipChoice}
      />

      <footer
        ref={payBar}
        className="sticky bottom-0 z-20 -mx-4 flex flex-col gap-2 border-t bg-background px-4 pt-3 pb-4"
      >
        <div className="flex justify-between gap-3 text-sm text-muted-foreground tabular-nums">
          <span>
            {share.amount > 0
              ? t("selfPay.summary.share", { amount: format(share.amount) })
              : t("selfPay.summary.nothing")}
          </span>
          {share.amount > 0 ? (
            <span>
              {tipAmount > 0
                ? t("selfPay.summary.tip", { amount: format(tipAmount) })
                : t("selfPay.summary.noTip")}
            </span>
          ) : null}
        </div>
        {notice === null ? null : <p className="text-sm">{notice}</p>}
        {share.amount === 0 ? null : (
          <Button
            type="button"
            size="lg"
            className="h-12 text-base"
            disabled={
              isPreparing ||
              isBelowMinimum ||
              isCustomTipUnreadable(tipChoice, bill.currency)
            }
            onClick={() => {
              onContinue({ amount: total, split, share, tip: tipAmount })
            }}
          >
            {isPreparing ? (
              <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
            ) : null}
            {isPreparing ? t("selfPay.pay.preparing") : payLabel}
          </Button>
        )}
      </footer>
    </div>
  )
}
