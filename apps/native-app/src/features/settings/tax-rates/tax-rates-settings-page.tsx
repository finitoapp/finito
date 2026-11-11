import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  NO_OPTION,
  optionalIdCodec,
  requiredTextCodec,
} from "@payky/app-shared/inline-edit-codecs"
import { parseTaxRateForm } from "@payky/app-shared/tax-rate-form"
import { setKeypadTaxRate } from "@payky/core/modules/app-settings/app-settings-actions"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { legalEntityQuery } from "@payky/core/modules/legal-entity/legal-entity-queries"
import { isVatPayer } from "@payky/core/modules/legal-entity/legal-entity-utils"
import type { TaxRateRow } from "@payky/core/modules/tax-rate/tax-rate"
import {
  activateTaxRate,
  archiveTaxRate,
  createTaxRate,
  renameTaxRate,
  setDefaultTaxRate,
} from "@payky/core/modules/tax-rate/tax-rate-actions"
import { taxRatesQuery } from "@payky/core/modules/tax-rate/tax-rate-queries"
import type { TaxRateId } from "@payky/core/modules/tax-rate/tax-rate-types"
import {
  filterSelectableTaxRates,
  formatTaxRateLabel,
  taxRatePercentageToDecimalString,
} from "@payky/core/modules/tax-rate/tax-rate-utils"
import Archive from "lucide-react-native/icons/archive"
import ArchiveRestore from "lucide-react-native/icons/archive-restore"
import Pencil from "lucide-react-native/icons/pencil"
import Plus from "lucide-react-native/icons/plus"
import Star from "lucide-react-native/icons/star"
import { type ComponentProps, useState } from "react"
import { Text, XStack, YStack } from "tamagui"
import { z } from "zod"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { InlineEditField } from "../../../components/inline-edit-field.tsx"
import { Screen } from "../../../components/screen.tsx"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "../../../components/ui/field.tsx"
import { Input } from "../../../components/ui/input.tsx"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select.tsx"
import { useConfirm } from "../../../hooks/use-confirm.ts"
import {
  useEvoluQuery,
  usePreloadEvoluQueries,
} from "../../../hooks/use-evolu-query.ts"
import { useInlineChoice } from "../../../hooks/use-inline-choice.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"

const keypadTaxRateCodec = optionalIdCodec<TaxRateId>()

/** What the screen reads: the rates, and for a VAT payer the keypad's rate. */
const taxRatesSettingsPageQueries = [
  taxRatesQuery,
  legalEntityQuery,
  settingsQuery,
]

/** Tax rates, as web's `TaxRatesSettingsPage`; every change is written at once. */
export function TaxRatesSettingsPage() {
  usePreloadEvoluQueries(taxRatesSettingsPageQueries)
  const { t } = useTranslation()
  const { data: taxRates } = useEvoluQuery(taxRatesQuery)
  const [legalEntity] = useEvoluQuery(legalEntityQuery).data
  const activeTaxRates = taxRates.filter((rate) => rate.deactivatedAt === null)
  const archivedTaxRates = taxRates.filter(
    (rate) => rate.deactivatedAt !== null
  )

  return (
    <Screen>
      <FadeHeader title={t("settings.taxRates.title")} />
      <YStack gap={20}>
        <Card>
          <CardHeader>
            <CardDescription>
              {t("settings.taxRates.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeTaxRates.length === 0 ? (
              <Text py={16} color="muted-foreground" text="center">
                {t("settings.taxRates.empty")}
              </Text>
            ) : (
              <YStack rounded="lg" bg="neutral-soft" overflow="hidden">
                {activeTaxRates.map((taxRate) => (
                  <TaxRateRowItem key={taxRate.id} taxRate={taxRate} />
                ))}
              </YStack>
            )}
          </CardContent>
        </Card>

        {isVatPayer(legalEntity) && <KeypadTaxRateCard taxRates={taxRates} />}

        <NewTaxRateForm />

        {archivedTaxRates.length > 0 && (
          <Card>
            <CardHeader>
              <Text fontSize="sm" lineHeight="sm" fontWeight="600">
                {t("settings.taxRates.archived.title")}
              </Text>
            </CardHeader>
            <CardContent>
              <YStack rounded="lg" bg="neutral-soft" overflow="hidden">
                {archivedTaxRates.map((taxRate) => (
                  <TaxRateRowItem key={taxRate.id} taxRate={taxRate} />
                ))}
              </YStack>
            </CardContent>
          </Card>
        )}
      </YStack>
    </Screen>
  )
}

