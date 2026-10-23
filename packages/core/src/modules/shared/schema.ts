import type { FiniteNumber, StandardSchemaV1 } from "@evolu/common"
import type { ValueOf } from "type-fest"
import { z } from "zod"

import { isValidBitcoinAddress } from "./bitcoin-address-utils.ts"
import {
  isValidIban,
  normalizeBankAccountInputToIban,
  normalizeIbanInput,
} from "./iban-utils.ts"

export type InferTable<T extends Readonly<Record<string, StandardSchemaV1>>> =
  Readonly<{
    [K in keyof T]: StandardSchemaV1.InferOutput<T[K]>
  }>

const addCustomBrand =
  <B>() =>
  <T extends z.ZodType>(schema: T) =>
    schema as z.core.$ZodNarrow<T, z.output<T> & B>

export const FiniteNumberSchema = addCustomBrand<FiniteNumber>()(z.number())
export const TimestampMsSchema = FiniteNumberSchema.int()
  .nonnegative()
  .brand<"TimestampMs">()
export type TimestampMs = z.output<typeof TimestampMsSchema>
export const TimestampMs = TimestampMsSchema.decode

export const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u)
  .brand<"DateString">()
export type DateString = z.output<typeof DateStringSchema>
export const NonEmptyStringSchema = z
  .string()
  .trim()
  .min(1)
  .brand<"NonEmptyString">()
export type NonEmptyString = z.output<typeof NonEmptyStringSchema>
export const NonEmptyString255Schema =
  NonEmptyStringSchema.max(255).brand<"NonEmptyString255">()
export type NonEmptyString255 = z.output<typeof NonEmptyString255Schema>
export const NonEmptyString255 = NonEmptyString255Schema.decode

export const SqliteTrueSchema = z.literal(1)

export const HexSchema = (bytes: number) =>
  z.string().regex(new RegExp(`^[0-9a-f]{${bytes * 2}}$`, "u"))

export const WssUrlSchema = z
  .url({ protocol: /^wss$/, abort: true })
  // `wss://user:pass@host` would put a credential into a stored, synced and
  // shown URL (and into error payloads); relays here are reached anonymously.
  .refine((value) => {
    const { username, password } = new URL(value)
    return username === "" && password === ""
  }, "A relay URL must not carry credentials.")
  .brand<"NonEmpty", "inout">()
  .brand<"WssUrl", "inout">()
export type WssUrl = z.output<typeof WssUrlSchema>
export const WssUrl = <T extends string>(value: T): WssUrl =>
  WssUrlSchema.parse(value)

export const IntegerSchema = FiniteNumberSchema.int().brand<"Int">()
export const Integer = IntegerSchema.decode
export const NonNegativeIntegerSchema =
  IntegerSchema.nonnegative().brand<"NonNegative">()
export type NonNegativeInteger = z.output<typeof NonNegativeIntegerSchema>
export const NonNegativeInteger = NonNegativeIntegerSchema.decode

export const PositiveIntegerSchema =
  NonNegativeIntegerSchema.positive().brand<"Positive">()
export type PositiveInteger = z.output<typeof PositiveIntegerSchema>
export const PositiveInteger = PositiveIntegerSchema.decode

export const NonNegativeNumberSchema =
  FiniteNumberSchema.nonnegative().brand<"NonNegative">()
export type NonNegativeNumber = z.output<typeof NonNegativeNumberSchema>
export const NonNegativeNumber = NonNegativeNumberSchema.decode

export const PositiveNumberSchema =
  FiniteNumberSchema.positive().brand<"Positive">()
export type PositiveNumber = z.output<typeof PositiveNumberSchema>
export const PositiveNumber = PositiveNumberSchema.decode

export const IntegerStringSchema = z
  .string()
  .regex(/^-?(?:0|[1-9]\d*)$/)
  .brand<"Int">()
export type IntegerString = z.output<typeof IntegerStringSchema>

export const NumberStringSchema = z
  .string()
  .regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/)
  .brand<"Float">()
export type NumberString = z.output<typeof NumberStringSchema>
export const NumberString = NumberStringSchema.decode

export const NumberFromStringSchema = z
  .string()
  .regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/)
  .transform((value) => Number(value))
export const NonNegativeNumberFromStringSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/)
  .transform((value) => Number(value) as NonNegativeNumber)
export const PositiveNumberFromStringSchema = z
  .string()
  .regex(/^(?:[1-9]\d*)(?:\.\d+)?$/)
  .transform((value) => Number(value) as PositiveNumber)

export const IntegerFromStringSchema = z
  .string()
  .regex(/^-?(?:0|[1-9]\d*)$/)
  .transform((value) => Number(value) as Integer)

export const NonNegativeIntegerFromStringSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d*)$/)
  .transform((value) => Number(value) as NonNegativeInteger)

export const PositiveIntegerFromStringSchema = z
  .string()
  .regex(/^(?:[1-9]\d*)$/)
  .transform((value) => Number(value) as PositiveInteger)

export const FiatCurrency = {
  USD: "USD",
  EUR: "EUR",
  CZK: "CZK",
} as const
export type FiatCurrency = ValueOf<typeof FiatCurrency>

export const Currency = {
  ...FiatCurrency,
  BTC: "BTC",
} as const
export type Currency = ValueOf<typeof Currency>

export const FiatCurrencySchema = z.enum(Object.values(FiatCurrency))
export const CurrencySchema = z.enum(Object.values(Currency))
export const SyncSourceSchema = z.enum(["manual", "auto"])
export const IbanSchema = z
  .string()
  .transform(normalizeIbanInput)
  .refine(isValidIban)
  .brand<"Iban">()
export type Iban = z.output<typeof IbanSchema>
export const BankAccountInputIbanSchema = z
  .string()
  .transform((value, context) => {
    const result = normalizeBankAccountInputToIban(value)

    if (!result.ok) {
      context.addIssue({
        code: "custom",
        message: "Invalid bank account input.",
      })

      return z.NEVER
    }

    return result.value as Iban
  })
export const BitcoinAddressSchema = z
  .string()
  .refine(isValidBitcoinAddress)
  .brand<"BitcoinAddress">()
export const BitcoinAddress = BitcoinAddressSchema.decode
export type BitcoinAddress = z.output<typeof BitcoinAddressSchema>
export const VariableSymbolSchema = z
  .string()
  .trim()
  .regex(/^\d{1,10}$/u)
  .brand<"VariableSymbol">()
export const VariableSymbol = VariableSymbolSchema.decode
export const ConstantSymbolSchema = z
  .string()
  .trim()
  .regex(/^\d{1,10}$/u)
  .brand<"ConstantSymbol">()
export const SpecificSymbolSchema = z
  .string()
  .trim()
  .regex(/^\d{1,10}$/u)
  .brand<"SpecificSymbol">()
export const SpecificSymbol = SpecificSymbolSchema.decode
export type SpecificSymbol = z.output<typeof SpecificSymbolSchema>

export type SyncSource = z.output<typeof SyncSourceSchema>
export type Integer = z.output<typeof IntegerSchema>
export type FloatString = z.output<typeof NumberStringSchema>
export type VariableSymbol = z.output<typeof VariableSymbolSchema>
export type ConstantSymbol = z.output<typeof ConstantSymbolSchema>

declare global {
  interface BigInt {
    toString(radix?: number): IntegerString
  }

  interface DateConstructor {
    now(): TimestampMs
    parse(s: string): TimestampMs
  }

  interface Date {
    getTime(): TimestampMs
  }
}
