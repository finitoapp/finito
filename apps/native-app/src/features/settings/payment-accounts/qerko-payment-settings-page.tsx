import {
  deriveQerkoPaymentReadiness,
  type QerkoPaymentReadiness,
  qerkoConnectionStatusKeys,
  qerkoCountryLabelKeys,
  qerkoEnvironmentLabelKeys,
  qerkoPaymentReadinessKeys,
} from "@payky/app-shared/qerko-terminal-flow"
import {
  saveQerkoPaymentAccount,
  setQerkoPaymentConnectionDevice,
} from "@payky/core/modules/account/account-actions"
import { qerkoPaymentAccountQuery } from "@payky/core/modules/account/account-queries"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { getFiatCurrency } from "@payky/core/modules/app-settings/app-settings-utils"
import { deviceByIdQuery } from "@payky/core/modules/device/device-queries"
import type { DeviceId } from "@payky/core/modules/device/device-types"
import type { QerkoPluginRow } from "@payky/core/modules/qerko-plugin/qerko-plugin"
import { deleteQerkoPlugin } from "@payky/core/modules/qerko-plugin/qerko-plugin-actions"
import { qerkoPluginQuery } from "@payky/core/modules/qerko-plugin/qerko-plugin-queries"
import { useAtomValue } from "jotai"
import type { LucideIcon } from "lucide-react-native"
import CircleCheck from "lucide-react-native/icons/circle-check"
import LoaderCircle from "lucide-react-native/icons/loader-circle"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { type ReactNode, useState } from "react"
import { Text, XStack } from "tamagui"
import { accountAtom } from "../../../atoms/account.ts"
import { qerkoConnectionStatusStore } from "../../../atoms/qerko-connection-status.ts"
import { DetailRow } from "../../../components/detail-row.tsx"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import {
  SettingsTile,
  SettingsTileList,
} from "../../../components/settings-tile.tsx"
import { SwitchRow } from "../../../components/switch-row.tsx"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert.tsx"
import { Badge } from "../../../components/ui/badge.tsx"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../components/ui/collapsible.tsx"
import { Icon } from "../../../components/ui/icon.tsx"
import { Switch } from "../../../components/ui/switch.tsx"
import { useConfirm } from "../../../hooks/use-confirm.ts"
import {
  useEvoluQuery,
  usePreloadEvoluQueries,
} from "../../../hooks/use-evolu-query.ts"
import { useInlineChoice } from "../../../hooks/use-inline-choice.ts"
import { useQerkoConnectionStatus } from "../../../hooks/use-qerko-connection-status.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import type { ThemeColor } from "../../../theme/themes.ts"
import { fontSize, fontWeight } from "../../../theme/tokens.ts"
import { AdvancedSettingsLabel } from "./advanced-settings-label.tsx"
import { QerkoLocationChooser } from "./qerko-location-chooser.tsx"
import { QerkoPairingWizard } from "./qerko-pairing-wizard.tsx"

const qerkoPaymentPageQueries = [
  qerkoPluginQuery("standard"),
  qerkoPaymentAccountQuery,
  settingsQuery,
]

/**
 * Qerko payments' settings, as web's `QerkoPaymentSettingsPage` (qerko/0007,
 * qerko/0011): the pairing wizard until the `standard` role is paired, ending
 * on which device serves Qerko payments; then the restaurant, that device and
 * its connection, and a way to unpair. On Android the connection is held only
 * while the app is in the foreground.
 *
 * Native differences: the "this device" switch is a `SwitchRow`, each step a
 * `SettingsTile` and each paired value a `DetailRow`; unpairing, which removes
 * the screen's subject, is a full-width destructive button under the card
 * rather than in its footer.
 */
