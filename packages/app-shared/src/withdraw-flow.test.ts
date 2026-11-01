import { BitcoinAddress, FiatCurrency } from "@payky/core/modules/shared/schema"
import type {
  LightningWithdrawalQuote,
  OnchainWithdrawalQuote,
  SupportedWithdrawDestination,
  WithdrawalQuote,
} from "@payky/core/modules/withdraw/withdraw-actions"
import type { WithdrawalId } from "@payky/core/modules/withdraw/withdraw-types"
import { WITHDRAWAL_QUOTE_EXPIRY_MARGIN_MS } from "@payky/core/modules/withdraw/withdraw-utils"
import { describe, expect, test } from "vitest"
import { paykyBrand } from "./brand.ts"
import { createTranslate } from "./i18n/translate.ts"
import {
  amountFieldWarnings,
  buildWithdrawRequest,
  confirmOutcome,
  createWithdrawDraft,
  draftAmountSats,
  draftWithDestination,
  initialWithdrawState,
  pendingLightningText,
  pendingLightningTimes,
  quoteConfirmDeadline,
  withdrawAllUnavailableKey,
  withdrawPinDetail,
  withdrawReducer,
} from "./withdraw-flow.ts"

describe("draftAmountSats", () => {
  const noRate = { rate: null, currency: FiatCurrency.CZK }
  const czk = { rate: 2_000_000, currency: FiatCurrency.CZK }

  test("takes whole sats as typed", () => {
    expect(draftAmountSats({ amount: "1500", unit: "sats" }, noRate)).toBe(1500)
  })

  test("refuses fractional or empty sats", () => {
    expect(draftAmountSats({ amount: "1.5", unit: "sats" }, noRate)).toBeNull()
    expect(draftAmountSats({ amount: " ", unit: "sats" }, noRate)).toBeNull()
    expect(draftAmountSats({ amount: "1e3", unit: "sats" }, noRate)).toBeNull()
  })

  test("converts fiat with a comma at the rate", () => {
    // 2 000 000 CZK per BTC: 10 CZK is 500 sats.
    expect(draftAmountSats({ amount: "10,00", unit: "fiat" }, czk)).toBe(500)
  })

  test("refuses fiat with more fraction digits than the currency has", () => {
    expect(draftAmountSats({ amount: "10.001", unit: "fiat" }, czk)).toBeNull()
  })

  test("needs a rate for fiat", () => {
    expect(draftAmountSats({ amount: "10", unit: "fiat" }, noRate)).toBeNull()
  })
})

describe("withdrawReducer exit speed", () => {
  const onchainAddress = BitcoinAddress(
    "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"
  )
  const quote = (availableSats: number): OnchainWithdrawalQuote => ({
    kind: "onchain",
    onchainAddress,
    availableSats,
    amountSats: availableSats,
    withdrawAll: true,
    feeQuote: {
      id: "fee-quote-1",
      expiresAt: "2026-06-05T12:05:00.000Z",
      fast: { userFeeSats: 300, l1BroadcastFeeSats: 500, totalFeeSats: 800 },
      medium: { userFeeSats: 200, l1BroadcastFeeSats: 300, totalFeeSats: 500 },
      slow: { userFeeSats: 100, l1BroadcastFeeSats: 150, totalFeeSats: 250 },
    },
  })
  const request = {
    destination: { kind: "onchain", address: onchainAddress },
    amountSats: undefined,
    recipientComment: "",
  } satisfies {
    destination: SupportedWithdrawDestination
    amountSats: undefined
    recipientComment: string
  }
  const open = (availableSats: number) =>
    withdrawReducer(initialWithdrawState, {
      type: "OPEN_REVIEW",
      request,
      quote: quote(availableSats),
    })

  test("opens on medium when its fee leaves the minimum", () => {
    expect(open(10_500)).toMatchObject({ exitSpeed: "medium" })
  })

  test("falls back to slow when medium's fee would push withdraw-all under the minimum", () => {
    expect(open(10_400)).toMatchObject({ exitSpeed: "slow" })
  })

  test("a new quote moves an unavailable speed to slow", () => {
    const fast = withdrawReducer(open(20_000), {
      type: "SET_EXIT_SPEED",
      exitSpeed: "fast",
    })
    expect(
      withdrawReducer(fast, { type: "REQUOTED", quote: quote(10_500) })
    ).toMatchObject({ exitSpeed: "slow" })
  })
})

const address = BitcoinAddress("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq")
const t = createTranslate("en", paykyBrand)

