import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { positiveIntegerCodec } from "@payky/app-shared/inline-edit-codecs"
import {
  type NonEmptyString255,
  NonEmptyString255Schema,
  type PositiveInteger,
} from "@payky/core/modules/shared/schema"
import { z } from "zod"

export type TableFormResult =
  | {
      readonly ok: true
      readonly name: NonEmptyString255
      readonly seatCount: PositiveInteger
    }
  | {
      readonly ok: false
      readonly field: "name" | "seatCount"
      readonly errorKey: TranslationKey
    }

/** Validates the "add a table" form: the name first, then the seat count. */
export const parseTableForm = (input: {
  readonly name: string
  readonly seatCount: string
}): TableFormResult => {
  const name = NonEmptyString255Schema.safeParse(input.name.trim())
  if (!name.success) {
    return {
      ok: false,
      field: "name",
      errorKey: "catalog.tables.form.name.invalid",
    }
  }
  const seatCount = z.safeDecode(positiveIntegerCodec, input.seatCount)
  if (!seatCount.success) {
    return {
      ok: false,
      field: "seatCount",
      errorKey: "catalog.tables.form.seatCount.invalid",
    }
  }
  return { ok: true, name: name.data, seatCount: seatCount.data }
}
