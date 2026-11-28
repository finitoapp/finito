import { Capacitor } from "@capacitor/core"
import {
  checkNewPin,
  presetOf,
  sanitizePinInput,
  sortDevicesByPermissions,
  wizardDeviceDefaults,
} from "@payky/app-shared/access-form"
import { accessSessionAtom } from "@payky/app-shared/access-state"
import { pinPadAttribute } from "@payky/app-shared/error-scrubbing"
import {
  changePin,
  disableAccessControl,
  enableAccessControl,
} from "@payky/core/modules/access/access-actions"
import { accessControlQuery } from "@payky/core/modules/access/access-queries"
import {
  type AccessPreset,
  type Permission,
  permissions,
} from "@payky/core/modules/access/access-types"
import {
  decodePermissions,
  decodePinHash,
  type Pin,
} from "@payky/core/modules/access/access-utils"
import {
  removeDevice,
  renameDevice,
  setDeviceDefaultPermissions,
  unblockDevice,
} from "@payky/core/modules/device/device-actions"
import {
  type DeviceListRow,
  devicesQuery,
} from "@payky/core/modules/device/device-queries"
import type { DeviceId } from "@payky/core/modules/device/device-types"
import { NonEmptyString255Schema } from "@payky/core/modules/shared/schema"
import { Link } from "@tanstack/react-router"
import { useSetAtom } from "jotai"
import {
  Ban,
  KeyRound,
  MonitorSmartphone,
  Pencil,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Unlock,
} from "lucide-react"
import { useId, useState } from "react"
import { FadeHeader } from "@/components/fade-header.tsx"
import { Badge } from "@/components/ui/badge.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field.tsx"
import { Input } from "@/components/ui/input.tsx"
import {
  PermissionsFields,
  PresetSelect,
  Warning,
} from "@/features/settings/access/permissions-fields.tsx"
import { useAccess, useRequirePermission } from "@/hooks/use-access.ts"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import {
  accessPresetLabelKeys,
  permissionLabelKeys,
} from "@/i18n/access-labels.ts"

/**
 * Settings → Devices (access/0001, access/0013): the account's devices, in
 * order of what each may do without the PIN, and below them the PIN that
 * locks the rest — switching it on with its wizard and off, and changing it.
 */
export function AccessSettingsPage() {
  const { t } = useTranslation()
  const { data: control } = useEvoluQuery(accessControlQuery)
  const enabled = control[0]?.enabled === 1
  const hasPin = decodePinHash(control[0]?.pin ?? null) !== null
  const [mode, setMode] = useState<"view" | "wizard" | "changePin">("view")

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("devices.title")} />
      <div className="flex flex-col gap-5">
        {mode === "wizard" && !enabled ? null : (
          <DevicesCard accessControlOn={enabled} />
        )}
        {mode === "wizard" && !enabled ? (
          <TurnOnWizard hasPin={hasPin} onDone={() => setMode("view")} />
        ) : mode === "changePin" ? (
          <ChangePinCard onDone={() => setMode("view")} />
        ) : (
          <StatusCard
            enabled={enabled}
            onTurnOn={() => setMode("wizard")}
            onChangePin={() => setMode("changePin")}
          />
        )}
      </div>
    </>
  )
}

