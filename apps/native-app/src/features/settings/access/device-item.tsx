import { presetOf, withPermission } from "@payky/app-shared/access-form"
import {
  accessPresets,
  type Permission,
  permissions,
} from "@payky/core/modules/access/access-types"
import { decodePermissions } from "@payky/core/modules/access/access-utils"
import {
  removeDevice,
  setDeviceDefaultPermissions,
  unblockDevice,
} from "@payky/core/modules/device/device-actions"
import type { DeviceListRow } from "@payky/core/modules/device/device-queries"
import LockOpen from "lucide-react-native/icons/lock-open"
import Pencil from "lucide-react-native/icons/pencil"
import Trash from "lucide-react-native/icons/trash"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import { Button } from "../../../components/ui/button.tsx"
import { Checkbox } from "../../../components/ui/checkbox.tsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog.tsx"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "../../../components/ui/field.tsx"
import { Icon } from "../../../components/ui/icon.tsx"
import {
  accessPresetLabelKeys,
  permissionDescriptionKeys,
  permissionLabelKeys,
} from "../../../core/access-labels.ts"
import { useRequirePermission } from "../../../core/use-access.ts"
import { useConfirm } from "../../../hooks/use-confirm.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { DeviceHeading, PresetPicker, RenameForm } from "./device-parts.tsx"

/** One device of the account: its defaults, name, and removal (access/0004). */
export function DeviceItem({
  device,
  thisDevice,
}: {
  readonly device: DeviceListRow
  readonly thisDevice: boolean
}) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const confirm = useConfirm()
  const { requirePin } = useRequirePermission()
  const [editor, setEditor] = useState<"permissions" | "rename" | null>(null)
  const granted = decodePermissions(device.defaultPermissions)
  const preset = presetOf(granted)

  // The current PIN even on a device with `admin` (access/0001), awaited
  // before the Task writes the fresh token (access/0006).
  const unblock = async () => {
    if (!(await requirePin("access.action.unblock"))) return
    await runToast(async (run) => {
      await run.ok(unblockDevice(device.id))
    })
  }

  // As web: a confirmation, not the PIN. The route is `admin` already, and
  // removing a row clears its permissions together with the delete.
  const remove = async () => {
    const confirmed = await confirm({
      title: t("access.device.remove.title", { name: device.name }),
      description: t("access.device.remove.description"),
      confirmLabel: t("access.device.remove.confirm"),
      cancelLabel: t("access.cancel"),
      variant: "destructive",
    })
    if (!confirmed) return
    await runToast(async (run) => {
      await run.ok(removeDevice(device.id))
    })
  }

  return (
    <YStack gap="3" p="3" rounded="lg" bg="neutral-soft">
      <DeviceHeading device={device} thisDevice={thisDevice} />
      <Text fontSize="sm" lineHeight="sm" color="muted-foreground">
        {preset === null
          ? permissions
              .filter((permission) => granted.has(permission))
              .map((permission) => t(permissionLabelKeys[permission]))
              .join(", ")
          : t(accessPresetLabelKeys[preset])}
      </Text>
      {editor === null ? (
        <XStack flexWrap="wrap" gap="2">
          <Button
            size="sm"
            variant="outline"
            label={t("access.device.permissions")}
            onPress={() => setEditor("permissions")}
          />
          <Button
            size="sm"
            variant="outline"
            iconStart={Pencil}
            label={t("access.device.rename")}
            onPress={() => setEditor("rename")}
          />
          {device.pinBlockedAt !== null && !thisDevice ? (
            <Button
              size="sm"
              variant="outline"
              iconStart={LockOpen}
              label={t("access.device.unblock")}
              onPress={() => {
                void unblock()
              }}
            />
          ) : null}
          {thisDevice ? null : (
            <Button
              size="sm"
              variant="ghost"
              iconStart={Trash}
              label={t("access.device.remove")}
              onPress={() => {
                void remove()
              }}
            />
          )}
        </XStack>
      ) : (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setEditor(null)
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editor === "permissions"
                  ? device.name
                  : t("access.device.rename")}
              </DialogTitle>
              {editor === "permissions" ? (
                <DialogDescription>
                  {t("access.device.permissions.description")}
                </DialogDescription>
              ) : null}
            </DialogHeader>
            {editor === "permissions" ? (
              <PermissionsEditor
                device={device}
                initial={granted}
                onClose={() => setEditor(null)}
              />
            ) : (
              <RenameForm device={device} onClose={() => setEditor(null)} />
            )}
          </DialogContent>
        </Dialog>
      )}
    </YStack>
  )
}

/** A device's default permissions: a preset to start from, then each one. */
function PermissionsEditor({
  device,
  initial,
  onClose,
}: {
  readonly device: DeviceListRow
  readonly initial: ReadonlySet<Permission>
  readonly onClose: () => void
}) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const [granted, setGranted] = useState<ReadonlySet<Permission>>(initial)
  const [pending, setPending] = useState(false)

  const save = async () => {
    setPending(true)
    const saved = await runToast(async (run) => {
      await run.ok(
        setDeviceDefaultPermissions({ id: device.id, permissions: granted })
      )
    })
    setPending(false)
    if (saved) onClose()
  }

  return (
    <YStack gap="3">
      <Text fontWeight="600">
        {t("access.device.preset", { name: device.name })}
      </Text>
      <PresetPicker
        label={t("access.device.preset", { name: device.name })}
        value={presetOf(granted)}
        onChange={(preset) => setGranted(new Set(accessPresets[preset]))}
      />
      <FieldGroup>
        {permissions.map((permission) => (
          <Field key={permission} orientation="horizontal">
            <Checkbox
              aria-label={t(permissionLabelKeys[permission])}
              checked={granted.has(permission)}
              disabled={pending}
              onCheckedChange={(checked) =>
                setGranted((current) =>
                  withPermission(current, permission, checked)
                )
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
        <XStack gap={8} rounded={6.8} bg="destructive-tint" p={12} role="alert">
          <YStack pt={2}>
            <Icon icon={TriangleAlert} color="destructive" />
          </YStack>
          <Text flex={1} fontSize="sm" lineHeight="sm">
            {t("access.device.adminWarning")}
          </Text>
        </XStack>
      ) : null}
      <DialogFooter>
        <Button
          variant="ghost"
          label={t("access.cancel")}
          disabled={pending}
          onPress={onClose}
        />
        <Button
          label={t("access.save")}
          pending={pending}
          onPress={() => void save()}
        />
      </DialogFooter>
    </YStack>
  )
}
