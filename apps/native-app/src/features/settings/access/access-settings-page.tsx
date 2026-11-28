import { sortDevicesByPermissions } from "@payky/app-shared/access-form"
import { disableAccessControl } from "@payky/core/modules/access/access-actions"
import { accessControlQuery } from "@payky/core/modules/access/access-queries"
import { decodePinHash } from "@payky/core/modules/access/access-utils"
import { devicesQuery } from "@payky/core/modules/device/device-queries"
import { router } from "expo-router"
import KeyRound from "lucide-react-native/icons/key-round"
import MonitorSmartphone from "lucide-react-native/icons/monitor-smartphone"
import { useState } from "react"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import { SettingsTileList } from "../../../components/settings-tile.tsx"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import { useAccess, useRequirePermission } from "../../../core/use-access.ts"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { ChangePinCard } from "./change-pin-card.tsx"
import { DeviceItem } from "./device-item.tsx"
import { TurnOnWizard } from "./turn-on-wizard.tsx"

/**
 * Settings → Devices (access/0001, access/0013), as web's
 * `AccessSettingsPage`: the account's devices, in order of what each may do
 * without the PIN, and below them the PIN that locks the rest. The route is
 * `admin` (access/0002).
 */
export function AccessSettingsPage() {
  const { accountId } = useAccess()
  // Keyed by account, so an account switch drops the wizard's PIN digits and
  // its keep-current-PIN approval.
  return <AccessSettings key={accountId} />
}

function AccessSettings() {
  const { t } = useTranslation()
  const { data: control } = useEvoluQuery(accessControlQuery)
  const enabled = control[0]?.enabled === 1
  const hasPin = decodePinHash(control[0]?.pin ?? null) !== null
  const [mode, setMode] = useState<"view" | "wizard" | "changePin">("view")
  const toView = () => setMode("view")

  return (
    <Screen>
      <FadeHeader title={t("devices.title")} />
      {mode === "wizard" && !enabled ? null : (
        <DevicesCard accessControlOn={enabled} />
      )}
      {mode === "wizard" && !enabled ? (
        <TurnOnWizard hasPin={hasPin} onDone={toView} />
      ) : mode === "changePin" ? (
        <ChangePinCard onDone={toView} />
      ) : (
        <StatusCard
          enabled={enabled}
          onTurnOn={() => setMode("wizard")}
          onChangePin={() => setMode("changePin")}
        />
      )}
    </Screen>
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

  // Always the current PIN, even on a device with `admin` (access/0001),
  // awaited before the Task; the PIN is kept for turning it on again.
  const turnOff = async () => {
    if (!(await requirePin("access.action.disable"))) return
    await runToast(async (run) => {
      await run.ok(disableAccessControl())
    })
  }

  return (
    <Card>
      {/* The title says whether access control is on; the footer's buttons
          change it (a switch could not open the turn-on wizard). */}
      <CardHeader>
        <CardTitle>
          {t(enabled ? "access.status.on" : "access.status.off")}
        </CardTitle>
        <CardDescription>{t("access.description")}</CardDescription>
      </CardHeader>
      <CardFooter flexWrap="wrap" justify="flex-end" gap={8}>
        {enabled ? (
          <>
            <Button
              variant="outline"
              iconStart={KeyRound}
              label={t("access.changePin")}
              onPress={onChangePin}
            />
            <Button
              variant="outline"
              label={t("access.turnOff")}
              onPress={() => {
                void turnOff()
              }}
            />
          </>
        ) : (
          <Button label={t("access.turnOn")} onPress={onTurnOn} />
        )}
      </CardFooter>
    </Card>
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
        <SettingsTileList testID="access-devices">
          {sortDevicesByPermissions(devices).map((device) => (
            <DeviceItem
              key={device.id}
              device={device}
              thisDevice={device.id === deviceId}
              accessControlOn={accessControlOn}
            />
          ))}
        </SettingsTileList>
      </CardContent>
      <CardFooter justify="flex-end">
        {/* Sends this account to the new device by QR (account/0012). */}
        <Button
          variant="outline"
          iconStart={MonitorSmartphone}
          label={t("access.devices.add")}
          onPress={() => router.push("/settings/access/add-device")}
        />
      </CardFooter>
    </Card>
  )
}
