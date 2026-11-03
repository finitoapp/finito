import { wizardDeviceDefaults } from "@payky/app-shared/access-form"
import { accessSessionAtom } from "@payky/app-shared/access-state"
import { enableAccessControl } from "@payky/core/modules/access/access-actions"
import type { AccessPreset } from "@payky/core/modules/access/access-types"
import {
  type DeviceListRow,
  devicesQuery,
} from "@payky/core/modules/device/device-queries"
import type { DeviceId } from "@payky/core/modules/device/device-types"
import { useAtom } from "jotai"
import KeyRound from "lucide-react-native/icons/key-round"
import Pencil from "lucide-react-native/icons/pencil"
import { useState } from "react"
import { XStack, YStack } from "tamagui"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog.tsx"
import { useAccess, useRequirePermission } from "../../../core/use-access.ts"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { DeviceHeading, PresetPicker, RenameForm } from "./device-parts.tsx"
import { NewPinFields, useNewPin } from "./new-pin-fields.tsx"

/**
 * Sets the PIN and every listed device's defaults, saved in one batch with
 * switching access control on (access/0004): otherwise every existing device
 * would stop working, the owner's own included.
 */
export function TurnOnWizard({
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
  const [session, setSession] = useAtom(accessSessionAtom)
  const { data: devices } = useEvoluQuery(devicesQuery)
  const newPin = useNewPin()
  const [step, setStep] = useState<"pin" | "devices">("pin")
  // The current PIN, kept once it has been entered. Typing a new one drops it.
  const [keepPin, setKeepPin] = useState(false)
  const [presets, setPresets] = useState<
    Readonly<Record<DeviceId, AccessPreset>>
  >({})
  const [renaming, setRenaming] = useState<DeviceListRow | null>(null)
  const [pending, setPending] = useState(false)

  const keepCurrentPin = async () => {
    if (!(await requirePin("access.action.enable"))) return
    newPin.clear()
    setKeepPin(true)
    setStep("devices")
  }

  const finish = async () => {
    const pin = keepPin ? null : newPin.check.pin
    if (!keepPin && pin === null) return
    if (pending) return
    setPending(true)
    // Whoever just set or entered the PIN holds it: they stay on this page
    // even when the wizard takes this device's own `admin` away. Started
    // before the write, not after it: the gate would otherwise render the
    // saved rules without the session once, hiding this page behind the PIN
    // screen (`display: none`) for a frame, and Fabric on Android mounts
    // views created under a hidden parent without a native view, then
    // crashes removing their children ("Unable to find parentView").
    setSession({ accountId })
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
    newPin.clear()
    setPending(false)
    if (!saved) {
      setSession(session)
      return
    }
    // Again, in case the gate ended it meanwhile: the device's earlier
    // defaults may already cover this page.
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
        <CardContent gap={16}>
          {hasPin ? (
            <Button
              variant="outline"
              label={t("access.wizard.keepPin")}
              iconStart={KeyRound}
              onPress={() => void keepCurrentPin()}
            />
          ) : null}
          <NewPinFields
            state={{
              ...newPin,
              setPin: (text) => {
                setKeepPin(false)
                newPin.setPin(text)
              },
              setRepeat: (text) => {
                setKeepPin(false)
                newPin.setRepeat(text)
              },
            }}
          />
        </CardContent>
        <CardFooter justify="flex-end" gap={8}>
          <Button variant="ghost" label={t("access.cancel")} onPress={onDone} />
          <Button
            label={t("access.wizard.next")}
            disabled={keepPin || newPin.check.pin === null}
            onPress={() => setStep("devices")}
          />
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
      <CardContent gap={12} testID="wizard-devices">
        {devices.map((device) => (
          <YStack key={device.id} gap="2" p="3" rounded="lg" bg="neutral-soft">
            <XStack items="flex-start" justify="space-between" gap="2">
              <YStack flex={1} minW={0}>
                <DeviceHeading
                  device={device}
                  thisDevice={device.id === deviceId}
                />
              </YStack>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t("access.device.rename")}
                iconStart={Pencil}
                onPress={() => setRenaming(device)}
              />
            </XStack>
            <PresetPicker
              label={t("access.device.preset", { name: device.name })}
              value={presets[device.id] ?? "basic"}
              onChange={(preset) =>
                setPresets((current) => ({ ...current, [device.id]: preset }))
              }
            />
          </YStack>
        ))}
        {renaming === null ? null : (
          <Dialog
            open
            onOpenChange={(open) => {
              if (!open) setRenaming(null)
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("access.device.rename")}</DialogTitle>
                <DialogDescription>{t("access.device.name")}</DialogDescription>
              </DialogHeader>
              <RenameForm device={renaming} onClose={() => setRenaming(null)} />
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
      <CardFooter justify="flex-end" gap={8}>
        <Button
          variant="ghost"
          label={t("access.wizard.back")}
          disabled={pending}
          onPress={() => setStep("pin")}
        />
        <Button
          label={t("access.turnOn")}
          pending={pending}
          onPress={() => void finish()}
        />
      </CardFooter>
    </Card>
  )
}
