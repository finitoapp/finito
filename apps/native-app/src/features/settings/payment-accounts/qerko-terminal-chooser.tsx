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
import CreditCard from "lucide-react-native/icons/credit-card"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { Text, XStack, YStack } from "tamagui"
import { accountAtom } from "../../../atoms/account.ts"
import { deviceEvoluAtom } from "../../../atoms/device-evolu.ts"
import { EmptyState } from "../../../components/empty-state.tsx"
import { ListSkeleton } from "../../../components/list-skeleton.tsx"
import {
  SettingsTile,
  SettingsTileList,
} from "../../../components/settings-tile.tsx"
import {
  Alert,
  AlertAction,
  AlertDescription,
} from "../../../components/ui/alert.tsx"
import { Badge } from "../../../components/ui/badge.tsx"
import { Button } from "../../../components/ui/button.tsx"
import { useAppRun } from "../../../hooks/use-app-run.ts"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { fontSize, fontWeight } from "../../../theme/tokens.ts"

/**
 * Web's `QerkoTerminalChooser`: the terminals Qerko lists for the paired
 * company, grouped by location; choosing one makes it this device's terminal
 * (qerko/0001), written to the device database so it never syncs.
 *
 * Native differences: the list loads behind `ListSkeleton` rows where web
 * spins a loader; each terminal is a `SettingsTile` with its platform as an
 * outline tag; a failure is a destructive `Alert` carrying its actions, and
 * no terminal at all an `EmptyState`, where web writes lines of text.
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
  const plugin = useEvoluQuery(qerkoPluginQuery("terminalPayments")).data[0]
  const settings = useEvoluQuery(settingsQuery).data[0]

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
      <Button
        variant="ghost"
        label={t("settings.qerkoTerminal.terminals.later")}
        onPress={onSkip}
      />
    )

  if (terminals.isPending) return <ListSkeleton rows={2} />

  if (terminals.isError || terminals.data.failure !== null) {
    const failure =
      terminals.data?.failure ??
      describeQerkoTerminalsFailure({ type: "unknown" })
    return (
      <Alert variant="destructive" icon={TriangleAlert}>
        <AlertDescription>{t(failure.key)}</AlertDescription>
        <AlertAction>
          {failure.keyRejected && onKeyRejected !== undefined ? (
            <Button
              size="sm"
              label={t("settings.qerkoTerminal.terminals.keyRejected.action")}
              onPress={onKeyRejected}
            />
          ) : (
            <Button
              size="sm"
              variant="outline"
              label={t("settings.qerkoTerminal.terminals.retry")}
              onPress={() => {
                void terminals.refetch()
              }}
            />
          )}
          {skip}
        </AlertAction>
      </Alert>
    )
  }

  if (terminals.data.locations.length === 0) {
    return (
      <EmptyState
        icon={CreditCard}
        title={t("settings.qerkoTerminal.terminals.empty")}
        description={t("settings.qerkoTerminal.terminals.empty.help")}
        action={
          <XStack gap={8} flexWrap="wrap" justify="center">
            <Button
              variant="outline"
              label={t("settings.qerkoTerminal.terminals.retry")}
              pending={terminals.isFetching}
              onPress={() => {
                void terminals.refetch()
              }}
            />
            {skip}
          </XStack>
        }
      />
    )
  }

  return (
    <YStack gap={16}>
      {terminals.data.locations.map((location) => (
        <YStack key={location.locationId} gap={8}>
          <Text
            fontSize={fontSize.sm}
            lineHeight={fontSize.sm}
            fontWeight={fontWeight.semibold}
          >
            {location.locationName}
          </Text>
          <SettingsTileList>
            {location.terminals.map((terminal) => (
              <SettingsTile
                key={terminal.terminalId}
                title={terminal.tid}
                description={
                  <Badge
                    variant="outline"
                    label={t(
                      terminal.platform === "softPos"
                        ? "settings.qerkoTerminal.terminals.platform.softPos"
                        : "settings.qerkoTerminal.terminals.platform.physical"
                    )}
                  />
                }
                trailing={
                  <Button
                    variant="outline"
                    label={t("settings.qerkoTerminal.terminals.choose")}
                    onPress={() => {
                      void choose(terminal)
                    }}
                  />
                }
              />
            ))}
          </SettingsTileList>
        </YStack>
      ))}
      {skip}
    </YStack>
  )
}