function StatusCard({
  enabled,
  onTurnOn,
  onChangePin,
}: {
  readonly enabled: boolean
  readonly onTurnOn: () => void
  readonly onChangePin: () => void
}) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const { requirePin } = useRequirePermission()

  const turnOff = async () => {
    if (!(await requirePin("access.action.disable"))) return
    await runToast(async (run) => {
      await run.ok(disableAccessControl())
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {enabled ? (
            <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
          ) : (
            <ShieldOff
              className="size-5 text-muted-foreground"
              aria-hidden="true"
            />
          )}
          {t(enabled ? "access.status.on" : "access.status.off")}
        </CardTitle>
        <CardDescription>{t("access.description")}</CardDescription>
      </CardHeader>
      {enabled && !Capacitor.isNativePlatform() ? (
        <CardContent>
          <Warning>{t("access.webWarning")}</Warning>
        </CardContent>
      ) : null}
      <CardFooter className="flex flex-wrap justify-end gap-2">
        {enabled ? (
          <>
            <Button variant="outline" onClick={onChangePin}>
              <KeyRound data-icon="inline-start" />
              {t("access.changePin")}
            </Button>
            <Button variant="outline" onClick={() => void turnOff()}>
              {t("access.turnOff")}
            </Button>
          </>
        ) : (
          <Button onClick={onTurnOn}>{t("access.turnOn")}</Button>
        )}
      </CardFooter>
    </Card>
  )
}

/** A new PIN typed twice, `null` until both agree and are 4–8 digits. */
function NewPinFields({
  onChange,
}: {
  readonly onChange: (pin: Pin | null) => void
}) {
  const { t } = useTranslation()
  const pinId = useId()
  const repeatId = useId()
  const [pin, setPin] = useState("")
  const [repeat, setRepeat] = useState("")
  const { invalid, mismatch } = checkNewPin(pin, repeat)

  const update = (nextPin: string, nextRepeat: string) => {
    setPin(nextPin)
    setRepeat(nextRepeat)
    onChange(checkNewPin(nextPin, nextRepeat).pin)
  }

  return (
    <FieldGroup {...{ [pinPadAttribute]: "" }}>
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor={pinId}>{t("access.newPin.label")}</FieldLabel>
        <Input
          id={pinId}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          value={pin}
          onChange={(event) =>
            update(sanitizePinInput(event.currentTarget.value), repeat)
          }
        />
        <FieldDescription>{t("access.newPin.description")}</FieldDescription>
      </Field>
      <Field data-invalid={mismatch}>
        <FieldLabel htmlFor={repeatId}>{t("access.newPin.repeat")}</FieldLabel>
        <Input
          id={repeatId}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          value={repeat}
          onChange={(event) =>
            update(pin, sanitizePinInput(event.currentTarget.value))
          }
        />
        <FieldError>{mismatch ? t("access.newPin.mismatch") : null}</FieldError>
      </Field>
    </FieldGroup>
  )
}

function ChangePinCard({ onDone }: { readonly onDone: () => void }) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const { requirePin } = useRequirePermission()
  const [pin, setPin] = useState<Pin | null>(null)

  const save = async () => {
    if (pin === null) return
    // Always the current PIN first, even on a device with `admin`
    // (access/0001): a device set to Owner by mistake must not be able to
    // lock the owner out.
    if (!(await requirePin("access.action.changePin"))) return
    const saved = await runToast(async (run) => {
      await run.ok(changePin(pin))
    })
    if (saved) onDone()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("access.changePin")}</CardTitle>
      </CardHeader>
      <CardContent>
        <NewPinFields onChange={setPin} />
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          {t("access.cancel")}
        </Button>
        <Button disabled={pin === null} onClick={() => void save()}>
          {t("access.save")}
        </Button>
      </CardFooter>
    </Card>
  )
}

/**
 * Sets the PIN and every listed device's defaults, saved in one batch with
 * switching access control on (access/0004): otherwise every existing device
 * would stop working, the owner's own included.
 */
