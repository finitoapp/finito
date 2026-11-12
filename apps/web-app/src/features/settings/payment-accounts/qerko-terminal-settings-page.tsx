import {
  describeQerkoTerminalStatus,
  qerkoCountryLabelKeys,
  qerkoEnvironmentLabelKeys,
} from "@payky/app-shared/qerko-terminal-flow"
import {
  clearQerkoTerminal,
  qerkoTerminalSelectionQuery,
} from "@payky/core/evolu/device-qerko"
import { getQerkoTerminalStatus } from "@payky/core/integrations/qerko/qerko-client"
import { saveQerkoTerminalAccount } from "@payky/core/modules/account/account-actions"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { getFiatCurrency } from "@payky/core/modules/app-settings/app-settings-utils"
import type { QerkoPluginRow } from "@payky/core/modules/qerko-plugin/qerko-plugin"
import { deleteQerkoPlugin } from "@payky/core/modules/qerko-plugin/qerko-plugin-actions"
import { qerkoPluginQuery } from "@payky/core/modules/qerko-plugin/qerko-plugin-queries"
import { useAtomValue } from "jotai"
import { ChevronDown, LoaderCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { accountAtom } from "@/atoms/account.ts"
import { FadeHeader } from "@/components/fade-header.tsx"
import { Alert, AlertDescription } from "@/components/reui/alert.tsx"
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
import { QerkoPairingWizard } from "@/features/settings/payment-accounts/qerko-pairing-wizard.tsx"
import { QerkoTerminalChooser } from "@/features/settings/payment-accounts/qerko-terminal-chooser.tsx"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog.ts"
import { useDeviceEvoluQuery } from "@/hooks/use-device-evolu-query.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

/**
 * The Qerko card terminal's settings (qerko/0001): the pairing wizard until
 * the company is paired, then what is paired, the terminal this device pays
 * on and a way to unpair.
 */
export function QerkoTerminalSettingsPage() {
  const { t } = useTranslation()
  const { data } = useEvoluQuery(qerkoPluginQuery("terminalPayments"))
  const [plugin] = data
  // Pairing saves the key, which would swap the wizard for the paired view
  // before the terminal is chosen; the wizard raises this before it confirms
  // the code.
  const [finishingPairing, setFinishingPairing] = useState(false)
  // The terminal the wizard ended on, which the paired view tests on arrival.
  const [chosenTerminalId, setChosenTerminalId] = useState<string>()

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("settings.qerkoTerminal.title")} />
      {plugin === undefined || finishingPairing ? (
        <QerkoPairingWizard
          qerkoRole="terminalPayments"
          onPairing={() => {
            setFinishingPairing(true)
          }}
          lastStep={
            <QerkoTerminalChooser
              enableAccount
              onChosen={(terminalId) => {
                setChosenTerminalId(terminalId)
                setFinishingPairing(false)
              }}
              onSkip={() => {
                setFinishingPairing(false)
              }}
            />
          }
        />
      ) : (
        <QerkoPairedView
          plugin={plugin}
          initialTestTerminalId={chosenTerminalId}
        />
      )}
    </>
  )
}

function QerkoPairedView({
  plugin,
  initialTestTerminalId,
}: {
  readonly plugin: QerkoPluginRow
  readonly initialTestTerminalId?: string
}) {
  const { t } = useTranslation()
  const appRun = useAppRun()
  const runToast = useRunToast()
  const confirm = useConfirmDialog()
  const account = useAtomValue(accountAtom)
  const { data: settingsData } = useEvoluQuery(settingsQuery)
  const { data: selectionData } = useDeviceEvoluQuery(
    qerkoTerminalSelectionQuery(account.id)
  )
  const [selection] = selectionData
  const [choosing, setChoosing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    readonly key: Parameters<typeof t>[0]
    readonly ok: boolean
  } | null>(null)

  // A terminal is tested as soon as it is chosen, so a terminal that is not
  // connected or activated shows now and not at the first customer's card.
  const testedInitially = useRef(false)

  const test = async (terminalId: string) => {
    setTesting(true)
    setTestResult(null)
    await using run = appRun()
    const result = await run(
      getQerkoTerminalStatus({
        credentials: { apiKey: plugin.apiKey, environment: plugin.environment },
        terminalId,
      })
    )
    setTesting(false)
    setTestResult(
      result.ok
        ? describeQerkoTerminalStatus(result.value)
        : { key: "settings.qerkoTerminal.error.unreachable", ok: false }
    )
  }

  useEffect(() => {
    if (initialTestTerminalId === undefined || testedInitially.current) return
    testedInitially.current = true
    void test(initialTestTerminalId)
  })

  const unpair = async () => {
    const confirmed = await confirm({
      title: t("settings.qerkoTerminal.unpair.confirm.title"),
      description: t("settings.qerkoTerminal.unpair.confirm.description"),
      confirmLabel: t("settings.qerkoTerminal.unpair.confirm.confirm"),
      cancelLabel: t("settings.qerkoTerminal.unpair.confirm.cancel"),
      variant: "destructive",
    })
    if (!confirmed) return

    await runToast(async (run) => {
      await run.ok(deleteQerkoPlugin("terminalPayments"))
      await run.ok(
        saveQerkoTerminalAccount({
          enabled: false,
          currency: getFiatCurrency(settingsData[0]),
        })
      )
      clearQerkoTerminal(run.deps.deviceEvolu, account.id)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.qerkoTerminal.paired.title")}</CardTitle>
          <CardDescription>
            {t("settings.qerkoTerminal.paired.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-muted-foreground">
              {t("settings.qerkoTerminal.paired.company")}
            </dt>
            <dd>
              {plugin.legalEntityName} ({plugin.identificationNumber},{" "}
              {t(qerkoCountryLabelKeys[plugin.country])})
            </dd>
            <dt className="text-muted-foreground">
              {t("settings.qerkoTerminal.terminal.label")}
            </dt>
            <dd>
              {selection === undefined
                ? t("settings.qerkoTerminal.terminal.none")
                : `${selection.locationName} · ${selection.terminalTid}`}
            </dd>
          </dl>

          {choosing ? (
            <QerkoTerminalChooser
              onKeyRejected={() => {
                void unpair()
              }}
              onChosen={(terminalId) => {
                setChoosing(false)
                void test(terminalId)
              }}
            />
          ) : null}

          {testResult === null ? null : (
            <Alert variant={testResult.ok ? "success" : "destructive"}>
              <AlertDescription>{t(testResult.key)}</AlertDescription>
            </Alert>
          )}

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
        <CardFooter className="flex flex-wrap justify-between gap-2">
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              void unpair()
            }}
          >
            {t("settings.qerkoTerminal.unpair.action")}
          </Button>
          <span className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setChoosing((open) => !open)
              }}
            >
              {t(
                selection === undefined
                  ? "settings.qerkoTerminal.terminal.choose"
                  : "settings.qerkoTerminal.terminal.change"
              )}
            </Button>
            <Button
              type="button"
              disabled={selection === undefined || testing}
              onClick={() => {
                if (selection !== undefined) void test(selection.terminalId)
              }}
            >
              {testing ? <LoaderCircle className="animate-spin" /> : null}
              {t("settings.qerkoTerminal.test.action")}
            </Button>
          </span>
        </CardFooter>
      </Card>
    </div>
  )
}
