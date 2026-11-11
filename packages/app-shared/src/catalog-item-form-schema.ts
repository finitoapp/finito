import { err, ok, type Result } from "@evolu/common"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type { CatalogItemNotFoundError } from "@payky/core/modules/catalog-item/catalog-item-actions"
import {
  type CatalogItemPricingError,
  validateCatalogItemPricing,
} from "@payky/core/modules/catalog-item/catalog-item-utils"
import {
  decimalPriceToMinorUnits,
  minorUnitsToDecimalString,
} from "@payky/core/modules/shared/money"
import {
  type FiatCurrency,
  Integer,
  IntegerSchema,
  NonEmptyString255Schema,
} from "@payky/core/modules/shared/schema"
import type { TaxRateId } from "@payky/core/modules/tax-rate/tax-rate-types"
import { z } from "zod"

/**
 * A required catalog-item text field as the form holds it: whitespace
 * trimmed, then a valid `NonEmptyString255`.
 */
const RequiredTextSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(NonEmptyString255Schema)

/**
 * An optional one: blank means "not set" (`null`), anything else still has
 * to be a valid `NonEmptyString255`. Five of the form's fields want exactly
 * this, and each used to spell it out as its own trim-then-`safeParse` pair.
 */
const OptionalTextSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.union([z.literal("").transform(() => null), NonEmptyString255Schema]))

/** The message each `validateCatalogItemPricing` refusal shows. */
export const catalogItemPricingErrorKeys = {
  ZeroPriceWithoutTaxRate: "catalog.items.form.price.zeroWithoutTaxRate",
  DiscountWithTaxRate: "catalog.items.form.price.discountWithTaxRate",
  CatalogItemPriceSignChange: "catalog.items.form.price.signChange",
} satisfies Record<CatalogItemPricingError["type"], TranslationKey>

/**
 * The message each refusal of `updateCatalogItem` shows at the edit form's
 * inline edits (`useInlineSave`'s `TranslationKey` protocol on web, the
 * `useRunToast` action's on native): an edit of the price or the VAT rate
 * that breaks `validateCatalogItemPricing` says which rule, as the create
 * form does (catalog/0001, catalog/0002); an item deleted meanwhile gets the
 * generic one.
 */
export const updateCatalogItemErrorKeys = {
  ...catalogItemPricingErrorKeys,
  CatalogItemNotFound: "app.saveFailed",
} satisfies Record<
  (CatalogItemNotFoundError | CatalogItemPricingError)["type"],
  TranslationKey
>

const isCatalogItemPricingErrorType = (
  value: unknown
): value is CatalogItemPricingError["type"] =>
  typeof value === "string" && value in catalogItemPricingErrorKeys

/**
 * A discount of nothing (catalog/0002). The core cannot refuse it, since zero
 * has no sign; only the form's Discount switch says a zero was meant as one.
 */
const discountZeroErrorKey = "catalog.items.form.price.discountZero"

/**
 * What the price is judged against besides itself: the currency it is typed
 * in, which decides how many minor units it means, and the VAT rate picked
 * next to it together with whether the account is a VAT payer, which
 * `validateCatalogItemPricing` needs (catalog/0001).
 *
 * `discount` is the create form's Discount switch (catalog/0002): the amount
 * is typed without a sign, because Android's decimal keyboard has none, and
 * the switch turns it below zero. A discount has no VAT rate, so `taxRateId`
 * is then ignored and the parsed values carry `null`.
 */
export interface CatalogItemFormContext {
  readonly currency: FiatCurrency
  readonly taxRateId: TaxRateId | null
  readonly vatPayer: boolean
  readonly discount: boolean
}

/** A typed amount, without a sign, as the price it means (catalog/0002). */
const signedPrice = (magnitude: number, discount: boolean): Integer =>
  Integer(discount ? -magnitude : magnitude)

/**
 * The price as typed, judged together with the VAT rate — built per submit
 * rather than once at module load, since both depend on what is picked next
 * to it. `decimalPriceToMinorUnits` already trims, rejects a signed or
 * non-numeric amount, and rejects more fraction digits than the currency has,
 * returning `null` for all of them; zero is a price (catalog/0001), but not a
 * discount (catalog/0002). A refusal of `validateCatalogItemPricing` carries
 * its type in `params`, so `parseCatalogItemForm` shows its own message
 * rather than the generic one.
 */
const createPriceSchema = ({
  currency,
  taxRateId,
  vatPayer,
  discount,
}: CatalogItemFormContext) =>
  z.string().transform((value, ctx) => {
    const minorUnits = decimalPriceToMinorUnits({ currency, value })
    if (minorUnits === null) {
      ctx.issues.push({
        code: "custom",
        message: "Invalid price",
        input: value,
      })
      return z.NEVER
    }
    if (discount && minorUnits === 0) {
      ctx.issues.push({
        code: "custom",
        message: "DiscountZero",
        input: value,
        params: { discountZero: true },
      })
      return z.NEVER
    }

    const unitAmount = signedPrice(minorUnits, discount)
    const pricing = validateCatalogItemPricing({
      unitAmount,
      taxRateId: discount ? null : taxRateId,
      vatPayer,
      originalUnitAmount: null,
    })
    if (!pricing.ok) {
      ctx.issues.push({
        code: "custom",
        message: pricing.error.type,
        input: value,
        params: { pricingError: pricing.error.type },
      })
      return z.NEVER
    }

    return unitAmount
  })

