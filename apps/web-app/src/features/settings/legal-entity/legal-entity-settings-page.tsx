import { fiatCurrencyOptions } from "@payky/app-shared/fiat-currency-options"
import {
  countryCodec,
  countryLabelKey,
  countryOptions,
  OTHER_COUNTRY,
} from "@payky/app-shared/legal-entity-options"
import { updateSettings } from "@payky/core/modules/app-settings/app-settings-actions"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { getFiatCurrency } from "@payky/core/modules/app-settings/app-settings-utils"
import { setLegalEntity } from "@payky/core/modules/legal-entity/legal-entity-actions"
import { legalEntityQuery } from "@payky/core/modules/legal-entity/legal-entity-queries"
import type { CountryCode } from "@payky/core/modules/legal-entity/legal-entity-types"
import { FiatCurrencySchema } from "@payky/core/modules/shared/schema"
import { FadeHeader } from "@/components/fade-header.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import { FieldDescription, FieldGroup } from "@/components/ui/field.tsx"
import { InlineEditCheckbox } from "@/features/shared/forms/inline-edit-checkbox.tsx"
import { InlineEditSelect } from "@/features/shared/forms/inline-edit-select.tsx"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

export function LegalEntitySettingsPage() {
  const appRun = useAppRun()
  const { t } = useTranslation()
  const { data } = useEvoluQuery(legalEntityQuery)
  const [legalEntity] = data
  const [settings] = useEvoluQuery(settingsQuery).data

  const vatPayer = legalEntity?.vatPayer === 1

  // `setLegalEntity` always writes both fields, so each control carries the
  // other one along unchanged.
  const save = async (values: {
    readonly country: CountryCode | null
    readonly vatPayer: boolean
  }) => {
    await using run = appRun()
    await run.ok(setLegalEntity(values))
  }

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("settings.legalEntity.title")} />

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.legalEntity.title")}</CardTitle>
          <CardDescription>
            {t("settings.legalEntity.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <InlineEditSelect
              label={t("settings.legalEntity.country.label")}
              placeholder={t("settings.legalEntity.country.placeholder")}
              defaultValue={
                legalEntity === undefined ? undefined : legalEntity.country
              }
              codec={countryCodec}
              options={countryOptions.map((option) => ({
                value: option,
                label: t(
                  countryLabelKey(option === OTHER_COUNTRY ? null : option)
                ),
              }))}
              onSave={(country) => save({ country, vatPayer })}
            />

            <InlineEditSelect
              label={t("settings.legalEntity.currency.label")}
              defaultValue={getFiatCurrency(settings)}
              codec={FiatCurrencySchema}
              options={fiatCurrencyOptions.map((option) => ({
                value: option.value,
                label: t(option.label),
              }))}
              onSave={async (fiatCurrency) => {
                await using run = appRun()
                await run.ok(updateSettings({ fiatCurrency }))
              }}
            />
            <FieldDescription>
              {t("settings.legalEntity.currency.description")}
            </FieldDescription>

            <InlineEditCheckbox
              label={t("settings.legalEntity.vatPayer.label")}
              description={t("settings.legalEntity.vatPayer.description")}
              defaultValue={vatPayer}
              // The country comes first: saving this while none is chosen
              // would write "other" on the user's behalf, which is what the
              // old form's "country required" error existed to prevent.
              disabled={legalEntity === undefined}
              onSave={(nextVatPayer) =>
                save({
                  country: legalEntity?.country ?? null,
                  vatPayer: nextVatPayer,
                })
              }
            />
          </FieldGroup>
        </CardContent>
      </Card>
    </>
  )
}
