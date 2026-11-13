import { z } from "zod"

import { jsonCodec } from "../../zod-utils.ts"

export const maxTipPresetCount = 4

export const defaultTipPercentages = [5, 10, 15] as const
export const defaultTipFixedAmounts = [] as const

const hasUniqueValues = (values: ReadonlyArray<number>): boolean =>
  new Set(values).size === values.length

export const TipPercentagesSchema = z
  .array(z.number().int().min(1).max(100))
  .max(maxTipPresetCount)
  .refine(hasUniqueValues, "Tip percentages must be unique.")
  .readonly()
export type TipPercentages = z.output<typeof TipPercentagesSchema>

export const TipFixedAmountsSchema = z
  .array(z.number().int().positive())
  .max(maxTipPresetCount)
  .refine(hasUniqueValues, "Tip fixed amounts must be unique.")
  .readonly()
export type TipFixedAmounts = z.output<typeof TipFixedAmountsSchema>

const TipPercentagesJson = jsonCodec(TipPercentagesSchema)
const TipFixedAmountsJson = jsonCodec(TipFixedAmountsSchema)

const parseTipPreset = <Value>(
  value: string | null | undefined,
  codec: z.ZodType<Value, string>,
  fallback: Value
): Value => {
  if (value === null || value === undefined) return fallback

  const parsed = z.safeDecode(codec, value)
  return parsed.success ? parsed.data : fallback
}

export const parseTipPercentages = (
  value: string | null | undefined
): TipPercentages =>
  parseTipPreset(value, TipPercentagesJson, defaultTipPercentages)

export const parseTipFixedAmounts = (
  value: string | null | undefined
): TipFixedAmounts =>
  parseTipPreset(value, TipFixedAmountsJson, defaultTipFixedAmounts)

export const stringifyTipPercentages = (
  values: ReadonlyArray<number>
): string => z.encode(TipPercentagesJson, values)

export const stringifyTipFixedAmounts = (
  values: ReadonlyArray<number>
): string => z.encode(TipFixedAmountsJson, values)
