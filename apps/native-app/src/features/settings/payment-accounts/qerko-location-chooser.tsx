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
import MapPinOff from "lucide-react-native/icons/map-pin-off"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { type ReactNode, useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import { EmptyState } from "../../../components/empty-state.tsx"
import {
  Alert,
  AlertAction,
  AlertDescription,
} from "../../../components/ui/alert.tsx"
import { Button } from "../../../components/ui/button.tsx"
import { Field, FieldLabel } from "../../../components/ui/field.tsx"
import { Skeleton } from "../../../components/ui/skeleton.tsx"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "../../../components/ui/toggle-group.tsx"
import { useAppRun } from "../../../hooks/use-app-run.ts"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { fontSize, fontWeight, shape } from "../../../theme/tokens.ts"

/**
 * The locations of the paired company, as web's `QerkoLocationChooser`
 * (qerko/0007): the only one, or the one the key is already paired with,
 * starts chosen; confirming pairs it, then `onPaired` runs.
 *
 * Native differences: the list loads behind skeleton rows where web spins a
 * loader; a failure is a destructive `Alert` with its retry, and no location
 * at all an `EmptyState` with it, where web writes a line of text.
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

  if (locations.isPending) {
    return (
      <YStack gap={8}>
        <Skeleton h={14} w={96} />
        <Skeleton h={56} rounded={shape.control} />
        <Skeleton h={56} rounded={shape.control} opacity={0.5} />
      </YStack>
    )
  }

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
      <Alert variant="destructive" icon={TriangleAlert}>
        <AlertDescription>{t(failure.key)}</AlertDescription>
        {failure.keyRejected ? null : (
          <AlertAction>
            <Button
              size="sm"
              variant="outline"
              label={t("settings.qerkoPayment.location.retry")}
              onPress={() => {
                void locations.refetch()
              }}
            />
          </AlertAction>
        )}
      </Alert>
    )
  }

  if (data.choices.length === 0) {
    return (
      <EmptyState
        icon={MapPinOff}
        description={t("settings.qerkoPayment.location.empty")}
        action={
          <Button
            variant="outline"
            label={t("settings.qerkoPayment.location.retry")}
            pending={locations.isFetching}
            onPress={() => {
              void locations.refetch()
            }}
          />
        }
      />
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
                <Text
                  fontSize={fontSize.sm}
                  lineHeight={fontSize.sm}
                  fontWeight={fontWeight.semibold}
                >
                  {choice.name}
                </Text>
                <Text
                  fontSize={fontSize.xs}
                  lineHeight={fontSize.xs}
                  color="muted-foreground"
                >
                  {choice.address}
                </Text>
              </YStack>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
      {children}
      {failureKey === null ? null : (
        <Alert variant="destructive" icon={TriangleAlert}>
          <AlertDescription>{t(failureKey)}</AlertDescription>
        </Alert>
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