function TurnOnWizard({
  hasPin,
  onDone,
}: {
  readonly hasPin: boolean
  readonly onDone: () => void
}) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const { requirePin } = useRequirePermission()
  const { accountId, deviceId } = useAccess()
  const setSession = useSetAtom(accessSessionAtom)
  const { data: devices } = useEvoluQuery(devicesQuery)
  const [step, setStep] = useState<"pin" | "devices">("pin")
  // `null` keeps the current PIN, once it has been entered.
  const [pinChoice, setPinChoice] = useState<
    { readonly keep: true } | { readonly keep: false; readonly pin: Pin | null }
  >({ keep: false, pin: null })
  const [presets, setPresets] = useState<
    Readonly<Record<DeviceId, AccessPreset>>
  >({})
  const [renaming, setRenaming] = useState<DeviceListRow | null>(null)

  const keepCurrentPin = async () => {
    if (!(await requirePin("access.action.enable"))) return
    setPinChoice({ keep: true })
    setStep("devices")
  }

  const finish = async () => {
    const pin = pinChoice.keep ? null : pinChoice.pin
    if (!pinChoice.keep && pin === null) return
    const saved = await runToast(async (run) => {
      const result = await run(
        enableAccessControl({
          pin,
          devices: wizardDeviceDefaults(devices, presets),
        })
      )
      if (!result.ok) {
        return result.error.type === "NoPin"
          ? "access.wizard.noPin"
          : "app.saveFailed"
      }
    })
    if (!saved) return
    // Whoever just set or entered the PIN holds it: they stay on this page
    // even when the wizard took this device's own `admin` away.
    setSession({ accountId })
    onDone()
  }

  if (step === "pin") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("access.wizard.pin.title")}</CardTitle>
          <CardDescription>
            {t("access.wizard.pin.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {hasPin ? (
            <Button
              variant="outline"
              className="self-start"
              onClick={() => void keepCurrentPin()}
            >
              <KeyRound data-icon="inline-start" />
              {t("access.wizard.keepPin")}
            </Button>
          ) : null}
          <NewPinFields
            onChange={(pin) => setPinChoice({ keep: false, pin })}
          />
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onDone}>
            {t("access.cancel")}
          </Button>
          <Button
            disabled={pinChoice.keep || pinChoice.pin === null}
            onClick={() => setStep("devices")}
          >
            {t("access.wizard.next")}
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("access.wizard.devices.title")}</CardTitle>
        <CardDescription>
          {t("access.wizard.devices.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3" data-testid="wizard-devices">
          {devices.map((device) => (
            <li
              key={device.id}
              className="flex flex-col gap-2 rounded-lg border p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <DeviceHeading
                  device={device}
                  thisDevice={device.id === deviceId}
                />
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t("access.device.rename")}
                  onClick={() => setRenaming(device)}
                >
                  <Pencil aria-hidden="true" />
                </Button>
              </div>
              <PresetSelect
                label={t("access.device.preset", { name: device.name })}
                value={presets[device.id] ?? "basic"}
                onChange={(preset) =>
                  setPresets((current) => ({ ...current, [device.id]: preset }))
                }
              />
            </li>
          ))}
        </ul>
        {renaming === null ? null : (
          <RenameDialog device={renaming} onClose={() => setRenaming(null)} />
        )}
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setStep("pin")}>
          {t("access.wizard.back")}
        </Button>
        <Button onClick={() => void finish()}>{t("access.turnOn")}</Button>
      </CardFooter>
    </Card>
  )
}

/** Name, "this device", and what kind of device it is (access/0004). */
function DeviceHeading({
  device,
  thisDevice,
}: {
  readonly device: DeviceListRow
  readonly thisDevice: boolean
}) {
  const { t } = useTranslation()
  const details = [device.deviceType, device.browserName, device.osName]
    .filter((value) => value !== null)
    .join(" · ")

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="flex flex-wrap items-center gap-2">
        <span className="truncate font-medium text-sm">{device.name}</span>
        {thisDevice ? (
          <Badge variant="secondary">{t("access.device.this")}</Badge>
        ) : null}
        {device.pinBlockedAt !== null ? (
          <Badge variant="destructive">
            <Ban data-icon="inline-start" />
            {t("access.device.blocked")}
          </Badge>
        ) : null}
      </span>
      {details === "" ? null : (
        <span className="text-muted-foreground text-xs">{details}</span>
      )}
    </div>
  )
}

