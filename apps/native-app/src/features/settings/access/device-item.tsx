import { presetOf } from "@payky/app-shared/access-form"
import {
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
import { useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import { SettingsTile } from "../../../components/settings-tile.tsx"
import { Button } from "../../../components/ui/button.tsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog.tsx"
import {
  accessPresetLabelKeys,
  permissionLabelKeys,
} from "../../../core/access-labels.ts"
import { useRequirePermission } from "../../../core/use-access.ts"
import { useConfirm } from "../../../hooks/use-confirm.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { fontSize } from "../../../theme/tokens.ts"
import { DeviceTitle, deviceDetails, RenameForm } from "./device-parts.tsx"
import { PermissionsFields } from "./permissions-fields.tsx"

/**
 * One device of the account as a `SettingsTile`: its name and badges, what
 * it is and its defaults, and the row's actions, the removal a labelled
 * ghost with a destructive confirm (access/0004).
 */
export function DeviceItem({
  device,
  thisDevice,
  accessControlOn,
}: {
  readonly device: DeviceListRow
  readonly thisDevice: boolean
  readonly accessControlOn: boolean
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

  // Removing a device signs it out of the account (access/0013), so it
  // takes the PIN, even on a device with `admin`, once there is one; the row's
  // permissions are cleared together with the delete.
  const remove = async () => {
    if (accessControlOn && !(await requirePin("access.action.removeDevice"))) {
      return
    }
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
    <SettingsTile
      title={<DeviceTitle device={device} thisDevice={thisDevice} />}
      description={deviceDetails(device)}
    >
      <Text
        fontSize={fontSize.xs}
        lineHeight={fontSize.xs}
        color="muted-foreground"
      >
        {preset === null
          ? permissions
              .filter((permission) => granted.has(permission))
              .map((permission) => t(permissionLabelKeys[permission]))
              .join(", ")
          : t(accessPresetLabelKeys[preset])}
      </Text>
      {editor === null ? (
        <XStack flexWrap="wrap" gap={8} pt={4}>
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
    </SettingsTile>
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
    <YStack gap={16}>
      <PermissionsFields
        label={t("access.device.preset", { name: device.name })}
        granted={granted}
        disabled={pending}
        onChange={setGranted}
      />
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
