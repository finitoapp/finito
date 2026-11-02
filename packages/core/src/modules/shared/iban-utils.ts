import { err, ok, type Result } from "@evolu/common"
import { z } from "zod"

import { defineError } from "../../error.ts"

import { czechBankNames } from "./czech-bank-codes.ts"

const ibanCountryLengths: Readonly<Record<string, number>> = {
  AD: 24,
  AE: 23,
  AL: 28,
  AT: 20,
  AZ: 28,
  BA: 20,
  BE: 16,
  BG: 22,
  BH: 22,
  BR: 29,
  BY: 28,
  CH: 21,
  CR: 22,
  CY: 28,
  CZ: 24,
  DE: 22,
  DK: 18,
  DO: 28,
  EE: 20,
  EG: 29,
  ES: 24,
  FI: 18,
  FO: 18,
  FR: 27,
  GB: 22,
  GE: 22,
  GI: 23,
  GL: 18,
  GR: 27,
  GT: 28,
  HR: 21,
  HU: 28,
  IE: 22,
  IL: 23,
  IQ: 23,
  IS: 26,
  IT: 27,
  JO: 30,
  KW: 30,
  KZ: 20,
  LB: 28,
  LC: 32,
  LI: 21,
  LT: 20,
  LU: 20,
  LV: 21,
  MC: 27,
  MD: 24,
  ME: 22,
  MK: 19,
  MR: 27,
  MT: 31,
  MU: 30,
  NL: 18,
  NO: 15,
  PK: 24,
  PL: 28,
  PS: 29,
  PT: 25,
  QA: 29,
  RO: 24,
  RS: 22,
  SA: 24,
  SC: 31,
  SE: 24,
  SI: 19,
  SK: 24,
  SM: 27,
  ST: 25,
  SV: 28,
  TL: 23,
  TN: 24,
  TR: 26,
  UA: 29,
  VA: 22,
  VG: 24,
  XK: 20,
} as const

const czechBbanPattern = /^(?:(\d{1,6})-)?(\d{1,10})\/(\d{4})$/u

export const createInvalidBankAccountInputError = defineError(
  "InvalidBankAccountInput"
)()
export type InvalidBankAccountInputError = ReturnType<
  typeof createInvalidBankAccountInputError
>

type BankAccountInputResult = Result<string, InvalidBankAccountInputError>

export const normalizeIbanInput = (value: string) =>
  value.replaceAll(/\s/gu, "").toUpperCase()

const getIbanRemainder = (value: string) => {
  let remainder = 0

  for (const char of value) {
    const charCode = char.charCodeAt(0)
    const digits =
      charCode >= 65 && charCode <= 90 ? String(charCode - 55) : char

    for (const digit of digits) {
      remainder = (remainder * 10 + Number(digit)) % 97
    }
  }

  return remainder
}

/**
 * Fio banka's bank code per country — the four digits right after the check
 * digits in a CZ or SK IBAN. The Fio API serves both, so either counts.
 */
const fioBankCodes: Readonly<Record<string, string>> = {
  CZ: "2010",
  SK: "8330",
}

export const isFioBankIban = (value: string) => {
  const iban = normalizeIbanInput(value)

  return fioBankCodes[iban.slice(0, 2)] === iban.slice(4, 8)
}

/**
 * MONETA Money Bank's code in a CZ IBAN. Its VIP API serves Czech accounts
 * only, so an SK IBAN never counts.
 */
const monetaBankCode = "0600"

export const isMonetaBankIban = (value: string) => {
  const iban = normalizeIbanInput(value)

  return iban.startsWith("CZ") && iban.slice(4, 8) === monetaBankCode
}

export const isValidIban = (value: string) => {
  const iban = normalizeIbanInput(value)

  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/u.test(iban)) {
    return false
  }

  const expectedLength = ibanCountryLengths[iban.slice(0, 2)]

  if (expectedLength === undefined || iban.length !== expectedLength) {
    return false
  }

  return getIbanRemainder(`${iban.slice(4)}${iban.slice(0, 4)}`) === 1
}

const createIbanFromCountryAndBban = (countryCode: string, bban: string) => {
  const checkDigits = 98 - getIbanRemainder(`${bban}${countryCode}00`)
  return `${countryCode}${String(checkDigits).padStart(2, "0")}${bban}`
}

const normalizeCzechBbanInput = (value: string) => {
  const normalizedValue = value.replaceAll(/\s/gu, "")
  const match = czechBbanPattern.exec(normalizedValue)

  if (!match) {
    return null
  }

  const [, prefix = "", accountNumber, bankCode] = match

  if (accountNumber === undefined || bankCode === undefined) {
    return null
  }

  return `${bankCode}${prefix.padStart(6, "0")}${accountNumber.padStart(10, "0")}`
}

export const BbanSchema = z
  .string()
  .transform((value, context) => {
    const bban = normalizeCzechBbanInput(value)

    if (bban === null) {
      context.addIssue({
        code: "custom",
        message: "Invalid BBAN.",
      })

      return z.NEVER
    }

    return bban
  })
  .brand<"Bban">()
type Bban = z.output<typeof BbanSchema>

export const czechBbanToIban = (bban: Bban) => {
  return createIbanFromCountryAndBban("CZ", bban)
}

export const normalizeBankAccountInputToIban = (
  value: string
): BankAccountInputResult => {
  const iban = normalizeIbanInput(value)

  if (isValidIban(iban)) {
    return ok(iban)
  }

  const bban = BbanSchema.safeParse(value)
  const czechIban = bban.success ? czechBbanToIban(bban.data) : null

  if (czechIban && isValidIban(czechIban)) {
    return ok(czechIban)
  }

  return err(createInvalidBankAccountInputError())
}

/**
 * The Czech account number (`prefix-number/bank`, leading zeros dropped) a CZ
 * IBAN encodes, or `null` for any other IBAN.
 */
export const czechIbanToBban = (value: string) => {
  const iban = normalizeIbanInput(value)
  if (!iban.startsWith("CZ") || !isValidIban(iban)) return null

  const bankCode = iban.slice(4, 8)
  const prefix = iban.slice(8, 14).replace(/^0+/u, "")
  const accountNumber = iban.slice(14).replace(/^0+/u, "")

  return `${prefix === "" ? "" : `${prefix}-`}${accountNumber}/${bankCode}`
}

/** The bank a CZ IBAN belongs to, when the CNB register knows its code. */
export const czechBankNameForIban = (value: string) => {
  const iban = normalizeIbanInput(value)
  if (!iban.startsWith("CZ")) return undefined

  return czechBankNames[iban.slice(4, 8)]
}
