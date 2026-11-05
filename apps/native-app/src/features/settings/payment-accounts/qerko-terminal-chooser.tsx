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
import { ActivityIndicator } from "react-native"
import { Text, XStack, YStack } from "tamagui"
import { accountAtom } from "../../../atoms/account.ts"
import { deviceEvoluAtom } from "../../../atoms/device-evolu.ts"
import { Badge } from "../../../components/ui/badge.tsx"
import { Button } from "../../../components/ui/button.tsx"
import { useAppRun } from "../../../hooks/use-app-run.ts"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"

/**
 * Web's `QerkoTerminalChooser`: the terminals Qerko lists for the paired
 * company, grouped by location; choosing one makes it this device's terminal
 * (qerko/0001), written to the device database so it never syncs.
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

  if (terminals.isPending) return <ActivityIndicator />

  if (terminals.isError || terminals.data.failure !== null) {
    const failure =
      terminals.data?.failure ??
      describeQerkoTerminalsFailure({ type: "unknown" })
    return (
      <YStack gap={12} items="flex-start">
        <Text fontSize="sm" lineHeight="sm" color="destructive">
          {t(failure.key)}
        </Text>
        <XStack gap={8}>
          {failure.keyRejected && onKeyRejected !== undefined ? (
            <Button
              label={t("settings.qerkoTerminal.terminals.keyRejected.action")}
              onPress={onKeyRejected}
            />
          ) : (
            <Button
              variant="outline"
              label={t("settings.qerkoTerminal.terminals.retry")}
              onPress={() => {
                void terminals.refetch()
              }}
            />
          )}
          {skip}
        </XStack>
      </YStack>
    )
  }

  if (terminals.data.locations.length === 0) {
    return (
      <YStack gap={12} items="flex-start">
        <YStack gap={4}>
          <Text fontSize="sm" lineHeight="sm" fontWeight="600">
            {t("settings.qerkoTerminal.terminals.empty")}
          </Text>
          <Text fontSize="sm" lineHeight="sm" color="muted-foreground">
            {t("settings.qerkoTerminal.terminals.empty.help")}
          </Text>
        </YStack>
        <XStack gap={8}>
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
      </YStack>
    )
  }

  return (
    <YStack gap={16}>
      {terminals.data.locations.map((location) => (
        <YStack key={location.locationId} gap={8}>
          <Text fontSize="sm" lineHeight="sm" fontWeight="600">
            {location.locationName}
          </Text>
          {location.terminals.map((terminal) => (
            <XStack
              key={terminal.terminalId}
              items="center"
              justify="space-between"
              gap={12}
              bg="neutral-soft"
              rounded={8}
              px={12}
              py={8}
            >
              <YStack flex={1} gap={4} items="flex-start">
                <Text fontSize="sm" lineHeight="sm">
                  {terminal.tid}
                </Text>
                <Badge
                  variant="secondary"
                  label={t(
                    terminal.platform === "softPos"
                      ? "settings.qerkoTerminal.terminals.platform.softPos"
                      : "settings.qerkoTerminal.terminals.platform.physical"
                  )}
                />
              </YStack>
              <Button
                variant="outline"
                label={t("settings.qerkoTerminal.terminals.choose")}
                onPress={() => {
                  void choose(terminal)
                }}
              />
            </XStack>
          ))}
        </YStack>
      ))}
      {skip}
    </YStack>
  )
}
