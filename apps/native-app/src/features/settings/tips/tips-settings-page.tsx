import { sqliteTrue } from "@evolu/common"
import {
  addTipFixedAmount,
  addTipPercentage,
  type TipPresetError,
} from "@payky/app-shared/tip-presets"
import type { AppSettingsRow } from "@payky/core/modules/app-settings/app-settings"
import { updateTipSettings } from "@payky/core/modules/app-settings/app-settings-actions"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import {
  defaultTipFixedAmounts,
  defaultTipPercentages,
  maxTipPresetCount,
  parseTipFixedAmounts,
  parseTipPercentages,
} from "@payky/core/modules/app-settings/app-settings-tips"
import { Integer } from "@payky/core/modules/shared/schema"
import Plus from "lucide-react-native/icons/plus"
import RotateCcw from "lucide-react-native/icons/rotate-ccw"
import Trash from "lucide-react-native/icons/trash"
import { useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { Screen } from "../../../components/screen.tsx"
import { SwitchRow } from "../../../components/switch-row.tsx"
import { Button } from "../../../components/ui/button.tsx"
import { Field, FieldError, FieldLabel } from "../../../components/ui/field.tsx"
import { Input } from "../../../components/ui/input.tsx"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useInlineChoice } from "../../../hooks/use-inline-choice.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useLocale, useTranslation } from "../../../hooks/use-translation.ts"
import { formatMoney } from "../../../lib/format-money.ts"

/** Smallest first, so the payment screen's options read in order. */
const ascending = (presets: ReadonlyArray<number>) =>
  presets.toSorted((a, b) => a - b)

/**
 * Tip suggestions, as web's `TipsSettingsPage` without its Save: every
 * change is written the moment it is made, and the presets are kept in
 * ascending order. No card, no descriptions (fazole-ui-minimal-copy).
 */
export function TipsSettingsPage() {
  const { t } = useTranslation()
  const [settings] = useEvoluQuery(settingsQuery).data

  return (
    <Screen>
      <FadeHeader title={t("settings.tips.title")} />
      {settings === undefined ? null : (
        <TipsSettingsForm key={settings.id} settings={settings} />
      )}
    </Screen>
  )
}

