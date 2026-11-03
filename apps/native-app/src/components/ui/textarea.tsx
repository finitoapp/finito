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
  textAlignVertical: "top",
  multiline: true,

  variants: {
    invalid: { true: { borderColor: "destructive" } },
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
