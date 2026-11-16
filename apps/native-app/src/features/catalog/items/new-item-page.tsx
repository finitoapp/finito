import { resolveCategoryChoice } from "@payky/app-shared/catalog-category-choice"
import {
  type CatalogItemFormErrors,
  catalogItemPricingErrorKeys,
  parseCatalogItemForm,
} from "@payky/app-shared/catalog-item-form-schema"
import { fiatCurrencyOptions } from "@payky/app-shared/fiat-currency-options"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { NO_OPTION } from "@payky/app-shared/inline-edit-codecs"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { getFiatCurrency } from "@payky/core/modules/app-settings/app-settings-utils"
import { catalogCategoriesQuery } from "@payky/core/modules/catalog-category/catalog-category-queries"
import { CatalogCategoryId } from "@payky/core/modules/catalog-category/catalog-category-types"
import { createCatalogItemAtEnd } from "@payky/core/modules/catalog-item/catalog-item-actions"
import { catalogItemsQuery } from "@payky/core/modules/catalog-item/catalog-item-queries"
import {
  findCatalogItemsByScanCode,
  getStaffDisplayName,
} from "@payky/core/modules/catalog-item/catalog-item-utils"
import { legalEntityQuery } from "@payky/core/modules/legal-entity/legal-entity-queries"
import type { FiatCurrency } from "@payky/core/modules/shared/schema"
import { taxRatesQuery } from "@payky/core/modules/tax-rate/tax-rate-queries"
import { router, useLocalSearchParams } from "expo-router"
import { type ComponentProps, useMemo, useState } from "react"
import { View, XStack } from "tamagui"
import { FadeHeader } from "../../../components/fade-header.tsx"
import { ScanCodeScanner } from "../../../components/scan-code-scanner.tsx"
import { Screen } from "../../../components/screen.tsx"
import { Button } from "../../../components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import {
  useEvoluQuery,
  usePreloadEvoluQueries,
} from "../../../hooks/use-evolu-query.ts"
import { useHardwareScanner } from "../../../hooks/use-hardware-scanner.ts"
import { useIsConfirmOpen } from "../../../hooks/use-is-confirm-open.ts"
import {
  libraryProductById,
  useProductLibrary,
} from "../../../hooks/use-product-library.ts"
import { useRunToast } from "../../../hooks/use-run-toast.ts"
import { useTranslation } from "../../../hooks/use-translation.ts"
import { CategoryCombobox } from "../../shared/category-combobox.tsx"
import { DiscountSwitchField } from "../../shared/discount-switch-field.tsx"
import { ItemLibraryPicture } from "../../shared/item-library-picture.tsx"
import { LibraryNameField } from "../../shared/library-name-field.tsx"
import { useCatalogItemOptions } from "../../shared/use-catalog-item-options.ts"
import { useLibraryItemFields } from "../../shared/use-library-product-prefill.ts"
import { newItemReturn } from "./new-item-return.ts"
import { ScanCodeButton } from "./scan-code-button.tsx"

/**
 * What the screen reads, its options' VAT rates and the account's VAT payer
 * flag (catalog/0001) included, started together.
 */
const newItemPageQueries = [
  settingsQuery,
  legalEntityQuery,
  catalogItemsQuery,
  catalogCategoriesQuery,
  taxRatesQuery,
]

/**
 * Adds a catalog item, as web's `NewCatalogItemPage`: a submit-and-go-back
 * form that validates every field at once before it inserts.
 *
 * The name field suggests products of the product library; picking one, or
 * opening the form from a related product's chip on the items list
 * (`?libraryProductId=`, with the `categoryId` of the item just created when
 * the library files both together), fills the name, the picture, the VAT
 * rate and the category, never the price; the VAT rate and the category
 * only where the merchant has not set them. Opened from the items list
 * (`?from=items`), an item saved from a library product returns to the list
 * with `?added=` naming it, where its related products are offered next;
 * any other save goes Back, as to the bill whose empty state opened it.
 */
