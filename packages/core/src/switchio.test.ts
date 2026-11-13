import { describe, expect, test } from "vitest"
import {
  interpretSwitchioClosureResult,
  interpretSwitchioPaymentLookup,
  interpretSwitchioPaymentResult,
  interpretSwitchioRefundResult,
  interpretSwitchioReversalResult,
  interpretSwitchioTransactionLookup,
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
      busy: false,
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
      busy: true,
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
      busy: false,
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

describe("interpretSwitchioRefundResult", () => {
  test("accepts an approved refund and keeps its trace", () => {
    expect(
      interpretSwitchioRefundResult({
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
        terminalDateTime: "Jul 16, 2020 14:39:37",
      },
    })
  })

  test("accepts success without a response code, since the field is optional", () => {
    const result = interpretSwitchioRefundResult({
      resultCode: -1,
      transactionResult: JSON.stringify({ authCode: "1" }),
    })

    expect(result.ok).toBe(true)
  })

  test("reports an explicit non-OK answer as declined", () => {
    const result = interpretSwitchioRefundResult({
      resultCode: -1,
      transactionResult: JSON.stringify({
        responseCode: "DECLINED",
        responseMessage: "zamitnuto",
      }),
    })

    expect(!result.ok && result.error).toMatchObject({
      type: "SwitchioRefundFailed",
      responseCode: "DECLINED",
      responseMessage: "zamitnuto",
    })
  })

  test("reports a cancelled result with no payload as an unknown outcome, not a decline", () => {
    const result = interpretSwitchioRefundResult({
      resultCode: 0,
      transactionResult: null,
    })

    expect(!result.ok && result.error.type).toBe("SwitchioResultUnreadable")
  })

  test("reports a success it cannot read as an unknown outcome", () => {
    const result = interpretSwitchioRefundResult({
      resultCode: -1,
      transactionResult: "{not json",
    })

    expect(!result.ok && result.error.type).toBe("SwitchioResultUnreadable")
  })

  test("reports busy and not initialised as a refund that never started", () => {
    for (const resultCode of [1, 2]) {
      const result = interpretSwitchioRefundResult({
        resultCode,
        transactionResult: null,
      })
      expect(!result.ok && result.error).toEqual({
        type: "SwitchioRefundNotStarted",
        resultCode,
      })
    }
  })
})

describe("interpretSwitchioReversalResult", () => {
  test("accepts an approved reversal, with or without the reversal flag", () => {
    for (const extra of [{}, { reversal: true }]) {
      const result = interpretSwitchioReversalResult({
        resultCode: -1,
        transactionResult: JSON.stringify({ responseCode: "OK", ...extra }),
      })
      expect(result.ok).toBe(true)
    }
  })

  test("takes an approval that says it is no reversal as an unknown outcome", () => {
    const result = interpretSwitchioReversalResult({
      resultCode: -1,
      transactionResult: JSON.stringify({
        responseCode: "OK",
        reversal: false,
      }),
    })

    expect(!result.ok && result.error.type).toBe("SwitchioResultUnreadable")
  })

  test("reports a declined reversal as a decline", () => {
    const result = interpretSwitchioReversalResult({
      resultCode: -1,
      transactionResult: JSON.stringify({ responseCode: "DECLINED" }),
    })

    expect(!result.ok && result.error.type).toBe("SwitchioRefundFailed")
  })
})

describe("interpretSwitchioTransactionLookup", () => {
  const transactionId = "48a3ea7d-b82f-4b42-abbb-5043365e4faa"

  test("reports the transaction asked for as approved when the terminal says OK", () => {
    expect(
      interpretSwitchioTransactionLookup({
        transactionId,
        resultCode: -1,
        transactionResult: approvedResult,
      })
    ).toMatchObject({
      type: "approved",
      result: { authCode: "114546" },
      reversed: false,
    })
  })

  test("tells a payment taken back by its isReversed", () => {
    expect(
      interpretSwitchioTransactionLookup({
        transactionId,
        resultCode: -1,
        transactionResult: JSON.stringify({
          transactionId,
          responseCode: "OK",
          isReversed: true,
        }),
      })
    ).toMatchObject({ type: "approved", reversed: true })
  })

  test("never reads a failure as not refunded, as the terminal says not found for a reversal it approved", () => {
    for (const answer of [
      // What the terminal answered, on a device, for an approved reversal.
      { responseCode: "FAILED", responseMessage: "Transaction not found" },
      { responseCode: "DECLINED" },
    ]) {
      expect(
        interpretSwitchioTransactionLookup({
          transactionId,
          resultCode: -1,
          transactionResult: JSON.stringify({ transactionId, ...answer }),
        })
      ).toEqual({ type: "unknown" })
    }
  })

  test("never takes an answer about another transaction for this one", () => {
    expect(
      interpretSwitchioTransactionLookup({
        transactionId: "another",
        resultCode: -1,
        transactionResult: approvedResult,
      })
    ).toEqual({ type: "unknown" })
  })

  test("leaves everything else unknown, an answer for an unseen id included", () => {
    for (const answer of [
      { resultCode: 0, transactionResult: null },
      { resultCode: 2, transactionResult: null },
      { resultCode: -1, transactionResult: "{not json" },
      { resultCode: -1, transactionResult: JSON.stringify({ transactionId }) },
    ]) {
      expect(
        interpretSwitchioTransactionLookup({ transactionId, ...answer })
      ).toEqual({ type: "unknown" })
    }
  })
})

describe("interpretSwitchioPaymentLookup", () => {
  const transactionId = "48a3ea7d-b82f-4b42-abbb-5043365e4faa"

  test("reads an approval of the payment asked for as the payment's own result", () => {
    const answer = { resultCode: -1, transactionResult: approvedResult }
    const payment = interpretSwitchioPaymentResult(answer)

    expect(
      interpretSwitchioPaymentLookup({ transactionId, ...answer })
    ).toEqual({
      type: "approved",
      result: payment.ok ? payment.value : null,
    })
    expect(payment).toMatchObject({
      ok: true,
      value: { maskedPan: "970348******3910", authCode: "114546" },
    })
  })

  test("never reads a payment the terminal does not confirm as not charged", () => {
    for (const answer of [
      // What the terminal answered, on a device, for a reversal it approved.
      {
        resultCode: -1,
        transactionResult: JSON.stringify({
          transactionId,
          responseCode: "FAILED",
          responseMessage: "Transaction not found",
        }),
      },
      {
        resultCode: -1,
        transactionResult: JSON.stringify({
          transactionId,
          responseCode: "DECLINED",
        }),
      },
      { resultCode: 0, transactionResult: null },
      { resultCode: 2, transactionResult: null },
      { resultCode: -1, transactionResult: "{not json" },
      { resultCode: -1, transactionResult: JSON.stringify({ transactionId }) },
    ]) {
      expect(
        interpretSwitchioPaymentLookup({ transactionId, ...answer })
      ).toEqual({ type: "unknown" })
    }
  })

  test("never takes an answer about another transaction, or a reversal, for the payment", () => {
    expect(
      interpretSwitchioPaymentLookup({
        transactionId: "another",
        resultCode: -1,
        transactionResult: approvedResult,
      })
    ).toEqual({ type: "unknown" })
    expect(
      interpretSwitchioPaymentLookup({
        transactionId,
        resultCode: -1,
        transactionResult: JSON.stringify({
          transactionId,
          responseCode: "OK",
          reversal: true,
        }),
      })
    ).toEqual({ type: "unknown" })
  })
})

describe("every SwitchioPay answer (payment/0006)", () => {
  const readers = {
    payment: interpretSwitchioPaymentResult,
    closure: interpretSwitchioClosureResult,
    refund: interpretSwitchioRefundResult,
  }
  const kindOf = (result: {
    readonly ok: boolean
    readonly error?: { readonly type: string }
  }) =>
    result.ok
      ? "approved"
      : result.error?.type === "SwitchioResultUnreadable"
        ? "unreadable"
        : "failed"

  test.each([
    ["the failure code with no answer", 0, null, "unreadable"],
    ["the failure code with an unreadable answer", 0, "not json", "unreadable"],
    [
      "the failure code with the terminal's own answer",
      0,
      JSON.stringify({ responseCode: "DECLINED" }),
      "failed",
    ],
    ["another code with no answer", 5, null, "failed"],
    ["success with no answer", -1, null, "unreadable"],
    [
      "success with a response code that is not OK",
      -1,
      JSON.stringify({ responseCode: "DECLINED" }),
      "failed",
    ],
  ] as const)(
    "reads %s the same for a payment, a closure and a refund",
    (_, resultCode, transactionResult, kind) => {
      for (const read of Object.values(readers)) {
        expect(kindOf(read({ resultCode, transactionResult }))).toBe(kind)
      }
    }
  )
})
