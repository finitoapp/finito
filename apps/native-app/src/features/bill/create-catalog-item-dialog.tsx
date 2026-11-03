import {
  type CatalogItemFormErrors,
  parseCatalogItemForm,
} from "@payky/app-shared/catalog-item-form-schema"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { NO_OPTION } from "@payky/app-shared/inline-edit-codecs"
import type { CatalogCategoryId } from "@payky/core/modules/catalog-category/catalog-category-types"
import type { CatalogItemRow } from "@payky/core/modules/catalog-item/catalog-item"
import { createCatalogItemAtEnd } from "@payky/core/modules/catalog-item/catalog-item-actions"
import { catalogItemByIdQuery } from "@payky/core/modules/catalog-item/catalog-item-queries"
import type { FiatCurrency } from "@payky/core/modules/shared/schema"
import type { TaxRateId } from "@payky/core/modules/tax-rate/tax-rate-types"
import { useAtomValue } from "jotai"
import { useState } from "react"
import { evoluAtom } from "../../atoms/evolu.ts"
import { Button } from "../../components/ui/button.tsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "../../components/ui/field.tsx"
import { Input } from "../../components/ui/input.tsx"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select.tsx"
import { useRequirePermission } from "../../core/use-access.ts"
import type { useProductLookup } from "../../hooks/use-product-lookup.ts"
import { useRunToast } from "../../hooks/use-run-toast.ts"
import { useToast } from "../../hooks/use-toast.ts"
import { useTranslation } from "../../hooks/use-translation.ts"
import { useCatalogItemOptions } from "../shared/use-catalog-item-options.ts"

/**
 * Lightweight create-item form opened from bill scan mode when a scanned code
 * matches no catalog item, as web's `CreateCatalogItemDialog`: name,
 * description, price, category and tax rate; the rest is left for Settings.
 * Name and description are prefilled from `productLookup` once it arrives,
 * unless the user already typed into them.
 */
export function CreateCatalogItemDialog({
  scanCode,
  productLookup,
  currency,
  onClose,
  onCreated,
}: {
  /** `null` while closed. */
  readonly scanCode: string | null
  readonly productLookup: ReturnType<typeof useProductLookup>
  readonly currency: FiatCurrency
  readonly onClose: () => void
  readonly onCreated: (item: CatalogItemRow) => void
}) {
  return (
    <Dialog
      open={scanCode !== null}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      {scanCode === null ? null : (
        <CreateForm
          scanCode={scanCode}
          productLookup={productLookup}
          currency={currency}
          onCreated={onCreated}
        />
      )}
    </Dialog>
  )
}