export function QerkoPaymentSettingsPage() {
  usePreloadEvoluQueries(qerkoPaymentPageQueries)
  const { t } = useTranslation()
  const plugin = useEvoluQuery(qerkoPluginQuery("standard")).data[0]
  // Pairing saves the key, which would swap the wizard for the paired view
  // before the device is chosen; the wizard raises this before it confirms
  // the code.
  const [finishingPairing, setFinishingPairing] = useState(false)
  const [justPaired, setJustPaired] = useState(false)

  return (
    <Screen>
      <FadeHeader title={t("settings.qerkoPayment.title")} />
      {plugin === undefined || finishingPairing ? (
        <QerkoPairingWizard
          qerkoRole="standard"
          onPairing={() => {
            setFinishingPairing(true)
          }}
          lastStep={
            <QerkoPaymentFinishStep
              onFinished={() => {
                setJustPaired(true)
                setFinishingPairing(false)
              }}
            />
          }
        />
      ) : (
        <QerkoPaymentPairedView plugin={plugin} justPaired={justPaired} />
      )}
    </Screen>
  )
}

/**
 * Makes this device the one serving Qerko payments, or none (qerko/0011).
 * Choosing it again also restarts a connection another one took over.
 */
const useChooseConnectionDevice = () => {
  const runToast = useRunToast()
  return (deviceId: DeviceId | null) =>
    runToast(async (run) => {
      const [account] = await run.deps.evolu.loadQuery(qerkoPaymentAccountQuery)
      if (account === undefined) return
      await run.ok(
        setQerkoPaymentConnectionDevice({ accountId: account.id, deviceId })
      )
      qerkoConnectionStatusStore.resume()
    })
}

/**
 * The wizard's last step for Qerko payments, as web's: the location the key
 * is paired with (qerko/0007), and whether this device accepts the payments
 * (qerko/0011).
 */
function QerkoPaymentFinishStep({
  onFinished,
}: {
  readonly onFinished: () => void
}) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const chooseDevice = useChooseConnectionDevice()
  const account = useAtomValue(accountAtom)
  const settings = useEvoluQuery(settingsQuery).data[0]
  const [thisDevice, setThisDevice] = useState(true)

  // The wizard closes only when all of it was saved; otherwise it stays on
  // this step, where confirming again is harmless.
  const finish = async () => {
    const enabled = await runToast(async (run) => {
      await run.ok(
        saveQerkoPaymentAccount({
          enabled: true,
          currency: getFiatCurrency(settings),
        })
      )
    })
    if (!enabled) return
    if (thisDevice && !(await chooseDevice(account.device.id))) return
    onFinished()
  }

  return (
    <QerkoLocationChooser
      confirmLabel={t("settings.qerkoPayment.confirm.finish")}
      onPaired={finish}
    >
      <SwitchRow
        label={t("settings.qerkoPayment.confirm.thisDevice")}
        description={t("settings.qerkoPayment.confirm.description")}
        checked={thisDevice}
        onCheckedChange={setThisDevice}
      />
    </QerkoLocationChooser>
  )
}

const readinessBadgeVariants = {
  active: "secondary",
  connecting: "outline",
  notAccepting: "destructive",
} as const satisfies Record<QerkoPaymentReadiness["type"], string>

type StepState = "done" | "pending" | "blocked"

/**
 * The paired Qerko payments, as web's: whether customers can pay, the
 * location, the method switch and the device holding the connection, each
 * with its own fix; right after the wizard, that the method is on. The card
 * and the unpair button under it are sections of the screen.
 */
