import {
  type AmountKeypadKey,
  amountKeypadKeys,
  applyAmountKey,
  formatAmountInput,
  getDecimalSeparator,
} from "@payky/app-shared/amount-entry"
import {
  decimalAmountToMinorUnits,
  type Money,
} from "@payky/core/modules/shared/money"
import type { Currency, FiatCurrency } from "@payky/core/modules/shared/schema"
import { type PrimitiveAtom, useAtomValue, useSetAtom, useStore } from "jotai"
import { LoaderCircle } from "lucide-react"
import { motion, useAnimationControls, useReducedMotion } from "motion/react"
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react"
import { Button } from "@/components/ui/button.tsx"
import { useLocale } from "@/hooks/use-locale.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { vibrateOnButtonPress } from "@/platform/haptics.ts"

const keypadButtonBubbleAnimation = {
  opacity: [0.28, 0.16, 0],
  scale: [0.25, 1.15, 1.65],
}
const amountChangeAnimation = {
  opacity: [0.6, 1, 1],
  scale: [0.94, 1.03, 1],
  y: [0, 0, 0],
}

type KeypadKey = AmountKeypadKey
type AmountInputAtom = PrimitiveAtom<string>
type SetAmountInput = (value: string | ((current: string) => string)) => void
type ChargeHandler = (money: Money) => Promise<void> | void

const numericKeyboardKeys = new Set<string>([
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
])

function applyKeypadPress(
  setAmountInput: SetAmountInput,
  key: KeypadKey,
  currency: Currency
) {
  setAmountInput((current) => applyAmountKey(current, key, currency))
}

/**
 * The amount keypad: the typed amount, the twelve keys and one submit
 * button, which a physical keyboard's Enter presses too. Home charges from
 * it, holding the amount in `terminalAmountInputAtom` so a half-typed amount
 * survives leaving home; the custom tip step types its tip into an atom of
 * its own. The atom is passed down as a prop, so only `AmountDisplay` and `ChargeButton` re-render per keypress —
 * not the twelve `KeypadButton`s. Measured (Chrome, CDP `TaskDuration`, 600
 * keypresses): 2.8 ms per keypress with the atom versus 4.95 ms with a plain
 * `useState` here, and a Capacitor WebView on low-end Android multiplies that
 * gap several times against a 16 ms frame.
 */
export function AmountKeypad({
  amountInputAtom,
  currency,
  submitLabel,
  onCharge,
}: {
  readonly amountInputAtom: AmountInputAtom
  readonly currency: FiatCurrency
  readonly submitLabel: string
  readonly onCharge: ChargeHandler
}) {
  const isChargePendingRef = useRef(false)
  const [isChargePending, setIsChargePending] = useState(false)

  const handleCharge = useCallback(
    async (money: Money) => {
      if (isChargePendingRef.current) return

      isChargePendingRef.current = true
      setIsChargePending(true)

      try {
        await onCharge(money)
      } finally {
        isChargePendingRef.current = false
        setIsChargePending(false)
      }
    },
    [onCharge]
  )

  return (
    <>
      <AmountDisplay amountInputAtom={amountInputAtom} currency={currency} />
      <Keypad
        amountInputAtom={amountInputAtom}
        currency={currency}
        isChargePending={isChargePending}
        onCharge={handleCharge}
      />
      <ChargeButton
        amountInputAtom={amountInputAtom}
        currency={currency}
        label={submitLabel}
        isChargePending={isChargePending}
        onCharge={handleCharge}
      />
    </>
  )
}

function AmountDisplay({
  amountInputAtom,
  currency,
}: {
  readonly amountInputAtom: AmountInputAtom
  readonly currency: FiatCurrency
}) {
  const amountInput = useAtomValue(amountInputAtom)
  const locale = useLocale()
  const amountAnimationControls = useAnimationControls()
  const lastAnimatedAmountRef = useRef<string | null>(null)
  const shouldReduceMotion = useReducedMotion()

  const formattedAmount = formatAmountInput(amountInput, currency, locale)

  useEffect(() => {
    if (shouldReduceMotion) return
    if (lastAnimatedAmountRef.current === formattedAmount) return

    lastAnimatedAmountRef.current = formattedAmount

    amountAnimationControls.stop()
    void amountAnimationControls.start({
      ...amountChangeAnimation,
      transition: { duration: 0.32, ease: "easeOut", times: [0, 0.55, 1] },
    })
  }, [amountAnimationControls, formattedAmount, shouldReduceMotion])

  return (
    <section className="flex flex-col items-center gap-5 text-center">
      <motion.h1
        className="text-6xl font-semibold tracking-normal tabular-nums"
        animate={amountAnimationControls}
      >
        {formattedAmount}
      </motion.h1>
    </section>
  )
}

