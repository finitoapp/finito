import {
  accessPresetOrder,
  presetOf,
  withPermission,
} from "@payky/app-shared/access-form"
import {
  type AccessPreset,
  accessPresets,
  type Permission,
  permissions,
} from "@payky/core/modules/access/access-types"
import { TriangleAlert } from "lucide-react"
import { useId } from "react"
import { Checkbox } from "@/components/ui/checkbox.tsx"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field.tsx"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx"
import { useTranslation } from "@/hooks/use-translation.ts"
import {
  accessPresetLabelKeys,
  permissionDescriptionKeys,
  permissionLabelKeys,
} from "@/i18n/access-labels.ts"

export function Warning({ children }: { readonly children: string }) {
  return (
    <p className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <TriangleAlert
        className="mt-0.5 size-4 shrink-0 text-destructive"
        aria-hidden="true"
      />
      {children}
    </p>
  )
}

export function PresetSelect({
  label,
  value,
  onChange,
}: {
  readonly label: string
  readonly value: AccessPreset | null
  readonly onChange: (preset: AccessPreset) => void
}) {
  const { t } = useTranslation()

  return (
    <Select<AccessPreset>
      value={value}
      onValueChange={(preset: AccessPreset | null) => {
        if (preset !== null) onChange(preset)
      }}
    >
      <SelectTrigger aria-label={label} className="w-full">
        <SelectValue>
          {(preset: AccessPreset | null) =>
            preset === null
              ? t("access.preset.custom")
              : t(accessPresetLabelKeys[preset])
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {accessPresetOrder.map((preset) => (
          <SelectItem key={preset} value={preset}>
            {t(accessPresetLabelKeys[preset])}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * What a device may do without the PIN (access/0004, access/0013): a preset
 * to start from, then each permission. The device list's dialog and adding a
 * device both set it.
 */
export function PermissionsFields({
  label,
  granted,
  onChange,
}: {
  /** Already translated: whose permissions these are. */
  readonly label: string
  readonly granted: ReadonlySet<Permission>
  readonly onChange: (granted: ReadonlySet<Permission>) => void
}) {
  const { t } = useTranslation()
  const idPrefix = useId()

  return (
    <>
      <PresetSelect
        label={label}
        value={presetOf(granted)}
        onChange={(preset) => onChange(new Set(accessPresets[preset]))}
      />
      <FieldGroup>
        {permissions.map((permission) => {
          const id = `${idPrefix}-${permission}`
          return (
            <Field key={permission} orientation="horizontal">
              <Checkbox
                id={id}
                checked={granted.has(permission)}
                onCheckedChange={(checked) =>
                  onChange(
                    withPermission(granted, permission, checked === true)
                  )
                }
              />
              <div className="flex flex-col gap-0.5">
                <FieldLabel htmlFor={id}>
                  {t(permissionLabelKeys[permission])}
                </FieldLabel>
                <FieldDescription>
                  {t(permissionDescriptionKeys[permission])}
                </FieldDescription>
              </div>
            </Field>
          )
        })}
      </FieldGroup>
      {granted.has("admin") ? (
        <Warning>{t("access.device.adminWarning")}</Warning>
      ) : null}
    </>
  )
}
