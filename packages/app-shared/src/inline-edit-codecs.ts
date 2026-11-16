import {
  DateStringSchema,
  NonEmptyString255Schema,
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
  TimestampMsSchema,
} from "@payky/core/modules/shared/schema"
import { format, parseISO } from "date-fns"
import { z } from "zod"

/**
 * The codecs inline-edit fields bridge their text through. Each one reads
 * `string` (what the control holds) on the input side and the stored value
 * on the output side, so the same object serves both directions.
 *
 * Their output side must not be a `.transform()` schema: `z.encode` runs it
 * backwards, and a transform has no backwards to run. That rules out the
 * `standardSchemaToZod` id schemas, which is why `optionalIdCodec` takes its
 * type as a parameter rather than the schema.
 */

/** A required text field; the schema does the trimming and the length cap. */
export const requiredTextCodec = z.codec(z.string(), NonEmptyString255Schema, {
  decode: (value) => value,
  encode: (value) => value,
})

/** The same, except blank means "not set". */
export const optionalTextCodec = z.codec(
  z.string(),
  NonEmptyString255Schema.nullable(),
  {
    decode: (value) => (value.trim() === "" ? null : value),
    encode: (value) => value ?? "",
  }
)

/** The value a select uses for its "not set" option. */
export const NO_OPTION = "none"

/**
 * A select over optional rows: the id as the option value, `NO_OPTION` for
 * the row not being set at all. The id itself is not re-validated — every
 * option value comes from a row the page already loaded, not from the user.
 */
export const optionalIdCodec = <T extends string>(noneValue = NO_OPTION) =>
  z.codec(z.string(), z.custom<T | null>(), {
    decode: (value) => (value === noneValue ? null : (value as T)),
    encode: (value) => value ?? noneValue,
  })

/**
 * Digits only, so the loose corners of `Number` ("1e3", "0x10", " 12 ", "")
 * stay rejected the way the `*FromStringSchema` regexes reject them. `NaN`
 * is what the integer schema turns into the issue.
 */
const wholeNumberFromText = (value: string): number =>
  /^\d+$/u.test(value.trim()) ? Number(value.trim()) : Number.NaN

export const nonNegativeIntegerCodec = z.codec(
  z.string(),
  NonNegativeIntegerSchema,
  { decode: wholeNumberFromText, encode: String }
)

export const positiveIntegerCodec = z.codec(z.string(), PositiveIntegerSchema, {
  decode: wholeNumberFromText,
  encode: String,
})

/** The same, except blank means "not set". */
export const optionalPositiveIntegerCodec = z.codec(
  z.string(),
  PositiveIntegerSchema.nullable(),
  {
    decode: (value) =>
      value.trim() === "" ? null : wholeNumberFromText(value),
    encode: (value) => (value === null ? "" : String(value)),
  }
)

/** For `<Input type="date">`, whose value is already `yyyy-MM-dd`. */
export const dateCodec = z.codec(z.string(), DateStringSchema, {
  decode: (value) => value.trim(),
  encode: (value) => value,
})

/** The same, except blank means "not set". */
export const optionalDateCodec = z.codec(
  z.string(),
  DateStringSchema.nullable(),
  {
    decode: (value) => (value.trim() === "" ? null : value.trim()),
    encode: (value) => value ?? "",
  }
)

/**
 * For `<Input type="date">` fields backing a precise `TimestampMs` instead of
 * a `DateString` — decodes to local midnight of the chosen day, the same
 * local-clock convention `dateToDateString`/`dateStringToDate`
 * (`core/modules/shared/date-string-utils.ts`) use for date-only values.
 */
export const timestampMsDateCodec = z.codec(z.string(), TimestampMsSchema, {
  decode: (value) => parseISO(value.trim()).getTime(),
  encode: (value) => format(new Date(value), "yyyy-MM-dd"),
})