function QerkoPaymentPairedView({
  plugin,
  justPaired,
}: {
  readonly plugin: QerkoPluginRow
  readonly justPaired: boolean
}) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const confirm = useConfirm()
  const chooseDevice = useChooseConnectionDevice()
  const account = useAtomValue(accountAtom)
  const settings = useEvoluQuery(settingsQuery).data[0]
  const paymentAccount = useEvoluQuery(qerkoPaymentAccountQuery).data[0]
  const connectionDeviceId = paymentAccount?.connectionDeviceId ?? null
  const isThisDevice = connectionDeviceId === account.device.id
  const hasLocation = plugin.restaurantId !== null
  const enabled = paymentAccount !== undefined && paymentAccount.isDeleted !== 1
  const status = useQerkoConnectionStatus()
  const readiness = deriveQerkoPaymentReadiness({
    hasLocation,
    enabled,
    connectionDeviceId,
    thisDeviceId: account.device.id,
    connection: status.type,
  })
  const enabledChoice = useInlineChoice(enabled, (next: boolean) =>
    runToast(async (run) => {
      await run.ok(
        saveQerkoPaymentAccount({
          enabled: next,
          currency: getFiatCurrency(settings),
        })
      )
    })
  )
  const deviceState: StepState =
    connectionDeviceId === null ||
    (isThisDevice &&
      (status.type === "stolen" || status.type === "unauthorized"))
      ? "blocked"
      : isThisDevice && status.type !== "connected"
        ? "pending"
        : "done"

  const unpair = async () => {
    const confirmed = await confirm({
      title: t("settings.qerkoTerminal.unpair.confirm.title"),
      description: t("settings.qerkoPayment.unpair.confirm.description"),
      confirmLabel: t("settings.qerkoTerminal.unpair.confirm.confirm"),
      cancelLabel: t("settings.qerkoTerminal.unpair.confirm.cancel"),
      variant: "destructive",
    })
    if (!confirmed) return

    await runToast(async (run) => {
      await run.ok(deleteQerkoPlugin("standard"))
      await run.ok(
        saveQerkoPaymentAccount({
          enabled: false,
          currency: getFiatCurrency(settings),
        })
      )
    })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <XStack gap={8} items="center" flexWrap="wrap">
            <CardTitle>{t("settings.qerkoPayment.paired.title")}</CardTitle>
            <Badge
              variant={readinessBadgeVariants[readiness.type]}
              label={t(qerkoPaymentReadinessKeys[readiness.type])}
            />
            {plugin.environment === "sandbox" ? (
              <Badge
                variant="outline"
                label={t("settings.qerkoPayment.sandbox")}
              />
            ) : null}
          </XStack>
          <CardDescription>
            {t("settings.qerkoPayment.paired.description")}
          </CardDescription>
        </CardHeader>
        <CardContent gap={16}>
          {justPaired && enabled ? (
            <Alert variant="success" icon={CircleCheck}>
              <AlertTitle>
                {t("settings.qerkoPayment.paired.success.title")}
              </AlertTitle>
              <AlertDescription>
                {t("settings.qerkoPayment.paired.success.description")}
                {connectionDeviceId === null
                  ? ` ${t("settings.qerkoPayment.paired.success.noDevice")}`
                  : null}
              </AlertDescription>
            </Alert>
          ) : null}

          <DetailRow
            label={t("settings.qerkoPayment.paired.company")}
            value={`${plugin.legalEntityName} (${plugin.identificationNumber}, ${t(
              qerkoCountryLabelKeys[plugin.country]
            )})`}
          />

          <SettingsTileList>
            <StepRow
              state={hasLocation ? "done" : "blocked"}
              label={t("settings.qerkoPayment.location.label")}
              value={
                plugin.locationName ?? t("settings.qerkoPayment.location.none")
              }
            />
            <StepRow
              state={enabled ? "done" : "blocked"}
              label={t("settings.qerkoPayment.paired.enabled")}
              action={
                <Switch
                  aria-label={t("settings.qerkoPayment.enabled.label")}
                  checked={enabledChoice.value}
                  // A key without a location cannot take payments (qerko/0007).
                  disabled={enabledChoice.saving || (!hasLocation && !enabled)}
                  onCheckedChange={(checked) => {
                    void enabledChoice.choose(checked)
                  }}
                />
              }
            />
            <StepRow
              state={deviceState}
              label={t("settings.qerkoPayment.paired.device")}
              value={
                <>
                  <ConnectionDeviceName
                    deviceId={connectionDeviceId}
                    isThisDevice={isThisDevice}
                  />
                  {isThisDevice
                    ? ` · ${t(qerkoConnectionStatusKeys[status.type])}`
                    : null}
                </>
              }
              action={
                isThisDevice && status.type !== "stolen" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    label={t("settings.qerkoPayment.stopHere")}
                    onPress={() => {
                      void chooseDevice(null)
                    }}
                  />
                ) : (
                  <Button
                    size="sm"
                    label={t("settings.qerkoPayment.acceptHere")}
                    onPress={() => {
                      void chooseDevice(account.device.id)
                    }}
                  />
                )
              }
            />
          </SettingsTileList>

          {!hasLocation ? (
            // Pairing was left before its location was chosen (qerko/0007).
            <QerkoLocationChooser
              confirmLabel={t("settings.qerkoPayment.location.use")}
              onPaired={() => {}}
            />
          ) : null}

          {isThisDevice &&
          (status.type === "stolen" || status.type === "unauthorized") ? (
            <Alert variant="destructive" icon={TriangleAlert}>
              <AlertDescription>
                {t(qerkoConnectionStatusKeys[status.type])}
              </AlertDescription>
            </Alert>
          ) : null}

          <Collapsible>
            <CollapsibleTrigger>
              <AdvancedSettingsLabel
                label={t("settings.qerkoTerminal.advanced")}
              />
            </CollapsibleTrigger>
            <CollapsibleContent pt={16} gap={8}>
              <DetailRow
                label={t("settings.qerkoTerminal.paired.keyName")}
                value={plugin.apiKeyName}
              />
              <DetailRow
                label={t("settings.qerkoTerminal.environment.label")}
                value={t(qerkoEnvironmentLabelKeys[plugin.environment])}
              />
              <Text
                fontSize={fontSize.xs}
                lineHeight={fontSize.xs}
                color="muted-foreground"
              >
                {t("settings.qerkoTerminal.paired.environmentReadOnly")}
              </Text>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
      <Button
        variant="destructive"
        label={t("settings.qerkoTerminal.unpair.action")}
        onPress={() => {
          void unpair()
        }}
      />
    </>
  )
}