describe("buildWithdrawRequest", () => {
  const draft = { recipientComment: "thanks" }
  const onchain = { kind: "onchain", address } as const
  const invoiceWith = {
    kind: "lightning-invoice",
    amountSats: 500,
  } as unknown as SupportedWithdrawDestination

  test("refuses a missing or unsupported destination with its key", () => {
    const base = { draft, typedSats: 1000, withdrawAll: false }
    expect(
      buildWithdrawRequest({
        ...base,
        destination: null,
        destinationError: "withdraw.error.lnurlNotSupported",
      })
    ).toEqual({ ok: false, error: "withdraw.error.lnurlNotSupported" })
    expect(
      buildWithdrawRequest({
        ...base,
        destination: null,
        destinationError: null,
      })
    ).toEqual({ ok: false, error: "withdraw.destination.invalid" })
  })

  test("needs a positive typed amount unless the invoice or withdraw-all sets it", () => {
    const base = { destination: onchain, destinationError: null, draft }
    expect(
      buildWithdrawRequest({ ...base, typedSats: null, withdrawAll: false })
    ).toEqual({ ok: false, error: "withdraw.amount.invalid" })
    expect(
      buildWithdrawRequest({ ...base, typedSats: 12_000, withdrawAll: false })
    ).toMatchObject({ ok: true, value: { amountSats: 12_000 } })
    expect(
      buildWithdrawRequest({ ...base, typedSats: null, withdrawAll: true })
    ).toMatchObject({ ok: true, value: { amountSats: undefined } })
    expect(
      buildWithdrawRequest({
        destination: invoiceWith,
        destinationError: null,
        draft,
        typedSats: 99,
        withdrawAll: false,
      })
    ).toMatchObject({ ok: true, value: { amountSats: undefined } })
  })
})

describe("draftWithDestination", () => {
  test("a BIP-21 amount fills the amount in sats and turns withdraw-all off", () => {
    const draft = {
      ...createWithdrawDraft(""),
      withdrawAll: true,
      unit: "fiat" as const,
    }
    expect(
      draftWithDestination(draft, `bitcoin:${address}?amount=0.0002`)
    ).toMatchObject({ withdrawAll: false, unit: "sats", amount: "20000" })
  })

  test("a plain destination only replaces the text", () => {
    const draft = { ...createWithdrawDraft(""), amount: "5", withdrawAll: true }
    expect(draftWithDestination(draft, address)).toEqual({
      ...draft,
      destination: address,
    })
  })
})

describe("withdrawAllUnavailableKey", () => {
  test("is off only for an invoice with its own amount", () => {
    expect(withdrawAllUnavailableKey(null)).toBeNull()
    expect(
      withdrawAllUnavailableKey({
        kind: "lightning-invoice",
        amountSats: 5,
      } as unknown as SupportedWithdrawDestination)
    ).toBe("withdraw.all.unavailableInvoice")
    expect(
      withdrawAllUnavailableKey({
        kind: "lightning-invoice",
        amountSats: null,
      } as unknown as SupportedWithdrawDestination)
    ).toBeNull()
  })
})

describe("amountFieldWarnings", () => {
  const range = { minSendableSats: 10, maxSendableSats: 100 }
  test("flags an amount outside the range or below the on-chain minimum", () => {
    expect(
      amountFieldWarnings({
        typedSats: 5,
        range,
        withdrawAll: false,
        onchainMinimumSats: null,
      })
    ).toEqual({ outOfRange: true, belowOnchainMinimum: false })
    expect(
      amountFieldWarnings({
        typedSats: 5,
        range: null,
        withdrawAll: false,
        onchainMinimumSats: 10_000,
      })
    ).toEqual({ outOfRange: false, belowOnchainMinimum: true })
  })

  test("withdraw-all and an empty amount warn about nothing", () => {
    expect(
      amountFieldWarnings({
        typedSats: 5,
        range,
        withdrawAll: true,
        onchainMinimumSats: 10_000,
      })
    ).toEqual({ outOfRange: false, belowOnchainMinimum: false })
    expect(
      amountFieldWarnings({
        typedSats: null,
        range,
        withdrawAll: false,
        onchainMinimumSats: 10_000,
      })
    ).toEqual({ outOfRange: false, belowOnchainMinimum: false })
  })
})

