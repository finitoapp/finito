import type { Language } from "@payky/app-shared/i18n/resources"
import type { Page, Route } from "@playwright/test"
import { translate } from "./i18n.ts"
import { gotoPage, waitForLocalWriteToSettle } from "./navigation.ts"

/**
 * A stand-in for Qerko's POS API for the browser, as `routeFakeEet` is for
 * EET. Every Qerko call goes through `fetch`, so intercepting the requests
 * covers the settings screens, the payment screen and the background job
 * alike. The sandbox and production hosts share the one fake.
 *
 * The fake terminal keeps each payment and refund it was asked for. A payment
 * stays pending while `holdPayment` is set, then answers `paymentOutcome`.
 * For Qerko payments (the `standard` key) it lists the company's one location
 * and remembers the one the key was paired with.
 */

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "POST, OPTIONS",
}

export const qerkoPairingCode = "1234"
export const qerkoLegalEntityName = "E2E Cafe s.r.o."
export const qerkoTerminalTid = "TID-0001"
export const qerkoLocationName = "Main street"

export interface FakeQerko {
  /** Every request answered, in order. */
  readonly requests: ReadonlyArray<{
    path: string
    body: Record<string, unknown>
  }>
  /** While set, started payments stay pending (waiting for the card). */
  holdPayment: boolean
  /** What a payment that is no longer held ends as. */
  paymentOutcome: "approved" | "declined" | "unknown"
  /** What a refund answers. */
  refundOutcome: "approved" | "declined"
  /** While set, Qerko lists no terminal for the company. */
  noTerminals: boolean
  /** When set, a refund is refused to start for this reason. */
  refundNotStarted: "terminalNotActivated" | "unknownTerminal" | null
  /** While set, a started refund stays pending (waiting for the card). */
  holdRefund: boolean
  /** While set, Qerko refuses the API key on every call but the pairing (401). */
  rejectKey: boolean
  /** The location the `standard` key is paired with, none until `pair-location`. */
  pairedLocationId: string | null
}

interface Operation {
  readonly amount: string
  cancelled: boolean
}

const legalEntity = {
  id: "le-1",
  name: qerkoLegalEntityName,
  identificationNumber: "12345678",
  country: "CZ",
}

const paymentOf = (
  transactionId: string,
  operation: Operation,
  fake: FakeQerko
): Record<string, unknown> => {
  if (operation.cancelled) {
    return { status: "failed", transactionId, reason: "cancelled" }
  }
  if (fake.holdPayment) {
    return {
      status: "pending",
      transactionId,
      step: "waitingForCard",
    }
  }
  if (fake.paymentOutcome === "declined") {
    return { status: "failed", transactionId, reason: "declined" }
  }
  if (fake.paymentOutcome === "unknown") {
    return { status: "unknown", transactionId }
  }
  return {
    status: "approved",
    transactionId,
    currency: "CZK",
    amount: operation.amount,
    chargedAmount: operation.amount,
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
  }
}

