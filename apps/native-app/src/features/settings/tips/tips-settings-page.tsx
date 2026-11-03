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
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import { Checkbox } from "../../../components/ui/checkbox.tsx"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "../../../components/ui/field.tsx"
import { Input } from "../../../components/ui/input.tsx"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useToast } from "../../../hooks/use-toast.ts"
import { useLocale, useTranslation } from "../../../hooks/use-translation.ts"
import { formatMoney } from "../../../lib/format-money.ts"

/**
 * Tip suggestions, as web's `TipsSettingsPage`: edited as a draft and written
 * by Save, since the presets are one setting.
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
  const toast = useToast()
  const { t } = useTranslation()
  const locale = useLocale()
  const [enabled, setEnabled] = useState(settings.tipsEnabled === sqliteTrue)
  const [percentages, setPercentages] = useState<ReadonlyArray<number>>(() =>
    parseTipPercentages(settings.presetTipPercentagesJson)
  )
  const [fixedAmounts, setFixedAmounts] = useState<ReadonlyArray<number>>(() =>
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

  const addPercentage = () => {
    const result = addTipPercentage(percentages, percentageInput)
    if (!result.ok) {
      setPercentageError(result.errorKey)
      return
    }
    setPercentages(result.presets)
    setPercentageInput("")
    setPercentageError(null)
  }

  const addFixedAmount = () => {
    const result = addTipFixedAmount(
      fixedAmounts,
      fixedAmountInput,
      settings.fiatCurrency
    )
    if (!result.ok) {
      setFixedAmountError(result.errorKey)
      return
    }
    setFixedAmounts(result.presets)
    setFixedAmountInput("")
    setFixedAmountError(null)
  }

  const resetToDefaults = () => {
    setEnabled(true)
    setPercentages([...defaultTipPercentages])
    setFixedAmounts([...defaultTipFixedAmounts])
    setPercentageInput("")
    setFixedAmountInput("")
    setPercentageError(null)
    setFixedAmountError(null)
  }

  const save = async () => {
    setPending(true)
    const saved = await runToast(async (run) => {
      await run.ok(updateTipSettings({ enabled, fixedAmounts, percentages }))
    })
    setPending(false)
    if (saved) toast.success(t("settings.tips.saved"))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle size="sm">{t("settings.tips.form.title")}</CardTitle>
        <CardDescription>{t("settings.tips.form.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field orientation="horizontal">
            <Checkbox
              checked={enabled}
              disabled={pending}
              aria-label={t("settings.tips.enabled.label")}
              onCheckedChange={setEnabled}
            />
            <FieldContent>
              <FieldLabel>{t("settings.tips.enabled.label")}</FieldLabel>
              <FieldDescription>
                {t("settings.tips.enabled.description")}
              </FieldDescription>
            </FieldContent>
          </Field>

          <TipPresetField
            addLabel={t("settings.tips.percentages.add")}
            description={t("settings.tips.percentages.description")}
            disabled={pending}
            error={percentageError}
            keyboardType="number-pad"
            inputValue={percentageInput}
            label={t("settings.tips.percentages.label")}
            onAdd={addPercentage}
            onInputChange={(value) => {
              setPercentageInput(value)
              setPercentageError(null)
            }}
            onRemove={(value) =>
              setPercentages(
                percentages.filter((percentage) => percentage !== value)
              )
            }
            placeholder={t("settings.tips.percentages.placeholder")}
            presets={percentages}
            renderPreset={(value) =>
              t("settings.tips.percentages.value", { value })
            }
          />

          <TipPresetField
            addLabel={t("settings.tips.fixedAmounts.add")}
            description={t("settings.tips.fixedAmounts.description", {
              currency: settings.fiatCurrency,
            })}
            disabled={pending}
            error={fixedAmountError}
            keyboardType="decimal-pad"
            inputValue={fixedAmountInput}
            label={t("settings.tips.fixedAmounts.label")}
            onAdd={addFixedAmount}
            onInputChange={(value) => {
              setFixedAmountInput(value)
              setFixedAmountError(null)
            }}
            onRemove={(value) =>
              setFixedAmounts(fixedAmounts.filter((amount) => amount !== value))
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
        </FieldGroup>
      </CardContent>
      <CardFooter justify="flex-end">
        <Button
          label={t("settings.tips.save")}
          pending={pending}
          onPress={() => {
            void save()
          }}
        />
      </CardFooter>
    </Card>
  )
}

function TipPresetField({
  addLabel,
  description,
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
  readonly description: string
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

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <FieldDescription>{description}</FieldDescription>
      <YStack rounded="lg" bg="neutral-soft" overflow="hidden">
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
      <Input
        value={inputValue}
        disabled={disabled}
        keyboardType={keyboardType}
        invalid={error !== null}
        placeholder={placeholder}
        onChangeText={onInputChange}
      />
      <Button
        label={addLabel}
        iconStart={Plus}
        variant="outline"
        disabled={disabled}
        onPress={onAdd}
      />
      <FieldError>{error === null ? undefined : t(error)}</FieldError>
    </Field>
  )
}
