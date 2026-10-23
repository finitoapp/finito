import {
  type CatalogItemFormErrors,
  createPriceCodec,
  parseCatalogItemForm,
} from "@payky/app-shared/catalog-item-form-schema"
import { fiatCurrencyOptions } from "@payky/app-shared/fiat-currency-options"
import {
  NO_OPTION,
  optionalIdCodec,
  optionalTextCodec,
  requiredTextCodec,
} from "@payky/app-shared/inline-edit-codecs"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { getFiatCurrency } from "@payky/core/modules/app-settings/app-settings-utils"
import { catalogCategoriesQuery } from "@payky/core/modules/catalog-category/catalog-category-queries"
import type { CatalogCategoryId } from "@payky/core/modules/catalog-category/catalog-category-types"
import type { CatalogItemRow } from "@payky/core/modules/catalog-item/catalog-item"
import {
  createCatalogItemAtEnd,
  deleteCatalogItem,
  setCatalogItemInMenu,
  setCatalogItemSoldOut,
  updateCatalogItem,
} from "@payky/core/modules/catalog-item/catalog-item-actions"
import {
  catalogItemByIdQuery,
  catalogItemsQuery,
} from "@payky/core/modules/catalog-item/catalog-item-queries"
import {
  CatalogItemId,
  type CatalogItemId as CatalogItemIdType,
} from "@payky/core/modules/catalog-item/catalog-item-types"
import {
  findCatalogItemsByScanCode,
  getStaffDisplayName,
} from "@payky/core/modules/catalog-item/catalog-item-utils"
import {
  FiatCurrencySchema,
  type FiatCurrency as FiatCurrencyType,
} from "@payky/core/modules/shared/schema"
import { taxRatesQuery } from "@payky/core/modules/tax-rate/tax-rate-queries"
import type { TaxRateId } from "@payky/core/modules/tax-rate/tax-rate-types"
import {
  filterSelectableTaxRates,
  formatTaxRateLabel,
} from "@payky/core/modules/tax-rate/tax-rate-utils"
import { useRouter } from "@tanstack/react-router"
import { ScanLineIcon, Trash2Icon } from "lucide-react"
import { useId, useMemo, useState } from "react"
import { z } from "zod"
import { FadeHeader } from "@/components/fade-header.tsx"
import { ScanCodeScannerDialog } from "@/components/scan-code-scanner-dialog.tsx"
import { Button } from "@/components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field.tsx"
import { Input } from "@/components/ui/input.tsx"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx"
import { CatalogFormEmptyState } from "@/features/catalog/catalog-form-empty-state.tsx"
import { FormCard } from "@/features/shared/forms/form-card.tsx"
import { InlineEditField } from "@/features/shared/forms/inline-edit-field.tsx"
import { InlineEditSelect } from "@/features/shared/forms/inline-edit-select.tsx"
import { InlineEditSwitch } from "@/features/shared/forms/inline-edit-switch.tsx"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useIsConfirmDialogOpen } from "@/hooks/use-confirm-dialog.ts"
import { useConfirmedRun } from "@/hooks/use-confirmed-run.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import { useHardwareScanner } from "@/hooks/use-hardware-scanner.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useSettingsForm } from "@/hooks/use-settings-form.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

const categoryCodec = optionalIdCodec<CatalogCategoryId>()
const taxRateCodec = optionalIdCodec<TaxRateId>()
const currencyCodec = FiatCurrencySchema

export function NewCatalogItemPage({
  initialScanCode,
}: {
  /** Prefills the scan code, for an unknown code scanned on the items list. */
  readonly initialScanCode?: string
}) {
  const { t } = useTranslation()
  const { data } = useEvoluQuery(settingsQuery)
  const [settings] = data

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("catalog.items.form.title.create")} />
      <CreateCatalogItemForm
        defaultCurrency={getFiatCurrency(settings)}
        initialScanCode={initialScanCode ?? ""}
      />
    </>
  )
}

export function EditCatalogItemPage({
  catalogItemId,
}: {
  readonly catalogItemId: string
}) {
  const parsedId = CatalogItemId.safeParse(catalogItemId)

  if (!parsedId.success) {
    return (
      <CatalogFormEmptyState
        titleKey="catalog.items.form.title.edit"
        messageKey="catalog.items.form.invalidId"
      />
    )
  }

  return <EditCatalogItemPageContent catalogItemId={parsedId.data} />
}

