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
import { ReceiptText } from "lucide-react"
import { useMemo } from "react"
import { FadeHeader } from "@/components/fade-header.tsx"
import type { OptionToggleGroupOption } from "@/components/option-toggle-group.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import { FieldGroup } from "@/components/ui/field.tsx"
import { InlineEditField } from "@/features/shared/forms/inline-edit-field.tsx"
import { InlineEditToggleGroup } from "@/features/shared/forms/inline-edit-toggle-group.tsx"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

export function PaymentNumberSeriesSettingsPage() {
  const { t } = useTranslation()

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("settings.paymentNumberSeries.title")} />

      <div className="flex flex-col gap-4">
        <LastNumberCard />
        <SeriesFormatCard />
      </div>
    </>
  )
}

function LastNumberCard() {
  const appRun = useAppRun()
  const { t } = useTranslation()
  const { data } = useEvoluQuery(paymentLastNumberQuery)
  const [paymentLastNumber] = data

  const serialNumber = paymentLastNumber?.serialNumber ?? NonNegativeInteger(0)
  const date = paymentLastNumber?.date ?? null

  // `updatePaymentLastNumber` writes the whole row, so each field carries the
  // other one along unchanged.
  const save = async (values: {
    readonly serialNumber: typeof serialNumber
    readonly date: typeof date
  }) => {
    await using run = appRun()
    await run.ok(updatePaymentLastNumber(values))
  }

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
            inputMode="numeric"
            defaultValue={serialNumber}
            codec={nonNegativeIntegerCodec}
            errorKey="settings.paymentNumberSeries.lastNumber.serialNumber.invalid"
            onSave={(nextSerialNumber) =>
              save({ serialNumber: nextSerialNumber, date })
            }
          />

          <InlineEditField
            label={t("settings.paymentNumberSeries.lastNumber.date.label")}
            description={t(
              "settings.paymentNumberSeries.lastNumber.date.description"
            )}
            type="date"
            defaultValue={date}
            codec={optionalDateCodec}
            errorKey="settings.paymentNumberSeries.lastNumber.date.invalid"
            onSave={(nextDate) => save({ serialNumber, date: nextDate })}
          />
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

function SeriesFormatCard() {
  const appRun = useAppRun()
  const { t } = useTranslation()
  const { data } = useEvoluQuery(paymentNumberSeriesQuery)
  const [storedSeries] = data
  const series = useMemo(
    () => storedSeries ?? createDefaultPaymentNumberSeries(),
    [storedSeries]
  )

  /**
   * `updatePaymentNumberSeries` upserts the whole row over the defaults, so
   * a partial save would reset every field it leaves out. Each control sends
   * the current series with its own field replaced.
   */
  const save = async (changed: Partial<PaymentNumberSeriesRow>) => {
    await using run = appRun()
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
  }

  const toggleOptions = <Value extends string>(
    options: ReadonlyArray<ToggleOption<Value>>
  ): ReadonlyArray<OptionToggleGroupOption<Value>> =>
    options.map((option) => ({
      value: option.value,
      icon: ReceiptText,
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
            inputMode="numeric"
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

          <InlineEditToggleGroup
            label={t("settings.paymentNumberSeries.year.label")}
            defaultValue={series.yearFormat}
            options={toggleOptions(yearFormatOptions)}
            onSave={(yearFormat) => save({ yearFormat })}
          />

          <InlineEditToggleGroup
            label={t("settings.paymentNumberSeries.month.label")}
            defaultValue={series.monthFormat}
            options={toggleOptions(monthFormatOptions)}
            onSave={(monthFormat) => save({ monthFormat })}
          />

          <InlineEditToggleGroup
            label={t("settings.paymentNumberSeries.day.label")}
            defaultValue={series.dayFormat}
            options={toggleOptions(dayFormatOptions)}
            onSave={(dayFormat) => save({ dayFormat })}
          />
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
