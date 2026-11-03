import type { ReactNode } from "react"
import { useId } from "react"

import { Checkbox } from "@/components/ui/checkbox.tsx"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field.tsx"
import {
  InlineEditSavedTick,
  useInlineChoice,
} from "@/features/shared/forms/inline-edit-save.tsx"
import { cn } from "@/lib/utils.ts"

interface InlineEditCheckboxProps {
  readonly label: string
  readonly description?: ReactNode
  /** Current stored value. Re-renders flow straight through while idle. */
  readonly defaultValue: boolean
  readonly disabled?: boolean
  /** Rejects to report a failed save; the field toasts and shows no tick. */
  readonly onSave: (checked: boolean) => Promise<void>
}

/**
 * A single checkbox that saves itself.
 *
 * Like `InlineEditSelect` and unlike `InlineEditField` there is no edit mode
 * to finish: ticking the box is the confirmation, and a checkbox has no
 * invalid value, so there is no codec either.
 */
export function InlineEditCheckbox({
  label,
  description,
  defaultValue,
  disabled,
  onSave,
}: InlineEditCheckboxProps) {
  const id = useId()
  const { value, saving, justSaved, choose } = useInlineChoice(
    defaultValue,
    onSave
  )

  return (
    <Field
      orientation="horizontal"
      className={cn("relative", justSaved && "pr-7")}
    >
      <Checkbox
        id={id}
        checked={value}
        disabled={disabled === true || saving}
        onCheckedChange={(checked) => {
          void choose(checked)
        }}
      />
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {description !== undefined && (
          <FieldDescription>{description}</FieldDescription>
        )}
      </FieldContent>
      {justSaved && <InlineEditSavedTick className="right-0" />}
    </Field>
  )
}