function RowAction({
  iconStart,
  label,
  disabled,
  variant = "ghost",
  onPress,
}: {
  readonly iconStart: ComponentProps<typeof Button>["iconStart"]
  /** Already translated. */
  readonly label: string
  readonly disabled: boolean
  readonly variant?: ComponentProps<typeof Button>["variant"]
  readonly onPress: () => void
}) {
  return (
    <Button
      size="icon-sm"
      variant={variant}
      aria-label={label}
      disabled={disabled}
      iconStart={iconStart}
      onPress={onPress}
    />
  )
}

function TaxRateRowItem({ taxRate }: { readonly taxRate: TaxRateRow }) {
  const confirm = useConfirm()
  const runToast = useRunToast()
  const { t } = useTranslation()
  const isArchived = taxRate.deactivatedAt !== null
  const isDefault = taxRate.isDefault === 1
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState(false)
  const name = { name: taxRate.name }

  const act = async (
    action: Parameters<typeof runToast>[0],
    confirmation?: {
      readonly key: "archive" | "activate"
    }
  ) => {
    if (confirmation !== undefined) {
      const prefix = `settings.taxRates.${confirmation.key}.confirm` as const
      const confirmed = await confirm({
        title: t(`${prefix}.title`, name),
        description: t(`${prefix}.description`, name),
        confirmLabel: t(`${prefix}.confirm`),
        cancelLabel: t(`${prefix}.cancel`),
        ...(confirmation.key === "archive" ? { variant: "destructive" } : {}),
      })
      if (!confirmed) return
    }
    setPending(true)
    await runToast(action)
    setPending(false)
  }

  if (editing) {
    return (
      <YStack px={12} py={8}>
        <InlineEditField
          startEditing
          label={t("settings.taxRates.rename.input", name)}
          defaultValue={taxRate.name}
          codec={requiredTextCodec}
          errorKey="settings.taxRates.name.invalid"
          onSave={(next) =>
            runToast(async (run) => {
              await run.ok(renameTaxRate({ id: taxRate.id, name: next }))
            })
          }
          onEditFinished={() => setEditing(false)}
        />
      </YStack>
    )
  }

  return (
    <XStack items="center" justify="space-between" gap="1" px={12} py={8}>
      <YStack flex={1}>
        <Text fontSize="sm" lineHeight="sm" fontWeight="600" numberOfLines={1}>
          {taxRate.name}
        </Text>
        <Text fontSize="xs" lineHeight="xs" color="muted-foreground">
          {taxRatePercentageToDecimalString(taxRate.rate)}%
        </Text>
      </YStack>
      {!isArchived && (
        <RowAction
          iconStart={Star}
          label={t(
            isDefault
              ? "settings.taxRates.default.unset"
              : "settings.taxRates.default.set",
            name
          )}
          disabled={pending}
          variant={isDefault ? "secondary" : "ghost"}
          onPress={() => {
            void act(async (run) => {
              await run.ok(setDefaultTaxRate(isDefault ? null : taxRate.id))
            })
          }}
        />
      )}
      {!isArchived && (
        <RowAction
          iconStart={Pencil}
          label={t("settings.taxRates.rename", name)}
          disabled={pending}
          onPress={() => setEditing(true)}
        />
      )}
      {isArchived ? (
        <RowAction
          iconStart={ArchiveRestore}
          label={t("settings.taxRates.activate", name)}
          disabled={pending}
          onPress={() => {
            void act(
              async (run) => {
                await run.ok(activateTaxRate(taxRate.id))
              },
              { key: "activate" }
            )
          }}
        />
      ) : (
        <RowAction
          iconStart={Archive}
          label={t("settings.taxRates.archive", name)}
          disabled={pending}
          onPress={() => {
            void act(
              async (run) => {
                await run.ok(archiveTaxRate(taxRate.id))
              },
              { key: "archive" }
            )
          }}
        />
      )}
    </XStack>
  )
}