export function NewCatalogItemPage() {
  usePreloadEvoluQueries(newItemPageQueries)
  const { t } = useTranslation()
  const [settings] = useEvoluQuery(settingsQuery).data
  const [legalEntity] = useEvoluQuery(legalEntityQuery).data
  const { data: catalogItems } = useEvoluQuery(catalogItemsQuery)
  const runToast = useRunToast()
  const { defaultTaxRate, taxRateOptions } = useCatalogItemOptions()
  const [description, setDescription] = useState("")
  const [internalName, setInternalName] = useState("")
  const [internalDescription, setInternalDescription] = useState("")
  const [sku, setSku] = useState("")
  const { data: categories } = useEvoluQuery(catalogCategoriesQuery)
  // The name, the library product it links, the VAT rate and the category
  // (a typed name stays a name until the item is saved, catalog/0004).
  const libraryFields = useLibraryItemFields({
    defaultTaxRateId: defaultTaxRate?.id ?? NO_OPTION,
  })
  const { name, libraryProductId, category, taxRateId } = libraryFields
  const [currency, setCurrency] = useState<FiatCurrency>(
    getFiatCurrency(settings)
  )
  const [price, setPrice] = useState("")
  // The Discount switch carries the price's sign, which Android's decimal
  // keyboard cannot type; it is set here, on create, only (catalog/0002).
  const [discount, setDiscount] = useState(false)
  const params = useLocalSearchParams<{
    scan?: string
    libraryProductId?: string
    categoryId?: string
    /** `items` when the items list opened the form (`newItemReturn`). */
    from?: string
  }>()
  // A code scanned in the item list, which opened this form to carry it.
  const { scan } = params
  const [scanCode, setScanCode] = useState(scan ?? "")
  const [scannerOpen, setScannerOpen] = useState(false)
  const [errors, setErrors] = useState<CatalogItemFormErrors>({})
  const [pending, setPending] = useState(false)
  const confirmOpen = useIsConfirmOpen()
  const clearError = (field: keyof CatalogItemFormErrors) =>
    setErrors((current) => ({ ...current, [field]: undefined }))

  const { library } = useProductLibrary()

  // A related product's chip opened the form: fill it from that product
  // once the library is there (it is, the list showed the chip).
  const [routePrefilled, setRoutePrefilled] = useState(false)
  if (
    !routePrefilled &&
    library !== undefined &&
    params.libraryProductId !== undefined
  ) {
    setRoutePrefilled(true)
    const product = libraryProductById(library, params.libraryProductId)
    const prefill =
      product === undefined ? undefined : libraryFields.prefillFor(product)
    if (prefill !== undefined) {
      const categoryId = CatalogCategoryId.safeParse(params.categoryId)
      libraryFields.apply(
        categoryId.success &&
          categories.some((candidate) => candidate.id === categoryId.data)
          ? { ...prefill, category: { kind: "existing", id: categoryId.data } }
          : prefill
      )
    }
  }

  // Fills the field wherever focus is; a focused field already received the
  // code's characters and is overwritten with the clean code.
  useHardwareScanner({
    enabled: !pending && !confirmOpen,
    onScan: (code) => {
      setScanCode(code)
      clearError("scanCode")
    },
  })
  const error = (field: keyof CatalogItemFormErrors) => {
    const key: TranslationKey | undefined = errors[field]
    return key === undefined ? undefined : t(key)
  }
  const text = (
    field: keyof CatalogItemFormErrors,
    value: string,
    set: (value: string) => void
  ): Pick<
    ComponentProps<typeof Input>,
    "value" | "onChangeText" | "disabled" | "autoCorrect"
  > => ({
    value,
    disabled: pending,
    autoCorrect: false,
    onChangeText: (next) => {
      set(next)
      clearError(field)
    },
  })

  // Uniqueness can't be enforced (devices can assign the same code before
  // syncing), so this is a heads-up next to the field, not a validation error.
  const scanCodeCollisions = useMemo(
    () => findCatalogItemsByScanCode(catalogItems, scanCode),
    [catalogItems, scanCode]
  )

  const submit = async () => {
    setErrors({})
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
      {
        currency,
        taxRateId,
        legalEntity,
        discount,
      }
    )
    if (!parsed.ok) {
      setErrors(parsed.error)
      return
    }
    const values = parsed.value
    setPending(true)
    let createdId: string | undefined
    const saved = await runToast(async (run) => {
      const categoryId = await run.ok(resolveCategoryChoice(category))
      const result = await run(
        createCatalogItemAtEnd({
          deviceId: null,
          categoryId,
          name: values.name,
          description: values.description,
          internalName: values.internalName,
          internalDescription: values.internalDescription,
          sku: values.sku,
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
      createdId = result.value
      return undefined
    })
    setPending(false)
    if (!saved) return
    // Back to the list that opened the form, which offers the related
    // products of a library item (`?added=`); the same Back as before for
    // any other item or opener.
    const destination =
      createdId === undefined
        ? undefined
        : newItemReturn({ from: params.from, libraryProductId, createdId })
    if (destination?.kind === "list")
      router.dismissTo({
        pathname: "/settings/items",
        params: { added: destination.added },
      })
    else router.back()
  }

  return (
    <Screen>
      <FadeHeader title={t("catalog.items.form.title.create")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("catalog.items.form.card.title")}</CardTitle>
          <CardDescription>
            {t("catalog.items.form.card.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                placeholder={t("catalog.items.form.name.placeholder")}
                invalid={error("name") !== undefined}
                disabled={pending}
                onChangeText={(next) => {
                  libraryFields.typeName(next)
                  clearError("name")
                }}
                onChoose={(product) => {
                  if (libraryFields.pick(product)) clearError("name")
                }}
              />
              <FieldError>{error("name")}</FieldError>
            </Field>
            <Field>
              <FieldLabel>
                {t("catalog.items.form.internalName.label")}
              </FieldLabel>
              <Input
                placeholder={t("catalog.items.form.internalName.placeholder")}
                invalid={error("internalName") !== undefined}
                {...text("internalName", internalName, setInternalName)}
              />
              <FieldDescription>
                {t("catalog.items.form.internalName.hint")}
              </FieldDescription>
              <FieldError>{error("internalName")}</FieldError>
            </Field>
            <Field>
              <FieldLabel>{t("catalog.items.form.price.label")}</FieldLabel>
              <XStack items="center" gap={8}>
                <Input
                  flex={1}
                  keyboardType="decimal-pad"
                  invalid={error("price") !== undefined}
                  {...text("price", price, setPrice)}
                />
                <View w={96}>
                  <Select
                    value={currency}
                    onValueChange={setCurrency}
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
                    <SelectContent
                      title={t("catalog.items.form.currency.label")}
                    >
                      <SelectGroup>
                        {fiatCurrencyOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.value}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </View>
              </XStack>
              <FieldError>{error("price")}</FieldError>
            </Field>
            <DiscountSwitchField
              checked={discount}
              disabled={pending}
              onCheckedChange={(next) => {
                setDiscount(next)
                clearError("price")
              }}
            />
            <Field>
              <FieldLabel>
                {t("catalog.items.form.description.label")}
              </FieldLabel>
              <Input
                placeholder={t("catalog.items.form.description.placeholder")}
                invalid={error("description") !== undefined}
                {...text("description", description, setDescription)}
              />
              <FieldError>{error("description")}</FieldError>
            </Field>
            <Field>
              <FieldLabel>
                {t("catalog.items.form.internalDescription.label")}
              </FieldLabel>
              <Input
                placeholder={t(
                  "catalog.items.form.internalDescription.placeholder"
                )}
                invalid={error("internalDescription") !== undefined}
                {...text(
                  "internalDescription",
                  internalDescription,
                  setInternalDescription
                )}
              />
              <FieldError>{error("internalDescription")}</FieldError>
            </Field>
            <Field>
              <FieldLabel>{t("catalog.items.form.sku.label")}</FieldLabel>
              <Input
                placeholder={t("catalog.items.form.sku.placeholder")}
                invalid={error("sku") !== undefined}
                {...text("sku", sku, setSku)}
              />
              <FieldError>{error("sku")}</FieldError>
            </Field>
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
                <FieldDescription>
                  {t("catalog.items.form.taxRate.description")}
                </FieldDescription>
              </Field>
            )}
            <Field>
              <FieldLabel>{t("catalog.items.form.scanCode.label")}</FieldLabel>
              <View position="relative">
                <Input
                  pr={48}
                  placeholder={t("catalog.items.form.scanCode.placeholder")}
                  invalid={error("scanCode") !== undefined}
                  {...text("scanCode", scanCode, setScanCode)}
                />
                <View position="absolute" t={0} b={0} r={8} justify="center">
                  <ScanCodeButton
                    disabled={pending}
                    onPress={() => setScannerOpen((open) => !open)}
                  />
                </View>
              </View>
              {errors.scanCode === undefined &&
              scanCodeCollisions.length > 0 ? (
                <FieldDescription>
                  {t("catalog.items.form.scanCode.duplicate", {
                    name: scanCodeCollisions
                      .map((match) => getStaffDisplayName(match))
                      .join(", "),
                  })}
                </FieldDescription>
              ) : null}
              <FieldError>{error("scanCode")}</FieldError>
              {scannerOpen ? (
                <ScanCodeScanner
                  onScan={(code) => {
                    setScannerOpen(false)
                    setScanCode(code)
                    clearError("scanCode")
                  }}
                />
              ) : null}
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter justify="flex-end">
          <Button
            label={t("catalog.items.form.save.create")}
            pending={pending}
            onPress={() => {
              void submit()
            }}
          />
        </CardFooter>
      </Card>
    </Screen>
  )
}
