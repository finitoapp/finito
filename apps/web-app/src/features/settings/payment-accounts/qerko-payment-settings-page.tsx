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
import {
  ChevronDown,
  CircleCheckIcon,
  LoaderCircle,
  TriangleAlertIcon,
} from "lucide-react"
import { type ReactNode, useId, useState } from "react"
import { accountAtom } from "@/atoms/account.ts"
import { qerkoConnectionStatusStore } from "@/atoms/qerko-connection-status.ts"
import { FadeHeader } from "@/components/fade-header.tsx"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/reui/alert.tsx"
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible.tsx"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field.tsx"
import { Switch } from "@/components/ui/switch.tsx"
import { QerkoLocationChooser } from "@/features/settings/payment-accounts/qerko-location-chooser.tsx"
import { QerkoPairingWizard } from "@/features/settings/payment-accounts/qerko-pairing-wizard.tsx"
import { useInlineChoice } from "@/features/shared/forms/inline-edit-save.tsx"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog.ts"
import {
  useEvoluQuery,
  usePreloadEvoluQueries,
} from "@/hooks/use-evolu-query.ts"
import { useQerkoConnectionStatus } from "@/hooks/use-qerko-connection-status.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

const qerkoPaymentPageQueries = [
  qerkoPluginQuery("standard"),
  qerkoPaymentAccountQuery,
  settingsQuery,
]

/**
 * Qerko payments' settings (qerko/0011, qerko/0007): the pairing wizard until
 * the `standard` role is paired with a location; then a summary of whether
 * customers can pay — the location, the method switch and the device holding
 * the connection, each with its own fix — and a way to unpair. Right after the
 * wizard it says the method is on.
 */
export function QerkoPaymentSettingsPage() {
  usePreloadEvoluQueries(qerkoPaymentPageQueries)
  const { t } = useTranslation()
  const [plugin] = useEvoluQuery(qerkoPluginQuery("standard")).data
  // Pairing saves the key, which would swap the wizard for the paired view
  // before the location and device are chosen; the wizard raises this before
  // it confirms the code.
  const [finishingPairing, setFinishingPairing] = useState(false)
  const [justPaired, setJustPaired] = useState(false)

  return (
    <>
      <div className="h-6" />
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
    </>
  )
}

