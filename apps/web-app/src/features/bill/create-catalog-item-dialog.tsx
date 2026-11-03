import { parseCatalogItemForm } from "@payky/app-shared/catalog-item-form-schema"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type { CatalogCategoryRow } from "@payky/core/modules/catalog-category/catalog-category"
import type { CatalogCategoryId } from "@payky/core/modules/catalog-category/catalog-category-types"
import type { CatalogItemRow } from "@payky/core/modules/catalog-item/catalog-item"
import { createCatalogItemAtEnd } from "@payky/core/modules/catalog-item/catalog-item-actions"
import { catalogItemByIdQuery } from "@payky/core/modules/catalog-item/catalog-item-queries"
import type { FiatCurrency as FiatCurrencyType } from "@payky/core/modules/shared/schema"
import { taxRatesQuery } from "@payky/core/modules/tax-rate/tax-rate-queries"
import type { TaxRateId } from "@payky/core/modules/tax-rate/tax-rate-types"
import {
  filterSelectableTaxRates,
  formatTaxRateLabel,
} from "@payky/core/modules/tax-rate/tax-rate-utils"
import { useId, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button.tsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx"
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
import { useRequirePermission } from "@/hooks/use-access.ts"
import { useEvolu } from "@/hooks/use-evolu.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"
import type { useProductLookup } from "@/hooks/use-product-lookup.ts"
import { useRunToast } from "@/hooks/use-run-toast.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

/**
 * Lightweight create-item form opened from bill scan mode when a scanned
 * code matches no catalog item — just enough to add the item and keep
 * scanning (name, description, price, category). Anything else is left for
 * the full form under Settings. Name and description are prefilled from
 * `productLookup` once it arrives, unless the user already typed into them.
 */
export function CreateCatalogItemDialog({
  open,
  onOpenChange,
  scanCode,
  productLookup,
  currency,
  categories,
  onCreated,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly scanCode: string
  readonly productLookup: ReturnType<typeof useProductLookup>
  readonly currency: FiatCurrencyType
  readonly categories: ReadonlyArray<CatalogCategoryRow>
  readonly onCreated: (item: CatalogItemRow) => void
}) {
  const runToast = useRunToast()
  const { require } = useRequirePermission()
  const evolu = useEvolu()
  const { t } = useTranslation()
  const formId = useId()
  const { data: taxRates } = useEvoluQuery(taxRatesQuery)
  const defaultTaxRate = taxRates.find(
    (rate) => rate.isDefault === 1 && rate.deactivatedAt === null
  )
  const selectableTaxRates = filterSelectableTaxRates(taxRates, undefined)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [categoryId, setCategoryId] = useState<CatalogCategoryId | "none">(
    "none"
  )
  const [taxRateId, setTaxRateId] = useState<TaxRateId | "none">(
    defaultTaxRate?.id ?? "none"
  )
  const [nameError, setNameError] = useState<TranslationKey | null>(null)
  const [descriptionError, setDescriptionError] =
    useState<TranslationKey | null>(null)
  const [priceError, setPriceError] = useState<TranslationKey | null>(null)
  const [pending, setPending] = useState(false)

  const { product } = productLookup
  const [prefilledFrom, setPrefilledFrom] = useState(product)
  if (product !== prefilledFrom) {
    setPrefilledFrom(product)
    if (product === undefined) {
      // The lookup only goes away once the code is dismissed, so this clears
      // a prefill the user never got to see.
      setName("")
      setDescription("")
    } else {
      if (name === "") setName(product.name)
      if (description === "") setDescription(product.description ?? "")
    }
  }

  const resetForm = () => {
    setName("")
    setDescription("")
    setPrice("")
    setCategoryId("none")
    setTaxRateId(defaultTaxRate?.id ?? "none")
    setNameError(null)
    setDescriptionError(null)
    setPriceError(null)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) resetForm()
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("bill.scan.create.title")}</DialogTitle>
          <DialogDescription>
            {t("bill.scan.create.description", { code: scanCode })}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            setNameError(null)
            setDescriptionError(null)
            setPriceError(null)

            const parsed = parseCatalogItemForm(
              {
                name,
                price,
                description,
                internalName: "",
                internalDescription: "",
                sku: "",
                scanCode,
              },
              currency
            )
            if (!parsed.ok) {
              setNameError(parsed.error.name ?? null)
              setDescriptionError(parsed.error.description ?? null)
              setPriceError(parsed.error.price ?? null)
              // The scanned code has no field here to show it under.
              if (parsed.error.scanCode !== undefined) {
                toast.error(t(parsed.error.scanCode))
              }
              return
            }
            const values = parsed.value

            void (async () => {
              // The same synced write as Settings → Items (access/0002).
              if (!(await require("catalog", "access.action.createItem"))) {
                return
              }
              setPending(true)
              await runToast(async (run) => {
                const id = await run.ok(
                  createCatalogItemAtEnd({
                    deviceId: null,
                    categoryId: categoryId === "none" ? null : categoryId,
                    name: values.name,
                    description: values.description,
                    currency,
                    unitAmount: values.price,
                    scanCode: values.scanCode,
                    taxRateId: taxRateId === "none" ? null : taxRateId,
                  })
                )
                const [created] = await evolu.loadQuery(
                  catalogItemByIdQuery(id)
                )
                if (created === undefined) return "app.saveFailed"

                resetForm()
                onOpenChange(false)
                onCreated(created)
              })
              setPending(false)
            })()
          }}
        >
          <FieldGroup>
            <Field data-invalid={nameError !== null}>
              <FieldLabel htmlFor={`${formId}-name`}>
                {t("catalog.items.form.name.label")}
              </FieldLabel>
              <Input
                id={`${formId}-name`}
                value={name}
                disabled={pending}
                aria-invalid={nameError !== null}
                autoComplete="off"
                autoFocus
                placeholder={t("catalog.items.form.name.placeholder")}
                onChange={(event) => {
                  setName(event.currentTarget.value)
                  setNameError(null)
                }}
              />
              <FieldError>{nameError ? t(nameError) : null}</FieldError>
            </Field>

            <Field data-invalid={descriptionError !== null}>
              <FieldLabel htmlFor={`${formId}-description`}>
                {t("catalog.items.form.description.label")}
              </FieldLabel>
              <Input
                id={`${formId}-description`}
                value={description}
                disabled={pending}
                aria-invalid={descriptionError !== null}
                autoComplete="off"
                placeholder={t("catalog.items.form.description.placeholder")}
                onChange={(event) => {
                  setDescription(event.currentTarget.value)
                  setDescriptionError(null)
                }}
              />
              <FieldError>
                {descriptionError ? t(descriptionError) : null}
              </FieldError>
              {productLookup.isFetching ? (
                <FieldDescription>
                  {t("bill.scan.lookup.loading")}
                </FieldDescription>
              ) : product !== undefined ? (
                <FieldDescription>
                  {t("bill.scan.lookup.source", { source: product.source })}
                </FieldDescription>
              ) : null}
            </Field>

            <Field data-invalid={priceError !== null}>
              <FieldLabel htmlFor={`${formId}-price`}>
                {t("catalog.items.form.price.label")}
              </FieldLabel>
              <Input
                id={`${formId}-price`}
                value={price}
                disabled={pending}
                aria-invalid={priceError !== null}
                autoComplete="off"
                inputMode="decimal"
                onChange={(event) => {
                  setPrice(event.currentTarget.value)
                  setPriceError(null)
                }}
              />
              <FieldError>{priceError ? t(priceError) : null}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor={`${formId}-category`}>
                {t("catalog.items.form.category.label")}
              </FieldLabel>
              <Select<CatalogCategoryId | "none">
                items={{
                  none: t("catalog.items.form.category.none"),
                  ...Object.fromEntries(
                    categories.map((category) => [category.id, category.name])
                  ),
                }}
                value={categoryId}
                onValueChange={(nextCategoryId) => {
                  if (nextCategoryId === null) return
                  setCategoryId(nextCategoryId)
                }}
              >
                <SelectTrigger id={`${formId}-category`} disabled={pending}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">
                      {t("catalog.items.form.category.none")}
                    </SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
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
                items={{
                  none: t("catalog.items.form.taxRate.none"),
                  ...Object.fromEntries(
                    selectableTaxRates.map((taxRate) => [
                      taxRate.id,
                      formatTaxRateLabel(taxRate),
                    ])
                  ),
                }}
                value={taxRateId}
                onValueChange={(nextTaxRateId) => {
                  if (nextTaxRateId === null) return
                  setTaxRateId(nextTaxRateId)
                }}
              >
                <SelectTrigger id={`${formId}-taxRate`} disabled={pending}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">
                      {t("catalog.items.form.taxRate.none")}
                    </SelectItem>
                    {selectableTaxRates.map((taxRate) => (
                      <SelectItem key={taxRate.id} value={taxRate.id}>
                        {formatTaxRateLabel(taxRate)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {t("bill.scan.create.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
