import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type { ReactNode } from "react"
import { useId } from "react"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field.tsx"
import { Switch } from "@/components/ui/switch.tsx"
import {
  InlineEditSavedTick,
  useInlineChoice,
} from "@/features/shared/forms/inline-edit-save.tsx"
import { cn } from "@/lib/utils.ts"

interface InlineEditSwitchProps {
  readonly label: string
  readonly description?: ReactNode
  readonly defaultValue: boolean
  readonly disabled?: boolean
  readonly showText?: boolean
  readonly showSaved?: boolean
  readonly onSave:
    | ((checked: boolean) => Promise<void>)
    | ((checked: boolean) => Promise<TranslationKey | undefined>)
}

export function InlineEditSwitch({
  label,
  description,
  defaultValue,
  disabled,
  showText = true,
  showSaved = true,
  onSave,
}: InlineEditSwitchProps) {
  const id = useId()
  const { value, saving, justSaved, choose } = useInlineChoice(
    defaultValue,
    onSave
  )

  return (
    <Field
      orientation="horizontal"
      className={cn("relative", justSaved && showSaved && !showText && "pr-7")}
    >
      <Switch
        id={id}
        aria-label={label}
        checked={value}
        disabled={disabled === true || saving}
        onCheckedChange={(checked) => {
          void choose(checked)
        }}
      />
      {showText && (
        <FieldContent className={cn(justSaved && showSaved && "pr-7")}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          {description !== undefined && (
            <FieldDescription>{description}</FieldDescription>
          )}
        </FieldContent>
      )}
      {justSaved && showSaved && <InlineEditSavedTick className="right-0" />}
    </Field>
  )
}
