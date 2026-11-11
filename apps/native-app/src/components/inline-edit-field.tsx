import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import Check from "lucide-react-native/icons/check"
import X from "lucide-react-native/icons/x"
import { type ComponentProps, type ReactNode, useState } from "react"
import { View, XStack } from "tamagui"
import { z } from "zod"
import { useToast } from "../hooks/use-toast.ts"
import { useTranslation } from "../hooks/use-translation.ts"
import { Button } from "./ui/button.tsx"
import { Field, FieldDescription, FieldError, FieldLabel } from "./ui/field.tsx"
import { Input } from "./ui/input.tsx"

/**
 * Native counterpart of web's `InlineEditField`: the first keystroke starts an
 * edit, Save (or the keyboard's submit key) commits it, Discard drops it. Unlike
 * web there is no focus to hold, so leaving the field changes nothing: the draft
 * stays until it is saved or discarded. `codec` is the same
 * `@payky/app-shared/inline-edit-codecs` codec web uses; `onSave` resolves
 * `true` once the value is stored (a `useRunToast` result), and a `false` keeps
 * the draft so the user can retry.
 *
 * Drawn as web's: label, then the input with Save (a default icon button with
 * `Check`) and Discard (outline, `X`) inside it on the right while editing,
 * then the description and the error.
 */
export function InlineEditField<T extends string | number | null>({
  label,
  description,
  placeholder,
  keyboardType,
  defaultValue,
  codec,
  errorKey,
  labelAction,
  trailing,
  onSave,
  startEditing = false,
  onEditFinished,
}: {
  /** Already translated. */
  readonly label: string
  /** Already translated. */
  readonly description?: string
  readonly placeholder?: string
  readonly keyboardType?: ComponentProps<typeof Input>["keyboardType"]
  readonly defaultValue: T
  readonly codec: z.core.$ZodType<T, string>
  readonly errorKey: TranslationKey
  /** A control beside the label, hidden while editing with its space kept. */
  readonly labelAction?: ReactNode
  /** A control inside the input while idle, hidden during an edit. */
  readonly trailing?: ReactNode
  readonly onSave: (value: T) => Promise<boolean>
  /**
   * Mounts the field already in edit mode, for a caller that renders it only
   * in response to an explicit "edit this" action (a row's rename).
   */
  readonly startEditing?: boolean
  /** Called once the field is back to idle, saved or discarded. */
  readonly onEditFinished?: () => void
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const [draft, setDraft] = useState<string | null>(
    startEditing ? z.encode(codec, defaultValue) : null
  )
  const [invalid, setInvalid] = useState(false)
  const [saving, setSaving] = useState(false)

  const discard = () => {
    setDraft(null)
    setInvalid(false)
    onEditFinished?.()
  }

  const commit = async () => {
    if (draft === null || saving) return
    const parsed = z.safeDecode(codec, draft)
    if (!parsed.success) {
      setInvalid(true)
      return
    }
    if (parsed.data === defaultValue) {
      discard()
      return
    }
    setSaving(true)
    const saved = await onSave(parsed.data)
    setSaving(false)
    if (!saved) return
    discard()
    toast.success(t("inlineEdit.saved"))
  }

  return (
    <Field>
      {labelAction === undefined ? (
        <FieldLabel>{label}</FieldLabel>
      ) : (
        <XStack w="100%" items="center" justify="space-between" gap="2">
          <FieldLabel>{label}</FieldLabel>
          <View
            opacity={draft === null ? 1 : 0}
            pointerEvents={draft === null ? "auto" : "none"}
            aria-hidden={draft !== null}
          >
            {labelAction}
          </View>
        </XStack>
      )}
      <View position="relative">
        <Input
          value={draft ?? z.encode(codec, defaultValue)}
          placeholder={placeholder}
          keyboardType={keyboardType}
          disabled={saving}
          autoCorrect={false}
          invalid={invalid}
          aria-label={label}
          pr={draft === null ? (trailing === undefined ? 10 : 48) : 80}
          onChangeText={(text) => {
            setDraft(text)
            setInvalid(false)
          }}
          onSubmitEditing={() => {
            void commit()
          }}
        />
        {draft === null && trailing !== undefined ? (
          <View position="absolute" t={0} b={0} r={8} justify="center">
            {trailing}
          </View>
        ) : null}
        {draft === null ? null : (
          <XStack position="absolute" t={0} b={0} r={4} items="center" gap={2}>
            <Button
              size="icon"
              iconStart={Check}
              aria-label={t("inlineEdit.save")}
              pending={saving}
              onPress={() => {
                void commit()
              }}
            />
            <Button
              variant="outline"
              size="icon"
              iconStart={X}
              aria-label={t("inlineEdit.discard")}
              disabled={saving}
              onPress={discard}
            />
          </XStack>
        )}
      </View>
      {description === undefined ? null : (
        <FieldDescription>{description}</FieldDescription>
      )}
      <FieldError>{invalid ? t(errorKey) : undefined}</FieldError>
    </Field>
  )
}
