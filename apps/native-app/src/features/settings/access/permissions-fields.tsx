import { presetOf, withPermission } from "@payky/app-shared/access-form"
import {
  accessPresets,
  type Permission,
  permissions,
} from "@payky/core/modules/access/access-types"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { Alert, AlertDescription } from "../../../components/ui/alert.tsx"
import { Checkbox } from "../../../components/ui/checkbox.tsx"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "../../../components/ui/field.tsx"
import {
  permissionDescriptionKeys,
  permissionLabelKeys,
} from "../../../core/access-labels.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { PresetPicker } from "./device-parts.tsx"

/**
 * What a device may do without the PIN (access/0004, access/0013): a preset
 * to start from, then each permission. The device list's dialog and adding a
 * device both set it; web's `PermissionsFields`.
 */
export function PermissionsFields({
  label,
  granted,
  disabled = false,
  onChange,
}: {
  /** Already translated: whose permissions these are. */
  readonly label: string
  readonly granted: ReadonlySet<Permission>
  readonly disabled?: boolean
  readonly onChange: (granted: ReadonlySet<Permission>) => void
}) {
  const { t } = useTranslation()

  return (
    <>
      <Field>
        <FieldLabel>{label}</FieldLabel>
        <PresetPicker
          label={label}
          value={presetOf(granted)}
          onChange={(preset) => onChange(new Set(accessPresets[preset]))}
        />
      </Field>
      <FieldGroup>
        {permissions.map((permission) => (
          <Field key={permission} orientation="horizontal">
            <Checkbox
              aria-label={t(permissionLabelKeys[permission])}
              checked={granted.has(permission)}
              disabled={disabled}
              onCheckedChange={(checked) =>
                onChange(withPermission(granted, permission, checked))
              }
            />
            <FieldContent>
              <FieldLabel>{t(permissionLabelKeys[permission])}</FieldLabel>
              <FieldDescription>
                {t(permissionDescriptionKeys[permission])}
              </FieldDescription>
            </FieldContent>
          </Field>
        ))}
      </FieldGroup>
      {granted.has("admin") ? (
        <Alert variant="destructive" icon={TriangleAlert}>
          <AlertDescription>{t("access.device.adminWarning")}</AlertDescription>
        </Alert>
      ) : null}
    </>
  )
}
