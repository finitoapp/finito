import { testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"

import type { FetchDep } from "../../deps.ts"
import { Integer } from "../../modules/shared/schema.ts"
import {
  cancelQerkoTerminalPayment,
  confirmQerkoPairing,
  createQerkoApiDep,
  createQerkoTerminalPayment,
  createQerkoTerminalRefund,
  getQerkoLocations,
  getQerkoTerminalPaymentStatus,
  getQerkoTerminals,
  pairQerkoLocation,
  type QerkoApiDep,
  requestQerkoPairing,
} from "./qerko-client.ts"

const credentials = { apiKey: "key-1", environment: "sandbox" } as const
const transactionId = "5455d25b-415c-4104-9035-5c357e60ff01"

interface Recorded {
  readonly url: string
  readonly headers: Record<string, string>
  readonly body: unknown
}

const setup = (reply: unknown, status = 200) => {
  const requests: Recorded[] = []
  const deps = {
    ...createQerkoApiDep({ posId: "pos-1" }),
    fetch: async (input, init) => {
      requests.push({
        url: String(input),
        headers: init?.headers as Record<string, string>,
        body: JSON.parse(String(init?.body)),
      })
      return Response.json(reply, { status })
    },
  } satisfies QerkoApiDep & FetchDep
  return { requests, deps }
}

const approved = {
  status: "approved",
  transactionId,
  referenceId: null,
  amount: "100.00",
  tipAmount: null,
  currency: "CZK",
  createdAt: "2026-10-23T10:00:00Z",
  finishedAt: "2026-10-23T10:00:20Z",
  chargedAmount: "110.50",
  chargedTipAmount: "10.50",
  authorizationCode: "A1B2C3",
  card: {
    brand: "VISA",
    maskedPan: "************8902",
    panSequenceNumber: null,
    entryMode: "contactless",
    aid: null,
    applicationLabel: null,
  },
  cardholderVerification: ["none"],
  receipt: {
    merchantId: "M1",
    terminalId: "T1",
    sequenceNumber: "42",
    terminalDateTime: "2026-10-23T12:00:00",
    refundId: "refund-1",
  },
  reversalTransactionId: null,
}

describe("qerko client", () => {
  test("requests pairing with the Pos-Id header only", async () => {
    const { requests, deps } = setup({
      pairingRequestId: "p-1",
      resendAvailableInSeconds: 60,
    })
    await using run = testCreateRun(deps)

    const result = await run(
      requestQerkoPairing({
        role: "terminalPayments",
        environment: "sandbox",
        identificationNumber: "12345678",
        country: "CZ",
      })
    )

    expect(result).toEqual({
      ok: true,
      value: { pairingRequestId: "p-1", resendAvailableInSeconds: 60 },
    })
    expect(requests).toEqual([
      {
        url: "https://sandbox.qerko.com/api/v4/pos/request-pairing",
        headers: { "content-type": "application/json", "pos-id": "pos-1" },
        body: {
          identificationNumber: "12345678",
          country: "CZ",
          roles: ["terminalPayments"],
        },
      },
    ])
  })

  test("requests a pairing for the standard role", async () => {
    const { requests, deps } = setup({
      pairingRequestId: "p-1",
      resendAvailableInSeconds: 60,
    })
    await using run = testCreateRun(deps)

    await run(
      requestQerkoPairing({
        role: "standard",
        environment: "sandbox",
        identificationNumber: "12345678",
        country: "CZ",
      })
    )

    expect(requests[0]?.body).toMatchObject({ roles: ["standard"] })
  })

  test("lists the locations of a key's company", async () => {
    const reply = {
      legalEntity: {
        id: "le-1",
        name: "Cafe s.r.o.",
        identificationNumber: "12345678",
        country: "CZ",
      },
      locations: [
        {
          id: "loc-1",
          name: "Cafe Praha",
          address: {
            street: "Dlouhá",
            descriptiveNumber: "1",
            city: "Praha",
            zipCode: "11000",
            country: "CZ",
          },
        },
      ],
      pairedLocationId: null,
    }
    const { requests, deps } = setup(reply)
    await using run = testCreateRun(deps)

    await expect(run(getQerkoLocations(credentials))).resolves.toEqual({
      ok: true,
      value: reply,
    })
    expect(requests).toEqual([
      {
        url: "https://sandbox.qerko.com/api/v4/pos/get-locations",
        headers: {
          "content-type": "application/json",
          "pos-id": "pos-1",
          authorization: "Bearer key-1",
        },
        body: {},
      },
    ])
  })

  test("pairs a key with a location", async () => {
    const { requests, deps } = setup({ status: "Accepted" })
    await using run = testCreateRun(deps)

    await expect(
      run(pairQerkoLocation({ credentials, locationId: "loc-1" }))
    ).resolves.toEqual({ ok: true, value: undefined })
    expect(requests).toMatchObject([
      {
        url: "https://sandbox.qerko.com/api/v4/pos/pair-location",
        body: { locationId: "loc-1" },
      },
    ])
  })

  test("an unknown location is Qerko's 404", async () => {
    const { deps } = setup({ message: "Location not found" }, 404)
    await using run = testCreateRun(deps)

    await expect(
      run(pairQerkoLocation({ credentials, locationId: "gone" }))
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "QerkoHttpError", status: 404 },
    })
  })

  test("uses the production host for the production environment", async () => {
    const { requests, deps } = setup({ type: "codeExpired" })
    await using run = testCreateRun(deps)

    await run(
      confirmQerkoPairing({
        environment: "production",
        pairingRequestId: "p-1",
        code: "1234",
        name: "Payky",
      })
    )

    expect(requests[0]?.url).toBe(
      "https://qerko.com/api/v4/pos/confirm-pairing"
    )
  })

  test("a base URL override replaces the host of every environment", async () => {
    const requests: string[] = []
    const deps = {
      ...createQerkoApiDep({
        posId: "pos-1",
        baseUrl: "http://mock.test/qerko",
      }),
      fetch: async (input) => {
        requests.push(String(input))
        return Response.json({ type: "codeExpired" })
      },
    } satisfies QerkoApiDep & FetchDep
    await using run = testCreateRun(deps)

    await run(
      confirmQerkoPairing({
        environment: "production",
        pairingRequestId: "p-1",
        code: "1234",
        name: "Payky",
      })
    )

    expect(requests).toEqual(["http://mock.test/qerko/confirm-pairing"])
  })

  test("returns pairing outcomes as data", async () => {
    const { deps } = setup({ type: "invalidCode", remainingAttempts: 2 })
    await using run = testCreateRun(deps)

    await expect(
      run(
        confirmQerkoPairing({
          environment: "sandbox",
          pairingRequestId: "p-1",
          code: "0000",
          name: "Payky",
        })
      )
    ).resolves.toEqual({
      ok: true,
      value: { type: "invalidCode", remainingAttempts: 2 },
    })
  })

  test("sends the bearer key and lists terminals", async () => {
    const { requests, deps } = setup({
      legalEntity: {
        id: "le",
        name: "Cafe",
        identificationNumber: "1",
        country: "CZ",
      },
      locations: [],
    })
    await using run = testCreateRun(deps)

    const result = await run(getQerkoTerminals(credentials))

    expect(result.ok).toBe(true)
    expect(requests[0]?.headers).toEqual({
      "content-type": "application/json",
      "pos-id": "pos-1",
      authorization: "Bearer key-1",
    })
  })

  test("starts a payment, sending decimal strings", async () => {
    const { requests, deps } = setup({
      type: "started",
      payment: {
        status: "pending",
        transactionId,
        step: "connecting",
      },
    })
    await using run = testCreateRun(deps)

    const result = await run(
      createQerkoTerminalPayment({
        credentials,
        terminalId: "t-1",
        transactionId,
        amount: Integer(11050),
        tipAmount: Integer(1050),
        currency: "CZK",
        referenceId: "20260001",
      })
    )

    expect(result).toEqual({
      ok: true,
      value: {
        type: "started",
        operation: { status: "pending", step: "connecting" },
      },
    })
    expect(requests[0]?.body).toEqual({
      terminalId: "t-1",
      transactionId,
      amount: "110.5",
      currency: "CZK",
      tipAmount: "10.5",
      referenceId: "20260001",
    })
  })

  test("returns a business refusal as notStarted", async () => {
    const { deps } = setup({ type: "terminalBusy" })
    await using run = testCreateRun(deps)

    await expect(
      run(
        createQerkoTerminalPayment({
          credentials,
          terminalId: "t-1",
          transactionId,
          amount: Integer(100),
          currency: "EUR",
        })
      )
    ).resolves.toEqual({
      ok: true,
      value: { type: "notStarted", reason: "terminalBusy" },
    })
  })

  test("reads an approved payment in minor units", async () => {
    const { deps } = setup({ type: "found", payment: approved })
    await using run = testCreateRun(deps)

    const result = await run(
      getQerkoTerminalPaymentStatus({ credentials, transactionId })
    )

    expect(result).toEqual({
      ok: true,
      value: {
        type: "found",
        operation: {
          status: "approved",
          currency: "CZK",
          chargedAmount: 11050,
          chargedTipAmount: 1050,
          authorizationCode: "A1B2C3",
          cardBrand: "VISA",
          maskedPan: "************8902",
          entryMode: "contactless",
          merchantId: "M1",
          terminalId: "T1",
          sequenceNumber: "42",
          terminalDateTime: "2026-10-23T12:00:00",
          refundId: "refund-1",
        },
      },
    })
  })

  test("accepts a zero charged tip", async () => {
    const { deps } = setup({
      type: "found",
      payment: { ...approved, chargedAmount: "100", chargedTipAmount: "0" },
    })
    await using run = testCreateRun(deps)

    const result = await run(
      getQerkoTerminalPaymentStatus({ credentials, transactionId })
    )

    expect(result.ok && result.value.type === "found").toBe(true)
  })

  test("reads a failed payment and an unknown transaction", async () => {
    const failed = setup({
      type: "found",
      payment: { status: "failed", transactionId, reason: "declined" },
    })
    await using run = testCreateRun(failed.deps)
    await expect(
      run(getQerkoTerminalPaymentStatus({ credentials, transactionId }))
    ).resolves.toEqual({
      ok: true,
      value: {
        type: "found",
        operation: { status: "failed", reason: "declined" },
      },
    })

    const missing = setup({ type: "unknownTransaction" })
    await using run2 = testCreateRun(missing.deps)
    await expect(
      run2(getQerkoTerminalPaymentStatus({ credentials, transactionId }))
    ).resolves.toEqual({ ok: true, value: { type: "unknownTransaction" } })
  })

  test("reports a cancel outcome", async () => {
    const { deps } = setup({ type: "cancelling" })
    await using run = testCreateRun(deps)

    await expect(
      run(cancelQerkoTerminalPayment({ credentials, transactionId }))
    ).resolves.toEqual({ ok: true, value: "cancelling" })
  })

  test("starts a refund", async () => {
    const { requests, deps } = setup({
      type: "started",
      refund: { status: "approved", transactionId },
    })
    await using run = testCreateRun(deps)

    const result = await run(
      createQerkoTerminalRefund({
        credentials,
        terminalId: "t-1",
        transactionId,
        refundId: "refund-1",
        amount: Integer(5000),
        currency: "CZK",
      })
    )

    expect(result).toEqual({
      ok: true,
      value: { type: "started", operation: { status: "approved" } },
    })
    expect(requests[0]?.body).toEqual({
      terminalId: "t-1",
      transactionId,
      refundId: "refund-1",
      amount: "50",
      currency: "CZK",
    })
  })

  test("reports an HTTP error with its status and body", async () => {
    const { deps } = setup({ message: "no" }, 401)
    await using run = testCreateRun(deps)

    const result = await run(getQerkoTerminals(credentials))

    expect(result).toMatchObject({
      ok: false,
      error: { type: "QerkoHttpError", status: 401 },
    })
  })

  test("reports a response of an unexpected shape as an API error", async () => {
    const { deps } = setup({ type: "mystery" })
    await using run = testCreateRun(deps)

    const result = await run(
      cancelQerkoTerminalPayment({ credentials, transactionId })
    )

    expect(result).toMatchObject({
      ok: false,
      error: { type: "QerkoApiError" },
    })
  })
})
