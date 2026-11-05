import {
  describeQerkoTerminalsFailure,
  type QerkoTerminalChoice,
  selectableQerkoLocations,
} from "@payky/app-shared/qerko-terminal-flow"
import { selectQerkoTerminal } from "@payky/core/evolu/device-qerko"
import { getQerkoTerminals } from "@payky/core/integrations/qerko/qerko-client"
import { saveQerkoTerminalAccount } from "@payky/core/modules/account/account-actions"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { getFiatCurrency } from "@payky/core/modules/app-settings/app-settings-utils"
import { qerkoPluginQuery } from "@payky/core/modules/qerko-plugin/qerko-plugin-queries"
import { NonEmptyString255Schema } from "@payky/core/modules/shared/schema"
import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { LoaderCircle } from "lucide-react"
import { accountAtom } from "@/atoms/account.ts"
import { deviceEvoluAtom } from "@/atoms/device-evolu.ts"
import { Badge } from "@/components/ui/badge.tsx"
import { Button } from "@/components/ui/button.tsx"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

/**
 * The terminals Qerko lists for the paired company, grouped by location;
 * choosing one makes it this device's terminal (qerko/0001). The choice is
 * written to the device database, so it never syncs.
 */
export function QerkoTerminalChooser({
  enableAccount = false,
  onChosen,
  onSkip,
  onKeyRejected,
}: {
  /** Also turns the payment method on, as the end of first-time pairing does. */
  readonly enableAccount?: boolean
  /** Gets the id of the terminal just chosen. */
  readonly onChosen: (terminalId: string) => void
  /** Offers to leave without a terminal; pairing does, so it never dead-ends. */
  readonly onSkip?: () => void
  /** Starts pairing anew when Qerko no longer accepts the key. */
  readonly onKeyRejected?: () => void
}) {
  const { t } = useTranslation()
  const appRun = useAppRun()
  const runToast = useRunToast()
  const account = useAtomValue(accountAtom)
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const { data: pluginData } = useEvoluQuery(
    qerkoPluginQuery("terminalPayments")
  )
  const { data: settingsData } = useEvoluQuery(settingsQuery)
  const [plugin] = pluginData
  const [settings] = settingsData

  const terminals = useQuery({
    queryKey: ["qerko", "terminals", plugin?.environment, plugin?.apiKeyName],
    enabled: plugin !== undefined,
    // A terminal activated in Qerko a moment ago must show up on reopening.
    gcTime: 0,
    queryFn: async () => {
      if (plugin === undefined) return { locations: [], failure: null }
      await using run = appRun()
      const result = await run(
        getQerkoTerminals({
          apiKey: plugin.apiKey,
          environment: plugin.environment,
        })
      )
      if (!result.ok) {
        return {
          locations: [],
          failure: describeQerkoTerminalsFailure(result.error),
        }
      }
      return {
        locations: selectableQerkoLocations(result.value),
        failure: null,
      }
    },
  })

  const choose = async (terminal: QerkoTerminalChoice) => {
    const terminalId = NonEmptyString255Schema.safeParse(terminal.terminalId)
    const terminalTid = NonEmptyString255Schema.safeParse(terminal.tid)
    const locationName = NonEmptyString255Schema.safeParse(
      terminal.locationName
    )
    if (!terminalId.success || !terminalTid.success || !locationName.success) {
      return
    }

    selectQerkoTerminal(deviceEvolu, {
      accountId: account.id,
      terminalId: terminalId.data,
      terminalTid: terminalTid.data,
      locationName: locationName.data,
    })
    if (enableAccount) {
      const saved = await runToast(async (run) => {
        await run.ok(
          saveQerkoTerminalAccount({
            enabled: true,
            currency: getFiatCurrency(settings),
          })
        )
      })
      if (!saved) return
    }
    onChosen(terminalId.data)
  }

  const skip =
    onSkip === undefined ? null : (
      <Button type="button" variant="ghost" onClick={onSkip}>
        {t("settings.qerkoTerminal.terminals.later")}
      </Button>
    )

  if (terminals.isPending) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
      </p>
    )
  }

  if (terminals.isError || terminals.data.failure !== null) {
    const failure =
      terminals.data?.failure ??
      describeQerkoTerminalsFailure({ type: "unknown" })
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-destructive">{t(failure.key)}</p>
        <div className="flex flex-wrap gap-2">
          {failure.keyRejected && onKeyRejected !== undefined ? (
            <Button type="button" onClick={onKeyRejected}>
              {t("settings.qerkoTerminal.terminals.keyRejected.action")}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void terminals.refetch()
              }}
            >
              {t("settings.qerkoTerminal.terminals.retry")}
            </Button>
          )}
          {skip}
        </div>
      </div>
    )
  }

  if (terminals.data.locations.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium">
            {t("settings.qerkoTerminal.terminals.empty")}
          </p>
          <p className="text-muted-foreground">
            {t("settings.qerkoTerminal.terminals.empty.help")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={terminals.isFetching}
            onClick={() => {
              void terminals.refetch()
            }}
          >
            {terminals.isFetching ? (
              <LoaderCircle className="animate-spin" />
            ) : null}
            {t("settings.qerkoTerminal.terminals.retry")}
          </Button>
          {skip}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {terminals.data.locations.map((location) => (
        <section key={location.locationId} className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{location.locationName}</h3>
          <ul className="flex flex-col gap-2">
            {location.terminals.map((terminal) => (
              <li
                key={terminal.terminalId}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
              >
                <span className="flex min-w-0 flex-col gap-1 text-sm">
                  <span className="font-mono">{terminal.tid}</span>
                  <Badge variant="secondary" className="w-fit">
                    {t(
                      terminal.platform === "softPos"
                        ? "settings.qerkoTerminal.terminals.platform.softPos"
                        : "settings.qerkoTerminal.terminals.platform.physical"
                    )}
                  </Badge>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void choose(terminal)
                  }}
                >
                  {t("settings.qerkoTerminal.terminals.choose")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {skip}
    </div>
  )
}
