import { type GetProps, styled, TextArea } from "tamagui"
import { fontSize, shape } from "../../theme/tokens.ts"
import { useFieldLabelId, useFieldLabelText } from "./field.tsx"

/**
 * Web `apps/web-app/src/components/ui/textarea.tsx`, on Tamagui `TextArea`:
 * `ui/input.tsx`'s filled field with `min-h-24` (96), top-aligned text.
 */

const TextareaFrame = styled(TextArea, {
  name: "Textarea",
  minH: 96,
  rounded: shape.control,
  // No frame (fazole.fit): focus lifts the fill, no browser outline either.
  borderWidth: 0,
  outlineWidth: 0,
  bg: "input-bg focus:neutral-soft",
  // Not `px`: on native Tamagui expands it to paddingStart/End too, which
  // beat a caller's `pl`/`pr` (an icon inside the field).
  pl: 12,
  pr: 12,
  py: 10,
  color: "color",
  fontSize: fontSize.base,
  placeholderTextColor: "foreground-40",
  caretColor: "primary",
  textAlignVertical: "top",
  multiline: true,

  variants: {
    invalid: { true: { bg: "destructive-tint" } },
  } as const,
})

export type TextareaProps = GetProps<typeof TextareaFrame>

/**
 * Inside a `ui/field` `Field`, TalkBack names it after the `FieldLabel`. Its
 * name is also its `testID`, so an e2e flow finds the input by its label with
 * one `id:` on both platforms (on Android the label's own text matches a text
 * selector too).
 */
export function Textarea(props: TextareaProps) {
  const fieldLabel = useFieldLabelText()
  const name = props["aria-label"] ?? fieldLabel
  return (
    <TextareaFrame
      aria-labelledby={useFieldLabelId()}
      aria-label={name}
      testID={name}
      {...props}
    />
  )
}
