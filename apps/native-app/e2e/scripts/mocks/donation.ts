// The donation flow's HTTP services (apps/web-app/e2e/support/donation-mocks.ts):
// the LNURL pay-request/callback/verify trio and the donation history. The
// app reaches the LNURL hosts over https, which the plain-http mock cannot
// answer, so its fetch dep sends them to `/__host/<host>/...` here
// (src/e2e/e2e-fetch.ts). Yadio's rate is mocks/yadio.ts.
//
// Web's spec flips the verify endpoint's `settled` flag from the test; a flow
// cannot call the mock, so an invoice reads as settled `SETTLE_AFTER_MS` after
// its callback created it — long enough for the flow to see "waiting" first.
import { createTestInvoice } from "@payky/core/modules/shared/lightning-invoice-test-fixtures"
import type { MockHandler } from "./mock-handler.ts"

const SETTLE_AFTER_MS = 6_000
const MIN_SENDABLE_SATS = 100
// Web varies the range per test (1-1M, then 100-500); one range serves both: 1000
// is inside it, 9999 above.
const MAX_SENDABLE_SATS = 5_000

/**
 * A mainnet invoice for exactly `amountMsat`, as the app checks the one a
 * Lightning address returns (withdraw/0005). One pico-bitcoin is 0.1 msat.
 */
const invoiceForMsat = (amountMsat: number): string =>
  createTestInvoice({
    hrp: `lnbc${amountMsat * 10}p`,
    timestamp: Math.floor(Date.now() / 1000),
    expirySeconds: 3600,
  })

const LNURL = "https://donate.e2e.test"
let invoice = ""
let createdAt = 0

export const donationMock: MockHandler = (_request, url) => {
  const { pathname } = url
  if (pathname === "/api/donations")
    return Response.json({ items: [], nextCursor: null })
  if (pathname === "/__host/finito.fit/.well-known/lnurlp/donate")
    return Response.json({
      tag: "payRequest",
      callback: `${LNURL}/callback`,
      minSendable: MIN_SENDABLE_SATS * 1_000,
      maxSendable: MAX_SENDABLE_SATS * 1_000,
      metadata: JSON.stringify([["text/plain", "Donate to Finito"]]),
    })
  if (pathname === "/__host/donate.e2e.test/callback") {
    invoice = invoiceForMsat(Number(url.searchParams.get("amount")))
    createdAt = Date.now()
    return Response.json({
      pr: invoice,
      routes: [],
      verify: `${LNURL}/verify/1`,
    })
  }
  if (pathname === "/__host/donate.e2e.test/verify/1") {
    const settled = Date.now() - createdAt > SETTLE_AFTER_MS
    return Response.json({
      status: "OK",
      settled,
      preimage: settled ? "e2e-mock-preimage" : null,
      pr: invoice,
    })
  }
  return undefined
}
