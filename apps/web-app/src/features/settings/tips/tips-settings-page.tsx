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
import { PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react"
import { useId, useState } from "react"
import { FadeHeader } from "@/components/fade-header.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Checkbox } from "@/components/ui/checkbox.tsx"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field.tsx"
import { Input } from "@/components/ui/input.tsx"
import { FormCard } from "@/features/shared/forms/form-card.tsx"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useLocale } from "@/hooks/use-locale.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useSettingsForm } from "@/hooks/use-settings-form.ts"
import { useTranslation } from "@/hooks/use-translation.ts"
import { formatMoney } from "@/lib/format-utils.ts"

interface TipsSettingsFormProps {
  readonly settings: Pick<
    AppSettingsRow,
    | "fiatCurrency"
    | "id"
    | "presetTipFixedAmountsJson"
    | "presetTipPercentagesJson"
    | "tipsEnabled"
  >
}

export function TipsSettingsPage() {
  const { t } = useTranslation()
  const { data } = useEvoluQuery(settingsQuery)
  const [settings] = data

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("settings.tips.title")} />
      {settings === undefined ? null : (
        <TipsSettingsForm key={settings.id} settings={settings} />
      )}
    </>
  )
}

function TipsSettingsForm({ settings }: TipsSettingsFormProps) {
  const runToast = useRunToast()
  const { t } = useTranslation()
  const locale = useLocale()
  const formId = useId()
  const [enabled, setEnabled] = useState(settings.tipsEnabled === sqliteTrue)
  const [percentages, setPercentages] = useState(() =>
    parseTipPercentages(settings.presetTipPercentagesJson)
  )
  const [fixedAmounts, setFixedAmounts] = useState(() =>
    parseTipFixedAmounts(settings.presetTipFixedAmountsJson)
  )
  const [percentageInput, setPercentageInput] = useState("")
  const [fixedAmountInput, setFixedAmountInput] = useState("")
  const [percentageError, setPercentageError] = useState<TipPresetError | null>(
    null
  )
  const [fixedAmountError, setFixedAmountError] =
    useState<TipPresetError | null>(null)
  const { pending, saved, resetSaved, submit } = useSettingsForm()

  const addPercentage = () => {
    const result = addTipPercentage(percentages, percentageInput)
    if (!result.ok) {
      setPercentageError(result.errorKey)
      return
    }

    setPercentages(result.presets)
    setPercentageInput("")
    setPercentageError(null)
    resetSaved()
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
    resetSaved()
  }

  const resetToDefaults = () => {
    setEnabled(true)
    setPercentages([...defaultTipPercentages])
    setFixedAmounts([...defaultTipFixedAmounts])
    setPercentageInput("")
    setFixedAmountInput("")
    setPercentageError(null)
    setFixedAmountError(null)
    resetSaved()
  }

  return (
    <FormCard
      title={t("settings.tips.form.title")}
      description={t("settings.tips.form.description")}
      savedMessage={saved ? t("settings.tips.saved") : null}
      submitLabel={t("settings.tips.save")}
      pending={pending}
      onSubmit={(event) => {
        event.preventDefault()

        void submit(() =>
          runToast(async (run) => {
            await run.ok(
              updateTipSettings({
                enabled,
                fixedAmounts,
                percentages,
              })
            )
          })
        )
      }}
    >
      <FieldGroup>
        <Field orientation="horizontal">
          <Checkbox
            id={`${formId}-enabled`}
            checked={enabled}
            disabled={pending}
            onCheckedChange={(checked) => {
              setEnabled(checked)
              resetSaved()
            }}
          />
          <FieldContent>
            <FieldLabel htmlFor={`${formId}-enabled`}>
              {t("settings.tips.enabled.label")}
            </FieldLabel>
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
          inputId={`${formId}-percentage`}
          inputMode="numeric"
          inputValue={percentageInput}
          label={t("settings.tips.percentages.label")}
          onAdd={addPercentage}
          onInputChange={(value) => {
            setPercentageInput(value)
            setPercentageError(null)
          }}
          onRemove={(value) => {
            setPercentages(
              percentages.filter((percentage) => percentage !== value)
            )
            resetSaved()
          }}
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
          inputId={`${formId}-fixedAmount`}
          inputMode="decimal"
          inputValue={fixedAmountInput}
          label={t("settings.tips.fixedAmounts.label")}
          onAdd={addFixedAmount}
          onInputChange={(value) => {
            setFixedAmountInput(value)
            setFixedAmountError(null)
          }}
          onRemove={(value) => {
            setFixedAmounts(fixedAmounts.filter((amount) => amount !== value))
            resetSaved()
          }}
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
          type="button"
          variant="outline"
          disabled={pending}
          onClick={resetToDefaults}
        >
          <RotateCcwIcon data-icon="inline-start" />
          {t("settings.tips.reset")}
        </Button>
      </FieldGroup>
    </FormCard>
  )
}

function TipPresetField({
  addLabel,
  description,
  disabled,
  error,
  inputId,
  inputMode,
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
  readonly inputId: string
  readonly inputMode: "decimal" | "numeric"
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
    <Field data-invalid={error !== null}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <FieldDescription>{description}</FieldDescription>
      <div className="flex flex-col divide-y rounded-lg border">
        {presets.map((value) => {
          const label = renderPreset(value)

          return (
            <div
              key={value}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <span className="text-sm font-medium">{label}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={disabled}
                aria-label={t("settings.tips.preset.remove", { value: label })}
                onClick={() => {
                  onRemove(value)
                }}
              >
                <Trash2Icon />
              </Button>
            </div>
          )
        })}
      </div>
      <Input
        id={inputId}
        value={inputValue}
        disabled={disabled}
        aria-invalid={error !== null}
        autoComplete="off"
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(event) => {
          onInputChange(event.currentTarget.value)
        }}
      />
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={onAdd}
      >
        <PlusIcon data-icon="inline-start" />
        {addLabel}
      </Button>
      <FieldError>{error === null ? null : t(error)}</FieldError>
    </Field>
  )
}
