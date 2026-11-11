import type { ReactNode } from "react"
import { useId } from "react"
import { z } from "zod"

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field.tsx"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx"
import {
  InlineEditSavedTick,
  type InlineSaveResult,
  useInlineChoice,
} from "@/features/shared/forms/inline-edit-save.tsx"

interface InlineEditSelectOption {
  readonly value: string
  readonly label: string
}

interface InlineEditSelectProps<T extends string | number | null> {
  readonly label: string
  readonly description?: ReactNode
  /**
   * Current stored value, or `undefined` when the row does not exist yet —
   * the select then shows `placeholder` instead of an option.
   */
  readonly defaultValue: T | undefined
  readonly placeholder?: string
  /** See `InlineEditField`; the option values are this codec's input side. */
  readonly codec: z.core.$ZodType<T, string>
  readonly options: ReadonlyArray<InlineEditSelectOption>
  /** See `InlineEditField`'s: a `TranslationKey` or a rejection, no tick. */
  readonly onSave: (value: T) => InlineSaveResult
}

/**
 * A single select that saves itself.
 *
 * Unlike `InlineEditField` there is no edit mode to finish: picking an
 * option is the confirmation, and every option is valid by construction, so
 * the choice saves straight away. A save keeps the picked option on screen
 * until `onSave` resolves, then shows the same tick.
 */
export function InlineEditSelect<T extends string | number | null>({
  label,
  description,
  defaultValue,
  placeholder,
  codec,
  options,
  onSave,
}: InlineEditSelectProps<T>) {
  const id = useId()
  // The unset case is only ever a starting point: `choose` is called with a
  // decoded option, so `undefined` never reaches `onSave`.
  const { value, saving, justSaved, choose } = useInlineChoice<T | undefined>(
    defaultValue,
    // Handed back as it is, so a refusal's own message reaches the toast.
    (next) => (next === undefined ? Promise.resolve(undefined) : onSave(next))
  )

  const handleValueChange = (next: string | null) => {
    if (next === null) return

    // Every option value comes from `options`, so this cannot realistically
    // fail; a decode error here is a wrong codec, not bad user input.
    const parsed = z.safeDecode(codec, next)
    if (parsed.success) void choose(parsed.data)
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <Select<string>
          items={Object.fromEntries(
            options.map((option) => [option.value, option.label])
          )}
          value={value === undefined ? null : z.encode(codec, value)}
          onValueChange={handleValueChange}
        >
          <SelectTrigger
            id={id}
            disabled={saving}
            // The `Field` stretches its direct children, which here is the
            // wrapper the tick is positioned against, not the trigger.
            className="w-full"
          >
            <SelectValue placeholder={placeholder} />
            {/* Room for the tick between the value and the trigger's own
                chevron. Padding would move the chevron along with it. */}
            {justSaved && <span aria-hidden className="w-6 shrink-0" />}
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {justSaved && <InlineEditSavedTick className="right-6" />}
      </div>
      {description !== undefined && (
        <FieldDescription>{description}</FieldDescription>
      )}
    </Field>
  )
}