/**
 * Makes this device the one serving Qerko payments, or none (qerko/0011).
 * Choosing it again also restarts a connection another one took over, which
 * the synced choice alone cannot say, since it does not change. Resolves
 * whether it was saved.
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
 * The wizard's last step for Qerko payments: the location the key is paired
 * with (qerko/0007), and whether this device accepts the payments
 * (qerko/0011). Confirming pairs the location, turns the method on and, when
 * asked, names this device; the wizard closes only when all of it was saved,
 * and stays on this step otherwise, where confirming again is harmless.
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
  const [settings] = useEvoluQuery(settingsQuery).data
  const [thisDevice, setThisDevice] = useState(true)
  const switchId = useId()

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
      <Field orientation="horizontal">
        <Switch
          id={switchId}
          checked={thisDevice}
          onCheckedChange={setThisDevice}
        />
        <FieldContent>
          <FieldLabel htmlFor={switchId}>
            {t("settings.qerkoPayment.confirm.thisDevice")}
          </FieldLabel>
          <FieldDescription>
            {t("settings.qerkoPayment.confirm.description")}
          </FieldDescription>
        </FieldContent>
      </Field>
    </QerkoLocationChooser>
  )
}

const readinessBadgeVariants = {
  active: "default",
  connecting: "secondary",
  notAccepting: "destructive",
} as const satisfies Record<QerkoPaymentReadiness["type"], string>

type StepState = "done" | "pending" | "blocked"

function QerkoPaymentPairedView({
  plugin,
  justPaired,
}: {
  readonly plugin: QerkoPluginRow
  /** The wizard has just finished: say the method is on. */
  readonly justPaired: boolean
}) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const confirm = useConfirmDialog()
  const chooseDevice = useChooseConnectionDevice()
  const account = useAtomValue(accountAtom)
  const [settings] = useEvoluQuery(settingsQuery).data
  const [paymentAccount] = useEvoluQuery(qerkoPaymentAccountQuery).data
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
  const enabledChoice = useInlineChoice(enabled, async (next: boolean) => {
    await runToast(async (run) => {
      await run.ok(
        saveQerkoPaymentAccount({
          enabled: next,
          currency: getFiatCurrency(settings),
        })
      )
    })
  })
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
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {t("settings.qerkoPayment.paired.title")}
          <Badge variant={readinessBadgeVariants[readiness.type]}>
            {t(qerkoPaymentReadinessKeys[readiness.type])}
          </Badge>
          {plugin.environment === "sandbox" ? (
            <Badge variant="secondary">
              {t("settings.qerkoPayment.sandbox")}
            </Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          {t("settings.qerkoPayment.paired.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {justPaired && enabled ? (
          <Alert variant="success">
            <CircleCheckIcon />
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

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="text-muted-foreground">
            {t("settings.qerkoPayment.paired.company")}
          </dt>
          <dd>
            {plugin.legalEntityName} ({plugin.identificationNumber},{" "}
            {t(qerkoCountryLabelKeys[plugin.country])})
          </dd>
        </dl>

        <ul className="flex flex-col divide-y rounded-lg border">
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
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void chooseDevice(null)
                  }}
                >
                  {t("settings.qerkoPayment.stopHere")}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    void chooseDevice(account.device.id)
                  }}
                >
                  {t("settings.qerkoPayment.acceptHere")}
                </Button>
              )
            }
          />
        </ul>

        {!hasLocation ? (
          // Pairing was left before its location was chosen (qerko/0007).
          <QerkoLocationChooser
            confirmLabel={t("settings.qerkoPayment.location.use")}
            onPaired={() => {}}
          />
        ) : null}

        {isThisDevice &&
        (status.type === "stolen" || status.type === "unauthorized") ? (
          <Alert variant="destructive">
            <AlertDescription>
              {t(qerkoConnectionStatusKeys[status.type])}
            </AlertDescription>
          </Alert>
        ) : null}

        <Collapsible>
          <CollapsibleTrigger className="group/advanced-options flex w-full items-center justify-between text-left text-sm font-medium">
            {t("settings.qerkoTerminal.advanced")}
            <ChevronDown
              className="size-4 transition-transform group-data-[panel-open]/advanced-options:rotate-180"
              aria-hidden="true"
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden h-(--collapsible-panel-height) transition-[height] duration-200 ease-out data-starting-style:h-0 data-ending-style:h-0">
            <dl className="grid min-h-0 grid-cols-[auto_1fr] gap-x-4 gap-y-2 pt-5">
              <dt className="text-muted-foreground">
                {t("settings.qerkoTerminal.paired.keyName")}
              </dt>
              <dd>{plugin.apiKeyName}</dd>
              <dt className="text-muted-foreground">
                {t("settings.qerkoTerminal.environment.label")}
              </dt>
              <dd>{t(qerkoEnvironmentLabelKeys[plugin.environment])}</dd>
            </dl>
            <p className="pt-2 text-xs text-muted-foreground">
              {t("settings.qerkoTerminal.paired.environmentReadOnly")}
            </p>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
      <CardFooter>
        <Button
          type="button"
          variant="destructive"
          onClick={() => {
            void unpair()
          }}
        >
          {t("settings.qerkoTerminal.unpair.action")}
        </Button>
      </CardFooter>
    </Card>
  )
}

const stepIcons = {
  done: <CircleCheckIcon className="size-4 text-success" aria-hidden="true" />,
  pending: (
    <LoaderCircle
      className="size-4 animate-spin text-muted-foreground"
      aria-hidden="true"
    />
  ),
  blocked: (
    <TriangleAlertIcon className="size-4 text-warning" aria-hidden="true" />
  ),
} satisfies Record<StepState, ReactNode>

/** One thing customers' payments need, whether it is there, and its fix. */
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
    <li className="flex items-center gap-3 px-3 py-2.5">
      {stepIcons[state]}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium">{label}</span>
        {value === undefined ? null : (
          <span className="text-muted-foreground">{value}</span>
        )}
      </span>
      {action}
    </li>
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
  const [device] = useEvoluQuery(deviceByIdQuery(deviceId)).data
  const name = device?.name ?? null
  if (name === null) return <>{t("settings.qerkoPayment.device.other")}</>
  return (
    <>
      {isThisDevice ? t("settings.qerkoPayment.device.this", { name }) : name}
    </>
  )
}
