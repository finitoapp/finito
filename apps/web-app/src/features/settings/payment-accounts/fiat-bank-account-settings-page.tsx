import {
  type BankAccountDisplayFormat,
  bankQrFormatCodec,
  fiatBankAccountQrFormatOptions,
  fiatCurrencyCodec,
  optionalIbanCodecs,
} from "@payky/app-shared/bank-account-codecs"
import { bankSyncPluginLinks } from "@payky/app-shared/bank-sync-plugin-links"
import { fiatCurrencyOptions } from "@payky/app-shared/fiat-currency-options"
import { saveFiatBankAccount } from "@payky/core/modules/account/account-actions"
import { fiatBankAccountQuery } from "@payky/core/modules/account/account-queries"
import type { BankQrFormat } from "@payky/core/modules/account/account-types"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { getFiatCurrency } from "@payky/core/modules/app-settings/app-settings-utils"
import { fiatBankAccountFioPluginQuery } from "@payky/core/modules/fio-plugin/fio-plugin-queries"
import { fiatBankAccountMonetaPluginQuery } from "@payky/core/modules/moneta-plugin/moneta-plugin-queries"
import {
  czechIbanToBban,
  isFioBankIban,
} from "@payky/core/modules/shared/iban-utils"
import type {
  FiatCurrency as FiatCurrencyType,
  Iban,
} from "@payky/core/modules/shared/schema"
import { ChevronDown, Plug, TriangleAlert } from "lucide-react"
import { useState } from "react"
import { FadeHeader } from "@/components/fade-header.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible.tsx"
import { FieldDescription, FieldGroup } from "@/components/ui/field.tsx"
import {
  VerticalNav,
  type VerticalNavItem,
} from "@/components/vertical-nav.tsx"
import { InlineEditField } from "@/features/settings/inline-edit-field.tsx"
import { InlineEditSelect } from "@/features/settings/inline-edit-select.tsx"
import {
  BankAccountDescription,
  BankAccountFormatToggle,
} from "@/features/shared/bank-account-input.tsx"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

