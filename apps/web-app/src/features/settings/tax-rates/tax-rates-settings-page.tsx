import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { requiredTextCodec } from "@payky/app-shared/inline-edit-codecs"
import { parseTaxRateForm } from "@payky/app-shared/tax-rate-form"
import type { TaxRateRow } from "@payky/core/modules/tax-rate/tax-rate"
import {
  activateTaxRate,
  archiveTaxRate,
  createTaxRate,
  renameTaxRate,
  setDefaultTaxRate,
} from "@payky/core/modules/tax-rate/tax-rate-actions"
import { taxRatesQuery } from "@payky/core/modules/tax-rate/tax-rate-queries"
import { taxRatePercentageToDecimalString } from "@payky/core/modules/tax-rate/tax-rate-utils"
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  PencilIcon,
  PlusIcon,
  StarIcon,
} from "lucide-react"
import { useId, useState } from "react"
import { FadeHeader } from "@/components/fade-header.tsx"
import { Button } from "@/components/ui/button.tsx"
import { Card, CardContent, CardHeader } from "@/components/ui/card.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field.tsx"
import { Input } from "@/components/ui/input.tsx"
import { InlineEditField } from "@/features/shared/forms/inline-edit-field.tsx"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

export function TaxRatesSettingsPage() {
  const { t } = useTranslation()
  const { data: taxRates } = useEvoluQuery(taxRatesQuery)
  const activeTaxRates = taxRates.filter((rate) => rate.deactivatedAt === null)
  const archivedTaxRates = taxRates.filter(
    (rate) => rate.deactivatedAt !== null
  )

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("settings.taxRates.title")} />

      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">
              {t("settings.taxRates.description")}
            </p>
          </CardHeader>
          <CardContent>
            {activeTaxRates.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t("settings.taxRates.empty")}
              </p>
            ) : (
              <div className="flex flex-col divide-y rounded-lg border">
                {activeTaxRates.map((taxRate) => (
                  <TaxRateRowItem key={taxRate.id} taxRate={taxRate} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <NewTaxRateCard />

        {archivedTaxRates.length > 0 && (
          <Card>
            <CardHeader>
              <p className="text-sm font-medium">
                {t("settings.taxRates.archived.title")}
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col divide-y rounded-lg border">
                {archivedTaxRates.map((taxRate) => (
                  <TaxRateRowItem key={taxRate.id} taxRate={taxRate} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}

function TaxRateRowItem({ taxRate }: { readonly taxRate: TaxRateRow }) {
  const appRun = useAppRun()
  const confirm = useConfirmDialog()
  const runToast = useRunToast()
  const { t } = useTranslation()
  const isArchived = taxRate.deactivatedAt !== null
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState(false)

  if (editing) {
    // The label is the field's accessible name only: the row around it
    // already says which rate this is.
    return (
      <div className="px-3 py-2">
        <InlineEditField
          hideLabel
          startEditing
          label={t("settings.taxRates.rename.input", { name: taxRate.name })}
          defaultValue={taxRate.name}
          codec={requiredTextCodec}
          errorKey="settings.taxRates.name.invalid"
          onSave={async (name) => {
            await using run = appRun()
            await run.ok(renameTaxRate({ id: taxRate.id, name }))
          }}
          onEditFinished={() => {
            setEditing(false)
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{taxRate.name}</span>
        <span className="text-xs text-muted-foreground">
          {taxRatePercentageToDecimalString(taxRate.rate)}%
        </span>
      </div>
      <div className="flex items-center gap-1">
        {!isArchived && (
          <Button
            type="button"
            variant={taxRate.isDefault === 1 ? "secondary" : "ghost"}
            size="icon-sm"
            disabled={pending}
            aria-label={
              taxRate.isDefault === 1
                ? t("settings.taxRates.default.unset", { name: taxRate.name })
                : t("settings.taxRates.default.set", { name: taxRate.name })
            }
            onClick={() => {
              void (async () => {
                setPending(true)
                await runToast(async (run) => {
                  await run.ok(
                    setDefaultTaxRate(
                      taxRate.isDefault === 1 ? null : taxRate.id
                    )
                  )
                })
                setPending(false)
              })()
            }}
          >
            <StarIcon
              className={taxRate.isDefault === 1 ? "fill-current" : undefined}
            />
          </Button>
        )}
        {!isArchived && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            aria-label={t("settings.taxRates.rename", { name: taxRate.name })}
            onClick={() => {
              setEditing(true)
            }}
          >
            <PencilIcon />
          </Button>
        )}
        {isArchived ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            aria-label={t("settings.taxRates.activate", {
              name: taxRate.name,
            })}
            onClick={() => {
              void (async () => {
                const confirmed = await confirm({
                  title: t("settings.taxRates.activate.confirm.title", {
                    name: taxRate.name,
                  }),
                  description: t(
                    "settings.taxRates.activate.confirm.description",
                    { name: taxRate.name }
                  ),
                  confirmLabel: t("settings.taxRates.activate.confirm.confirm"),
                  cancelLabel: t("settings.taxRates.activate.confirm.cancel"),
                })
                if (!confirmed) return

                setPending(true)
                await runToast(async (run) => {
                  await run.ok(activateTaxRate(taxRate.id))
                })
                setPending(false)
              })()
            }}
          >
            <ArchiveRestoreIcon />
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            aria-label={t("settings.taxRates.archive", {
              name: taxRate.name,
            })}
            onClick={() => {
              void (async () => {
                const confirmed = await confirm({
                  title: t("settings.taxRates.archive.confirm.title", {
                    name: taxRate.name,
                  }),
                  description: t(
                    "settings.taxRates.archive.confirm.description",
                    { name: taxRate.name }
                  ),
                  confirmLabel: t("settings.taxRates.archive.confirm.confirm"),
                  cancelLabel: t("settings.taxRates.archive.confirm.cancel"),
                  variant: "destructive",
                })
                if (!confirmed) return

                setPending(true)
                await runToast(async (run) => {
                  await run.ok(archiveTaxRate(taxRate.id))
                })
                setPending(false)
              })()
            }}
          >
            <ArchiveIcon />
          </Button>
        )}
      </div>
    </div>
  )
}

function NewTaxRateCard() {
  const runToast = useRunToast()
  const { t } = useTranslation()
  const formId = useId()
  const [name, setName] = useState("")
  const [rateInput, setRateInput] = useState("")
  const [nameError, setNameError] = useState<TranslationKey | null>(null)
  const [rateError, setRateError] = useState<TranslationKey | null>(null)
  const [pending, setPending] = useState(false)

  return (
    <Card>
      <CardHeader>
        <p className="text-sm font-medium">
          {t("settings.taxRates.add.title")}
        </p>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            setNameError(null)
            setRateError(null)

            const form = parseTaxRateForm({ name, rate: rateInput })
            if (!form.ok) {
              if (form.field === "name") setNameError(form.errorKey)
              else setRateError(form.errorKey)
              return
            }

            void (async () => {
              setPending(true)
              const succeeded = await runToast(async (run) => {
                await run.ok(
                  createTaxRate({
                    name: form.name,
                    rate: form.rate,
                    isDefault: false,
                  })
                )
              })
              setPending(false)
              if (succeeded) {
                setName("")
                setRateInput("")
              }
            })()
          }}
        >
          <FieldGroup>
            <Field data-invalid={nameError !== null}>
              <FieldLabel htmlFor={`${formId}-name`}>
                {t("settings.taxRates.name.label")}
              </FieldLabel>
              <Input
                id={`${formId}-name`}
                value={name}
                disabled={pending}
                aria-invalid={nameError !== null}
                autoComplete="off"
                placeholder={t("settings.taxRates.name.placeholder")}
                onChange={(event) => {
                  setName(event.currentTarget.value)
                  setNameError(null)
                }}
              />
              <FieldError>{nameError ? t(nameError) : null}</FieldError>
            </Field>

            <Field data-invalid={rateError !== null}>
              <FieldLabel htmlFor={`${formId}-rate`}>
                {t("settings.taxRates.rate.label")}
              </FieldLabel>
              <Input
                id={`${formId}-rate`}
                value={rateInput}
                disabled={pending}
                aria-invalid={rateError !== null}
                autoComplete="off"
                inputMode="decimal"
                placeholder="21"
                onChange={(event) => {
                  setRateInput(event.currentTarget.value)
                  setRateError(null)
                }}
              />
              <FieldDescription>
                {t("settings.taxRates.rate.description")}
              </FieldDescription>
              <FieldError>{rateError ? t(rateError) : null}</FieldError>
            </Field>

            <Button type="submit" disabled={pending}>
              <PlusIcon data-icon="inline-start" />
              {t("settings.taxRates.add")}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