/**
 * The same price rule as a codec, for the edit form's inline price field:
 * minor units in the row, the decimal string the input shows. Built per
 * currency for the same reason `createPriceSchema` is. It reads the amount
 * only: whether a VAT payer's item may cost zero depends on its VAT rate,
 * which `updateCatalogItem` judges against the stored row
 * (`updateCatalogItemErrorKeys` has the messages).
 *
 * `discount` is whether the item being edited is one (`isDiscountPrice` of
 * its stored price). Its sign was set when it was created and stays
 * (catalog/0002), so the field shows and takes the amount without it, as the
 * create form's switch does, and zero is refused as there.
 *
 * The output side is the plain integer schema rather than
 * `createPriceSchema`, because `z.encode` runs the output schema backwards
 * and a `.transform()` has no backwards. `NaN` stands in for an amount
 * the codec rejected; the schema turns it into the issue.
 */
export const createPriceCodec = ({
  currency,
  discount,
}: {
  readonly currency: FiatCurrency
  readonly discount: boolean
}) =>
  z.codec(z.string(), IntegerSchema, {
    decode: (value) => {
      const minorUnits = decimalPriceToMinorUnits({ currency, value })
      if (minorUnits === null || (discount && minorUnits === 0)) {
        return Number.NaN
      }
      return signedPrice(minorUnits, discount)
    },
    encode: (value) =>
      minorUnitsToDecimalString({
        value: Integer(Math.abs(value)),
        currency,
      }),
  })

/**
 * The message an inline price field shows for text `createPriceCodec`
 * refuses: a zero discount's own (catalog/0002) only where the text is a
 * well-formed zero, the price's for anything malformed, as the create form
 * tells them apart (`createPriceSchema`).
 */
export const createPriceErrorKey =
  ({
    currency,
    discount,
  }: {
    readonly currency: FiatCurrency
    readonly discount: boolean
  }) =>
  (value: string): TranslationKey =>
    discount && decimalPriceToMinorUnits({ currency, value }) === 0
      ? discountZeroErrorKey
      : catalogItemFieldErrorKeys.price

const createCatalogItemFormSchema = (context: CatalogItemFormContext) =>
  z.object({
    name: RequiredTextSchema,
    price: createPriceSchema(context),
    description: OptionalTextSchema,
    internalName: OptionalTextSchema,
    internalDescription: OptionalTextSchema,
    sku: OptionalTextSchema,
    scanCode: OptionalTextSchema,
  })

type CatalogItemFormFieldValues = z.output<
  ReturnType<typeof createCatalogItemFormSchema>
>

/**
 * What the form hands the create action: the fields as parsed, and the VAT
 * rate the item is saved with, `null` for a discount (catalog/0002).
 */
type CatalogItemFormValues = CatalogItemFormFieldValues & {
  readonly taxRateId: TaxRateId | null
}

/** The raw strings the inputs hold, before any of it is validated. */
export type CatalogItemFormInput = z.input<
  ReturnType<typeof createCatalogItemFormSchema>
>

type CatalogItemFormField = keyof CatalogItemFormFieldValues

/** Which message each field shows when it fails. */
const catalogItemFieldErrorKeys = {
  name: "catalog.items.form.name.invalid",
  price: "catalog.items.form.price.invalid",
  description: "catalog.items.form.description.invalid",
  internalName: "catalog.items.form.internalName.invalid",
  internalDescription: "catalog.items.form.internalDescription.invalid",
  sku: "catalog.items.form.sku.invalid",
  scanCode: "catalog.items.form.scanCode.invalid",
} satisfies Record<CatalogItemFormField, TranslationKey>

export type CatalogItemFormErrors = Partial<
  Record<CatalogItemFormField, TranslationKey>
>

const isCatalogItemFormField = (
  value: PropertyKey | undefined
): value is CatalogItemFormField =>
  typeof value === "string" && value in catalogItemFieldErrorKeys

/**
 * The message one issue shows: a zero discount's or a pricing refusal's own,
 * or its field's.
 */
const issueErrorKey = (
  field: CatalogItemFormField,
  issue: z.core.$ZodIssue
): TranslationKey => {
  const params = issue.code === "custom" ? issue.params : undefined
  if (params?.discountZero === true) return discountZeroErrorKey
  const pricingError = params?.pricingError
  return isCatalogItemPricingErrorType(pricingError)
    ? catalogItemPricingErrorKeys[pricingError]
    : catalogItemFieldErrorKeys[field]
}

/**
 * Validates every field of the catalog-item form at once, so a submit
 * reports all of its problems rather than only the first one in field
 * order, and hands back values the domain actions take as they are. The
 * price is judged together with the VAT rate picked beside it
 * (`validateCatalogItemPricing`), and a refusal shows at the price; with the
 * Discount switch on it comes back below zero and without a VAT rate
 * (catalog/0002).
 */
export const parseCatalogItemForm = (
  input: CatalogItemFormInput,
  context: CatalogItemFormContext
): Result<CatalogItemFormValues, CatalogItemFormErrors> => {
  const parsed = createCatalogItemFormSchema(context).safeParse(input)
  if (parsed.success) {
    return ok({
      ...parsed.data,
      taxRateId: context.discount ? null : context.taxRateId,
    })
  }

  return err(
    Object.fromEntries(
      parsed.error.issues.flatMap((issue) => {
        const field = issue.path[0]
        return isCatalogItemFormField(field)
          ? [[field, issueErrorKey(field, issue)]]
          : []
      })
    )
  )
}
