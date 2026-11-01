import type { MintUrl } from "@payky/core/modules/cashu/cashu-types"
import type { CashuWithdrawalQuote } from "@payky/core/modules/withdraw/withdraw-cashu-actions"
import type { WithdrawalId } from "@payky/core/modules/withdraw/withdraw-types"
import { describe, expect, test } from "vitest"
import { paykyBrand } from "./brand.ts"
import {
  cashuConfirmOutcome,
  cashuWithdrawPinDetail,
  formatMintLabel,
  fundedMints,
  withdrawMint,
} from "./cashu-withdraw-flow.ts"
import { createTranslate } from "./i18n/translate.ts"

const t = createTranslate("en", paykyBrand)
const withdrawalId = "wd1" as unknown as WithdrawalId
const mintA = "https://a.example/mint" as MintUrl
const mintB = "https://b.example" as MintUrl

describe("cashuConfirmOutcome", () => {
  test("a melt that was sent is recorded, never a failure", () => {
    expect(
      cashuConfirmOutcome({ ok: true, value: { withdrawalId } }, t)
    ).toEqual({ kind: "recorded", withdrawalId, result: "sent" })
    expect(
      cashuConfirmOutcome(
        { ok: false, error: { type: "WithdrawalRejected", withdrawalId } },
        t
      )
    ).toMatchObject({ kind: "recorded", result: "rejected" })
    expect(
      cashuConfirmOutcome(
        {
          ok: false,
          error: { type: "WithdrawalOutcomeUnknown", withdrawalId },
        },
        t
      )
    ).toMatchObject({ kind: "recorded", result: "unknown" })
  })

  test("a refusal before the melt keeps the review open with the reason", () => {
    expect(
      cashuConfirmOutcome(
        { ok: false, error: { type: "CashuInsufficientFunds" } as never },
        t
      )
    ).toEqual({
      kind: "failed",
      message: t("withdraw.cashu.error.insufficient"),
    })
  })
})

test("the PIN prompt names the amount and the destination", () => {
  const quote = {
    amountSats: 1500,
    lightningAddress: "a@b.example",
  } as CashuWithdrawalQuote
  expect(cashuWithdrawPinDetail({ quote, t, locale: "en" })).toContain(
    "a@b.example"
  )
  expect(
    cashuWithdrawPinDetail({
      quote: { ...quote, lightningAddress: null },
      t,
      locale: "en",
    })
  ).toContain(t("withdraw.destination.kind.lightningInvoice"))
})

describe("mint choice", () => {
  const funded = fundedMints(
    new Map([
      [mintB, 5],
      [mintA, 7],
      ["https://empty.example" as MintUrl, 0],
    ])
  )

  test("lists funded mints by name", () => {
    expect(funded.map(([mint]) => mint)).toEqual([mintA, mintB])
  })

  test("prefers the chosen, then the funded default, then the first funded", () => {
    expect(withdrawMint({ funded, chosen: mintB, defaultMint: mintA })).toBe(
      mintB
    )
    expect(withdrawMint({ funded, chosen: null, defaultMint: mintB })).toBe(
      mintB
    )
    expect(
      withdrawMint({
        funded,
        chosen: null,
        defaultMint: "https://x.example" as MintUrl,
      })
    ).toBe(mintA)
    // A chosen mint that is no longer funded falls back as if none was chosen.
    expect(
      withdrawMint({
        funded,
        chosen: "https://gone.example" as MintUrl,
        defaultMint: mintB,
      })
    ).toBe(mintB)
    expect(withdrawMint({ funded: [], chosen: null, defaultMint: mintA })).toBe(
      null
    )
  })
})

test("a mint label drops the scheme and keeps the path", () => {
  expect(formatMintLabel(mintA)).toBe("a.example/mint")
})
