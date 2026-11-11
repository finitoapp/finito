import {
  type CategoryChoice,
  categoryChoiceOf,
  resolveCategoryChoice,
} from "@payky/app-shared/catalog-category-choice"
import {
  createPriceCodec,
  priceErrorKey,
  updateCatalogItemErrorKeys,
} from "@payky/app-shared/catalog-item-form-schema"
import { fiatCurrencyOptions } from "@payky/app-shared/fiat-currency-options"
import {
  optionalIdCodec,
  optionalTextCodec,
  requiredTextCodec,
} from "@payky/app-shared/inline-edit-codecs"
import { catalogCategoriesQuery } from "@payky/core/modules/catalog-category/catalog-category-queries"
import type { CatalogCategoryId } from "@payky/core/modules/catalog-category/catalog-category-types"
import type { CatalogItemRow } from "@payky/core/modules/catalog-item/catalog-item"
import {
  deleteCatalogItem,
  updateCatalogItem,
} from "@payky/core/modules/catalog-item/catalog-item-actions"
import {
  catalogItemByIdQuery,
  catalogItemsQuery,
} from "@payky/core/modules/catalog-item/catalog-item-queries"
import { CatalogItemId } from "@payky/core/modules/catalog-item/catalog-item-types"
import {
  findCatalogItemsByScanCode,
  getStaffDisplayName,
  isDiscountPrice,
} from "@payky/core/modules/catalog-item/catalog-item-utils"
import { taxRatesQuery } from "@payky/core/modules/tax-rate/tax-rate-queries"
import type { TaxRateId } from "@payky/core/modules/tax-rate/tax-rate-types"
import { router, useLocalSearchParams } from "expo-router"
import Trash from "lucide-react-native/icons/trash"
import { useMemo, useState } from "react"
import { YStack } from "tamagui"
import { z } from "zod"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { InlineEditField } from "../../../components/inline-edit-field.tsx"
import { ScanCodeScanner } from "../../../components/scan-code-scanner.tsx"
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
  FieldGroup,
  FieldLabel,
} from "../../../components/ui/field.tsx"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select.tsx"
import { useConfirmedRun } from "../../../hooks/use-confirmed-run.ts"
import {
  useEvoluQuery,
  usePreloadEvoluQueries,
} from "../../../hooks/use-evolu-query.ts"
import { useHardwareScanner } from "../../../hooks/use-hardware-scanner.ts"
import { useInlineChoice } from "../../../hooks/use-inline-choice.ts"
import { useIsConfirmOpen } from "../../../hooks/use-is-confirm-open.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { CategoryCombobox } from "../../shared/category-combobox.tsx"
import { useCatalogItemOptions } from "../../shared/use-catalog-item-options.ts"
import { CatalogFormEmptyState } from "../catalog-form-empty-state.tsx"
import { CategoryEditDialog } from "./category-edit-dialog.tsx"
import { ScanCodeButton } from "./scan-code-button.tsx"

const taxRateCodec = optionalIdCodec<TaxRateId>()

/**
 * Edits one catalog item, as web's `EditCatalogItemPage`: every field saves
 * itself. Whether the item is a discount was settled when it was created
 * (catalog/0002): a discount's price field edits the amount and keeps the
 * sign, and it has no VAT rate to pick.
 */
export function EditCatalogItemPage() {
  const { catalogItemId } = useLocalSearchParams<{ catalogItemId: string }>()
  const parsedId = CatalogItemId.safeParse(catalogItemId)

  if (!parsedId.success) {
    return (
      <CatalogFormEmptyState
        titleKey="catalog.items.form.title.edit"
        messageKey="catalog.items.form.invalidId"
      />
    )
  }
  return <EditCatalogItemLoader id={parsedId.data} />
}

function EditCatalogItemLoader({ id }: { readonly id: CatalogItemId }) {
  const [item] = useEvoluQuery(catalogItemByIdQuery(id)).data
  if (item === undefined) {
    return (
      <CatalogFormEmptyState
        titleKey="catalog.items.form.title.edit"
        messageKey="catalog.items.form.notFound"
      />
    )
  }
  return <EditCatalogItemForm item={item} />
}

/**
 * What the form reads besides the item, its options' categories
 * (catalog/0004) and VAT rates included, started together.
 */
const editItemFormQueries = [
  catalogItemsQuery,
  catalogCategoriesQuery,
  taxRatesQuery,
]

