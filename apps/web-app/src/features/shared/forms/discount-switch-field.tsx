import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field.tsx"
import { Switch } from "@/components/ui/switch.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"

/**
 * The Discount switch of a form that creates a catalog item — the catalog's
 * item form and the bill's create dialog. It carries the price's sign, which
 * Android's decimal keyboard cannot type (catalog/0002), so it is offered
 * only when creating an item: a stored item keeps its sign.
 */
export function DiscountSwitchField({
  id,
  checked,
  disabled,
  onCheckedChange,
}: {
  readonly id: string
  readonly checked: boolean
  readonly disabled: boolean
  readonly onCheckedChange: (checked: boolean) => void
}) {
  const { t } = useTranslation()

  return (
    <Field orientation="horizontal">
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
      <FieldContent>
        <FieldLabel htmlFor={id}>
          {t("catalog.items.form.discount.label")}
        </FieldLabel>
        <FieldDescription>
          {t("catalog.items.form.discount.description")}
        </FieldDescription>
      </FieldContent>
    </Field>
  )
}