export function FiatBankAccountSettingsPage() {
  const appRun = useAppRun()
  const { t } = useTranslation()
  const { data: accountData } = useEvoluQuery(fiatBankAccountQuery)
  const { data: settingsData } = useEvoluQuery(settingsQuery)
  const [account] = accountData
  const [settings] = settingsData
  const [monetaPlugin] = useEvoluQuery(fiatBankAccountMonetaPluginQuery).data

  const iban = account?.iban ?? null
  const [fioPlugin] = useEvoluQuery(fiatBankAccountFioPluginQuery).data
  const { showsMonetaPlugin, showsFioPlugin, isMonetaPluginOn } =
    bankSyncPluginLinks({
      iban,
      monetaPlugin,
      hasFioPlugin: fioPlugin !== undefined,
    })
  // Entering the first IBAN is what setting up bank transfers means, so it
  // enables the account; after that the switch on the overview owns it.
  const enabled = account ? account.isDeleted !== 1 : true
  const currency = account?.currency ?? getFiatCurrency(settings)
  const defaultQrFormat = account?.defaultQrFormat ?? "spayd"
  const [ibanFormat, setIbanFormat] = useState<BankAccountDisplayFormat>("bban")

  // `saveFiatBankAccount` upserts the whole row, so a partial save would
  // reset the fields it leaves out. Each control sends the current settings
  // with its own field replaced — same pattern as the FIO plugin form.
  const save = async (changed: {
    readonly iban?: Iban
    readonly currency?: FiatCurrencyType
    readonly defaultQrFormat?: BankQrFormat
  }) => {
    await using run = appRun()
    await run.ok(
      saveFiatBankAccount({
        enabled,
        iban: changed.iban ?? iban ?? undefined,
        currency: changed.currency ?? currency,
        defaultQrFormat: changed.defaultQrFormat ?? defaultQrFormat,
      })
    )
  }

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("settings.paymentAccounts.method.iban")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.fiatBankAccount.form.title")}</CardTitle>
          <CardDescription>
            {t("settings.fiatBankAccount.form.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <InlineEditField
              label={t("settings.fiatBankAccount.iban.label")}
              description={(draft) => <BankAccountDescription draft={draft} />}
              defaultValue={iban}
              codec={optionalIbanCodecs[ibanFormat]}
              // Only saved Czech accounts have two display formats.
              labelAction={
                iban !== null && czechIbanToBban(iban) !== null
                  ? ({ draft }) => (
                      <BankAccountFormatToggle
                        format={ibanFormat}
                        draft={draft}
                        onFormatChange={setIbanFormat}
                      />
                    )
                  : undefined
              }
              errorKey="settings.fiatBankAccount.iban.invalid"
              onSave={(nextIban) => save({ iban: nextIban ?? undefined })}
            />

            <Collapsible>
              <CollapsibleTrigger className="group/advanced-options flex w-full items-center justify-between text-left text-sm font-medium">
                {t("settings.fiatBankAccount.advanced")}
                <ChevronDown
                  className="size-4 transition-transform group-data-[panel-open]/advanced-options:rotate-180"
                  aria-hidden="true"
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden h-(--collapsible-panel-height) transition-[height] duration-200 ease-out data-starting-style:h-0 data-ending-style:h-0">
                <div className="min-h-0 pt-5">
                  <FieldGroup>
                    <InlineEditSelect
                      label={t("settings.fiatBankAccount.currency.label")}
                      defaultValue={currency}
                      codec={fiatCurrencyCodec}
                      options={fiatCurrencyOptions.map((option) => ({
                        value: option.value,
                        label: t(option.label),
                      }))}
                      onSave={(nextCurrency) =>
                        save({ currency: nextCurrency })
                      }
                    />
                    <FieldDescription>
                      {t("settings.fiatBankAccount.currency.description")}
                    </FieldDescription>

                    <InlineEditSelect
                      label={t("settings.fiatBankAccount.qrFormat.label")}
                      defaultValue={defaultQrFormat}
                      codec={bankQrFormatCodec}
                      options={fiatBankAccountQrFormatOptions.map((option) => ({
                        value: option.value,
                        label: t(option.label),
                      }))}
                      onSave={(nextFormat) =>
                        save({ defaultQrFormat: nextFormat })
                      }
                    />
                    <FieldDescription>
                      {t("settings.fiatBankAccount.qrFormat.description")}
                    </FieldDescription>
                  </FieldGroup>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </FieldGroup>
        </CardContent>
      </Card>
      <VerticalNav
        items={[
          ...(showsMonetaPlugin
            ? [
                {
                  kind: "link",
                  to: "/settings/payment-accounts/iban/moneta-plugin",
                  icon: <Plug className="text-muted-foreground" />,
                  label: (
                    <span className="flex flex-col gap-1">
                      <span className="text-sm font-semibold">
                        {t("settings.monetaPlugin.title")}
                      </span>
                      <span className="text-xs leading-snug text-muted-foreground">
                        {t("settings.monetaPlugin.description")}
                      </span>
                      <span className="text-xs font-medium leading-snug">
                        {t(
                          isMonetaPluginOn
                            ? "settings.monetaPlugin.status.on"
                            : "settings.monetaPlugin.status.off"
                        )}
                      </span>
                    </span>
                  ),
                } satisfies VerticalNavItem,
              ]
            : []),
          ...(showsFioPlugin
            ? [
                {
                  kind: "link",
                  to: "/settings/payment-accounts/iban/fio-plugin",
                  icon: <Plug className="text-muted-foreground" />,
                  label: (
                    <span className="flex flex-col gap-1">
                      <span className="text-sm font-semibold">
                        {t("settings.fioPlugin.title")}
                      </span>
                      <span className="text-xs leading-snug text-muted-foreground">
                        {t("settings.fioPlugin.description")}
                      </span>
                      {iban !== null && !isFioBankIban(iban) ? (
                        <span className="flex items-start gap-1.5 text-xs leading-snug text-warning">
                          <TriangleAlert className="size-3.5 shrink-0" />
                          {t("settings.fioPlugin.notFioIbanWarning")}
                        </span>
                      ) : null}
                    </span>
                  ),
                } satisfies VerticalNavItem,
              ]
            : []),
        ]}
      />
    </>
  )
}
