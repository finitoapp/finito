import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "../../components/ui/field.tsx"
import { Switch } from "../../components/ui/switch.tsx"
import { useTranslation } from "../../hooks/use-translation.ts"

/**
 * Native counterpart of web's `DiscountSwitchField`: the Discount switch of a
 * form that creates a catalog item — the new-item page and the bill's create
 * dialog. It carries the price's sign, which Android's decimal keyboard
 * cannot type (catalog/0002), so it is offered only when creating an item.
 */
export function DiscountSwitchField({
  checked,
  disabled,
  onCheckedChange,
}: {
  readonly checked: boolean
  readonly disabled: boolean
  readonly onCheckedChange: (checked: boolean) => void
}) {
  const { t } = useTranslation()

  return (
    <Field orientation="horizontal">
      <Switch
        aria-label={t("catalog.items.form.discount.label")}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
      <FieldContent>
        <FieldLabel>{t("catalog.items.form.discount.label")}</FieldLabel>
        <FieldDescription>
          {t("catalog.items.form.discount.description")}
        </FieldDescription>
      </FieldContent>
    </Field>
  )
}
