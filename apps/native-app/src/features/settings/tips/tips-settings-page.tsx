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
import { useConfirm } from "../../../hooks/use-confirm.ts"
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
 *
 * The presets show only while tips are on, as they do nothing otherwise.
 * Removing a preset and resetting to the defaults are confirmed first; the
 * reset replaces the presets only and leaves tips on or off as they are.
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
  const confirm = useConfirm()
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

  const resetToDefaults = async () => {
    const confirmed = await confirm({
      title: t("settings.tips.resetConfirm.title"),
      description: t("settings.tips.resetConfirm.description"),
      confirmLabel: t("settings.tips.resetConfirm.confirm"),
      cancelLabel: t("settings.tips.resetConfirm.cancel"),
      variant: "destructive",
    })
    if (!confirmed) return
    setPercentageInput("")
    setFixedAmountInput("")
    setPercentageError(null)
    setFixedAmountError(null)
    await save({
      percentages: [...defaultTipPercentages],
      fixedAmounts: [...defaultTipFixedAmounts],
    })
  }

  /** Asks before a preset is removed, naming it as the list shows it. */
  const confirmRemove = (text: string) =>
    confirm({
      title: t("settings.tips.removeConfirm.title", { value: text }),
      description: t("settings.tips.removeConfirm.description"),
      confirmLabel: t("settings.tips.removeConfirm.confirm"),
      cancelLabel: t("settings.tips.removeConfirm.cancel"),
      variant: "destructive",
    })

  const removePercentage = async (value: number, text: string) => {
    if (!(await confirmRemove(text))) return
    await save({
      percentages: percentages.filter((percentage) => percentage !== value),
    })
  }

  const removeFixedAmount = async (value: number, text: string) => {
    if (!(await confirmRemove(text))) return
    await save({
      fixedAmounts: fixedAmounts.filter((amount) => amount !== value),
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

      {enabledChoice.value ? (
        <>
          <TipPresetField
            addLabel={t("settings.tips.percentages.add")}
            disabled={pending}
            error={percentageError}
            keyboardType="number-pad"
            inputValue={percentageInput}
            label={t("settings.tips.percentages.label")}
            maximumKey="settings.tips.percentages.maximum"
            onAdd={() => void addPercentage()}
            onInputChange={(value) => {
              setPercentageInput(value)
              setPercentageError(null)
            }}
            onRemove={(value, text) => void removePercentage(value, text)}
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
            maximumKey="settings.tips.fixedAmounts.maximum"
            onAdd={() => void addFixedAmount()}
            onInputChange={(value) => {
              setFixedAmountInput(value)
              setFixedAmountError(null)
            }}
            onRemove={(value, text) => void removeFixedAmount(value, text)}
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
            variant="ghost"
            disabled={pending}
            onPress={() => void resetToDefaults()}
          />
        </>
      ) : null}
    </YStack>
  )
}

/**
 * One list of presets with a remove button each and, while there is room
 * for another (`maxTipPresetCount`), the input and the Add button under it;
 * once the list is full, the limit in their place, so they do not vanish
 * without a word.
 */
function TipPresetField({
  addLabel,
  disabled,
  error,
  keyboardType,
  inputValue,
  label,
  maximumKey,
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
  readonly maximumKey: TipPresetError
  readonly onAdd: () => void
  readonly onInputChange: (value: string) => void
  readonly onRemove: (value: number, text: string) => void
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
                labelColor="muted-foreground"
                disabled={disabled}
                iconStart={Trash}
                onPress={() => onRemove(value, text)}
              />
            </XStack>
          )
        })}
      </YStack>
      {full ? (
        <Text fontSize="sm" lineHeight="sm" color="muted-foreground">
          {t(maximumKey)}
        </Text>
      ) : (
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