function EditCatalogItemPageContent({
  catalogItemId,
}: {
  readonly catalogItemId: CatalogItemIdType
}) {
  const { t } = useTranslation()
  const { data } = useEvoluQuery(catalogItemByIdQuery(catalogItemId))
  const [item] = data

  if (item === undefined) {
    return (
      <CatalogFormEmptyState
        titleKey="catalog.items.form.title.edit"
        messageKey="catalog.items.form.notFound"
      />
    )
  }

  return (
    <>
      <div className="h-6" />
      <FadeHeader title={t("catalog.items.form.title.edit")} />
      <EditCatalogItemForm item={item} />
    </>
  )
}

/**
 * The category and tax-rate option lists, which both forms build the same
 * way: the "not set" entry, then the rows that are still selectable.
 */
const useCatalogItemOptions = (currentTaxRateId?: TaxRateId | null) => {
  const { t } = useTranslation()
  const { data: categories } = useEvoluQuery(catalogCategoriesQuery)
  const { data: taxRates } = useEvoluQuery(taxRatesQuery)

  const defaultTaxRate = taxRates.find(
    (rate) => rate.isDefault === 1 && rate.deactivatedAt === null
  )
  const selectableTaxRates = filterSelectableTaxRates(
    taxRates,
    currentTaxRateId
  )

  return {
    defaultTaxRate,
    categoryOptions: [
      { value: NO_OPTION, label: t("catalog.items.form.category.none") },
      ...categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    ],
    taxRateOptions: [
      { value: NO_OPTION, label: t("catalog.items.form.taxRate.none") },
      ...selectableTaxRates.map((taxRate) => ({
        value: taxRate.id,
        label: `${formatTaxRateLabel(taxRate)}${
          taxRate.deactivatedAt !== null
            ? ` — ${t("settings.taxRates.archived.title")}`
            : ""
        }`,
      })),
    ],
  }
}

/**
 * The create form stays a submit-and-navigate form: there is no row to edit
 * in place yet, so it validates every field at once and only then inserts.
 */
