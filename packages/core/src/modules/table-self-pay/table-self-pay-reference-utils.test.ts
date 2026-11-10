import { describe, expect, test } from "vitest"

import {
  createRandomText,
  createSeededRandom,
} from "../../testing/seeded-random.ts"

import {
  deriveBillSelfPayReference,
  deriveOrderSelfPayReference,
  deriveSelfPayPointerHash,
  formatSelfPayBankMessage,
  formatSelfPayLightningMemo,
  isOrderSelfPayReference,
  parseSelfPayBankMessage,
  parseSelfPayLightningMemo,
  SelfPayPointerSchema,
} from "./table-self-pay-reference-utils.ts"

const pointer = SelfPayPointerSchema.decode("K7QF2MX4TB3QAWZR5HLCE6DN3PJ4YV2G")
const otherPointer = SelfPayPointerSchema.decode("Z".repeat(32))
const memo = {
  reference: deriveBillSelfPayReference("bill-1"),
  pointer,
  amount: 22_000,
  rate: {
    msatPerMajor: 40_000,
    validFrom: 1_790_000_000,
    tag: "ABCDEFGHIJKLMNOP",
  },
}

describe("deriveBillSelfPayReference", () => {
  test("is stable for a bill", () => {
    expect(deriveBillSelfPayReference("bill-1")).toBe(
      deriveBillSelfPayReference("bill-1")
    )
    expect(deriveBillSelfPayReference("bill-1")).not.toBe(
      deriveBillSelfPayReference("bill-2")
    )
  })

  test("is always ten digits that start with 1 to 8", () => {
    for (let index = 0; index < 2000; index++) {
      const reference = deriveBillSelfPayReference(`bill-${index}`)
      expect(reference).toMatch(/^[1-8]\d{9}$/u)
      expect(isOrderSelfPayReference(reference)).toBe(false)
    }
  })

  test("never shares a reference with an order, whose references start with 9", () => {
    for (let index = 0; index < 2000; index++) {
      const reference = deriveOrderSelfPayReference(`pointer-${index}`)
      expect(reference).toMatch(/^9\d{9}$/u)
      expect(isOrderSelfPayReference(reference)).toBe(true)
    }
  })
})

describe("pointer hash", () => {
  test("is a short confirmation id", () => {
    expect(deriveSelfPayPointerHash(pointer)).toMatch(/^[0-9a-f]{16}$/u)
    expect(deriveSelfPayPointerHash(pointer)).not.toBe(
      deriveSelfPayPointerHash(otherPointer)
    )
  })
})

describe("bank message", () => {
  test("is PK1 and the pointer in 35 characters, one line of a Czech interbank message", () => {
    const message = formatSelfPayBankMessage({ pointer })

    expect(message).toBe("PK1K7QF2MX4TB3QAWZR5HLCE6DN3PJ4YV2G")
    expect(message).toHaveLength(35)
    expect(parseSelfPayBankMessage(message)).toEqual({ pointer })
  })

  test("survives a bank that wraps, trims and lower-cases the message", () => {
    expect(
      parseSelfPayBankMessage(
        ` pk1 ${pointer.slice(0, 9).toLowerCase()}\n ${pointer.slice(9)} `
      )
    ).toEqual({ pointer })
  })

  test.each([
    null,
    "",
    "hello",
    "PK1",
    "PK1 ",
    `PK1${pointer.slice(0, -1)}`,
    `PK1${pointer}A`,
    `PK1${pointer}1`,
    `PK1${pointer.slice(0, -1)}!`,
    `xPK1${pointer}`,
  ])("rejects %s", (message) => {
    expect(parseSelfPayBankMessage(message)).toBe(null)
  })
})

describe("Lightning memo", () => {
  test("round-trips everything the terminal needs", () => {
    const text = formatSelfPayLightningMemo(memo)

    expect(text).toBe(
      `PK1 ${memo.reference} ${pointer} A22000 R40000.1790000000.ABCDEFGHIJKLMNOP`
    )
    expect(parseSelfPayLightningMemo(text)).toEqual(memo)
  })

  test("fits the pointer, a twelve-digit amount and a fifteen-digit rate into 108 of the 120 bytes", () => {
    const longest = {
      ...memo,
      amount: 999_999_999_999,
      rate: {
        ...memo.rate,
        msatPerMajor: 999_999_999_999_999,
        validFrom: 999_999_999_999,
      },
    }
    const text = formatSelfPayLightningMemo(longest)

    expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(108)
    expect(parseSelfPayLightningMemo(text)).toEqual(longest)
  })

  test.each([
    null,
    "",
    `PK1 ${memo.reference} ${pointer} A1`,
    `PK1 ${memo.reference} ${pointer} R1.2.ABCDEFGHIJKLMNOP`,
    `PK1 012345678 ${pointer} A1 R1.2.ABCDEFGHIJKLMNOP`,
    `PK1 ${memo.reference} ${pointer} A1 R1.2.ABCDEF`,
    `PK1 ${memo.reference} ${pointer} A1 R1.2.ABCDEFGHIJKLMNOP tail`,
    `Table 3 · PK1 ${memo.reference} ${pointer} A1 R1.2.ABCDEFGHIJKLMNOP`,
    `PK1 ${memo.reference} ${pointer.slice(0, -1)} A1 R1.2.ABCDEFGHIJKLMNOP`,
    `PK1 ${memo.reference} ${pointer}A A1 R1.2.ABCDEFGHIJKLMNOP`,
  ])("rejects %s", (text) => {
    expect(parseSelfPayLightningMemo(text)).toBe(null)
  })

  test("rejects a memo over the length cap", () => {
    const text = `${formatSelfPayLightningMemo(memo)}${" ".repeat(700)}`

    expect(parseSelfPayLightningMemo(text)).toBe(null)
  })
})

describe("grammar fuzz", () => {
  test("parses nothing outside the grammar", () => {
    const random = createSeededRandom(7)
    const alphabet =
      "PK1 AR.0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ234567·x\n\u0000"
    for (let run = 0; run < 5000; run++) {
      const length = random(900)
      const text = Array.from(
        { length },
        () => alphabet[random(alphabet.length)]
      ).join("")
      const bank = parseSelfPayBankMessage(text)
      const lightning = parseSelfPayLightningMemo(text)

      if (bank !== null) {
        expect(text.length).toBeLessThanOrEqual(140)
        expect(`PK1${bank.pointer}`).toBe(
          text.replaceAll(/\s/gu, "").toUpperCase()
        )
      }
      if (lightning !== null) {
        expect(formatSelfPayLightningMemo(lightning)).toBe(text)
      }
    }
  })

  test("rejects every mutation of a valid memo's grammar characters", () => {
    const valid = formatSelfPayLightningMemo(memo)
    for (let index = 0; index < valid.length; index++) {
      const mutated = `${valid.slice(0, index)}!${valid.slice(index + 1)}`
      expect(parseSelfPayLightningMemo(mutated)).toBe(null)
    }
  })

  test("reads random text without throwing, and only as what it formats back to", () => {
    const random = createSeededRandom(20_261_015)
    for (let run = 0; run < 20_000; run++) {
      const text = createRandomText(random, 80)
      const message = parseSelfPayBankMessage(text)
      const memo = parseSelfPayLightningMemo(text)

      if (message !== null) {
        expect(
          parseSelfPayBankMessage(formatSelfPayBankMessage(message))
        ).toEqual(message)
      }
      if (memo !== null) {
        expect(
          parseSelfPayLightningMemo(formatSelfPayLightningMemo(memo))
        ).toEqual(memo)
      }
    }
  })
})