function EditCatalogItemForm({ item }: { readonly item: CatalogItemRow }) {
  usePreloadEvoluQueries(editItemFormQueries)
  const { t } = useTranslation()
  const runToast = useRunToast()
  const confirmedRun = useConfirmedRun()
  const [scannerOpen, setScannerOpen] = useState(false)
  const { data: catalogItems } = useEvoluQuery(catalogItemsQuery)
  const { taxRateOptions } = useCatalogItemOptions(item.taxRateId)
  const { data: categories } = useEvoluQuery(catalogCategoriesQuery)
  // The category opened to rename or delete (catalog/0004).
  const [editedCategory, setEditedCategory] = useState<{
    readonly id: CatalogCategoryId
    readonly name: string
  } | null>(null)

  const discount = isDiscountPrice(item.unitAmount)
  // How many minor units the price means depends on the currency next to it.
  const priceCodec = useMemo(
    () => createPriceCodec({ currency: item.currency, discount }),
    [item.currency, discount]
  )

  // A refused price or VAT rate (`validateCatalogItemPricing`, catalog/0001)
  // comes back as its own message, which `useRunToast` toasts; a throw gets
  // the generic one. Either way the inline field keeps its draft.
  const saveItem = (
    values: Omit<Parameters<typeof updateCatalogItem>[0], "id">
  ) =>
    runToast(async (run) => {
      const result = await run(updateCatalogItem({ id: item.id, ...values }))
      if (!result.ok) return updateCatalogItemErrorKeys[result.error.type]
    })

  const currency = useInlineChoice(item.currency, (next) =>
    saveItem({ currency: next })
  )
  // Saved as soon as it is chosen; a typed name becomes its category first
  // (catalog/0004).
  const category = useInlineChoice<CategoryChoice>(
    categoryChoiceOf(item.categoryId),
    (next) =>
      runToast(async (run) => {
        const categoryId = await run.ok(resolveCategoryChoice(next))
        const result = await run(updateCatalogItem({ id: item.id, categoryId }))
        if (!result.ok) return updateCatalogItemErrorKeys[result.error.type]
      })
  )
  const taxRate = useInlineChoice(item.taxRateId, (next) =>
    saveItem({ taxRateId: next })
  )

  // Uniqueness can't be enforced (devices can assign the same code before
  // syncing), so this is a heads-up next to the field, not a validation error.
  const confirmOpen = useIsConfirmOpen()
  // A scan saves the code like the camera does: the value is already confirmed.
  useHardwareScanner({
    enabled: !confirmOpen,
    onScan: (code) => {
      const parsed = z.safeDecode(optionalTextCodec, code)
      if (parsed.success) void saveItem({ scanCode: parsed.data })
    },
  })
  const scanCodeCollisions = useMemo(
    () =>
      findCatalogItemsByScanCode(catalogItems, item.scanCode ?? "").filter(
        (match) => match.id !== item.id
      ),
    [catalogItems, item.scanCode, item.id]
  )

  return (
    <Screen>
      <FadeHeader title={t("catalog.items.form.title.edit")} />
      <YStack gap={20}>
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
                label={t(
                  discount
                    ? "catalog.items.form.discount.label"
                    : "catalog.items.form.price.label"
                )}
                description={
                  discount
                    ? t("catalog.items.form.discount.existing")
                    : undefined
                }
                keyboardType="decimal-pad"
                defaultValue={item.unitAmount}
                codec={priceCodec}
                errorKey={priceErrorKey(discount)}
                onSave={(unitAmount) => saveItem({ unitAmount })}
              />
              <Field>
                <FieldLabel>
                  {t("catalog.items.form.currency.label")}
                </FieldLabel>
                <Select
                  value={currency.value}
                  onValueChange={(value) => void currency.choose(value)}
                  items={Object.fromEntries(
                    fiatCurrencyOptions.map((option) => [
                      option.value,
                      option.value,
                    ])
                  )}
                >
                  <SelectTrigger
                    fullWidth
                    aria-label={t("catalog.items.form.currency.label")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent title={t("catalog.items.form.currency.label")}>
                    <SelectGroup>
                      {fiatCurrencyOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.value}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
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
              <Field>
                <FieldLabel>
                  {t("catalog.items.form.category.label")}
                </FieldLabel>
                <CategoryCombobox
                  categories={categories}
                  value={category.value}
                  onValueChange={(next) => void category.choose(next)}
                  onEdit={setEditedCategory}
                  disabled={category.saving}
                />
              </Field>
              {discount ? null : (
                <Field>
                  <FieldLabel>
                    {t("catalog.items.form.taxRate.label")}
                  </FieldLabel>
                  <Select
                    value={z.encode(taxRateCodec, taxRate.value)}
                    onValueChange={(value) =>
                      void taxRate.choose(
                        z.safeDecode(taxRateCodec, value).data ?? null
                      )
                    }
                    items={Object.fromEntries(
                      taxRateOptions.map((option) => [
                        option.value,
                        option.title,
                      ])
                    )}
                  >
                    <SelectTrigger
                      fullWidth
                      aria-label={t("catalog.items.form.taxRate.label")}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      title={t("catalog.items.form.taxRate.label")}
                    >
                      <SelectGroup>
                        {taxRateOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.title}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    {t("catalog.items.form.taxRate.description")}
                  </FieldDescription>
                </Field>
              )}
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
                trailing={
                  <ScanCodeButton
                    onPress={() => setScannerOpen((open) => !open)}
                  />
                }
                onSave={(scanCode) => saveItem({ scanCode })}
              />
              {scannerOpen ? (
                <ScanCodeScanner
                  onScan={(rawValue) => {
                    setScannerOpen(false)
                    const parsed = z.safeDecode(optionalTextCodec, rawValue)
                    if (parsed.success) void saveItem({ scanCode: parsed.data })
                  }}
                />
              ) : null}
            </FieldGroup>
          </CardContent>
        </Card>
        <Button
          label={t("catalog.items.delete")}
          iconStart={Trash}
          variant="destructive"
          onPress={() => {
            void (async () => {
              const name = getStaffDisplayName(item)
              const deleted = await confirmedRun(
                {
                  title: t("catalog.items.delete.confirm.title", { name }),
                  description: t("catalog.items.delete.confirm.description", {
                    name,
                  }),
                  confirmLabel: t("catalog.items.delete.confirm.confirm"),
                  cancelLabel: t("catalog.items.delete.confirm.cancel"),
                  variant: "destructive",
                },
                deleteCatalogItem(item.id)
              )
              if (deleted) router.back()
            })()
          }}
        />
      </YStack>
      <CategoryEditDialog
        category={editedCategory}
        onClose={() => setEditedCategory(null)}
      />
    </Screen>
  )
}
