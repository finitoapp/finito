import { describe, expect, test } from "vitest"
import {
  interpretSwitchioClosureResult,
  interpretSwitchioPaymentResult,
} from "./switchio.ts"

const approvedResult = JSON.stringify({
  amount: 500,
  appLabel: "Air Bank",
  authCode: "114546",
  brand: "MASTERCARD",
  dateTimeTerminal: "Jul 16, 2020 14:39:37",
  pan: "970348******3910",
  responseCode: "OK",
  responseMessage: "potvrzeno",
  sequenceNumber: "001001614",
  terminalIdAcquirer: "M1TNEXGO01",
  transactionId: "48a3ea7d-b82f-4b42-abbb-5043365e4faa",
})

describe("interpretSwitchioPaymentResult", () => {
  test("accepts an approved transaction and keeps the traceable fields", () => {
    expect(
      interpretSwitchioPaymentResult({
        resultCode: -1,
        transactionResult: approvedResult,
      })
    ).toEqual({
      ok: true,
      value: {
        responseCode: "OK",
        authCode: "114546",
        sequenceNumber: "001001614",
        maskedPan: "970348******3910",
        cardLabel: "Air Bank",
        terminalId: "M1TNEXGO01",
        terminalDateTime: "Jul 16, 2020 14:39:37",
        refundId: null,
      },
    })
  })

  test("keeps an 18-digit numeric refund id digit for digit, past what a number holds", () => {
    // 2^53 is 16 digits: `JSON.parse` would round this to ...680.
    const result = interpretSwitchioPaymentResult({
      resultCode: -1,
      transactionResult: '{"responseCode":"OK","refundId": 123456789012345678}',
    })

    expect(result.ok && result.value.refundId).toBe("123456789012345678")
  })

  test("takes a quoted refund id as it is", () => {
    const result = interpretSwitchioPaymentResult({
      resultCode: -1,
      transactionResult: JSON.stringify({
        responseCode: "OK",
        refundId: "000012345678901234",
      }),
    })

    expect(result.ok && result.value.refundId).toBe("000012345678901234")
  })

  test("leaves the refund id out when the terminal sends none or no digits", () => {
    const missing = interpretSwitchioPaymentResult({
      resultCode: -1,
      transactionResult: JSON.stringify({ responseCode: "OK" }),
    })
    const notDigits = interpretSwitchioPaymentResult({
      resultCode: -1,
      transactionResult: JSON.stringify({
        responseCode: "OK",
        refundId: "n/a",
      }),
    })

    expect(missing.ok && missing.value.refundId).toBe(null)
    expect(notDigits.ok && notDigits.value.refundId).toBe(null)
  })

  test("falls back to the card brand when the app label is missing", () => {
    const result = interpretSwitchioPaymentResult({
      resultCode: -1,
      transactionResult: JSON.stringify({
        responseCode: "OK",
        brand: "MASTERCARD",
      }),
    })

    expect(result.ok).toBe(true)
    expect(result.ok && result.value.cardLabel).toBe("MASTERCARD")
  })

  test("accepts success without a response code, since the field is optional", () => {
    const result = interpretSwitchioPaymentResult({
      resultCode: -1,
      transactionResult: JSON.stringify({ authCode: "114546" }),
    })

    expect(result.ok).toBe(true)
    expect(result.ok && result.value.responseCode).toBe(null)
  })

  test("rejects an explicit non-OK response code even on a success result code", () => {
    const result = interpretSwitchioPaymentResult({
      resultCode: -1,
      transactionResult: JSON.stringify({
        responseCode: "DECLINED",
        responseMessage: "zamitnuto",
      }),
    })

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatchObject({
      type: "SwitchioPaymentFailed",
      responseCode: "DECLINED",
      responseMessage: "zamitnuto",
    })
  })

  test("reports a busy terminal as a failed payment carrying the terminal's message", () => {
    const result = interpretSwitchioPaymentResult({
      resultCode: 2,
      transactionResult: JSON.stringify({
        responseCode: "UNDEFINED",
        responseMessage: "Terminal busy",
      }),
    })

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatchObject({
      type: "SwitchioPaymentFailed",
      resultCode: 2,
      responseMessage: "Terminal busy",
    })
  })

  test("reports a failure result code with no payload as an unknown outcome, not a decline", () => {
    for (const transactionResult of [null, "", "not json"]) {
      const result = interpretSwitchioPaymentResult({
        resultCode: 0,
        transactionResult,
      })

      expect(result.ok).toBe(false)
      expect(!result.ok && result.error).toMatchObject({
        type: "SwitchioResultUnreadable",
        resultCode: 0,
      })
    }
  })

  test("still reports a failure result code with the terminal's own answer as declined", () => {
    const result = interpretSwitchioPaymentResult({
      resultCode: 0,
      transactionResult: JSON.stringify({
        responseCode: "DECLINED",
        responseMessage: "Card declined",
      }),
    })

    expect(!result.ok && result.error).toMatchObject({
      type: "SwitchioPaymentFailed",
      resultCode: 0,
      responseCode: "DECLINED",
    })
  })

  test("never reports an unreadable success payload as declined", () => {
    const result = interpretSwitchioPaymentResult({
      resultCode: -1,
      transactionResult: "not json",
    })

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatchObject({
      type: "SwitchioResultUnreadable",
      rawResult: "not json",
    })
  })

  test("treats a missing success payload as unreadable, not as a decline", () => {
    const result = interpretSwitchioPaymentResult({
      resultCode: -1,
      transactionResult: null,
    })

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatchObject({
      type: "SwitchioResultUnreadable",
    })
  })
})

