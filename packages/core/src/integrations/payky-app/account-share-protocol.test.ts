import { describe, expect, test } from "vitest"

import { MasterKey } from "../../modules/shared/key-derivation.ts"
import { NonEmptyString255, WssUrl } from "../../modules/shared/schema.ts"
import type { TransferPayload } from "../nostr/nostr-account-transfer.ts"
import {
  AccountShareRefusalSchema,
  ANDROID_RESULT_CANCELED,
  ANDROID_RESULT_OK,
  createShareCode,
  createShareRequest,
  encodeShareAnswer,
  parseShareRequest,
  parseShareResult,
} from "./account-share-protocol.ts"

const payload: TransferPayload = {
  masterKey: MasterKey("000102030405060708090a0b0c0d0e0f"),
  accountName: NonEmptyString255("Shop"),
  transports: [WssUrl("wss://evolu.example")],
}

const requestId = "0123456789abcdef0123456789abcdef"

const approved = (account: string | null) => ({
  resultCode: ANDROID_RESULT_OK,
  account,
  error: null,
})

describe("account share request", () => {
  test("round-trips a new request", () => {
    const request = createShareRequest("Finito")
    expect(request.requestId).toMatch(/^[0-9a-f]{32}$/u)
    expect(request.code).toMatch(/^\d{6}$/u)
    expect(parseShareRequest(request)).toEqual({ ok: true, value: request })
  })

  test("a request of another version is unsupported, a malformed one invalid", () => {
    const request = createShareRequest("Finito")
    expect(parseShareRequest({ ...request, v: 2 })).toEqual({
      ok: false,
      error: {
        type: "AccountShareRequestInvalid",
        reason: "unsupportedVersion",
      },
    })
    for (const raw of [
      { ...request, requestId: "nope" },
      { ...request, code: "12345" },
      { ...request, requesterName: "x".repeat(65) },
      null,
      "{}",
    ]) {
      expect(parseShareRequest(raw)).toEqual({
        ok: false,
        error: { type: "AccountShareRequestInvalid", reason: "invalidRequest" },
      })
    }
  })
})

describe("account share result", () => {
  test("round-trips an approved answer", () => {
    expect(
      parseShareResult(
        approved(encodeShareAnswer({ requestId, payload })),
        requestId
      )
    ).toEqual({ ok: true, value: payload })
  })

  test("an answer to another request is invalid", () => {
    const other = "f".repeat(32)
    expect(
      parseShareResult(
        approved(encodeShareAnswer({ requestId: other, payload })),
        requestId
      )
    ).toEqual({
      ok: false,
      error: { type: "AccountShareFailed", reason: "invalid" },
    })
  })

  test.each([
    ["malformed JSON", "{"],
    ["an unknown version", JSON.stringify({ v: 2, requestId, payload })],
    [
      "a payload that does not decode",
      JSON.stringify({ v: 1, requestId, payload: { masterKey: "x" } }),
    ],
  ])("%s is invalid, not a throw", (_name, account) => {
    expect(parseShareResult(approved(account), requestId)).toEqual({
      ok: false,
      error: { type: "AccountShareFailed", reason: "invalid" },
    })
  })

  test("an approval without an account is invalid", () => {
    expect(parseShareResult(approved(null), requestId)).toEqual({
      ok: false,
      error: { type: "AccountShareFailed", reason: "invalid" },
    })
  })

  test.each(AccountShareRefusalSchema.options)(
    "a refusal reads as %s",
    (reason) => {
      expect(
        parseShareResult(
          { resultCode: ANDROID_RESULT_CANCELED, account: null, error: reason },
          requestId
        )
      ).toEqual({ ok: false, error: { type: "AccountShareFailed", reason } })
    }
  )

  test("a result with no or an unknown error reads as cancelled", () => {
    for (const error of [null, "somethingNew"]) {
      expect(
        parseShareResult(
          { resultCode: ANDROID_RESULT_CANCELED, account: null, error },
          requestId
        )
      ).toEqual({
        ok: false,
        error: { type: "AccountShareFailed", reason: "cancelled" },
      })
    }
  })
})

describe("share code", () => {
  test("is six digits", () => {
    expect(createShareCode(() => 7)).toBe("000007")
    expect(createShareCode(() => 4_294_000_000 - 1)).toBe("999999")
  })

  test("draws again past the last whole million, so no code is favoured", () => {
    const draws = [4_294_000_000, 4_294_967_295, 123_456]
    expect(createShareCode(() => draws.shift() ?? 0)).toBe("123456")
    expect(draws).toEqual([])
  })

  test("spreads its leading digit evenly", () => {
    const counts = Array.from({ length: 10 }, () => 0)
    const samples = 20_000
    for (let index = 0; index < samples; index++) {
      const digit = Number(createShareCode()[0])
      counts[digit] = (counts[digit] ?? 0) + 1
    }
    // Chi-square with 9 degrees of freedom; 27.9 is p = 0.001.
    const expected = samples / 10
    const chiSquare = counts.reduce(
      (sum, count) => sum + (count - expected) ** 2 / expected,
      0
    )
    expect(chiSquare).toBeLessThan(27.9)
  })
})