export async function routeFakeQerko(page: Page): Promise<FakeQerko> {
  const requests: Array<{ path: string; body: Record<string, unknown> }> = []
  const payments = new Map<string, Operation>()
  const refunds = new Map<string, Operation>()
  const fake: FakeQerko = {
    requests,
    holdPayment: false,
    paymentOutcome: "approved",
    refundOutcome: "approved",
    noTerminals: false,
    refundNotStarted: null,
    holdRefund: false,
    rejectKey: false,
    pairedLocationId: null,
  }

  const answer = (path: string, body: Record<string, unknown>): unknown => {
    const transactionId = String(body.transactionId ?? "")
    switch (path) {
      case "request-pairing":
        return { pairingRequestId: "e2e-pairing", resendAvailableInSeconds: 1 }
      case "confirm-pairing":
        return body.code === qerkoPairingCode
          ? { type: "ok", apiKey: { token: "e2e-token", name: "Payky" } }
          : { type: "invalidCode", remainingAttempts: 2 }
      case "get-locations":
        return {
          legalEntity,
          locations: [
            {
              id: "loc-1",
              name: qerkoLocationName,
              address: {
                street: "Long street",
                descriptiveNumber: "1",
                city: "Prague",
                zipCode: "11000",
                country: "CZ",
              },
            },
          ],
          pairedLocationId: fake.pairedLocationId,
        }
      case "pair-location":
        fake.pairedLocationId = String(body.locationId)
        return { status: "Accepted" }
      case "get-terminals":
        return {
          legalEntity,
          locations: fake.noTerminals
            ? []
            : [
                {
                  id: "loc-1",
                  name: qerkoLocationName,
                  terminals: [
                    {
                      id: "terminal-1",
                      tid: qerkoTerminalTid,
                      platform: "physical",
                      enabled: true,
                    },
                    {
                      id: "terminal-2",
                      tid: "TID-OFF",
                      platform: "physical",
                      enabled: false,
                    },
                  ],
                },
              ],
        }
      case "get-terminal-status":
        return { type: "status", authorizationServerConnection: "ok" }
      case "create-terminal-payment": {
        const operation = { amount: String(body.amount), cancelled: false }
        payments.set(transactionId, operation)
        return {
          type: "started",
          payment: paymentOf(transactionId, operation, fake),
        }
      }
      case "get-terminal-payment-status": {
        const operation = payments.get(transactionId)
        return operation === undefined
          ? { type: "unknownTransaction" }
          : {
              type: "found",
              payment: paymentOf(transactionId, operation, fake),
            }
      }
      case "cancel-terminal-payment": {
        const operation = payments.get(transactionId)
        if (operation === undefined) return { type: "unknownTransaction" }
        operation.cancelled = true
        return { type: "cancelling" }
      }
      case "create-terminal-refund": {
        if (fake.refundNotStarted !== null) {
          return { type: fake.refundNotStarted }
        }
        refunds.set(transactionId, {
          amount: String(body.amount),
          cancelled: false,
        })
        return {
          type: "started",
          refund: { status: "pending", transactionId, step: "waitingForCard" },
        }
      }
      case "get-terminal-refund-status":
        return refunds.has(transactionId)
          ? {
              type: "found",
              refund: fake.holdRefund
                ? { status: "pending", transactionId, step: "waitingForCard" }
                : fake.refundOutcome === "approved"
                  ? { status: "approved", transactionId }
                  : { status: "failed", transactionId, reason: "declined" },
            }
          : { type: "unknownTransaction" }
      default:
        return { type: "unknownTransaction" }
    }
  }

  await page.route("**/api/v4/pos/**", async (route: Route) => {
    const request = route.request()
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders })
      return
    }
    const path = new URL(request.url()).pathname.split("/").at(-1) ?? ""
    const body: Record<string, unknown> = request.postDataJSON() ?? {}
    requests.push({ path, body })
    const rejected = fake.rejectKey && !path.endsWith("-pairing")
    await route.fulfill({
      status: rejected ? 401 : 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
      body: JSON.stringify(
        rejected ? { error: "unauthorized" } : answer(path, body)
      ),
    })
  })

  return fake
}

/** Pairs with the fake Qerko through the wizard and takes the first terminal. */
export async function pairQerko(
  page: Page,
  language: Language = "en"
): Promise<void> {
  await gotoPage(
    page,
    "/settings/payment-accounts/qerko-terminal",
    language,
    "settings.qerkoTerminal.title"
  )
  await page
    .getByLabel(
      translate(
        language,
        "settings.qerkoTerminal.company.identificationNumber.label"
      )
    )
    .fill("12345678")
  await page
    .getByRole("button", {
      name: translate(language, "settings.qerkoTerminal.requestCode"),
    })
    .click()
  await page
    .getByLabel(translate(language, "settings.qerkoTerminal.code.label"))
    .pressSequentially(qerkoPairingCode)
  await page
    .getByRole("button", {
      name: translate(language, "settings.qerkoTerminal.code.confirm"),
    })
    .click()
  await page
    .getByRole("button", {
      name: translate(language, "settings.qerkoTerminal.terminals.choose"),
    })
    .click()
  await page
    .getByText(translate(language, "settings.qerkoTerminal.paired.title"))
    .waitFor()
  // The pairing and the terminal are local writes; a hard navigation right
  // after them can otherwise read a stale snapshot.
  await waitForLocalWriteToSettle(page)
}
