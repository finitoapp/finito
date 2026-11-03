import type { ReactNode } from "react"

import {
  OptionToggleGroup,
  type OptionToggleGroupOption,
} from "@/components/option-toggle-group.tsx"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field.tsx"
import {
  InlineEditSavedTick,
  useInlineChoice,
} from "@/features/shared/forms/inline-edit-save.tsx"

interface InlineEditToggleGroupProps<Value extends string> {
  readonly label: string
  readonly description?: ReactNode
  /** Current stored value. Re-renders flow straight through while idle. */
  readonly defaultValue: Value
  readonly options: ReadonlyArray<OptionToggleGroupOption<Value>>
  /** Rejects to report a failed save; the field toasts and shows no tick. */
  readonly onSave: (value: Value) => Promise<void>
}

/**
 * An `OptionToggleGroup` that saves itself.
 *
 * Same bargain as `InlineEditSelect`: picking an option is the confirmation,
 * every option is valid by construction, so there is no edit mode and no
 * codec — the option values are the stored values.
 */
export function InlineEditToggleGroup<Value extends string>({
  label,
  description,
  defaultValue,
  options,
  onSave,
}: InlineEditToggleGroupProps<Value>) {
  const { value, saving, justSaved, choose } = useInlineChoice(
    defaultValue,
    onSave
  )

  return (
    <Field>
      <div className="relative">
        <FieldLabel>{label}</FieldLabel>
        {/* Against the label rather than the options, which are a tall block. */}
        {justSaved && <InlineEditSavedTick className="right-0" />}
      </div>
      <OptionToggleGroup
        value={value}
        options={options}
        disabled={saving}
        onChange={(next) => {
          void choose(next)
        }}
      />
      {description !== undefined && (
        <FieldDescription>{description}</FieldDescription>
      )}
    </Field>
  )
}