function TipsSettingsForm({
  settings,
}: {
  readonly settings: Pick<
    AppSettingsRow,
    | "fiatCurrency"
    | "id"
    | "presetTipFixedAmountsJson"
    | "presetTipPercentagesJson"
    | "tipsEnabled"
  >
}) {
  const runToast = useRunToast()
  const { t } = useTranslation()
  const locale = useLocale()
  const enabled = settings.tipsEnabled === sqliteTrue
  const percentages = ascending(
    parseTipPercentages(settings.presetTipPercentagesJson)
  )
  const fixedAmounts = ascending(
    parseTipFixedAmounts(settings.presetTipFixedAmountsJson)
  )
  const [percentageInput, setPercentageInput] = useState("")
  const [fixedAmountInput, setFixedAmountInput] = useState("")
  const [percentageError, setPercentageError] = useState<TipPresetError | null>(
    null
  )
  const [fixedAmountError, setFixedAmountError] =
    useState<TipPresetError | null>(null)
  const [pending, setPending] = useState(false)

  // Every write carries the whole setting, as the presets are one setting.
  const save = async (next: {
    readonly enabled?: boolean
    readonly percentages?: ReadonlyArray<number>
    readonly fixedAmounts?: ReadonlyArray<number>
  }) => {
    setPending(true)
    const saved = await runToast(async (run) => {
      await run.ok(
        updateTipSettings({
          enabled: next.enabled ?? enabled,
          percentages: ascending(next.percentages ?? percentages),
          fixedAmounts: ascending(next.fixedAmounts ?? fixedAmounts),
        })
      )
    })
    setPending(false)
    return saved
  }
  const enabledChoice = useInlineChoice(enabled, (next) =>
    save({ enabled: next })
  )

  const addPercentage = async () => {
    const result = addTipPercentage(percentages, percentageInput)
    if (!result.ok) {
      setPercentageError(result.errorKey)
      return
    }
    setPercentageError(null)
    if (await save({ percentages: result.presets })) setPercentageInput("")
  }

  const addFixedAmount = async () => {
    const result = addTipFixedAmount(
      fixedAmounts,
      fixedAmountInput,
      settings.fiatCurrency
    )
    if (!result.ok) {
      setFixedAmountError(result.errorKey)
      return
    }
    setFixedAmountError(null)
    if (await save({ fixedAmounts: result.presets })) setFixedAmountInput("")
  }

  const resetToDefaults = () => {
    setPercentageInput("")
    setFixedAmountInput("")
    setPercentageError(null)
    setFixedAmountError(null)
    void save({
      enabled: true,
      percentages: [...defaultTipPercentages],
      fixedAmounts: [...defaultTipFixedAmounts],
    })
  }

  return (
    <YStack gap={24}>
      <SwitchRow
        label={t("settings.tips.enabled.label")}
        checked={enabledChoice.value}
        disabled={enabledChoice.saving}
        onCheckedChange={(next) => {
          void enabledChoice.choose(next)
        }}
      />

      <TipPresetField
        addLabel={t("settings.tips.percentages.add")}
        disabled={pending}
        error={percentageError}
        keyboardType="number-pad"
        inputValue={percentageInput}
        label={t("settings.tips.percentages.label")}
        onAdd={() => void addPercentage()}
        onInputChange={(value) => {
          setPercentageInput(value)
          setPercentageError(null)
        }}
        onRemove={(value) =>
          void save({
            percentages: percentages.filter(
              (percentage) => percentage !== value
            ),
          })
        }
        placeholder={t("settings.tips.percentages.placeholder")}
        presets={percentages}
        renderPreset={(value) =>
          t("settings.tips.percentages.value", { value })
        }
      />

      <TipPresetField
        addLabel={t("settings.tips.fixedAmounts.add")}
        disabled={pending}
        error={fixedAmountError}
        keyboardType="decimal-pad"
        inputValue={fixedAmountInput}
        label={t("settings.tips.fixedAmounts.label")}
        onAdd={() => void addFixedAmount()}
        onInputChange={(value) => {
          setFixedAmountInput(value)
          setFixedAmountError(null)
        }}
        onRemove={(value) =>
          void save({
            fixedAmounts: fixedAmounts.filter((amount) => amount !== value),
          })
        }
        placeholder={t("settings.tips.fixedAmounts.placeholder")}
        presets={fixedAmounts}
        renderPreset={(value) =>
          formatMoney(
            { value: Integer(value), currency: settings.fiatCurrency },
            locale
          )
        }
      />

      <Button
        label={t("settings.tips.reset")}
        iconStart={RotateCcw}
        variant="outline"
        disabled={pending}
        onPress={resetToDefaults}
      />
    </YStack>
  )
}

/**
 * One list of presets with a remove button each and, while there is room
 * for another (`maxTipPresetCount`), the input and the Add button under it.
 */
function TipPresetField({
  addLabel,
  disabled,
  error,
  keyboardType,
  inputValue,
  label,
  onAdd,
  onInputChange,
  onRemove,
  placeholder,
  presets,
  renderPreset,
}: {
  readonly addLabel: string
  readonly disabled: boolean
  readonly error: TipPresetError | null
  readonly keyboardType: "number-pad" | "decimal-pad"
  readonly inputValue: string
  readonly label: string
  readonly onAdd: () => void
  readonly onInputChange: (value: string) => void
  readonly onRemove: (value: number) => void
  readonly placeholder: string
  readonly presets: ReadonlyArray<number>
  readonly renderPreset: (value: number) => string
}) {
  const { t } = useTranslation()
  const full = presets.length >= maxTipPresetCount

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <YStack rounded="lg" bg="tile" overflow="hidden">
        {presets.map((value) => {
          const text = renderPreset(value)
          return (
            <XStack key={value} items="center" gap="3" px="3" py="2">
              <Text flex={1} fontWeight="600">
                {text}
              </Text>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t("settings.tips.preset.remove", {
                  value: text,
                })}
                disabled={disabled}
                iconStart={Trash}
                onPress={() => onRemove(value)}
              />
            </XStack>
          )
        })}
      </YStack>
      {full ? null : (
        <>
          <Input
            value={inputValue}
            disabled={disabled}
            keyboardType={keyboardType}
            invalid={error !== null}
            placeholder={placeholder}
            onChangeText={onInputChange}
            onSubmitEditing={onAdd}
          />
          <Button
            label={addLabel}
            iconStart={Plus}
            variant="outline"
            disabled={disabled}
            onPress={onAdd}
          />
        </>
      )}
      <FieldError>{error === null ? undefined : t(error)}</FieldError>
    </Field>
  )
}
