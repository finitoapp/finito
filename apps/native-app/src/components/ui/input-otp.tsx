import Minus from "lucide-react-native/icons/minus"
import { createContext, type ReactNode, useContext, useState } from "react"
import { TextInput } from "react-native"
import { styled, Text, View } from "tamagui"
import { fontSize, radius } from "../../theme/tokens.ts"
import { Icon } from "./icon.tsx"

/**
 * Web `apps/web-app/src/components/ui/input-otp.tsx` (shadcn over the
 * `input-otp` package): the same parts, `InputOTP`, `InputOTPGroup`,
 * `InputOTPSlot`, `InputOTPSeparator`.
 *
 * Tailwind mirrored: the slot `size-8 border-y border-r border-input text-sm
 * first:rounded-l-lg first:border-l last:rounded-r-lg dark:bg-input/30`,
 * active `border-ring`, `aria-invalid:border-destructive`; the caret `h-4
 * w-px bg-foreground`; the separator a `size-4` `Minus`;
 * `has-disabled:opacity-50`.
 *
 * Native differences, as web's package does it: one transparent RN
 * `TextInput` lies over the slots and holds the focus and the keyboard; the
 * slots only draw its value. That input has every keyboard aid off — no
 * suggestions, autocorrect or spell check, no autofill or one-time-code
 * fill, no context menu (so no paste) — because the codes it takes are
 * secrets. It keeps no value of its own: the caller owns `value`, so the
 * code is gone when the caller unmounts. The caret does not blink (no
 * animation driver); `invalid` stands in for `aria-invalid`; `size="lg"` is
 * the one web call site's `size-12 text-2xl`, in Manrope rather than
 * `font-mono`, which the Tamagui config has no font for.
 */

interface SlotState {
  readonly char: string | undefined
  readonly isActive: boolean
}

const InputOTPContext = createContext<ReadonlyArray<SlotState>>([])

interface InputOTPProps {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly maxLength: number
  /** Already translated; TalkBack reads it for the whole code. */
  readonly "aria-label": string
  readonly autoFocus?: boolean
  readonly disabled?: boolean
  readonly children: ReactNode
}

export function InputOTP({
  value,
  onChange,
  maxLength,
  "aria-label": ariaLabel,
  autoFocus = false,
  disabled = false,
  children,
}: InputOTPProps) {
  const [focused, setFocused] = useState(false)
  const activeIndex = Math.min(value.length, maxLength - 1)
  const slots = Array.from({ length: maxLength }, (_, index) => ({
    char: value[index],
    isActive: focused && index === activeIndex,
  }))
  return (
    <InputOTPContext value={slots}>
      <View
        flexDirection="row"
        items="center"
        justify="center"
        gap={8}
        opacity={disabled ? 0.5 : 1}
      >
        <View
          flexDirection="row"
          items="center"
          gap={8}
          importantForAccessibility="no-hide-descendants"
        >
          {children}
        </View>
        <TextInput
          value={value}
          onChangeText={onChange}
          maxLength={maxLength}
          editable={!disabled}
          autoFocus={autoFocus}
          keyboardType="number-pad"
          autoComplete="off"
          importantForAutofill="no"
          textContentType="none"
          autoCorrect={false}
          spellCheck={false}
          contextMenuHidden
          caretHidden
          aria-label={ariaLabel}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            opacity: 0,
          }}
        />
      </View>
    </InputOTPContext>
  )
}

export const InputOTPGroup = styled(View, {
  name: "InputOTPGroup",
  flexDirection: "row",
  items: "center",
})

const SlotFrame = styled(View, {
  name: "InputOTPSlot",
  items: "center",
  justify: "center",
  borderTopWidth: 1,
  borderBottomWidth: 1,
  borderRightWidth: 1,
  borderColor: "input",
  bg: "input-bg",

  variants: {
    size: {
      default: { w: 32, h: 32 },
      lg: { w: 48, h: 48 },
    },
    first: {
      true: {
        borderLeftWidth: 1,
        borderTopLeftRadius: radius.lg,
        borderBottomLeftRadius: radius.lg,
      },
    },
    last: {
      true: {
        borderTopRightRadius: radius.lg,
        borderBottomRightRadius: radius.lg,
      },
    },
    active: { true: { borderColor: "ring", z: 10 } },
    invalid: { true: { borderColor: "destructive" } },
  } as const,

  defaultVariants: { size: "default" },
})

interface InputOTPSlotProps {
  readonly index: number
  /** Web's `first:`/`last:` inside an `InputOTPGroup`: RN has no sibling selectors. */
  readonly first?: boolean
  readonly last?: boolean
  readonly invalid?: boolean
  readonly size?: "default" | "lg"
}

export function InputOTPSlot({
  index,
  first = false,
  last = false,
  invalid = false,
  size = "default",
}: InputOTPSlotProps) {
  const slot = useContext(InputOTPContext)[index]
  const char = slot?.char
  const isActive = slot?.isActive === true
  return (
    <SlotFrame
      size={size}
      first={first}
      last={last}
      active={isActive}
      invalid={invalid}
    >
      {char === undefined ? (
        isActive ? (
          <View w={1} h={16} bg="color" />
        ) : null
      ) : (
        <Text
          color="color"
          fontSize={size === "lg" ? fontSize["2xl"] : fontSize.sm}
          lineHeight={size === "lg" ? fontSize["2xl"] : fontSize.sm}
        >
          {char}
        </Text>
      )}
    </SlotFrame>
  )
}

export function InputOTPSeparator() {
  return <Icon icon={Minus} />
}
