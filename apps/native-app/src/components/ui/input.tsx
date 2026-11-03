import type { ComponentProps } from "react"
import { Platform } from "react-native"
import { type GetProps, styled, Input as TamaguiInput } from "tamagui"
import { fontSize, radius } from "../../theme/tokens.ts"
import { useFieldLabelId, useFieldLabelText } from "./field.tsx"

/**
 * Web `apps/web-app/src/components/ui/input.tsx`, on Tamagui `Input`.
 *
 * Tailwind mirrored: `rounded-lg border border-input bg-transparent px-2.5
 * py-1 text-base placeholder:text-muted-foreground focus-visible:border-ring
 * disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive
 * dark:bg-input/30 dark:disabled:bg-input/80`.
 *
 * Native differences: web's `h-8` (32) becomes a minimum of 40, because a
 * text input takes no `hitSlop` and the field itself is the touch target;
 * the focus ring (`ring-3 ring-ring/50`) is only the border color; `invalid`
 * stands in for `aria-invalid`. Every TextInput prop passes through, so
 * `secureTextEntry`, `contextMenuHidden` and the autofill props keep working
 * where a screen relies on them.
 */

const InputFrame = styled(TamaguiInput, {
  name: "Input",
  minH: 40,
  rounded: radius.lg,
  borderWidth: 1,
  borderColor: "input focus:ring",
  bg: "input-bg",
  // Not `px`: on native Tamagui expands it to paddingStart/End too, which
  // beat a caller's `pl`/`pr` (an icon inside the field).
  pl: 10,
  pr: 10,
  py: 4,
  color: "color",
  fontSize: fontSize.base,
  placeholderTextColor: "muted-foreground",
  caretColor: "primary",

  variants: {
    invalid: { true: { borderColor: "destructive" } },
  } as const,
})

export type InputProps = GetProps<typeof InputFrame>

/** The field itself, for a screen that moves focus between fields. */
export type InputHandle = ComponentProps<typeof InputFrame>["ref"]

/**
 * Inside a `ui/field` `Field`, TalkBack names it after the `FieldLabel`. Its
 * name is also its `testID`, so an e2e flow finds the input by its label with
 * one `id:` on both platforms (on Android the label's own text matches a text
 * selector too).
 */
export function Input(rawProps: InputProps & { readonly ref?: InputHandle }) {
  const props = Platform.OS === "web" ? toWebInputProps(rawProps) : rawProps
  const fieldLabel = useFieldLabelText()
  const name = props["aria-label"] ?? fieldLabel
  // The disabled look is applied here, not as a variant, so `disabled`
  // still reaches Tamagui's input and makes it read-only.
  const disabledStyle =
    props.disabled === true
      ? ({ opacity: 0.5, bg: "input-disabled" } as const)
      : {}
  return (
    <InputFrame
      aria-labelledby={useFieldLabelId()}
      aria-label={name}
      testID={name}
      {...disabledStyle}
      {...props}
    />
  )
}

/**
 * Tamagui's web `Input` is a plain `<input>` that drops the React Native
 * props it marks native-only, so a screen written for Android would lose
 * them in the web export without a word: `secureTextEntry` becomes web's
 * `type="password"`, and `onKeyPress` is fed from `onKeyDown` with the
 * same `{ nativeEvent: { key } }` shape.
 */
function toWebInputProps(
  props: InputProps & { readonly ref?: InputHandle }
): InputProps & { readonly ref?: InputHandle } {
  const { secureTextEntry, onKeyPress, onKeyDown, ...rest } = props
  return {
    ...rest,
    ...(secureTextEntry === true ? { type: "password" } : {}),
    onKeyDown:
      onKeyPress === undefined
        ? onKeyDown
        : (event) => {
            onKeyPress({ nativeEvent: { key: event.key } } as Parameters<
              typeof onKeyPress
            >[0])
            onKeyDown?.(event)
          },
  }
}