const stepIcons = {
  done: { icon: CircleCheck, color: "success" },
  pending: { icon: LoaderCircle, color: "muted-foreground" },
  blocked: { icon: TriangleAlert, color: "warning" },
} as const satisfies Record<
  StepState,
  { readonly icon: LucideIcon; readonly color: ThemeColor }
>

/**
 * One thing customers' payments need, whether it is there, and its fix: a
 * `SettingsTile` whose title leads with the step's state.
 */
function StepRow({
  state,
  label,
  value,
  action,
}: {
  readonly state: StepState
  readonly label: string
  readonly value?: ReactNode
  readonly action?: ReactNode
}) {
  return (
    <SettingsTile
      title={
        <XStack items="center" gap={8}>
          <Icon
            icon={stepIcons[state].icon}
            size={16}
            color={stepIcons[state].color}
          />
          <Text
            flex={1}
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            fontWeight={fontWeight.semibold}
          >
            {label}
          </Text>
        </XStack>
      }
      description={
        value === undefined ? undefined : (
          <Text
            fontSize={fontSize.xs}
            lineHeight={fontSize.xs}
            color="muted-foreground"
          >
            {value}
          </Text>
        )
      }
      trailing={action}
    />
  )
}

function ConnectionDeviceName({
  deviceId,
  isThisDevice,
}: {
  readonly deviceId: DeviceId | null
  readonly isThisDevice: boolean
}) {
  const { t } = useTranslation()
  if (deviceId === null) return <>{t("settings.qerkoPayment.device.none")}</>
  return <KnownDeviceName deviceId={deviceId} isThisDevice={isThisDevice} />
}

function KnownDeviceName({
  deviceId,
  isThisDevice,
}: {
  readonly deviceId: DeviceId
  readonly isThisDevice: boolean
}) {
  const { t } = useTranslation()
  const device = useEvoluQuery(deviceByIdQuery(deviceId)).data[0]
  const name = device?.name ?? null
  if (name === null) return <>{t("settings.qerkoPayment.device.other")}</>
  return (
    <>
      {isThisDevice ? t("settings.qerkoPayment.device.this", { name }) : name}
    </>
  )
}
