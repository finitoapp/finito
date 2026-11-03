import { Platform } from "react-native"
import { type GetProps, styled, TextArea } from "tamagui"
import { fontSize, radius } from "../../theme/tokens.ts"
import { useFieldLabelId, useFieldLabelText } from "./field.tsx"

/**
 * Web `apps/web-app/src/components/ui/textarea.tsx`, on Tamagui `TextArea`:
 * `ui/input.tsx`'s field with `min-h-24 py-2` (96/8), top-aligned text.
 */

const TextareaFrame = styled(TextArea, {
  name: "Textarea",
  minH: 96,
  rounded: radius.lg,
  borderWidth: 1,
  borderColor: "input focus:ring",
  bg: "input-bg",
  // Not `px`: on native Tamagui expands it to paddingStart/End too, which
  // beat a caller's `pl`/`pr` (an icon inside the field).
  pl: 10,
  pr: 10,
  py: 8,
  color: "color",
  fontSize: fontSize.base,
  placeholderTextColor: "muted-foreground",
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
export function Textarea(rawProps: TextareaProps) {
  const props = Platform.OS === "web" ? toWebTextareaProps(rawProps) : rawProps
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

/**
 * Tamagui's web `TextArea` is a plain `<textarea>`, which drops the native
 * `secureTextEntry` and has no `type="password"`; the glyphs are masked
 * with `-webkit-text-security` instead, which every current browser reads.
 */
function toWebTextareaProps(props: TextareaProps): TextareaProps {
  const { secureTextEntry, ...rest } = props
  if (secureTextEntry !== true) return rest
  return {
    ...rest,
    style: [
      rest.style,
      { WebkitTextSecurity: "disc" },
    ] as TextareaProps["style"],
  }
}