describe("confirmOutcome", () => {
  const withdrawalId = "wd1" as unknown as WithdrawalId

  test("a sent, rejected or unknown-outcome withdrawal is recorded, never a failure", () => {
    expect(confirmOutcome({ ok: true, value: { withdrawalId } }, t)).toEqual({
      kind: "recorded",
      withdrawalId,
      result: "sent",
    })
    expect(
      confirmOutcome(
        { ok: false, error: { type: "WithdrawalRejected", withdrawalId } },
        t
      )
    ).toMatchObject({ kind: "recorded", result: "rejected" })
    expect(
      confirmOutcome(
        {
          ok: false,
          error: { type: "WithdrawalOutcomeUnknown", withdrawalId },
        },
        t
      )
    ).toMatchObject({ kind: "recorded", result: "unknown" })
  })

  test("an error from before anything was recorded keeps the review open", () => {
    expect(
      confirmOutcome(
        { ok: false, error: { type: "WithdrawalQuoteExpired" } },
        t
      )
    ).toEqual({ kind: "failed", message: t("withdraw.error.quoteExpired") })
    expect(
      confirmOutcome(
        {
          ok: false,
          error: { type: "WithdrawalBelowMinimum", minSats: 10_000 },
        },
        t
      )
    ).toEqual({
      kind: "failed",
      message: t("withdraw.error.belowMinimum", { amount: 10_000 }),
    })
  })
})

describe("withdrawPinDetail", () => {
  test("names the recipient's amount and the on-chain address", () => {
    const quote = {
      kind: "onchain",
      onchainAddress: address,
      availableSats: 50_000,
      amountSats: 20_000,
      withdrawAll: false,
      feeQuote: {
        id: "q",
        expiresAt: "2026-06-05T12:05:00.000Z",
        fast: { userFeeSats: 3, l1BroadcastFeeSats: 5, totalFeeSats: 8 },
        medium: { userFeeSats: 2, l1BroadcastFeeSats: 3, totalFeeSats: 5 },
        slow: { userFeeSats: 1, l1BroadcastFeeSats: 1, totalFeeSats: 2 },
      },
    } as unknown as OnchainWithdrawalQuote
    const detail = withdrawPinDetail({
      quote,
      exitSpeed: "medium",
      t,
      locale: "en-US",
    })
    expect(detail).toContain("20,000")
    expect(detail).toContain(address)
  })

  test("names an address-less invoice by its shortened form and the amount", () => {
    const invoice = `lnbc10u1${"q".repeat(80)}xyz`
    const quote = {
      kind: "lightning",
      lightningAddress: null,
      amountSats: 1000,
      invoice: { invoice },
    } as unknown as LightningWithdrawalQuote
    const detail = withdrawPinDetail({
      quote,
      exitSpeed: "medium",
      t,
      locale: "en-US",
    })
    expect(detail).toContain("1,000")
    expect(detail).toContain(t("withdraw.destination.kind.lightningInvoice"))
    expect(detail).toContain(`${invoice.slice(0, 12)}…${invoice.slice(-8)}`)
    expect(detail).not.toContain(invoice)
  })
})

describe("pendingLightningText", () => {
  const createdAt = 1_000_000
  const text = (now: number, ownDevice: boolean, deviceName: string | null) =>
    pendingLightningText({
      times: pendingLightningTimes({ createdAt, ownDevice }),
      now,
      ownDevice,
      deviceName,
      t,
    })

  test("walks from sending to processing to unknown on the creating device", () => {
    const times = pendingLightningTimes({ createdAt, ownDevice: true })
    expect(text(createdAt, true, null)).toBe(
      t("withdraw.detail.pending.ownDevice")
    )
    expect(text(times.timeoutAt, true, null)).toBe(
      t("withdraw.detail.pending.processing")
    )
    expect(text(times.windowEndsAt, true, null)).toBe(
      t("withdraw.detail.pending.unknown")
    )
  })

  test("names the other device, or says it is unknown", () => {
    expect(text(createdAt, false, "Till 2")).toBe(
      t("withdraw.detail.pending.otherDevice", { device: "Till 2" })
    )
    expect(text(createdAt, false, null)).toBe(
      t("withdraw.detail.pending.unknownDevice")
    )
  })
})

describe("quoteConfirmDeadline", () => {
  test("is the invoice's or the fee quote's expiry less the send margin", () => {
    const lightning = {
      kind: "lightning",
      invoice: { expiresAt: 1_000_000 },
    } as unknown as WithdrawalQuote
    const onchain = {
      kind: "onchain",
      feeQuote: { expiresAt: "2026-06-05T12:05:00.000Z" },
    } as unknown as WithdrawalQuote
    expect(quoteConfirmDeadline(lightning)).toBe(
      1_000_000 - WITHDRAWAL_QUOTE_EXPIRY_MARGIN_MS
    )
    expect(quoteConfirmDeadline(onchain)).toBe(
      Date.parse("2026-06-05T12:05:00.000Z") - WITHDRAWAL_QUOTE_EXPIRY_MARGIN_MS
    )
  })
})
