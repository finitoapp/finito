import { err, ok, type Result } from "@evolu/common"
import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import {
  decimalAmountToMinorUnits,
  minorUnitsToDecimalString,
} from "@payky/core/modules/shared/money"
import {
  type FiatCurrency,
  Integer,
  NonEmptyString255Schema,
  NonNegativeInteger,
  NonNegativeIntegerSchema,
} from "@payky/core/modules/shared/schema"
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

/**
 * The price as typed, in the currency picked next to it — how many minor
 * units it means depends on that currency, so the schema is built per
 * submit rather than once at module load. `decimalAmountToMinorUnits`
 * already trims, rejects a negative or non-numeric amount, and rejects more
 * fraction digits than the currency has, returning `null` for all of them.
 */
const createPriceSchema = (currency: FiatCurrency) =>
  z.string().transform((value, ctx) => {
    const minorUnits = decimalAmountToMinorUnits({ currency, value })
    if (minorUnits === null) {
      ctx.issues.push({
        code: "custom",
        message: "Invalid price",
        input: value,
      })
      return z.NEVER
    }

    return NonNegativeInteger(minorUnits)
  })

/**
 * The same price rule as a codec, for the inline-edit field: minor units in
 * the row, the decimal string the input shows. Built per currency for the
 * same reason `createPriceSchema` is.
 *
 * The output side is the plain integer schema rather than
 * `createPriceSchema`, because `z.encode` runs the output schema backwards
 * and a `.transform()` has no backwards. `NaN` stands in for an amount
 * `decimalAmountToMinorUnits` rejected; the schema turns it into the issue.
 */
export const createPriceCodec = (currency: FiatCurrency) =>
  z.codec(z.string(), NonNegativeIntegerSchema, {
    decode: (value) =>
      decimalAmountToMinorUnits({ currency, value }) ?? Number.NaN,
    encode: (value) =>
      minorUnitsToDecimalString({ value: Integer(value), currency }),
  })

const createCatalogItemFormSchema = (currency: FiatCurrency) =>
  z.object({
    name: RequiredTextSchema,
    price: createPriceSchema(currency),
    description: OptionalTextSchema,
    internalName: OptionalTextSchema,
    internalDescription: OptionalTextSchema,
    sku: OptionalTextSchema,
    scanCode: OptionalTextSchema,
  })

type CatalogItemFormValues = z.output<
  ReturnType<typeof createCatalogItemFormSchema>
>

/** The raw strings the inputs hold, before any of it is validated. */
export type CatalogItemFormInput = z.input<
  ReturnType<typeof createCatalogItemFormSchema>
>

type CatalogItemFormField = keyof CatalogItemFormValues

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
 * Validates every field of the catalog-item form at once, so a submit
 * reports all of its problems rather than only the first one in field
 * order, and hands back values the domain actions take as they are.
 */
export const parseCatalogItemForm = (
  input: CatalogItemFormInput,
  currency: FiatCurrency
): Result<CatalogItemFormValues, CatalogItemFormErrors> => {
  const parsed = createCatalogItemFormSchema(currency).safeParse(input)
  if (parsed.success) return ok(parsed.data)

  return err(
    Object.fromEntries(
      parsed.error.issues
        .map((issue) => issue.path[0])
        .filter(isCatalogItemFormField)
        .map((field) => [field, catalogItemFieldErrorKeys[field]])
    )
  )
}
