import {
  type BankAccountDisplayFormat,
  czechBankForDraft,
  fiatBankAccountQrFormatOptions,
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
import type { FiatCurrency, Iban } from "@payky/core/modules/shared/schema"
import Plug from "lucide-react-native/icons/plug"
import TriangleAlert from "lucide-react-native/icons/triangle-alert"
import { useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { InlineEditField } from "../../../components/inline-edit-field.tsx"
import { Screen } from "../../../components/screen.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import {
  Collapsible,
  CollapsibleChevron,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../components/ui/collapsible.tsx"
import { FieldDescription, FieldGroup } from "../../../components/ui/field.tsx"
import { Icon } from "../../../components/ui/icon.tsx"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select.tsx"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "../../../components/ui/toggle-group.tsx"
import {
  VerticalNav,
  type VerticalNavItem,
} from "../../../components/vertical-nav.tsx"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useInlineChoice } from "../../../hooks/use-inline-choice.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"

/**
 * The bank transfer account, as web's `FiatBankAccountSettingsPage`: the IBAN
 * (or a Czech account number, normalized to IBAN), its currency and the QR
 * format. Each control writes at once; since `saveFiatBankAccount` upserts the
 * whole row, each sends the current settings with its own field replaced.
 */
export function FiatBankAccountSettingsPage() {
  const runToast = useRunToast()
  const { t } = useTranslation()
  const [account] = useEvoluQuery(fiatBankAccountQuery).data
  const [settings] = useEvoluQuery(settingsQuery).data
  const [ibanFormat, setIbanFormat] = useState<BankAccountDisplayFormat>("bban")

  const iban = account?.iban ?? null
  const [monetaPlugin] = useEvoluQuery(fiatBankAccountMonetaPluginQuery).data
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
  // The bank a saved Czech account belongs to.
  const bank = iban === null ? undefined : czechBankForDraft(iban)

  const save = (changed: {
    readonly iban?: Iban
    readonly currency?: FiatCurrency
    readonly defaultQrFormat?: BankQrFormat
  }) =>
    runToast(async (run) => {
      await run.ok(
        saveFiatBankAccount({
          enabled,
          iban: changed.iban ?? iban ?? undefined,
          currency: changed.currency ?? currency,
          defaultQrFormat: changed.defaultQrFormat ?? defaultQrFormat,
        })
      )
    })

  const currencyChoice = useInlineChoice(currency, (next) =>
    save({ currency: next })
  )
  const qrFormatChoice = useInlineChoice(defaultQrFormat, (next) =>
    save({ defaultQrFormat: next })
  )

  return (
    <Screen>
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
              description={
                bank === undefined
                  ? t("settings.fiatBankAccount.iban.description")
                  : `${bank ?? t("settings.fiatBankAccount.iban.unknownBank")}\n${t("settings.fiatBankAccount.iban.description")}`
              }
              defaultValue={iban}
              codec={optionalIbanCodecs[ibanFormat]}
              errorKey="settings.fiatBankAccount.iban.invalid"
              labelAction={
                iban !== null && czechIbanToBban(iban) !== null ? (
                  <ToggleGroup
                    size="sm"
                    variant="outline"
                    spacing={0}
                    value={ibanFormat}
                    onValueChange={setIbanFormat}
                  >
                    {[
                      {
                        value: "bban",
                        title: t("settings.fiatBankAccount.iban.format.bban"),
                      },
                      {
                        value: "iban",
                        title: t("settings.fiatBankAccount.iban.format.iban"),
                      },
                    ].map((option) => (
                      <ToggleGroupItem key={option.value} value={option.value}>
                        {option.title}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                ) : undefined
              }
              onSave={(nextIban) => save({ iban: nextIban ?? undefined })}
            />
            <Collapsible>
              <CollapsibleTrigger>
                <AdvancedSettingsLabel
                  label={t("settings.fiatBankAccount.advanced")}
                />
              </CollapsibleTrigger>
              <CollapsibleContent pt="4">
                <FieldGroup>
                  <YStack gap="2">
                    <Text fontSize="sm" lineHeight="sm" fontWeight="600">
                      {t("settings.fiatBankAccount.currency.label")}
                    </Text>
                    <Select
                      value={currencyChoice.value}
                      onValueChange={(next) => {
                        void currencyChoice.choose(next)
                      }}
                      items={Object.fromEntries(
                        fiatCurrencyOptions.map((option) => [
                          option.value,
                          t(option.label),
                        ])
                      )}
                    >
                      <SelectTrigger
                        fullWidth
                        aria-label={t(
                          "settings.fiatBankAccount.currency.label"
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                        title={t("settings.fiatBankAccount.currency.label")}
                      >
                        {fiatCurrencyOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.label)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      {t("settings.fiatBankAccount.currency.description")}
                    </FieldDescription>
                  </YStack>
                  <YStack gap="2">
                    <Text fontSize="sm" lineHeight="sm" fontWeight="600">
                      {t("settings.fiatBankAccount.qrFormat.label")}
                    </Text>
                    <Select
                      value={qrFormatChoice.value}
                      onValueChange={(next) => {
                        void qrFormatChoice.choose(next)
                      }}
                      items={Object.fromEntries(
                        fiatBankAccountQrFormatOptions.map((option) => [
                          option.value,
                          t(option.label),
                        ])
                      )}
                    >
                      <SelectTrigger
                        fullWidth
                        aria-label={t(
                          "settings.fiatBankAccount.qrFormat.label"
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                        title={t("settings.fiatBankAccount.qrFormat.label")}
                      >
                        {fiatBankAccountQrFormatOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.label)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      {t("settings.fiatBankAccount.qrFormat.description")}
                    </FieldDescription>
                  </YStack>
                </FieldGroup>
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
                  href: "/settings/payment-accounts/iban/moneta-plugin",
                  icon: <Icon icon={Plug} color="muted-foreground" />,
                  label: (
                    <YStack gap="1">
                      <Text fontSize="sm" lineHeight="sm" fontWeight="600">
                        {t("settings.monetaPlugin.title")}
                      </Text>
                      <Text fontSize={13} color="muted-foreground">
                        {t("settings.monetaPlugin.description")}
                      </Text>
                      <Text fontSize={13} fontWeight="600">
                        {t(
                          isMonetaPluginOn
                            ? "settings.monetaPlugin.status.on"
                            : "settings.monetaPlugin.status.off"
                        )}
                      </Text>
                    </YStack>
                  ),
                } satisfies VerticalNavItem,
              ]
            : []),
          ...(showsFioPlugin
            ? [
                {
                  kind: "link",
                  href: "/settings/payment-accounts/iban/fio-plugin",
                  icon: <Icon icon={Plug} color="muted-foreground" />,
                  label: (
                    <YStack gap="1">
                      <Text fontSize="sm" lineHeight="sm" fontWeight="600">
                        {t("settings.fioPlugin.title")}
                      </Text>
                      <Text fontSize={13} color="muted-foreground">
                        {t("settings.fioPlugin.description")}
                      </Text>
                      {iban !== null && !isFioBankIban(iban) ? (
                        <XStack items="flex-start" gap="1">
                          <Icon
                            icon={TriangleAlert}
                            size={14}
                            color="warning"
                          />
                          <Text flex={1} fontSize={13} color="warning">
                            {t("settings.fioPlugin.notFioIbanWarning")}
                          </Text>
                        </XStack>
                      ) : null}
                    </YStack>
                  ),
                } satisfies VerticalNavItem,
              ]
            : []),
        ]}
      />
    </Screen>
  )
}

function AdvancedSettingsLabel({ label }: { readonly label: string }) {
  return (
    <XStack items="center" justify="space-between" w="100%">
      <Text fontSize="sm" lineHeight="sm" fontWeight="600">
        {label}
      </Text>
      <CollapsibleChevron color="muted-foreground" />
    </XStack>
  )
}