const batchTotals = {
  shiftNumber: 3,
  batchNumber: 42,
  debitsCount: 5,
  debitsAmount: 128_900,
  creditsCount: 1,
  creditsAmount: 9_900,
  adjsCount: 0,
  adjsAmount: 0,
}

const closedBatch = JSON.stringify({
  transactionType: "CLOSE_BATCH",
  dateTimeTerminal: "Nov 8, 2026 22:14:03",
  responseCode: "OK",
  responseMessage: "Uzávěrka provedena",
  batchTotals,
})

describe("interpretSwitchioClosureResult", () => {
  test("accepts a closed batch and keeps its totals", () => {
    expect(
      interpretSwitchioClosureResult({
        resultCode: -1,
        transactionResult: closedBatch,
      })
    ).toEqual({
      ok: true,
      value: {
        ...batchTotals,
        terminalDateTime: "Nov 8, 2026 22:14:03",
        responseMessage: "Uzávěrka provedena",
      },
    })
  })

  test("accepts success without a response code, since the field is optional", () => {
    const result = interpretSwitchioClosureResult({
      resultCode: -1,
      transactionResult: JSON.stringify({ batchTotals }),
    })

    expect(result).toEqual({
      ok: true,
      value: { ...batchTotals, terminalDateTime: null, responseMessage: null },
    })
  })

  test("rejects an explicit non-OK response code even on a success result code", () => {
    const result = interpretSwitchioClosureResult({
      resultCode: -1,
      transactionResult: JSON.stringify({
        responseCode: "HOST_UNREACHABLE",
        responseMessage: "Server nedostupný",
        batchTotals,
      }),
    })

    expect(!result.ok && result.error).toEqual({
      type: "SwitchioClosureFailed",
      resultCode: -1,
      responseCode: "HOST_UNREACHABLE",
      responseMessage: "Server nedostupný",
    })
  })

  test("reports a busy terminal as a failed closure carrying its message", () => {
    const result = interpretSwitchioClosureResult({
      resultCode: 2,
      transactionResult: JSON.stringify({
        responseCode: "UNDEFINED",
        responseMessage: "Terminal busy",
      }),
    })

    expect(!result.ok && result.error).toMatchObject({
      type: "SwitchioClosureFailed",
      resultCode: 2,
      responseMessage: "Terminal busy",
    })
  })

  test("reports an init failure without a payload as a failed closure", () => {
    const result = interpretSwitchioClosureResult({
      resultCode: 1,
      transactionResult: null,
    })

    expect(!result.ok && result.error).toMatchObject({
      type: "SwitchioClosureFailed",
      resultCode: 1,
      responseCode: null,
    })
  })

  test("reports a cancelled result with no payload as an unknown outcome, not a failure", () => {
    for (const transactionResult of [null, "", "not json"]) {
      const result = interpretSwitchioClosureResult({
        resultCode: 0,
        transactionResult,
      })

      expect(!result.ok && result.error).toMatchObject({
        type: "SwitchioResultUnreadable",
        resultCode: 0,
      })
    }
  })

  test("never reports an unreadable success payload as a failed closure", () => {
    const result = interpretSwitchioClosureResult({
      resultCode: -1,
      transactionResult: "not json",
    })

    expect(!result.ok && result.error).toMatchObject({
      type: "SwitchioResultUnreadable",
      rawResult: "not json",
    })
  })

  test("treats a success without readable batch totals as unknown, since nothing can be kept", () => {
    for (const payload of [
      { responseCode: "OK" },
      { responseCode: "OK", batchTotals: { batchNumber: "42" } },
    ]) {
      const result = interpretSwitchioClosureResult({
        resultCode: -1,
        transactionResult: JSON.stringify(payload),
      })

      expect(!result.ok && result.error).toMatchObject({
        type: "SwitchioResultUnreadable",
      })
    }
  })
})
