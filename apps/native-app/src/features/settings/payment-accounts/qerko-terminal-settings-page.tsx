import type { TranslationKey } from "@payky/app-shared/i18n/resources"
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
import CircleCheck from "lucide-react-native/icons/circle-check"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { useEffect, useRef, useState } from "react"
import { Text, XStack } from "tamagui"
import { accountAtom } from "../../../atoms/account.ts"
import { DetailRow } from "../../../components/detail-row.tsx"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import { Alert, AlertDescription } from "../../../components/ui/alert.tsx"
import { Badge } from "../../../components/ui/badge.tsx"
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../components/ui/collapsible.tsx"
import { useAppRun } from "../../../hooks/use-app-run.ts"
import { useConfirm } from "../../../hooks/use-confirm.ts"
import {
  useDeviceEvoluQuery,
  useEvoluQuery,
} from "../../../hooks/use-evolu-query.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { fontSize } from "../../../theme/tokens.ts"
import { AdvancedSettingsLabel } from "./advanced-settings-label.tsx"
import { QerkoPairingWizard } from "./qerko-pairing-wizard.tsx"
import { QerkoTerminalChooser } from "./qerko-terminal-chooser.tsx"

/**
 * The Qerko card terminal's settings, as web's `QerkoTerminalSettingsPage`:
 * the pairing wizard until the company is paired, then what is paired, the
 * terminal this device pays on and a way to unpair.
 *
 * Native differences: a sandbox key shows a Sandbox badge in the card's
 * header, as Qerko payments' does; each paired value is a `DetailRow`; and
 * unpairing, which removes the screen's subject, is a full-width destructive
 * button under the card rather than the first of its footer's buttons.
 */
export function QerkoTerminalSettingsPage() {
  const { t } = useTranslation()
  const plugin = useEvoluQuery(qerkoPluginQuery("terminalPayments")).data[0]
  // Pairing saves the key, which would swap the wizard for the paired view
  // before the terminal is chosen; the wizard raises this before it confirms
  // the code.
  const [finishingPairing, setFinishingPairing] = useState(false)
  // The terminal the wizard ended on, which the paired view tests on arrival.
  const [chosenTerminalId, setChosenTerminalId] = useState<string>()

  return (
    <Screen>
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
    </Screen>
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
  const confirm = useConfirm()
  const account = useAtomValue(accountAtom)
  const settings = useEvoluQuery(settingsQuery).data[0]
  const selection = useDeviceEvoluQuery(qerkoTerminalSelectionQuery(account.id))
    .data[0]
  const [choosing, setChoosing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    readonly key: TranslationKey
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
          currency: getFiatCurrency(settings),
        })
      )
      clearQerkoTerminal(run.deps.deviceEvolu, account.id)
    })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <XStack gap={8} items="center" flexWrap="wrap">
            <CardTitle>{t("settings.qerkoTerminal.paired.title")}</CardTitle>
            {plugin.environment === "sandbox" ? (
              <Badge
                variant="outline"
                label={t("settings.qerkoPayment.sandbox")}
              />
            ) : null}
          </XStack>
          <CardDescription>
            {t("settings.qerkoTerminal.paired.description")}
          </CardDescription>
        </CardHeader>
        <CardContent gap={16}>
          <DetailRow
            label={t("settings.qerkoTerminal.paired.company")}
            value={`${plugin.legalEntityName} (${plugin.identificationNumber}, ${t(
              qerkoCountryLabelKeys[plugin.country]
            )})`}
          />
          <DetailRow
            label={t("settings.qerkoTerminal.terminal.label")}
            value={
              selection === undefined
                ? t("settings.qerkoTerminal.terminal.none")
                : `${selection.locationName} · ${selection.terminalTid}`
            }
          />

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
            <Alert
              variant={testResult.ok ? "success" : "destructive"}
              icon={testResult.ok ? CircleCheck : TriangleAlert}
            >
              <AlertDescription>{t(testResult.key)}</AlertDescription>
            </Alert>
          )}

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
        <CardFooter justify="flex-end" flexWrap="wrap" gap={8}>
          <Button
            variant="outline"
            label={t(
              selection === undefined
                ? "settings.qerkoTerminal.terminal.choose"
                : "settings.qerkoTerminal.terminal.change"
            )}
            onPress={() => {
              setChoosing((open) => !open)
            }}
          />
          <Button
            label={t("settings.qerkoTerminal.test.action")}
            pending={testing}
            disabled={selection === undefined}
            onPress={() => {
              if (selection !== undefined) void test(selection.terminalId)
            }}
          />
        </CardFooter>
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
