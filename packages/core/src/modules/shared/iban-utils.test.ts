import { describe, expect, test } from "vitest"
import {
  BbanSchema,
  czechBankNameForIban,
  czechBbanToIban,
  czechIbanToBban,
  isFioBankIban,
  isMonetaBankIban,
  normalizeBankAccountInputToIban,
  normalizeIbanInput,
} from "./iban-utils.ts"
import { BankAccountInputIbanSchema, IbanSchema } from "./schema.ts"

describe("IBAN utilities", () => {
  test("normalizes IBAN spacing and case", () => {
    expect(normalizeIbanInput(" cz65 0800 0000 1920 0014 5399 ")).toBe(
      "CZ6508000000192000145399"
    )
  })

  test("normalizes valid IBAN schema output", () => {
    expect(IbanSchema.parse(" cz65 0800 0000 1920 0014 5399 ")).toBe(
      "CZ6508000000192000145399"
    )
  })

  test("normalizes bank account input schema output", () => {
    expect(BankAccountInputIbanSchema.parse("123456789/0100")).toBe(
      "CZ1801000000000123456789"
    )
  })

  test("validates IBAN checksum and country length", () => {
    expect(IbanSchema.safeParse("CZ6508000000192000145399").success).toBe(true)
    expect(IbanSchema.safeParse("CZ6508000000192000145398").success).toBe(false)
    expect(IbanSchema.safeParse("CZ650800000019200014539999").success).toBe(
      false
    )
  })

  test("normalizes Czech BBAN schema output", () => {
    expect(BbanSchema.parse("123-12345678/0100")).toBe("01000001230012345678")
    expect(BbanSchema.parse(" 123456789 / 0100 ")).toBe("01000000000123456789")
  })

  test("rejects invalid Czech BBAN schema input", () => {
    expect(BbanSchema.safeParse("/0100").success).toBe(false)
    expect(BbanSchema.safeParse("123456789/").success).toBe(false)
    expect(BbanSchema.safeParse("123456789/01000").success).toBe(false)
  })

  test("converts Czech BBAN type to normalized IBAN", () => {
    expect(czechBbanToIban(BbanSchema.parse("123456789/0100"))).toBe(
      "CZ1801000000000123456789"
    )
  })

  test("converts Czech BBAN without prefix to normalized IBAN", () => {
    expect(normalizeBankAccountInputToIban("123456789/0100")).toEqual({
      ok: true,
      value: "CZ1801000000000123456789",
    })
  })

  test("converts Czech BBAN with prefix to normalized IBAN", () => {
    expect(normalizeBankAccountInputToIban("123-12345678/0100")).toEqual({
      ok: true,
      value: "CZ5701000001230012345678",
    })
  })

  test("rejects BBAN with missing account number or bank code", () => {
    expect(normalizeBankAccountInputToIban("/0100")).toEqual({
      ok: false,
      error: { type: "InvalidBankAccountInput" },
    })
    expect(normalizeBankAccountInputToIban("123456789/")).toEqual({
      ok: false,
      error: { type: "InvalidBankAccountInput" },
    })
  })

  test("recognizes Fio banka IBANs by bank code", () => {
    expect(isFioBankIban("CZ65 2010 0000 0024 0028 9187")).toBe(true)
    expect(isFioBankIban("SK31 8330 0000 0021 0000 1234")).toBe(true)
    expect(isFioBankIban("CZ6508000000192000145399")).toBe(false)
    expect(isFioBankIban("SK3120100000002100001234")).toBe(false)
    expect(isFioBankIban("DE89370400440532013000")).toBe(false)
  })

  test("recognizes MONETA Money Bank IBANs by bank code", () => {
    expect(isMonetaBankIban("CZ38 0600 0000 0021 2345 6789")).toBe(true)
    expect(isMonetaBankIban("cz3806000000002123456789")).toBe(true)
    expect(isMonetaBankIban("CZ6508000000192000145399")).toBe(false)
    expect(isMonetaBankIban("CZ65 2010 0000 0024 0028 9187")).toBe(false)
    expect(isMonetaBankIban("SK3106000000002100001234")).toBe(false)
  })
})

describe("czechIbanToBban", () => {
  test("drops leading zeros and keeps a prefix", () => {
    expect(czechIbanToBban("CZ6508000000192000145399")).toBe(
      "19-2000145399/0800"
    )
    expect(czechIbanToBban("CZ1801000000000123456789")).toBe("123456789/0100")
  })

  test("round-trips through the BBAN parser", () => {
    const bban = czechIbanToBban("CZ6508000000192000145399")
    expect(bban).not.toBeNull()
    expect(czechBbanToIban(BbanSchema.parse(bban))).toBe(
      "CZ6508000000192000145399"
    )
  })

  test("returns null for non-CZ IBANs", () => {
    expect(czechIbanToBban("SK3112000000198742637541")).toBeNull()
  })
})

describe("czechBankNameForIban", () => {
  test("detects the bank from the bank code", () => {
    expect(czechBankNameForIban("CZ6508000000192000145399")).toBe(
      "Česká spořitelna, a.s."
    )
    expect(czechBankNameForIban("SK3112000000198742637541")).toBeUndefined()
  })
})
