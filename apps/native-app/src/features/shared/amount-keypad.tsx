import {
  type AmountKeypadKey,
  amountKeypadKeys,
  applyAmountKey,
  formatAmountInputParts,
  getDecimalSeparator,
} from "@payky/app-shared/amount-entry"
import { decimalAmountToMinorUnits } from "@payky/core/modules/shared/money"
import {
  type FiatCurrency,
  NonNegativeInteger,
} from "@payky/core/modules/shared/schema"
import { type PrimitiveAtom, useAtomValue, useSetAtom } from "jotai"
import { type ReactNode, useRef, useState } from "react"
import { Animated, StyleSheet } from "react-native"
import { Text, useTheme, XStack, YStack } from "tamagui"
import { AmountFigure } from "../../components/amount-figure.tsx"
import { replay } from "../../components/motion.ts"
import { Button } from "../../components/ui/button.tsx"
import { useChangePulse } from "../../hooks/use-change-pulse.ts"
import { useLocale, useTranslation } from "../../hooks/use-translation.ts"
import { hapticButtonPress } from "../../platform/haptics.ts"
import { isReduceMotionEnabled } from "../../platform/reduce-motion.ts"
import { fontSize, fontWeight, radius } from "../../theme/tokens.ts"
import { useKeypadKeyboard } from "./use-keypad-keyboard.ts"

type AmountInputAtom = PrimitiveAtom<string>

/** The key bubble, read as `changePulseKeyframes` in `components/motion.ts`. */
const bubbleKeyframes = {
  inputRange: [0, 0.6, 1],
  opacity: [0.28, 0.16, 0],
  scale: [0.25, 1.15, 1.65],
  duration: 340,
  /** Web's `size-24`. */
  size: 96,
} as const

/**
 * Web's `AmountKeypad`: the typed amount, the keys and one submit button.
 * Home charges from it, holding the amount in `terminalAmountInputAtom` so
 * a half-typed amount survives leaving home; the custom tip step types its
 * tip into an atom of its own. The atom is passed down as a prop (AGENTS.md;
 * web's `AmountKeypad` has the measurement), so a key press re-renders only
 * the display and the submit button, not the keys.
 *
 * Drawn as web's `AmountKeypad`: the `header` (a spacer on home), the amount (the
 * `AmountFigure` every screen headlines with, at its largest), the 3-column grid of round ghost keys
 * (`text-3xl`, rows `gap-y-10` around keys that overlap by `-m-6`) and the
 * round Charge button (`h-14 rounded-full text-base font-bold`), filled
 * with the primary color where web outlines it,
 * spread over the height, with web's two motion effects: the amount
 * bounces when it changes and a key blooms a bubble where it is pressed.
 * Both run on RN `Animated` with the native driver (the Tamagui config has
 * no animation driver), on plain `Animated.View`s, as `ui/skeleton.tsx`
 * explains, and neither runs under reduced motion. A physical keyboard
 * types too (`useKeypadKeyboard`), and its Enter charges as the
 * Charge button does, so the pending charge lives here, shared by both.
 */
