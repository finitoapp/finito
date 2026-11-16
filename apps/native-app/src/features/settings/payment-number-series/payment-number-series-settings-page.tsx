import {
  nonNegativeIntegerCodec,
  optionalDateCodec,
  optionalTextCodec,
  positiveIntegerCodec,
} from "@payky/app-shared/inline-edit-codecs"
import {
  dayFormatOptions,
  monthFormatOptions,
  type ToggleOption,
  yearFormatOptions,
} from "@payky/app-shared/payment-number-series-options"
import { updatePaymentLastNumber } from "@payky/core/modules/payment-number/payment-number-actions"
import { paymentLastNumberQuery } from "@payky/core/modules/payment-number/payment-number-queries"
import type { PaymentNumberSeriesRow } from "@payky/core/modules/payment-number-series/payment-number-series"
import { updatePaymentNumberSeries } from "@payky/core/modules/payment-number-series/payment-number-series-actions"
import { paymentNumberSeriesQuery } from "@payky/core/modules/payment-number-series/payment-number-series-queries"
import { createDefaultPaymentNumberSeries } from "@payky/core/modules/payment-number-series/payment-number-series-utils"
import { NonNegativeInteger } from "@payky/core/modules/shared/schema"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { InlineEditField } from "../../../components/inline-edit-field.tsx"
import { OptionToggleGroup } from "../../../components/option-toggle-group.tsx"
import { Screen } from "../../../components/screen.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import { Field, FieldGroup, FieldLabel } from "../../../components/ui/field.tsx"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useInlineChoice } from "../../../hooks/use-inline-choice.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"

/** Payment numbering, as web's `PaymentNumberSeriesSettingsPage`; each field is written at once. */
export function PaymentNumberSeriesSettingsPage() {
  const { t } = useTranslation()

  return (
    <Screen>
      <FadeHeader title={t("settings.paymentNumberSeries.title")} />
      <LastNumberSection />
      <SeriesFormatSection />
    </Screen>
  )
}

function LastNumberSection() {
  const runToast = useRunToast()
  const { t } = useTranslation()
  const [paymentLastNumber] = useEvoluQuery(paymentLastNumberQuery).data

  const serialNumber = paymentLastNumber?.serialNumber ?? NonNegativeInteger(0)
  const date = paymentLastNumber?.date ?? null

  // `updatePaymentLastNumber` writes the whole row, so each field carries the
  // other one along unchanged.
  const save = (values: {
    readonly serialNumber: typeof serialNumber
    readonly date: typeof date
  }) =>
    runToast(async (run) => {
      await run.ok(updatePaymentLastNumber(values))
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t("settings.paymentNumberSeries.lastNumber.title")}
        </CardTitle>
        <CardDescription>
          {t("settings.paymentNumberSeries.lastNumber.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <InlineEditField
            label={t(
              "settings.paymentNumberSeries.lastNumber.serialNumber.label"
            )}
            description={t(
              "settings.paymentNumberSeries.lastNumber.serialNumber.description"
            )}
            keyboardType="number-pad"
            defaultValue={serialNumber}
            codec={nonNegativeIntegerCodec}
            errorKey="settings.paymentNumberSeries.lastNumber.serialNumber.invalid"
            onSave={(next) => save({ serialNumber: next, date })}
          />
          <InlineEditField
            label={t("settings.paymentNumberSeries.lastNumber.date.label")}
            description={t(
              "settings.paymentNumberSeries.lastNumber.date.description"
            )}
            placeholder="yyyy-MM-dd"
            keyboardType="numbers-and-punctuation"
            defaultValue={date}
            codec={optionalDateCodec}
            errorKey="settings.paymentNumberSeries.lastNumber.date.invalid"
            onSave={(next) => save({ serialNumber, date: next })}
          />
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

function SeriesFormatSection() {
  const runToast = useRunToast()
  const { t } = useTranslation()
  const [storedSeries] = useEvoluQuery(paymentNumberSeriesQuery).data
  const series = storedSeries ?? createDefaultPaymentNumberSeries()

  /**
   * `updatePaymentNumberSeries` upserts the whole row over the defaults, so a
   * partial save would reset every field it leaves out. Each control sends
   * the current series with its own field replaced.
   */
  const save = (changed: Partial<PaymentNumberSeriesRow>) =>
    runToast(async (run) => {
      await run.ok(
        updatePaymentNumberSeries({
          serialNumberDigits: series.serialNumberDigits,
          prefix: series.prefix,
          yearFormat: series.yearFormat,
          monthFormat: series.monthFormat,
          dayFormat: series.dayFormat,
          ...changed,
        })
      )
    })

  const year = useInlineChoice(series.yearFormat, (yearFormat) =>
    save({ yearFormat })
  )
  const month = useInlineChoice(series.monthFormat, (monthFormat) =>
    save({ monthFormat })
  )
  const day = useInlineChoice(series.dayFormat, (dayFormat) =>
    save({ dayFormat })
  )

  // No icon: one and the same on every option would tell them nothing apart.
  const options = <Value extends string>(
    list: ReadonlyArray<ToggleOption<Value>>
  ) =>
    list.map((option) => ({
      value: option.value,
      title: t(option.label),
      description: t(option.description),
    }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.paymentNumberSeries.form.title")}</CardTitle>
        <CardDescription>
          {t("settings.paymentNumberSeries.form.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <InlineEditField
            label={t("settings.paymentNumberSeries.serialNumberDigits.label")}
            description={t(
              "settings.paymentNumberSeries.serialNumberDigits.description"
            )}
            keyboardType="number-pad"
            defaultValue={series.serialNumberDigits}
            codec={positiveIntegerCodec}
            errorKey="settings.paymentNumberSeries.serialNumberDigits.invalid"
            onSave={(serialNumberDigits) => save({ serialNumberDigits })}
          />
          <InlineEditField
            label={t("settings.paymentNumberSeries.prefix.label")}
            description={t("settings.paymentNumberSeries.prefix.description")}
            defaultValue={series.prefix}
            codec={optionalTextCodec}
            errorKey="settings.paymentNumberSeries.prefix.invalid"
            onSave={(prefix) => save({ prefix })}
          />
          <Field>
            <FieldLabel>
              {t("settings.paymentNumberSeries.year.label")}
            </FieldLabel>
            <OptionToggleGroup
              value={year.value}
              options={options(yearFormatOptions)}
              onChange={(value) => void year.choose(value)}
            />
          </Field>
          <Field>
            <FieldLabel>
              {t("settings.paymentNumberSeries.month.label")}
            </FieldLabel>
            <OptionToggleGroup
              value={month.value}
              options={options(monthFormatOptions)}
              onChange={(value) => void month.choose(value)}
            />
          </Field>
          <Field>
            <FieldLabel>
              {t("settings.paymentNumberSeries.day.label")}
            </FieldLabel>
            <OptionToggleGroup
              value={day.value}
              options={options(dayFormatOptions)}
              onChange={(value) => void day.choose(value)}
            />
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