function CreateCatalogItemForm({
  defaultCurrency,
  initialScanCode,
}: {
  readonly defaultCurrency: FiatCurrencyType
  readonly initialScanCode: string
}) {
  const runToast = useRunToast()
  const router = useRouter()
  const { t } = useTranslation()
  const formId = useId()
  const { data: catalogItems } = useEvoluQuery(catalogItemsQuery)
  const { defaultTaxRate, categoryOptions, taxRateOptions } =
    useCatalogItemOptions()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [internalName, setInternalName] = useState("")
  const [internalDescription, setInternalDescription] = useState("")
  const [sku, setSku] = useState("")
  const [categoryId, setCategoryId] = useState<CatalogCategoryId | "none">(
    NO_OPTION
  )
  const [taxRateId, setTaxRateId] = useState<TaxRateId | "none">(
    defaultTaxRate?.id ?? NO_OPTION
  )
  const [currency, setCurrency] = useState<FiatCurrencyType>(defaultCurrency)
  const [price, setPrice] = useState("")
  const [scanCode, setScanCode] = useState(initialScanCode)
  const [scannerDialogOpen, setScannerDialogOpen] = useState(false)
  const [errors, setErrors] = useState<CatalogItemFormErrors>({})
  const { pending, saved, resetSaved, submit } = useSettingsForm()
  const isConfirmDialogOpen = useIsConfirmDialogOpen()

  const clearError = (field: keyof CatalogItemFormErrors) => {
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const applyScanCode = (rawValue: string) => {
    setScanCode(rawValue)
    clearError("scanCode")
    resetSaved()
  }
  // Fills the field wherever focus is. A focused scan code field already
  // received the characters and is overwritten with the clean code; the
  // scanner's swallowed Enter keeps any focused field from submitting.
  useHardwareScanner({
    enabled: !scannerDialogOpen && !isConfirmDialogOpen && !pending,
    onScan: applyScanCode,
  })

  // Uniqueness can't be enforced (multiple devices can assign the same code
  // before syncing), so this is a heads-up shown next to the field, not a
  // blocking validation error.
  const scanCodeCollisions = useMemo(
    () => findCatalogItemsByScanCode(catalogItems, scanCode),
    [catalogItems, scanCode]
  )

  return (
    <>
      <FormCard
        title={t("catalog.items.form.card.title")}
        description={t("catalog.items.form.card.description")}
        savedMessage={saved ? t("catalog.items.form.saved.create") : null}
        submitLabel={t("catalog.items.form.save.create")}
        pending={pending}
        onSubmit={(event) => {
          event.preventDefault()
          setErrors({})
          resetSaved()

          const parsed = parseCatalogItemForm(
            {
              name,
              price,
              description,
              internalName,
              internalDescription,
              sku,
              scanCode,
            },
            currency
          )
          if (!parsed.ok) {
            setErrors(parsed.error)
            return
          }
          const values = parsed.value

          void submit(() =>
            runToast(async (run) => {
              await run.ok(
                createCatalogItemAtEnd({
                  deviceId: null,
                  categoryId: categoryId === NO_OPTION ? null : categoryId,
                  name: values.name,
                  description: values.description,
                  internalName: values.internalName,
                  internalDescription: values.internalDescription,
                  sku: values.sku,
                  currency,
                  unitAmount: values.price,
                  scanCode: values.scanCode,
                  taxRateId: taxRateId === NO_OPTION ? null : taxRateId,
                })
              )
              router.history.back()
            })
          )
        }}
      >
        <FieldGroup>
          <Field data-invalid={errors.name !== undefined}>
            <FieldLabel htmlFor={`${formId}-name`}>
              {t("catalog.items.form.name.label")}
            </FieldLabel>
            <Input
              id={`${formId}-name`}
              value={name}
              disabled={pending}
              aria-invalid={errors.name !== undefined}
              autoComplete="off"
              placeholder={t("catalog.items.form.name.placeholder")}
              onChange={(event) => {
                setName(event.currentTarget.value)
                clearError("name")
                resetSaved()
              }}
            />
            <FieldError>{errors.name ? t(errors.name) : null}</FieldError>
          </Field>

          <Field data-invalid={errors.internalName !== undefined}>
            <FieldLabel htmlFor={`${formId}-internalName`}>
              {t("catalog.items.form.internalName.label")}
            </FieldLabel>
            <Input
              id={`${formId}-internalName`}
              value={internalName}
              disabled={pending}
              aria-invalid={errors.internalName !== undefined}
              autoComplete="off"
              placeholder={t("catalog.items.form.internalName.placeholder")}
              onChange={(event) => {
                setInternalName(event.currentTarget.value)
                clearError("internalName")
                resetSaved()
              }}
            />
            <FieldDescription>
              {t("catalog.items.form.internalName.hint")}
            </FieldDescription>
            <FieldError>
              {errors.internalName ? t(errors.internalName) : null}
            </FieldError>
          </Field>

          <Field data-invalid={errors.price !== undefined}>
            <FieldLabel htmlFor={`${formId}-price`}>
              {t("catalog.items.form.price.label")}
            </FieldLabel>
            <div className="flex gap-2">
              <Input
                id={`${formId}-price`}
                value={price}
                disabled={pending}
                aria-invalid={errors.price !== undefined}
                autoComplete="off"
                inputMode="decimal"
                onChange={(event) => {
                  setPrice(event.currentTarget.value)
                  clearError("price")
                  resetSaved()
                }}
              />
              <Select<FiatCurrencyType>
                value={currency}
                onValueChange={(nextCurrency) => {
                  if (nextCurrency === null) return
                  setCurrency(nextCurrency)
                  resetSaved()
                }}
              >
                <SelectTrigger
                  id={`${formId}-currency`}
                  disabled={pending}
                  aria-label={t("catalog.items.form.currency.label")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {fiatCurrencyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.value}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <FieldError>{errors.price ? t(errors.price) : null}</FieldError>
          </Field>

          <Field data-invalid={errors.description !== undefined}>
            <FieldLabel htmlFor={`${formId}-description`}>
              {t("catalog.items.form.description.label")}
            </FieldLabel>
            <Input
              id={`${formId}-description`}
              value={description}
              disabled={pending}
              aria-invalid={errors.description !== undefined}
              autoComplete="off"
              placeholder={t("catalog.items.form.description.placeholder")}
              onChange={(event) => {
                setDescription(event.currentTarget.value)
                clearError("description")
                resetSaved()
              }}
            />
            <FieldError>
              {errors.description ? t(errors.description) : null}
            </FieldError>
          </Field>

          <Field data-invalid={errors.internalDescription !== undefined}>
            <FieldLabel htmlFor={`${formId}-internalDescription`}>
              {t("catalog.items.form.internalDescription.label")}
            </FieldLabel>
            <Input
              id={`${formId}-internalDescription`}
              value={internalDescription}
              disabled={pending}
              aria-invalid={errors.internalDescription !== undefined}
              autoComplete="off"
              placeholder={t(
                "catalog.items.form.internalDescription.placeholder"
              )}
              onChange={(event) => {
                setInternalDescription(event.currentTarget.value)
                clearError("internalDescription")
                resetSaved()
              }}
            />
            <FieldError>
              {errors.internalDescription
                ? t(errors.internalDescription)
                : null}
            </FieldError>
          </Field>

          <Field data-invalid={errors.sku !== undefined}>
            <FieldLabel htmlFor={`${formId}-sku`}>
              {t("catalog.items.form.sku.label")}
            </FieldLabel>
            <Input
              id={`${formId}-sku`}
              value={sku}
              disabled={pending}
              aria-invalid={errors.sku !== undefined}
              autoComplete="off"
              placeholder={t("catalog.items.form.sku.placeholder")}
              onChange={(event) => {
                setSku(event.currentTarget.value)
                clearError("sku")
                resetSaved()
              }}
            />
            <FieldError>{errors.sku ? t(errors.sku) : null}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor={`${formId}-category`}>
              {t("catalog.items.form.category.label")}
            </FieldLabel>
            <Select<CatalogCategoryId | "none">
              items={Object.fromEntries(
                categoryOptions.map((option) => [option.value, option.label])
              )}
              value={categoryId}
              onValueChange={(nextCategoryId) => {
                if (nextCategoryId === null) return
                setCategoryId(nextCategoryId)
                resetSaved()
              }}
            >
              <SelectTrigger id={`${formId}-category`} disabled={pending}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {categoryOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor={`${formId}-taxRate`}>
              {t("catalog.items.form.taxRate.label")}
            </FieldLabel>
            <Select<TaxRateId | "none">
              items={Object.fromEntries(
                taxRateOptions.map((option) => [option.value, option.label])
              )}
              value={taxRateId}
              onValueChange={(nextTaxRateId) => {
                if (nextTaxRateId === null) return
                setTaxRateId(nextTaxRateId)
                resetSaved()
              }}
            >
              <SelectTrigger id={`${formId}-taxRate`} disabled={pending}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {taxRateOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>
              {t("catalog.items.form.taxRate.description")}
            </FieldDescription>
          </Field>

          <Field data-invalid={errors.scanCode !== undefined}>
            <FieldLabel htmlFor={`${formId}-scanCode`}>
              {t("catalog.items.form.scanCode.label")}
            </FieldLabel>
            <div className="relative">
              <Input
                id={`${formId}-scanCode`}
                value={scanCode}
                disabled={pending}
                aria-invalid={errors.scanCode !== undefined}
                autoComplete="off"
                className="pr-12"
                placeholder={t("catalog.items.form.scanCode.placeholder")}
                onChange={(event) => {
                  setScanCode(event.currentTarget.value)
                  clearError("scanCode")
                  resetSaved()
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full"
                aria-label={t("catalog.items.form.scanCode.scan.aria")}
                disabled={pending}
                onClick={() => setScannerDialogOpen(true)}
              >
                <ScanLineIcon />
              </Button>
            </div>
            {errors.scanCode === undefined && scanCodeCollisions.length > 0 && (
              <FieldDescription>
                {t("catalog.items.form.scanCode.duplicate", {
                  name: scanCodeCollisions
                    .map((match) => getStaffDisplayName(match))
                    .join(", "),
                })}
              </FieldDescription>
            )}
            <FieldError>
              {errors.scanCode ? t(errors.scanCode) : null}
            </FieldError>
          </Field>
        </FieldGroup>
      </FormCard>

      <ScanCodeScannerDialog
        open={scannerDialogOpen}
        onOpenChange={setScannerDialogOpen}
        onScan={applyScanCode}
      />
    </>
  )
}

/**
 * The edit form has no submit button: every field saves itself. The row
 * already exists, so each change is an independent update and there is
 * nothing to validate across fields.
 */
function EditCatalogItemForm({ item }: { readonly item: CatalogItemRow }) {
  const appRun = useAppRun()
  const confirmedRun = useConfirmedRun()
  const router = useRouter()
  const { t } = useTranslation()
  const { data: catalogItems } = useEvoluQuery(catalogItemsQuery)
  const { categoryOptions, taxRateOptions } = useCatalogItemOptions(
    item.taxRateId
  )
  const [scannerDialogOpen, setScannerDialogOpen] = useState(false)
  const isConfirmDialogOpen = useIsConfirmDialogOpen()

  // How many minor units the price means depends on the currency next to it,
  // so the codec is rebuilt whenever that changes.
  const priceCodec = useMemo(
    () => createPriceCodec(item.currency),
    [item.currency]
  )

  // `updateCatalogItem` is a `Task<_, never>`: its only realistic failure is
  // unexpected infrastructure. `run.ok` throws on any non-ok result too (a
  // disposed run), and the inline-edit controls turn the throw into the toast
  // and withhold their saved tick.
  const saveItem = async (
    values: Omit<Parameters<typeof updateCatalogItem>[0], "id">
  ) => {
    await using run = appRun()
    await run.ok(updateCatalogItem({ id: item.id, ...values }))
  }

  const applyScanCode = (rawValue: string) => {
    const parsed = z.safeDecode(optionalTextCodec, rawValue)
    if (!parsed.success) return
    void saveItem({ scanCode: parsed.data })
  }
  useHardwareScanner({
    enabled: !scannerDialogOpen && !isConfirmDialogOpen,
    onScan: applyScanCode,
  })

  // Uniqueness can't be enforced (multiple devices can assign the same code
  // before syncing), so this is a heads-up shown next to the field, not a
  // blocking validation error.
  const scanCodeCollisions = useMemo(
    () =>
      findCatalogItemsByScanCode(catalogItems, item.scanCode ?? "").filter(
        (match) => match.id !== item.id
      ),
    [catalogItems, item.scanCode, item.id]
  )

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>{t("catalog.items.form.card.title")}</CardTitle>
          <CardDescription>
            {t("catalog.items.form.card.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <InlineEditField
              label={t("catalog.items.form.name.label")}
              placeholder={t("catalog.items.form.name.placeholder")}
              defaultValue={item.name}
              codec={requiredTextCodec}
              errorKey="catalog.items.form.name.invalid"
              onSave={(name) => saveItem({ name })}
            />

            <InlineEditField
              label={t("catalog.items.form.internalName.label")}
              description={t("catalog.items.form.internalName.hint")}
              placeholder={t("catalog.items.form.internalName.placeholder")}
              defaultValue={item.internalName}
              codec={optionalTextCodec}
              errorKey="catalog.items.form.internalName.invalid"
              onSave={(internalName) => saveItem({ internalName })}
            />

            <InlineEditField
              label={t("catalog.items.form.price.label")}
              inputMode="decimal"
              defaultValue={item.unitAmount}
              codec={priceCodec}
              errorKey="catalog.items.form.price.invalid"
              onSave={(unitAmount) => saveItem({ unitAmount })}
            />

            <InlineEditSelect
              label={t("catalog.items.form.currency.label")}
              defaultValue={item.currency}
              codec={currencyCodec}
              options={fiatCurrencyOptions.map((option) => ({
                value: option.value,
                label: option.value,
              }))}
              onSave={(currency) => saveItem({ currency })}
            />

            <InlineEditField
              label={t("catalog.items.form.description.label")}
              placeholder={t("catalog.items.form.description.placeholder")}
              defaultValue={item.description}
              codec={optionalTextCodec}
              errorKey="catalog.items.form.description.invalid"
              onSave={(description) => saveItem({ description })}
            />

            <InlineEditField
              label={t("catalog.items.form.internalDescription.label")}
              placeholder={t(
                "catalog.items.form.internalDescription.placeholder"
              )}
              defaultValue={item.internalDescription}
              codec={optionalTextCodec}
              errorKey="catalog.items.form.internalDescription.invalid"
              onSave={(internalDescription) =>
                saveItem({ internalDescription })
              }
            />

            <InlineEditField
              label={t("catalog.items.form.sku.label")}
              placeholder={t("catalog.items.form.sku.placeholder")}
              defaultValue={item.sku}
              codec={optionalTextCodec}
              errorKey="catalog.items.form.sku.invalid"
              onSave={(sku) => saveItem({ sku })}
            />

            <InlineEditSelect
              label={t("catalog.items.form.category.label")}
              defaultValue={item.categoryId}
              codec={categoryCodec}
              options={categoryOptions}
              onSave={(categoryId) => saveItem({ categoryId })}
            />

            <InlineEditSelect
              label={t("catalog.items.form.taxRate.label")}
              description={t("catalog.items.form.taxRate.description")}
              defaultValue={item.taxRateId}
              codec={taxRateCodec}
              options={taxRateOptions}
              onSave={(taxRateId) => saveItem({ taxRateId })}
            />

            <InlineEditField
              label={t("catalog.items.form.scanCode.label")}
              description={
                scanCodeCollisions.length > 0
                  ? t("catalog.items.form.scanCode.duplicate", {
                      name: scanCodeCollisions
                        .map((match) => getStaffDisplayName(match))
                        .join(", "),
                    })
                  : undefined
              }
              placeholder={t("catalog.items.form.scanCode.placeholder")}
              defaultValue={item.scanCode}
              codec={optionalTextCodec}
              errorKey="catalog.items.form.scanCode.invalid"
              // Scanning bypasses the edit mode entirely: the scanner already
              // confirmed the value, so there is nothing left to confirm.
              trailing={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full"
                  aria-label={t("catalog.items.form.scanCode.scan.aria")}
                  onClick={() => setScannerDialogOpen(true)}
                >
                  <ScanLineIcon />
                </Button>
              }
              onSave={(scanCode) => saveItem({ scanCode })}
            />
          </FieldGroup>
        </CardContent>
      </Card>

      <CatalogItemMenuCard item={item} />

      <ScanCodeScannerDialog
        open={scannerDialogOpen}
        onOpenChange={setScannerDialogOpen}
        onScan={applyScanCode}
      />

      <Button
        variant="destructive"
        onClick={() => {
          void (async () => {
            const deleted = await confirmedRun(
              {
                title: t("catalog.items.delete.confirm.title", {
                  name: getStaffDisplayName(item),
                }),
                description: t("catalog.items.delete.confirm.description", {
                  name: getStaffDisplayName(item),
                }),
                confirmLabel: t("catalog.items.delete.confirm.confirm"),
                cancelLabel: t("catalog.items.delete.confirm.cancel"),
                variant: "destructive",
              },
              deleteCatalogItem(item.id)
            )
            if (deleted) router.history.back()
          })()
        }}
      >
        <Trash2Icon data-icon="inline-start" />
        {t("catalog.items.delete")}
      </Button>
    </div>
  )
}

function CatalogItemMenuCard({ item }: { readonly item: CatalogItemRow }) {
  const { t } = useTranslation()
  const appRun = useAppRun()
  const inMenu = item.inMenu !== null

  const saveInMenu = async (checked: boolean) => {
    await using run = appRun()
    await run.ok(setCatalogItemInMenu({ id: item.id, inMenu: checked }))
  }

  const saveSoldOut = async (checked: boolean) => {
    await using run = appRun()
    await run.ok(setCatalogItemSoldOut({ id: item.id, soldOut: checked }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("catalog.items.form.menu.title")}</CardTitle>
        <CardDescription>
          {t("catalog.items.form.menu.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <InlineEditSwitch
          label={t("catalog.items.form.inMenu.label")}
          defaultValue={inMenu}
          onSave={saveInMenu}
        />
        {inMenu && (
          <InlineEditSwitch
            label={t("catalog.items.form.soldOut.label")}
            description={t("catalog.items.form.soldOut.description")}
            defaultValue={item.soldOut !== null}
            onSave={saveSoldOut}
          />
        )}
      </CardContent>
    </Card>
  )
}