export function AmountKeypad({
  amountInputAtom,
  currency,
  submitLabel,
  onSubmit,
  header,
}: {
  readonly amountInputAtom: AmountInputAtom
  readonly currency: FiatCurrency
  readonly submitLabel: string
  readonly onSubmit: (amount: NonNegativeInteger) => Promise<void> | void
  /** Drawn above the amount; an empty spacer when left out. */
  readonly header?: ReactNode
}) {
  const [pending, setPending] = useState(false)
  // The ref closes the window before `pending` re-renders: a double tap
  // creates one payment (web's `AmountKeypad` does the same).
  const pendingRef = useRef(false)

  const charge = async (minor: number) => {
    if (pendingRef.current) return
    pendingRef.current = true
    setPending(true)
    try {
      await onSubmit(NonNegativeInteger(minor))
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }
  const handleCharge = (minor: number) => void charge(minor)

  useKeypadKeyboard({
    amountInputAtom,
    currency,
    pending,
    onCharge: handleCharge,
  })

  return (
    <YStack flex={1} justify="space-between">
      {header ?? <YStack />}
      <AmountDisplay amountInputAtom={amountInputAtom} currency={currency} />
      <Keys amountInputAtom={amountInputAtom} currency={currency} />
      <ChargeButton
        amountInputAtom={amountInputAtom}
        currency={currency}
        label={submitLabel}
        pending={pending}
        onCharge={handleCharge}
      />
    </YStack>
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
  const parts = formatAmountInputParts(amountInput, currency, locale)

  const pulse = useChangePulse(parts.text)

  // The one amount figure (`AmountFigure`), at its largest. The transform
  // sits on a wrapper so `adjustsFontSizeToFit` measures the untransformed
  // text.
  return (
    <YStack items="center">
      <Animated.View style={[{ maxWidth: "100%" }, pulse]}>
        <AmountFigure
          size="xl"
          number={parts.number}
          unit={parts.unit}
          unitFirst={parts.unitFirst}
          label={parts.text}
        />
      </Animated.View>
    </YStack>
  )
}

function Keys({
  amountInputAtom,
  currency,
}: {
  readonly amountInputAtom: AmountInputAtom
  readonly currency: FiatCurrency
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const setAmountInput = useSetAtom(amountInputAtom)
  const decimalSeparator = getDecimalSeparator(locale)

  const label = (key: AmountKeypadKey) =>
    key === "."
      ? t("home.keypad.decimal")
      : key === "<"
        ? t("home.keypad.backspace")
        : key

  const rows = [0, 3, 6, 9].map((start) =>
    amountKeypadKeys.slice(start, start + 3)
  )

  return (
    <YStack gap={16}>
      {rows.map((row) => (
        <XStack key={row.join("")}>
          {row.map((key) => (
            <KeypadKey
              key={key}
              label={label(key)}
              onKey={() => {
                hapticButtonPress()
                setAmountInput((current) =>
                  applyAmountKey(current, key, currency)
                )
              }}
            >
              {key === "." ? decimalSeparator : key}
            </KeypadKey>
          ))}
        </XStack>
      ))}
    </YStack>
  )
}

const PRESS_IN_EXPIRES_MS = 5000

const styles = StyleSheet.create({
  bubble: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: bubbleKeyframes.size,
    height: bubbleKeyframes.size,
    marginTop: -bubbleKeyframes.size / 2,
    marginLeft: -bubbleKeyframes.size / 2,
    borderRadius: bubbleKeyframes.size / 2,
  },
})

/**
 * A key that types as the finger lands, as web's keypad does on
 * `pointerdown`, rather than on release: fast typing feels immediate. A
 * screen reader activates it without a touch, so `onPress` types only when
 * no `onPressIn` came just before it; a press the finger slid off of has
 * no `onPress`, and its stamp expires.
 * ponytail: holding a key past PRESS_IN_EXPIRES_MS types it again on release.
 *
 * The landing finger also blooms web's bubble (`bg-primary/20`, clipped by
 * the round key); the ghost press tint stays under it.
 */
function KeypadKey({
  label,
  children,
  onKey,
}: {
  readonly label: string
  readonly children: string
  readonly onKey: () => void
}) {
  const typedOnPressInAt = useRef<number | null>(null)
  const theme = useTheme()
  const [bubble] = useState(() => new Animated.Value(1))
  return (
    <Button
      variant="ghost"
      flex={1}
      h={72}
      rounded={radius.full}
      overflow="hidden"
      aria-label={label}
      onPressIn={() => {
        typedOnPressInAt.current = Date.now()
        if (!isReduceMotionEnabled()) {
          replay(bubble, bubbleKeyframes.duration)
        }
        onKey()
      }}
      onPress={() => {
        const at = typedOnPressInAt.current
        typedOnPressInAt.current = null
        if (at === null || Date.now() - at > PRESS_IN_EXPIRES_MS) onKey()
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.bubble,
          {
            backgroundColor: theme.primary?.val,
            // Web's `/20` alpha folded into the animated opacity.
            opacity: bubble.interpolate({
              inputRange: bubbleKeyframes.inputRange,
              outputRange: bubbleKeyframes.opacity.map((o) => o * 0.2),
            }),
            transform: [
              {
                scale: bubble.interpolate({
                  inputRange: bubbleKeyframes.inputRange,
                  outputRange: bubbleKeyframes.scale,
                }),
              },
            ],
          },
        ]}
      />
      <Text fontSize={fontSize["3xl"]} lineHeight={fontSize["3xl"]}>
        {children}
      </Text>
    </Button>
  )
}

function ChargeButton({
  amountInputAtom,
  currency,
  label,
  pending,
  onCharge,
}: {
  readonly amountInputAtom: AmountInputAtom
  readonly currency: FiatCurrency
  readonly label: string
  readonly pending: boolean
  readonly onCharge: (minor: number) => void
}) {
  const amountInput = useAtomValue(amountInputAtom)
  const amount = decimalAmountToMinorUnits({ currency, value: amountInput })

  return (
    <Button
      variant="default"
      h={56}
      rounded={radius.full}
      aria-label={label}
      pending={pending}
      disabled={amount === null}
      onPress={() => {
        if (amount === null) return
        hapticButtonPress()
        onCharge(amount)
      }}
    >
      <Text
        fontSize={fontSize.base}
        lineHeight={fontSize.base}
        fontWeight={fontWeight.bold}
        color="primary-foreground"
      >
        {label}
      </Text>
    </Button>
  )
}