function CreateForm({
  scanCode,
  productLookup,
  currency,
  onCreated,
}: {
  readonly scanCode: string
  readonly productLookup: ReturnType<typeof useProductLookup>
  readonly currency: FiatCurrency
  readonly onCreated: (item: CatalogItemRow) => void
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const runToast = useRunToast()
  const { require } = useRequirePermission()
  const evolu = useAtomValue(evoluAtom)
  const { defaultTaxRate, categoryOptions, taxRateOptions } =
    useCatalogItemOptions()
  // Unlike web's dialog, this form mounts only when it opens, by which time
  // the lookup (started with the unknown-code confirmation) usually answered:
  // start from that product, then follow it below.
  const [name, setName] = useState(productLookup.product?.name ?? "")
  const [description, setDescription] = useState(
    productLookup.product?.description ?? ""
  )
  const [price, setPrice] = useState("")
  const [categoryId, setCategoryId] = useState<CatalogCategoryId | "none">(
    NO_OPTION
  )
  const [taxRateId, setTaxRateId] = useState<TaxRateId | "none">(
    defaultTaxRate?.id ?? NO_OPTION
  )
  const [errors, setErrors] = useState<CatalogItemFormErrors>({})
  const [pending, setPending] = useState(false)

  // Prefill once the lookup arrives, without overwriting what was typed.
  const { product } = productLookup
  const [prefilledFrom, setPrefilledFrom] = useState(product)
  if (product !== prefilledFrom) {
    setPrefilledFrom(product)
    if (product !== undefined) {
      if (name === "") setName(product.name)
      if (description === "") setDescription(product.description ?? "")
    }
  }

  const error = (field: keyof CatalogItemFormErrors) => {
    const key: TranslationKey | undefined = errors[field]
    return key === undefined ? undefined : t(key)
  }
  const clear = (field: keyof CatalogItemFormErrors) =>
    setErrors((current) => ({ ...current, [field]: undefined }))

  const submit = async () => {
    setErrors({})
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
      setErrors(parsed.error)
      // The scanned code has no field here to show it under.
      if (parsed.error.scanCode !== undefined)
        toast.error(t(parsed.error.scanCode))
      return
    }
    const values = parsed.value
    // The same synced write as Settings → Items (access/0002).
    if (!(await require("catalog", "access.action.createItem"))) return
    setPending(true)
    await runToast(async (run) => {
      const id = await run.ok(
        createCatalogItemAtEnd({
          deviceId: null,
          categoryId: categoryId === NO_OPTION ? null : categoryId,
          name: values.name,
          description: values.description,
          currency,
          unitAmount: values.price,
          scanCode: values.scanCode,
          taxRateId: taxRateId === NO_OPTION ? null : taxRateId,
        })
      )
      const [created] = await evolu.loadQuery(catalogItemByIdQuery(id))
      if (created === undefined) return "app.saveFailed"
      onCreated(created)
      return undefined
    })
    setPending(false)
  }

  return (
    <DialogContent closeLabel={t("dialog.close")}>
      <DialogHeader>
        <DialogTitle>{t("bill.scan.create.title")}</DialogTitle>
        <DialogDescription>
          {t("bill.scan.create.description", { code: scanCode })}
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel>{t("catalog.items.form.name.label")}</FieldLabel>
          <Input
            value={name}
            disabled={pending}
            invalid={errors.name !== undefined}
            autoComplete="off"
            autoCorrect={false}
            autoFocus
            placeholder={t("catalog.items.form.name.placeholder")}
            onChangeText={(next) => {
              setName(next)
              clear("name")
            }}
          />
          <FieldError>{error("name")}</FieldError>
        </Field>
        <Field>
          <FieldLabel>{t("catalog.items.form.description.label")}</FieldLabel>
          <Input
            value={description}
            disabled={pending}
            invalid={errors.description !== undefined}
            autoComplete="off"
            autoCorrect={false}
            placeholder={t("catalog.items.form.description.placeholder")}
            onChangeText={(next) => {
              setDescription(next)
              clear("description")
            }}
          />
          <FieldError>{error("description")}</FieldError>
          {productLookup.isFetching ? (
            <FieldDescription>{t("bill.scan.lookup.loading")}</FieldDescription>
          ) : product === undefined ? null : (
            <FieldDescription>
              {t("bill.scan.lookup.source", { source: product.source })}
            </FieldDescription>
          )}
        </Field>
        <Field>
          <FieldLabel>{t("catalog.items.form.price.label")}</FieldLabel>
          <Input
            value={price}
            disabled={pending}
            invalid={errors.price !== undefined}
            autoComplete="off"
            keyboardType="decimal-pad"
            onChangeText={(next) => {
              setPrice(next)
              clear("price")
            }}
          />
          <FieldError>{error("price")}</FieldError>
        </Field>
        <Field>
          <FieldLabel>{t("catalog.items.form.category.label")}</FieldLabel>
          <Select
            value={categoryId}
            onValueChange={setCategoryId}
            items={Object.fromEntries(
              categoryOptions.map((option) => [option.value, option.title])
            )}
          >
            <SelectTrigger
              fullWidth
              aria-label={t("catalog.items.form.category.label")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent title={t("catalog.items.form.category.label")}>
              <SelectGroup>
                {categoryOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.title}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>{t("catalog.items.form.taxRate.label")}</FieldLabel>
          <Select
            value={taxRateId}
            onValueChange={setTaxRateId}
            items={Object.fromEntries(
              taxRateOptions.map((option) => [option.value, option.title])
            )}
          >
            <SelectTrigger
              fullWidth
              aria-label={t("catalog.items.form.taxRate.label")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent title={t("catalog.items.form.taxRate.label")}>
              <SelectGroup>
                {taxRateOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.title}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button
          label={t("bill.scan.create.save")}
          pending={pending}
          onPress={() => void submit()}
        />
      </DialogFooter>
    </DialogContent>
  )
}
