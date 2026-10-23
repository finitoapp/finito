import { createPriceCodec } from "@payky/app-shared/catalog-item-form-schema"
import { fiatCurrencyOptions } from "@payky/app-shared/fiat-currency-options"
import {
  optionalIdCodec,
  optionalTextCodec,
  requiredTextCodec,
} from "@payky/app-shared/inline-edit-codecs"
import { findOrCreateCatalogCategory } from "@payky/core/modules/catalog-category/catalog-category-actions"
import { catalogCategoriesQuery } from "@payky/core/modules/catalog-category/catalog-category-queries"
import type { CatalogItemRow } from "@payky/core/modules/catalog-item/catalog-item"
import {
  deleteCatalogItem,
  setCatalogItemInMenu,
  setCatalogItemSoldOut,
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
} from "@payky/core/modules/catalog-item/catalog-item-utils"
import { NonEmptyString255Schema } from "@payky/core/modules/shared/schema"
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
  FieldContent,
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
import { Switch } from "../../../components/ui/switch.tsx"
import { useConfirmedRun } from "../../../hooks/use-confirmed-run.ts"
import { useEvoluQuery } from "../../../hooks/use-evolu-query.ts"
import { useHardwareScanner } from "../../../hooks/use-hardware-scanner.ts"
import { useInlineChoice } from "../../../hooks/use-inline-choice.ts"
import { useIsConfirmOpen } from "../../../hooks/use-is-confirm-open.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { useCatalogItemOptions } from "../../shared/use-catalog-item-options.ts"
import { CatalogFormEmptyState } from "../catalog-form-empty-state.tsx"
import { CategoryField } from "./category-field.tsx"
import { ScanCodeButton } from "./scan-code-button.tsx"

const taxRateCodec = optionalIdCodec<TaxRateId>()

/** Edits one catalog item, as web's `EditCatalogItemPage`: every field saves itself. */
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

function EditCatalogItemForm({ item }: { readonly item: CatalogItemRow }) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const confirmedRun = useConfirmedRun()
  const [scannerOpen, setScannerOpen] = useState(false)
  const { data: catalogItems } = useEvoluQuery(catalogItemsQuery)
  const { taxRateOptions } = useCatalogItemOptions(item.taxRateId)
  const { data: categories } = useEvoluQuery(catalogCategoriesQuery)
  // A category typed rather than picked, made on Save (navigation/0003).
  const [newCategory, setNewCategory] = useState("")

  // How many minor units the price means depends on the currency next to it.
  const priceCodec = useMemo(
    () => createPriceCodec(item.currency),
    [item.currency]
  )

  // `updateCatalogItem` is a `Task<_, never>`: `run.ok` throws on an
  // unexpected failure and `useRunToast` turns that into the toast.
  const saveItem = (
    values: Omit<Parameters<typeof updateCatalogItem>[0], "id">
  ) =>
    runToast(async (run) => {
      await run.ok(updateCatalogItem({ id: item.id, ...values }))
    })

  const currency = useInlineChoice(item.currency, (next) =>
    saveItem({ currency: next })
  )
  const category = useInlineChoice(item.categoryId, (next) =>
    saveItem({ categoryId: next })
  )
  const [savingCategory, setSavingCategory] = useState(false)
  const commitNewCategory = async () => {
    const name = NonEmptyString255Schema.safeParse(newCategory.trim())
    if (!name.success || savingCategory) return
    setSavingCategory(true)
    const saved = await runToast(async (run) => {
      const categoryId = await run.ok(findOrCreateCatalogCategory(name.data))
      await run.ok(updateCatalogItem({ id: item.id, categoryId }))
    })
    setSavingCategory(false)
    if (saved) setNewCategory("")
  }
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
                label={t("catalog.items.form.price.label")}
                keyboardType="decimal-pad"
                defaultValue={item.unitAmount}
                codec={priceCodec}
                errorKey="catalog.items.form.price.invalid"
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
              <CategoryField
                categories={categories}
                value={category.value}
                onValueChange={(next) => void category.choose(next)}
                draft={newCategory}
                onDraftChange={setNewCategory}
                onCommitDraft={() => {
                  void commitNewCategory()
                }}
                saving={savingCategory || category.saving}
              />
              <Field>
                <FieldLabel>{t("catalog.items.form.taxRate.label")}</FieldLabel>
                <Select
                  value={z.encode(taxRateCodec, taxRate.value)}
                  onValueChange={(value) =>
                    void taxRate.choose(
                      z.safeDecode(taxRateCodec, value).data ?? null
                    )
                  }
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
                <FieldDescription>
                  {t("catalog.items.form.taxRate.description")}
                </FieldDescription>
              </Field>
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
        <CatalogItemMenuCard item={item} />
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
    </Screen>
  )
}

function CatalogItemMenuCard({ item }: { readonly item: CatalogItemRow }) {
  const { t } = useTranslation()
  const runToast = useRunToast()
  const inMenu = useInlineChoice(item.inMenu !== null, (checked) =>
    runToast(async (run) => {
      await run.ok(setCatalogItemInMenu({ id: item.id, inMenu: checked }))
    })
  )
  const soldOut = useInlineChoice(item.soldOut !== null, (checked) =>
    runToast(async (run) => {
      await run.ok(setCatalogItemSoldOut({ id: item.id, soldOut: checked }))
    })
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("catalog.items.form.menu.title")}</CardTitle>
        <CardDescription>
          {t("catalog.items.form.menu.description")}
        </CardDescription>
      </CardHeader>
      <CardContent gap={16}>
        <Field orientation="horizontal">
          <Switch
            aria-label={t("catalog.items.form.inMenu.label")}
            checked={inMenu.value}
            disabled={inMenu.saving}
            onCheckedChange={(checked) => {
              void inMenu.choose(checked)
            }}
          />
          <FieldContent>
            <FieldLabel>{t("catalog.items.form.inMenu.label")}</FieldLabel>
          </FieldContent>
        </Field>
        {item.inMenu !== null && (
          <Field orientation="horizontal">
            <Switch
              aria-label={t("catalog.items.form.soldOut.label")}
              checked={soldOut.value}
              disabled={soldOut.saving}
              onCheckedChange={(checked) => {
                void soldOut.choose(checked)
              }}
            />
            <FieldContent>
              <FieldLabel>{t("catalog.items.form.soldOut.label")}</FieldLabel>
              <FieldDescription>
                {t("catalog.items.form.soldOut.description")}
              </FieldDescription>
            </FieldContent>
          </Field>
        )}
      </CardContent>
    </Card>
  )
}
