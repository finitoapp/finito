import type { MockHandler } from "./mock-handler.ts"

/**
 * Qerko's POS API under `/qerko/` (the e2e build's `EXPO_PUBLIC_PAYKY_QERKO_BASE_URL`),
 * as web's `routeFakeQerko` is for Playwright: a pairing with the code 1234,
 * one company with one activated terminal, and payments the terminal approves
 * for the amount asked.
 */

export const qerkoPairingCode = "1234"

const payments = new Map<string, string>()

const approved = (transactionId: string, amount: string) => ({
  status: "approved",
  transactionId,
  currency: "CZK",
  amount,
  chargedAmount: amount,
  chargedTipAmount: "0",
  authorizationCode: "E2E123",
  card: { brand: "VISA", maskedPan: "************4242", entryMode: "chip" },
  receipt: {
    merchantId: "M-E2E",
    terminalId: "ACQ-1",
    sequenceNumber: "1",
    terminalDateTime: null,
    refundId: "e2e-refund-id",
  },
})

const answer = (path: string, body: Record<string, unknown>): unknown => {
  const transactionId = String(body.transactionId ?? "")
  switch (path) {
    case "request-pairing":
      return { pairingRequestId: "e2e-pairing", resendAvailableInSeconds: 1 }
    case "confirm-pairing":
      return body.code === qerkoPairingCode
        ? { type: "ok", apiKey: { token: "e2e-token", name: "Finito" } }
        : { type: "invalidCode", remainingAttempts: 2 }
    case "get-terminals":
      return {
        legalEntity: {
          id: "le-1",
          name: "E2E Cafe s.r.o.",
          identificationNumber: "12345678",
          country: "CZ",
        },
        locations: [
          {
            id: "loc-1",
            name: "Main street",
            terminals: [
              {
                id: "terminal-1",
                tid: "TID-0001",
                platform: "physical",
                enabled: true,
              },
            ],
          },
        ],
      }
    case "get-terminal-status":
      return { type: "status", authorizationServerConnection: "ok" }
    case "create-terminal-payment": {
      const amount = String(body.amount)
      payments.set(transactionId, amount)
      return {
        type: "started",
        payment: approved(transactionId, amount),
      }
    }
    case "get-terminal-payment-status": {
      const amount = payments.get(transactionId)
      return amount === undefined
        ? { type: "unknownTransaction" }
        : { type: "found", payment: approved(transactionId, amount) }
    }
    default:
      return { type: "unknownTransaction" }
  }
}

export const qerkoMock: MockHandler = async (request, url) => {
  if (!url.pathname.startsWith("/qerko/")) return undefined
  const path = url.pathname.slice("/qerko/".length)
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >
  return Response.json(answer(path, body))
}