function Keypad({
  amountInputAtom,
  currency,
  isChargePending,
  onCharge,
}: {
  readonly amountInputAtom: AmountInputAtom
  readonly currency: FiatCurrency
  readonly isChargePending: boolean
  readonly onCharge: ChargeHandler
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const store = useStore()
  const setAmountInput = useSetAtom(amountInputAtom)
  const decimalSeparator = getDecimalSeparator(locale)

  function handleKeypadPress(key: KeypadKey) {
    if (isChargePending) return

    vibrateOnButtonPress()
    applyKeypadPress(setAmountInput, key, currency)
  }

  const handleKeydown = useEffectEvent((event: KeyboardEvent) => {
    if (isChargePending) return

    const target = event.target
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement)
    ) {
      return
    }

    if (numericKeyboardKeys.has(event.key)) {
      applyKeypadPress(setAmountInput, event.key as KeypadKey, currency)
      event.preventDefault()
      return
    }

    if (event.key === "." || event.key === ",") {
      applyKeypadPress(setAmountInput, ".", currency)
      event.preventDefault()
      return
    }

    if (event.key === "Backspace") {
      applyKeypadPress(setAmountInput, "<", currency)
      event.preventDefault()
      return
    }

    if (event.key === "Delete" || event.key === "Escape") {
      setAmountInput("")
      event.preventDefault()
      return
    }

    if (event.key === "Enter") {
      const amountInput = store.get(amountInputAtom)
      const amount = decimalAmountToMinorUnits({ currency, value: amountInput })
      if (amount !== null && !isChargePending) {
        void onCharge({ value: amount, currency })
      }
      event.preventDefault()
    }
  })

  useEffect(() => {
    window.addEventListener("keydown", handleKeydown)
    return () => {
      window.removeEventListener("keydown", handleKeydown)
    }
  }, [])

  function getKeypadAriaLabel(key: KeypadKey) {
    if (key === ".") return t("home.keypad.decimal")
    if (key === "<") return t("home.keypad.backspace")

    return key
  }

  return (
    <section className="grid grid-cols-3 gap-x-0 gap-y-10">
      {amountKeypadKeys.map((key) => (
        <KeypadButton
          key={key}
          aria-label={getKeypadAriaLabel(key)}
          disabled={isChargePending}
          keypadKey={key}
          onPress={handleKeypadPress}
        >
          {key === "." ? decimalSeparator : key}
        </KeypadButton>
      ))}
    </section>
  )
}

function KeypadButton({
  "aria-label": ariaLabel,
  children,
  disabled,
  keypadKey,
  onPress,
}: {
  readonly "aria-label": string
  readonly children: string
  readonly disabled: boolean
  readonly keypadKey: KeypadKey
  readonly onPress: (key: KeypadKey) => void
}) {
  const bubbleAnimationControls = useAnimationControls()
  const shouldReduceMotion = useReducedMotion()

  return (
    <Button
      variant="ghost"
      aria-label={ariaLabel}
      className="relative size-24 -m-6 w-auto overflow-hidden rounded-full text-3xl text-foreground hover:bg-primary-foreground/10"
      disabled={disabled}
      onPointerDown={() => {
        if (disabled) return

        if (!shouldReduceMotion) {
          bubbleAnimationControls.stop()
          bubbleAnimationControls.set({ opacity: 0, scale: 0.25 })
          void bubbleAnimationControls.start({
            ...keypadButtonBubbleAnimation,
            transition: {
              duration: 0.34,
              ease: "easeOut",
              times: [0, 0.6, 1],
            },
          })
        }

        onPress(keypadKey)
      }}
    >
      <motion.span
        aria-hidden="true"
        className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-1/2 left-1/2 size-24 rounded-full bg-primary/20"
        initial={{ opacity: 0, scale: 0.25 }}
        animate={bubbleAnimationControls}
      />
      <span className="relative z-10">{children}</span>
    </Button>
  )
}

function ChargeButton({
  amountInputAtom,
  currency,
  label,
  isChargePending,
  onCharge,
}: {
  readonly amountInputAtom: AmountInputAtom
  readonly currency: FiatCurrency
  readonly label: string
  readonly isChargePending: boolean
  readonly onCharge: ChargeHandler
}) {
  const amountInput = useAtomValue(amountInputAtom)
  const amount = decimalAmountToMinorUnits({ currency, value: amountInput })

  return (
    <Button
      variant="outline"
      aria-busy={isChargePending}
      className="h-14 rounded-full text-base font-bold"
      disabled={amount === null || isChargePending}
      onClick={() => {
        if (amount === null) return

        vibrateOnButtonPress()
        void onCharge({ value: amount, currency })
      }}
    >
      {isChargePending ? (
        <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
      ) : null}
      {label}
    </Button>
  )
}