function DevicesCard({
  accessControlOn,
}: {
  readonly accessControlOn: boolean
}) {
  const { t } = useTranslation()
  const { deviceId } = useAccess()
  const { data: devices } = useEvoluQuery(devicesQuery)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("access.devices.title")}</CardTitle>
        <CardDescription>{t("access.devices.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3" data-testid="access-devices">
          {sortDevicesByPermissions(devices).map((device) => (
            <DeviceItem
              key={device.id}
              device={device}
              thisDevice={device.id === deviceId}
              accessControlOn={accessControlOn}
            />
          ))}
        </ul>
      </CardContent>
      <CardFooter className="justify-end">
        {/* Sends this account to the new device by QR (account/0012). */}
        <Button
          variant="outline"
          render={<Link to="/settings/access/add-device" />}
        >
          <MonitorSmartphone data-icon="inline-start" />
          {t("access.devices.add")}
        </Button>
      </CardFooter>
    </Card>
  )
}

function DeviceItem({
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
  const confirm = useConfirmDialog()
  const { requirePin } = useRequirePermission()
  const [dialog, setDialog] = useState<"permissions" | "rename" | null>(null)
  const granted = decodePermissions(device.defaultPermissions)
  const preset = presetOf(granted)

  const unblock = async () => {
    if (!(await requirePin("access.action.unblock"))) return
    await runToast(async (run) => {
      await run.ok(unblockDevice(device.id))
    })
  }

  // Removing a device signs it out of the account (access/0013), so it
  // takes the PIN, even on a device with `admin`, once there is one.
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
    <li className="flex flex-col gap-3 rounded-lg border p-3">
      <DeviceHeading device={device} thisDevice={thisDevice} />
      <p className="text-sm text-muted-foreground">
        {preset === null
          ? permissions
              .filter((permission) => granted.has(permission))
              .map((permission) => t(permissionLabelKeys[permission]))
              .join(", ")
          : t(accessPresetLabelKeys[preset])}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDialog("permissions")}
        >
          {t("access.device.permissions")}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setDialog("rename")}>
          <Pencil data-icon="inline-start" />
          {t("access.device.rename")}
        </Button>
        {device.pinBlockedAt !== null && !thisDevice ? (
          <Button size="sm" variant="outline" onClick={() => void unblock()}>
            <Unlock data-icon="inline-start" />
            {t("access.device.unblock")}
          </Button>
        ) : null}
        {thisDevice ? null : (
          <Button size="sm" variant="ghost" onClick={() => void remove()}>
            <Trash2 data-icon="inline-start" />
            {t("access.device.remove")}
          </Button>
        )}
      </div>
      {dialog === "permissions" ? (
        <PermissionsDialog
          device={device}
          initial={granted}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "rename" ? (
        <RenameDialog device={device} onClose={() => setDialog(null)} />
      ) : null}
    </li>
  )
}

function PermissionsDialog({
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

  const save = async () => {
    const saved = await runToast(async (run) => {
      await run.ok(
        setDeviceDefaultPermissions({ id: device.id, permissions: granted })
      )
    })
    if (saved) onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-auto">
        <DialogHeader>
          <DialogTitle>{device.name}</DialogTitle>
          <DialogDescription>
            {t("access.device.permissions.description")}
          </DialogDescription>
        </DialogHeader>
        <PermissionsFields
          label={t("access.device.preset", { name: device.name })}
          granted={granted}
          onChange={setGranted}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("access.cancel")}
          </Button>
          <Button onClick={() => void save()}>{t("access.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RenameDialog({
  device,
  onClose,
}: {
  readonly device: DeviceListRow
  readonly onClose: () => void
}) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const inputId = useId()
  const [name, setName] = useState<string>(device.name)
  const parsed = NonEmptyString255Schema.safeParse(name.trim())

  const save = async () => {
    if (!parsed.success) return
    const saved = await runToast(async (run) => {
      await run.ok(renameDevice({ id: device.id, name: parsed.data }))
    })
    if (saved) onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("access.device.rename")}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <Field>
            <FieldLabel htmlFor={inputId}>{t("access.device.name")}</FieldLabel>
            <Input
              id={inputId}
              value={name}
              maxLength={255}
              onChange={(event) => setName(event.currentTarget.value)}
            />
          </Field>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("access.cancel")}
            </Button>
            <Button type="submit" disabled={!parsed.success}>
              {t("access.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