/**
 * The rate a VAT payer's keypad amount is sold at, as web's
 * `KeypadTaxRateCard`. A rate that is gone, or not synced to this device
 * yet, reads as not set, as it does for the Qerko receipt.
 */
function KeypadTaxRateCard({
  taxRates,
}: {
  readonly taxRates: ReadonlyArray<TaxRateRow>
}) {
  const runToast = useRunToast()
  const { t } = useTranslation()
  const [settings] = useEvoluQuery(settingsQuery).data
  const keypadTaxRateId =
    taxRates.find((rate) => rate.id === settings?.keypadTaxRateId)?.id ?? null
  const keypadTaxRate = useInlineChoice(keypadTaxRateId, (next) =>
    runToast(async (run) => {
      await run.ok(setKeypadTaxRate(next))
    })
  )
  const options = [
    { value: NO_OPTION, title: t("settings.taxRates.keypad.none") },
    ...filterSelectableTaxRates(taxRates, keypadTaxRateId).map((rate) => ({
      value: rate.id,
      title: `${formatTaxRateLabel(rate)}${
        rate.deactivatedAt === null
          ? ""
          : ` — ${t("settings.taxRates.archived.title")}`
      }`,
    })),
  ]

  return (
    <Card>
      <CardContent>
        <Field>
          <FieldLabel>{t("settings.taxRates.keypad.label")}</FieldLabel>
          <Select
            value={z.encode(keypadTaxRateCodec, keypadTaxRate.value)}
            disabled={keypadTaxRate.saving}
            onValueChange={(value) =>
              void keypadTaxRate.choose(
                z.safeDecode(keypadTaxRateCodec, value).data ?? null
              )
            }
            items={Object.fromEntries(
              options.map((option) => [option.value, option.title])
            )}
          >
            <SelectTrigger
              fullWidth
              aria-label={t("settings.taxRates.keypad.label")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent title={t("settings.taxRates.keypad.label")}>
              <SelectGroup>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.title}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldDescription>
            {t("settings.taxRates.keypad.description")}
          </FieldDescription>
        </Field>
      </CardContent>
    </Card>
  )
}

function NewTaxRateForm() {
  const runToast = useRunToast()
  const { t } = useTranslation()
  const [name, setName] = useState("")
  const [rateInput, setRateInput] = useState("")
  const [nameError, setNameError] = useState<TranslationKey | null>(null)
  const [rateError, setRateError] = useState<TranslationKey | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async () => {
    setNameError(null)
    setRateError(null)
    const form = parseTaxRateForm({ name, rate: rateInput })
    if (!form.ok) {
      if (form.field === "name") setNameError(form.errorKey)
      else setRateError(form.errorKey)
      return
    }
    setPending(true)
    const succeeded = await runToast(async (run) => {
      await run.ok(
        createTaxRate({ name: form.name, rate: form.rate, isDefault: false })
      )
    })
    setPending(false)
    if (succeeded) {
      setName("")
      setRateInput("")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle size="sm">{t("settings.taxRates.add.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>{t("settings.taxRates.name.label")}</FieldLabel>
            <Input
              value={name}
              disabled={pending}
              autoCorrect={false}
              invalid={nameError !== null}
              placeholder={t("settings.taxRates.name.placeholder")}
              onChangeText={(text) => {
                setName(text)
                setNameError(null)
              }}
            />
            <FieldError>
              {nameError === null ? undefined : t(nameError)}
            </FieldError>
          </Field>
          <Field>
            <FieldLabel>{t("settings.taxRates.rate.label")}</FieldLabel>
            <Input
              value={rateInput}
              disabled={pending}
              keyboardType="decimal-pad"
              invalid={rateError !== null}
              placeholder="21"
              onChangeText={(text) => {
                setRateInput(text)
                setRateError(null)
              }}
            />
            <FieldDescription>
              {t("settings.taxRates.rate.description")}
            </FieldDescription>
            <FieldError>
              {rateError === null ? undefined : t(rateError)}
            </FieldError>
          </Field>
          <Button
            label={t("settings.taxRates.add")}
            iconStart={Plus}
            pending={pending}
            onPress={() => {
              void submit()
            }}
          />
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
