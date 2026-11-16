import { resolveCategoryChoice } from "@payky/app-shared/catalog-category-choice"
import {
  type CatalogItemFormErrors,
  catalogItemPricingErrorKeys,
  parseCatalogItemForm,
} from "@payky/app-shared/catalog-item-form-schema"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { NO_OPTION } from "@payky/app-shared/inline-edit-codecs"
import { catalogCategoriesQuery } from "@payky/core/modules/catalog-category/catalog-category-queries"
import type { CatalogItemRow } from "@payky/core/modules/catalog-item/catalog-item"
import { createCatalogItemAtEnd } from "@payky/core/modules/catalog-item/catalog-item-actions"
import { catalogItemByIdQuery } from "@payky/core/modules/catalog-item/catalog-item-queries"
import { legalEntityQuery } from "@payky/core/modules/legal-entity/legal-entity-queries"
import type { FiatCurrency } from "@payky/core/modules/shared/schema"
import { taxRatesQuery } from "@payky/core/modules/tax-rate/tax-rate-queries"
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
import {
  useEvoluQuery,
  usePreloadEvoluQueries,
} from "../../hooks/use-evolu-query.ts"
import type { useProductLookup } from "../../hooks/use-product-lookup.ts"
import { useRunToast } from "../../hooks/use-run-toast.ts"
import { useToast } from "../../hooks/use-toast.ts"
import { useTranslation } from "../../hooks/use-translation.ts"
import { CategoryCombobox } from "../shared/category-combobox.tsx"
import { DiscountSwitchField } from "../shared/discount-switch-field.tsx"
import { ItemLibraryPicture } from "../shared/item-library-picture.tsx"
import { LibraryNameField } from "../shared/library-name-field.tsx"
import { useCatalogItemOptions } from "../shared/use-catalog-item-options.ts"
import { useLibraryItemFields } from "../shared/use-library-product-prefill.ts"

/**
 * Lightweight create-item form opened from bill scan mode when a scanned code
 * matches no catalog item, as web's `CreateCatalogItemDialog`: name,
 * description, price and whether it is a discount, category and tax rate; the
 * rest is left for Settings.
 * Name and description are prefilled from `productLookup` once it arrives,
 * unless the user already typed into them. The name field suggests products
 * of the product library, as the catalog's create form does; the merchant
 * is mid-sale, so no related products are offered afterwards.
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

/**
 * What the form reads, started together: the account's VAT payer flag
 * (catalog/0001) and its options' categories (catalog/0004) and VAT rates.
 */
const createFormQueries = [
  legalEntityQuery,
  catalogCategoriesQuery,
  taxRatesQuery,
]

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
  usePreloadEvoluQueries(createFormQueries)
  const { t } = useTranslation()
  const toast = useToast()
  const runToast = useRunToast()
  const { require } = useRequirePermission()
  const evolu = useAtomValue(evoluAtom)
  const [legalEntity] = useEvoluQuery(legalEntityQuery).data
  const { defaultTaxRate, taxRateOptions } = useCatalogItemOptions()
  const { data: categories } = useEvoluQuery(catalogCategoriesQuery)
  // Unlike web's dialog, this form mounts only when it opens, by which time
  // the lookup (started with the unknown-code confirmation) usually answered:
  // start from that product, then follow it below.
  // The name, the library product it links, the VAT rate and the category
  // (a typed name becomes its category with the item, catalog/0004).
  const libraryFields = useLibraryItemFields({
    initialName: productLookup.product?.name ?? "",
    defaultTaxRateId: defaultTaxRate?.id ?? NO_OPTION,
  })
  const { name, setName, libraryProductId, category, taxRateId } = libraryFields
  const [description, setDescription] = useState(
    productLookup.product?.description ?? ""
  )
  const [price, setPrice] = useState("")
  // The sign of the price, as the catalog form's switch (catalog/0002).
  const [discount, setDiscount] = useState(false)
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
      {
        currency,
        taxRateId,
        legalEntity,
        discount,
      }
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
      const categoryId = await run.ok(resolveCategoryChoice(category))
      const result = await run(
        createCatalogItemAtEnd({
          deviceId: null,
          categoryId,
          name: values.name,
          description: values.description,
          currency,
          unitAmount: values.price,
          scanCode: values.scanCode,
          taxRateId: values.taxRateId,
          libraryProductId,
        })
      )
      // The core's own pricing rules, should the account have become a VAT
      // payer since the form judged it.
      if (!result.ok) return catalogItemPricingErrorKeys[result.error.type]
      const [created] = await evolu.loadQuery(
        catalogItemByIdQuery(result.value)
      )
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
        <ItemLibraryPicture
          libraryProductId={libraryProductId}
          disabled={pending}
          onUnlink={libraryFields.unlink}
        />
        <Field>
          <FieldLabel>{t("catalog.items.form.name.label")}</FieldLabel>
          <LibraryNameField
            value={name}
            disabled={pending}
            invalid={errors.name !== undefined}
            autoFocus
            placeholder={t("catalog.items.form.name.placeholder")}
            onChangeText={(next) => {
              libraryFields.typeName(next)
              clear("name")
            }}
            onChoose={(product) => {
              if (libraryFields.pick(product)) clear("name")
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
        <DiscountSwitchField
          checked={discount}
          disabled={pending}
          onCheckedChange={(next) => {
            setDiscount(next)
            clear("price")
          }}
        />
        <Field>
          <FieldLabel>{t("catalog.items.form.category.label")}</FieldLabel>
          <CategoryCombobox
            categories={categories}
            value={category}
            onValueChange={libraryFields.chooseCategory}
            disabled={pending}
          />
        </Field>
        {/* A discount has no VAT rate (catalog/0002). */}
        {discount ? null : (
          <Field>
            <FieldLabel>{t("catalog.items.form.taxRate.label")}</FieldLabel>
            <Select
              value={taxRateId}
              onValueChange={libraryFields.chooseTaxRate}
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
        )}
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
