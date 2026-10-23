import { equalBytes } from "@noble/curves/utils.js"
import { hmac } from "@noble/hashes/hmac.js"
import { sha256 } from "@noble/hashes/sha2.js"
import { base32nopad } from "@scure/base"

import { SATS_PER_BTC } from "../shared/money.ts"
import type { FiatCurrency } from "../shared/schema.ts"
import type { SelfPayMemoRate } from "./table-self-pay-reference-utils.ts"

const MSAT_PER_SAT = 1000
const MSAT_PER_BTC = SATS_PER_BTC * MSAT_PER_SAT
const RATE_WINDOW_SECONDS = 60 * 60
const RATE_TAG_BYTES = 10

interface SelfPayRate {
  readonly currency: FiatCurrency
  readonly msatPerMajor: number
  readonly validFrom: number
}

export const SELF_PAY_INVOICE_EXPIRY_SECONDS = 10 * 60

export const selfPayRateValidUntil = (validFrom: number): number =>
  validFrom + RATE_WINDOW_SECONDS

export const selfPayRatePayableUntil = (validFrom: number): number =>
  selfPayRateValidUntil(validFrom) + SELF_PAY_INVOICE_EXPIRY_SECONDS

const computeRateTag = (rateKey: Uint8Array, rate: SelfPayRate): Uint8Array =>
  hmac(
    sha256,
    rateKey,
    new TextEncoder().encode(
      `${rate.currency}|${rate.msatPerMajor}|${rate.validFrom}`
    )
  ).slice(0, RATE_TAG_BYTES)

export const createSelfPayRate = ({
  currency,
  exchangeRate,
  now,
}: {
  readonly currency: FiatCurrency
  readonly exchangeRate: number
  readonly now: Date
}): SelfPayRate => {
  return {
    currency,
    msatPerMajor: Math.max(1, Math.round(MSAT_PER_BTC / exchangeRate)),
    validFrom: Math.floor(now.getTime() / 1000),
  }
}

export const selfPayExchangeRate = (msatPerMajor: number): number =>
  MSAT_PER_BTC / msatPerMajor

export const signSelfPayRate = (
  rateKey: Uint8Array,
  rate: SelfPayRate
): SelfPayMemoRate => ({
  msatPerMajor: rate.msatPerMajor,
  validFrom: rate.validFrom,
  tag: base32nopad.encode(computeRateTag(rateKey, rate)),
})

export const verifySelfPayRate = (
  rateKey: Uint8Array,
  currency: FiatCurrency,
  { tag, ...rate }: SelfPayMemoRate
): boolean => {
  try {
    return equalBytes(
      base32nopad.decode(tag),
      computeRateTag(rateKey, { currency, ...rate })
    )
  } catch {
    return false
  }
}

const rateScale = (fractionDigits: number): bigint =>
  BigInt(MSAT_PER_SAT) * 10n ** BigInt(fractionDigits)

export const selfPaySatsForAmount = ({
  amount,
  fractionDigits,
  msatPerMajor,
}: {
  readonly amount: number
  readonly fractionDigits: number
  readonly msatPerMajor: number
}): number => {
  const scale = rateScale(fractionDigits)
  const numerator = BigInt(amount) * BigInt(msatPerMajor)
  return Number((numerator + scale - 1n) / scale)
}

export const selfPayCreditForSats = ({
  sats,
  fractionDigits,
  msatPerMajor,
}: {
  readonly sats: number
  readonly fractionDigits: number
  readonly msatPerMajor: number
}): number =>
  Number((BigInt(sats) * rateScale(fractionDigits)) / BigInt(msatPerMajor))
