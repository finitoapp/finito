import type { ComponentProps } from "react"
import { type GetProps, styled, Input as TamaguiInput } from "tamagui"
import { control, fontSize, shape } from "../../theme/tokens.ts"
import { useFieldLabelId, useFieldLabelText } from "./field.tsx"

/**
 * Web `apps/web-app/src/components/ui/input.tsx`, on Tamagui `Input`, in
 * fazole.fit's field (Linky's `packages/ui/src/styles.ts` `fieldStyle`): a
 * 12-round filled control 44 high, `px-3 py-2.5`, body text, no border at
 * rest; a focus or an `invalid` field shows one (`ring`, `destructive`) in
 * the space a transparent border keeps, so the text never moves.
 *
 * Native differences: `invalid` stands in for `aria-invalid`. Every
 * TextInput prop passes through, so `secureTextEntry`, `contextMenuHidden`
 * and the autofill props keep working where a screen relies on them.
 */

const InputFrame = styled(TamaguiInput, {
  name: "Input",
  minH: control.md,
  rounded: shape.control,
  borderWidth: 1,
  borderColor: "transparent focus:ring",
  // The ring is the focus mark; no browser outline on top of it.
  outlineWidth: 0,
  bg: "input-bg",
  // Not `px`: on native Tamagui expands it to paddingStart/End too, which
  // beat a caller's `pl`/`pr` (an icon inside the field).
  pl: 12,
  pr: 12,
  py: 10,
  color: "color",
  fontSize: fontSize.base,
  placeholderTextColor: "foreground-40",
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
export function Input(props: InputProps & { readonly ref?: InputHandle }) {
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
