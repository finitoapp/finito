import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  describeQerkoLocationsFailure,
  preselectedQerkoLocationId,
  selectableQerkoPaymentLocations,
} from "@payky/app-shared/qerko-terminal-flow"
import { getQerkoLocations } from "@payky/core/integrations/qerko/qerko-client"
import { pairQerkoPaymentLocation } from "@payky/core/modules/qerko-plugin/qerko-plugin-actions"
import { qerkoPluginQuery } from "@payky/core/modules/qerko-plugin/qerko-plugin-queries"
import { useQuery } from "@tanstack/react-query"
import { type ReactNode, useState } from "react"
import { ActivityIndicator } from "react-native"
import { Text, XStack, YStack } from "tamagui"
import { Button } from "../../../components/ui/button.tsx"
import { Field, FieldLabel } from "../../../components/ui/field.tsx"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "../../../components/ui/toggle-group.tsx"
import { useAppRun } from "../../../hooks/use-app-run.ts"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"

/**
 * The locations of the paired company, as web's `QerkoLocationChooser`
 * (qerko/0007): the only one, or the one the key is already paired with,
 * starts chosen; confirming pairs it, then `onPaired` runs.
 */
export function QerkoLocationChooser({
  confirmLabel,
  onPaired,
  children,
}: {
  readonly confirmLabel: string
  readonly onPaired: () => Promise<void> | void
  readonly children?: ReactNode
}) {
  const { t } = useTranslation()
  const appRun = useAppRun()
  const plugin = useEvoluQuery(qerkoPluginQuery("standard")).data[0]
  const [chosen, setChosen] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [failureKey, setFailureKey] = useState<TranslationKey | null>(null)

  const locations = useQuery({
    queryKey: ["qerko", "locations", plugin?.environment, plugin?.apiKeyName],
    enabled: plugin !== undefined,
    // A location activated in Qerko a moment ago must show up on reopening.
    gcTime: 0,
    queryFn: async () => {
      if (plugin === undefined) return null
      await using run = appRun()
      const result = await run(
        getQerkoLocations({
          apiKey: plugin.apiKey,
          environment: plugin.environment,
        })
      )
      return result.ok
        ? {
            choices: selectableQerkoPaymentLocations(result.value),
            preselected: preselectedQerkoLocationId(result.value),
            failure: null,
          }
        : {
            choices: [],
            preselected: null,
            failure: describeQerkoLocationsFailure(result.error),
          }
    },
  })

  if (locations.isPending) return <ActivityIndicator />

  const data = locations.data
  if (
    locations.isError ||
    data === undefined ||
    data === null ||
    data.failure !== null
  ) {
    const failure =
      data?.failure ?? describeQerkoLocationsFailure({ type: "unknown" })
    return (
      <YStack gap={12} items="flex-start">
        <Text fontSize="sm" lineHeight="sm" color="destructive">
          {t(failure.key)}
        </Text>
        {failure.keyRejected ? null : (
          <Button
            variant="outline"
            label={t("settings.qerkoPayment.location.retry")}
            onPress={() => {
              void locations.refetch()
            }}
          />
        )}
      </YStack>
    )
  }

  if (data.choices.length === 0) {
    return (
      <YStack gap={12} items="flex-start">
        <Text fontSize="sm" lineHeight="sm" color="muted-foreground">
          {t("settings.qerkoPayment.location.empty")}
        </Text>
        <Button
          variant="outline"
          label={t("settings.qerkoPayment.location.retry")}
          pending={locations.isFetching}
          onPress={() => {
            void locations.refetch()
          }}
        />
      </YStack>
    )
  }

  const selected = chosen ?? data.preselected
  const selectedChoice = data.choices.find(
    (choice) => choice.locationId === selected
  )

  const confirm = async () => {
    if (selectedChoice === undefined || pending) return
    setPending(true)
    setFailureKey(null)
    await using run = appRun()
    const result = await run(
      pairQerkoPaymentLocation({
        locationId: selectedChoice.locationId,
        locationName: selectedChoice.name,
      })
    )
    if (!result.ok) {
      setPending(false)
      setFailureKey(describeQerkoLocationsFailure(result.error).key)
      return
    }
    await onPaired()
    setPending(false)
  }

  return (
    <YStack gap={16}>
      <Field>
        <FieldLabel>{t("settings.qerkoPayment.location.label")}</FieldLabel>
        <ToggleGroup
          aria-label={t("settings.qerkoPayment.location.label")}
          value={selected}
          onValueChange={setChosen}
          variant="outline"
          orientation="vertical"
          disabled={pending}
        >
          {data.choices.map((choice) => (
            <ToggleGroupItem
              key={choice.locationId}
              value={choice.locationId}
              aria-label={choice.name}
              h="auto"
              py={8}
              justify="flex-start"
            >
              <YStack gap={2} items="flex-start">
                <Text fontSize="sm" lineHeight="sm" fontWeight="600">
                  {choice.name}
                </Text>
                <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
                  {choice.address}
                </Text>
              </YStack>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
      {children}
      {failureKey === null ? null : (
        <Text fontSize="sm" lineHeight="sm" color="destructive">
          {t(failureKey)}
        </Text>
      )}
      <XStack justify="flex-end">
        <Button
          label={confirmLabel}
          pending={pending}
          disabled={selectedChoice === undefined}
          onPress={() => {
            void confirm()
          }}
        />
      </XStack>
    </YStack>
  )
}
