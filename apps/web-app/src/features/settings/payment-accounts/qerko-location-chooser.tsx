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
import { LoaderCircle } from "lucide-react"
import { type ReactNode, useState } from "react"
import { Button } from "@/components/ui/button.tsx"
import { Field, FieldLabel } from "@/components/ui/field.tsx"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

/**
 * The locations of the paired company, one of which the Qerko payment key is
 * paired with (qerko/0007): its id is the restaurant the QR codes name. The
 * only location, or the one the key is already paired with, starts chosen.
 * Confirming pairs it with `pair-location`, then `onPaired` runs; `children`
 * sits between the list and the button.
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
  const { data: pluginData } = useEvoluQuery(qerkoPluginQuery("standard"))
  const [plugin] = pluginData
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
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
      </p>
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
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-destructive">{t(failure.key)}</p>
        {failure.keyRejected ? null : (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void locations.refetch()
            }}
          >
            {t("settings.qerkoPayment.location.retry")}
          </Button>
        )}
      </div>
    )
  }

  if (data.choices.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">
          {t("settings.qerkoPayment.location.empty")}
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={locations.isFetching}
          onClick={() => {
            void locations.refetch()
          }}
        >
          {locations.isFetching ? (
            <LoaderCircle className="animate-spin" />
          ) : null}
          {t("settings.qerkoPayment.location.retry")}
        </Button>
      </div>
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
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel>{t("settings.qerkoPayment.location.label")}</FieldLabel>
        <ToggleGroup
          aria-label={t("settings.qerkoPayment.location.label")}
          className="grid w-full grid-cols-1 gap-2"
          variant="outline"
          disabled={pending}
          value={selected === null ? [] : [selected]}
          onValueChange={(values) => {
            const [value] = values
            if (value !== undefined) setChosen(value)
          }}
        >
          {data.choices.map((choice) => (
            <ToggleGroupItem
              key={choice.locationId}
              value={choice.locationId}
              className="h-auto justify-start py-2 text-left"
            >
              <span className="flex flex-col items-start gap-0.5">
                <span className="font-medium">{choice.name}</span>
                <span className="text-xs text-muted-foreground">
                  {choice.address}
                </span>
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
      {children}
      {failureKey === null ? null : (
        <p className="text-sm text-destructive">{t(failureKey)}</p>
      )}
      <div className="flex justify-end">
        <Button
          type="button"
          disabled={selectedChoice === undefined || pending}
          onClick={() => {
            void confirm()
          }}
        >
          {pending ? <LoaderCircle className="animate-spin" /> : null}
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}
