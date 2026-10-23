import { describe, expect, test } from "vitest"

import { createSeededRandom } from "../../testing/seeded-random.ts"

import {
  createSelfPayRate,
  selfPayCreditForSats,
  selfPayRateValidUntil,
  selfPaySatsForAmount,
  signSelfPayRate,
  verifySelfPayRate,
} from "./table-self-pay-rate-utils.ts"

const rateKey = Uint8Array.from({ length: 32 }, (_, index) => index)
const now = new Date("2026-09-29T12:00:00Z")

describe("createSelfPayRate", () => {
  test("turns a fiat-per-BTC quote into msat per major unit for an hour", () => {
    const rate = createSelfPayRate({
      currency: "CZK",
      exchangeRate: 2_500_000,
      now,
    })

    expect(rate).toEqual({
      currency: "CZK",
      msatPerMajor: 40_000,
      validFrom: 1_790_683_200,
    })
    expect(selfPayRateValidUntil(rate.validFrom)).toBe(1_790_686_800)
  })
})

describe("rate MAC", () => {
  const rate = createSelfPayRate({
    currency: "CZK",
    exchangeRate: 2_500_000,
    now,
  })
  const signed = signSelfPayRate(rateKey, rate)

  test("verifies a rate the merchant signed", () => {
    expect(signed.tag).toMatch(/^[A-Z2-7]{16}$/u)
    expect(verifySelfPayRate(rateKey, "CZK", signed)).toBe(true)
  })

  test.each([
    ["the rate", { ...signed, msatPerMajor: signed.msatPerMajor - 1 }],
    ["the start", { ...signed, validFrom: signed.validFrom - 3600 }],
    ["the tag", { ...signed, tag: "A".repeat(16) }],
    ["the tag encoding", { ...signed, tag: "not base32" }],
  ])("fails when %s changed", (_name, forged) => {
    expect(verifySelfPayRate(rateKey, "CZK", forged)).toBe(false)
  })

  test("fails for another currency or another merchant", () => {
    expect(verifySelfPayRate(rateKey, "EUR", signed)).toBe(false)
    expect(verifySelfPayRate(new Uint8Array(32), "CZK", signed)).toBe(false)
  })
})

describe("sats conversion", () => {
  test("credits a 450.00 CZK share whole", () => {
    const sats = selfPaySatsForAmount({
      amount: 45_000,
      fractionDigits: 2,
      msatPerMajor: 40_000,
    })

    expect(sats).toBe(18_000)
    expect(
      selfPayCreditForSats({ sats, fractionDigits: 2, msatPerMajor: 40_000 })
    ).toBe(45_000)
  })

  test("never credits less than the chosen amount for any fraction digits", () => {
    const random = createSeededRandom(11)
    for (let run = 0; run < 20_000; run++) {
      const fractionDigits = run % 4
      const amount = 1 + random(100_000_000)
      const msatPerMajor = 1 + random(5_000_000)
      const sats = selfPaySatsForAmount({
        amount,
        fractionDigits,
        msatPerMajor,
      })

      expect(
        selfPayCreditForSats({ sats, fractionDigits, msatPerMajor })
      ).toBeGreaterThanOrEqual(amount)
    }
  })
})
