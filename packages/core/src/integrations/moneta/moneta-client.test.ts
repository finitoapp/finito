import { testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"

import type { FetchDep } from "../../deps.ts"
import { DateStringSchema } from "../../modules/shared/schema.ts"
import {
  createMonetaApiDep,
  fetchMonetaAccounts,
  fetchMonetaTransactions,
  MONETA_MAX_PAGES,
  type MonetaApiDep,
} from "./moneta-client.ts"

/** A ČOBS v7 transaction as the bank lists an incoming domestic payment (Linky's fixture). */
const incoming = (overrides: Record<string, unknown> = {}) => ({
  entryReference: "E-1",
  amount: { value: 750.5, currency: "CZK" },
  creditDebitIndicator: "CRDT",
  reversalIndicator: false,
  status: "BOOK",
  bookingDate: { date: "2026-10-30" },
  entryDetails: {
    transactionDetails: {
      references: { endToEndIdentification: "12345" },
      relatedParties: { debtor: { name: "Jan Novák" } },
      remittanceInformation: {
        unstructured: "kava",
        structured: {
          creditorReferenceInformation: {
            reference: "VS:0001234567,KS:0308,SS:7",
          },
        },
      },
    },
  },
  ...overrides,
})

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const createDeps = (
  respond: (url: URL, init: RequestInit | undefined) => Response
) => {
  const requests: Array<{ readonly url: URL; readonly init?: RequestInit }> = []
  const deps = {
    ...createMonetaApiDep({ token: "secret", baseUrl: "https://example.test" }),
    fetch: async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input)
      requests.push({ url, init })
      return respond(url, init)
    },
  } satisfies MonetaApiDep & FetchDep

  return { deps, requests }
}

const range = {
  monetaAccountId: "acc/1",
  fromDate: DateStringSchema.decode("2026-10-29"),
  toDate: DateStringSchema.decode("2026-10-30"),
}

describe("fetchMonetaTransactions", () => {
  test("reads an incoming transfer with its symbols and signed amount", async () => {
    const { deps, requests } = createDeps(() =>
      jsonResponse({ pageCount: 1, transactions: [incoming()] })
    )
    await using run = testCreateRun(deps)

    const result = await run(fetchMonetaTransactions(range))

    expect(result).toMatchObject({
      ok: true,
      value: {
        skipped: [],
        isTruncated: false,
        callCount: 1,
        transactions: [
          {
            id: "E-1",
            status: "booked",
            isReversal: false,
            direction: "incoming",
            amountMinor: 75_050,
            currency: "CZK",
            occurredOn: "2026-10-30",
            variableSymbol: "1234567",
            constantSymbol: "0308",
            specificSymbol: "7",
            note: "Jan Novák | kava",
            raw: incoming(),
          },
        ],
      },
    })
    const [request] = requests
    expect(request?.url.pathname).toBe(
      "/api/v4/vip/aisp/my/accounts/acc%2F1/transactions"
    )
    expect(request?.init?.headers).toMatchObject({
      Authorization: "Bearer secret",
      Accept: "application/json",
    })
  })

  test("dates a transfer by its value date, not the next working day it is booked on", async () => {
    const { deps } = createDeps(() =>
      jsonResponse({
        transactions: [
          incoming({
            valueDate: { date: "2026-11-01" },
            bookingDate: { date: "2026-11-02" },
          }),
        ],
      })
    )
    await using run = testCreateRun(deps)

    await expect(run(fetchMonetaTransactions(range))).resolves.toMatchObject({
      ok: true,
      value: { transactions: [{ occurredOn: "2026-11-01" }] },
    })
  })

  test("sends the bounds as bare booking days", async () => {
    const { deps, requests } = createDeps(() => jsonResponse({}))
    await using run = testCreateRun(deps)

    await run(fetchMonetaTransactions(range))

    const params = requests[0]?.url.searchParams
    expect(params?.get("fromDate")).toBe("2026-10-29")
    expect(params?.get("toDate")).toBe("2026-10-30")
    expect(params?.get("page")).toBe("0")
    expect(params?.get("size")).toBe("100")
  })

  test("takes the symbol from a list reference, a string amount or the end-to-end id", async () => {
    const { deps } = createDeps(() =>
      jsonResponse({
        transactions: [
          incoming({
            amount: { value: "1 000,00", currency: "CZK" },
            entryDetails: {
              transactionDetails: {
                remittanceInformation: {
                  structured: {
                    creditorReferenceInformation: {
                      reference: ["KS:0308", "VS:42"],
                    },
                  },
                },
              },
            },
          }),
          incoming({
            entryReference: null,
            status: "PDNG",
            entryDetails: {
              transactionDetails: {
                references: { endToEndIdentification: "VS:0009" },
              },
            },
          }),
          incoming({ entryDetails: null, bookingDate: null }),
        ],
      })
    )
    await using run = testCreateRun(deps)

    const result = await run(fetchMonetaTransactions(range))

    expect(result).toMatchObject({
      ok: true,
      value: {
        transactions: [
          { id: "E-1", amountMinor: 100_000, variableSymbol: "42" },
          { id: null, status: "pending", variableSymbol: "9" },
          { id: "E-1", variableSymbol: null, occurredOn: null, note: null },
        ],
      },
    })
  })

  test("reads all three symbols from the end-to-end id when there is no structured reference", async () => {
    const { deps } = createDeps(() =>
      jsonResponse({
        transactions: [
          incoming({
            entryDetails: {
              transactionDetails: {
                references: {
                  endToEndIdentification: "/VS0042/SS0261101/KS0308",
                },
              },
            },
          }),
          incoming({
            entryDetails: {
              transactionDetails: {
                references: { endToEndIdentification: "/VS99/SS5" },
                remittanceInformation: {
                  structured: {
                    creditorReferenceInformation: { reference: "VS:42" },
                  },
                },
              },
            },
          }),
        ],
      })
    )
    await using run = testCreateRun(deps)

    const result = await run(fetchMonetaTransactions(range))

    expect(result).toMatchObject({
      ok: true,
      value: {
        transactions: [
          {
            variableSymbol: "42",
            specificSymbol: "261101",
            constantSymbol: "0308",
          },
          { variableSymbol: "42", specificSymbol: "5", constantSymbol: null },
        ],
      },
    })
  })

  test("reads the symbol from the end-to-end id when the reference's is no symbol", async () => {
    const { deps } = createDeps(() =>
      jsonResponse({
        transactions: [
          incoming({
            entryDetails: {
              transactionDetails: {
                references: { endToEndIdentification: "/VS42" },
                remittanceInformation: {
                  structured: {
                    creditorReferenceInformation: {
                      reference: "VS:12345678901",
                    },
                  },
                },
              },
            },
          }),
        ],
      })
    )
    await using run = testCreateRun(deps)

    const result = await run(fetchMonetaTransactions(range))

    expect(result).toMatchObject({
      ok: true,
      value: { transactions: [{ variableSymbol: "42" }] },
    })
  })

  test("keeps outgoing, reversed, foreign and unknown-status entries for the module to filter", async () => {
    const { deps } = createDeps(() =>
      jsonResponse({
        transactions: [
          incoming({ creditDebitIndicator: "DBIT" }),
          incoming({ reversalIndicator: true }),
          incoming({ amount: { value: 10, currency: "EUR" } }),
          incoming({ status: "FUTR" }),
        ],
      })
    )
    await using run = testCreateRun(deps)

    const result = await run(fetchMonetaTransactions(range))

    expect(result).toMatchObject({
      ok: true,
      value: {
        skipped: [],
        transactions: [
          { direction: "outgoing", amountMinor: -75_050 },
          { isReversal: true },
          { currency: "EUR", amountMinor: 1000 },
          { status: "other" },
        ],
      },
    })
  })

  test("skips malformed entries without failing the page, keeping them as sent", async () => {
    const malformed = [
      incoming({ amount: { value: "n/a", currency: "CZK" } }),
      incoming({ amount: { value: 1, currency: "XYZ" } }),
      { creditDebitIndicator: "CRDT" },
      "not an entry",
    ]
    const { deps } = createDeps(() =>
      jsonResponse({ transactions: [incoming(), ...malformed] })
    )
    await using run = testCreateRun(deps)

    const result = await run(fetchMonetaTransactions(range))

    expect(result).toMatchObject({
      ok: true,
      value: { skipped: malformed, transactions: [{ id: "E-1" }] },
    })
  })

  test("reads every page the bank reports", async () => {
    const { deps, requests } = createDeps((url) => {
      const page = url.searchParams.get("page")
      return jsonResponse({
        pageCount: 3,
        transactions: [incoming({ entryReference: `E-${page}` })],
      })
    })
    await using run = testCreateRun(deps)

    const result = await run(fetchMonetaTransactions(range))

    expect(
      requests.map((request) => request.url.searchParams.get("page"))
    ).toEqual(["0", "1", "2"])
    expect(result).toMatchObject({
      ok: true,
      value: {
        isTruncated: false,
        callCount: 3,
        transactions: [{ id: "E-0" }, { id: "E-1" }, { id: "E-2" }],
      },
    })
  })

  test("asks for the bank's page of 100", async () => {
    const { deps, requests } = createDeps(() =>
      jsonResponse({ pageCount: 1, transactions: [] })
    )
    await using run = testCreateRun(deps)

    await run(fetchMonetaTransactions(range))

    expect(requests[0]?.url.searchParams.get("size")).toBe("100")
  })

  test("ends the listing at a page the bank no longer has", async () => {
    const { deps, requests } = createDeps((url) =>
      url.searchParams.get("page") === "0"
        ? jsonResponse({ pageCount: 3, transactions: [incoming()] })
        : jsonResponse(
            {
              errors: [
                { error: "PAGE_NOT_FOUND", message: "Page 1 does not exist" },
              ],
            },
            404
          )
    )
    await using run = testCreateRun(deps)

    const result = await run(fetchMonetaTransactions(range))

    expect(requests).toHaveLength(2)
    expect(result).toMatchObject({
      ok: true,
      value: {
        isTruncated: false,
        callCount: 2,
        transactions: [{ id: "E-1" }],
      },
    })
  })

  test("fails on any other 404", async () => {
    const { deps } = createDeps(() =>
      jsonResponse({ errors: [{ error: "ACCOUNT_NOT_FOUND" }] }, 404)
    )
    await using run = testCreateRun(deps)

    await expect(run(fetchMonetaTransactions(range))).resolves.toMatchObject({
      ok: false,
      error: { type: "MonetaHttpError", status: 404 },
    })
  })

  test("stops at MONETA_MAX_PAGES so a runaway page count cannot spend the daily limit", async () => {
    const { deps, requests } = createDeps(() =>
      jsonResponse({ pageCount: 1000, transactions: [] })
    )
    await using run = testCreateRun(deps)

    const result = await run(fetchMonetaTransactions(range))

    expect(requests).toHaveLength(MONETA_MAX_PAGES)
    expect(result).toMatchObject({
      ok: true,
      value: { isTruncated: true, callCount: MONETA_MAX_PAGES },
    })
  })

  test("maps 401, its NARR code, 403 and 429", async () => {
    const cases = [
      {
        response: jsonResponse(
          { errors: [{ error: "NARR", message: "Older than 2 years" }] },
          401
        ),
        expected: {
          type: "MonetaUnauthorizedError",
          status: 401,
          code: "NARR",
        },
      },
      {
        response: new Response("", { status: 401 }),
        expected: { type: "MonetaUnauthorizedError", status: 401, code: null },
      },
      {
        response: new Response("", { status: 403 }),
        expected: { type: "MonetaUnauthorizedError", status: 403 },
      },
      {
        response: new Response("slow down", { status: 429 }),
        expected: { type: "MonetaRateLimitError", responseBody: "slow down" },
      },
      {
        response: new Response("oops", { status: 500 }),
        expected: { type: "MonetaHttpError", status: 500 },
      },
      {
        response: new Response("<soap/>", { status: 200 }),
        expected: { type: "MonetaApiError", status: 200 },
      },
    ]

    for (const { response, expected } of cases) {
      const { deps } = createDeps(() => response)
      await using run = testCreateRun(deps)

      await expect(run(fetchMonetaTransactions(range))).resolves.toMatchObject({
        ok: false,
        error: expected,
      })
    }
  })
})

describe("fetchMonetaAccounts", () => {
  test("lists the accounts with a normalized IBAN, null when there is none", async () => {
    const entries = [
      {
        id: "main",
        identification: { iban: "cz38 0600 0000 0021 2345 6789" },
      },
      { id: "other", identification: {} },
      { identification: { iban: "CZ3806000000002123456789" } },
      "not an account",
    ]
    const { deps, requests } = createDeps(() =>
      jsonResponse({ accounts: entries })
    )
    await using run = testCreateRun(deps)

    await expect(run(fetchMonetaAccounts())).resolves.toEqual({
      ok: true,
      value: {
        accounts: [
          { id: "main", iban: "CZ3806000000002123456789" },
          { id: "other", iban: null },
        ],
        entries,
      },
    })
    expect(requests[0]?.url.pathname).toBe("/api/v4/vip/aisp/my/accounts")
  })

  test("reads every page of accounts", async () => {
    const { deps, requests } = createDeps((url) => {
      const page = url.searchParams.get("page")
      return jsonResponse({
        pageCount: 2,
        accounts: [{ id: `account-${page}` }],
      })
    })
    await using run = testCreateRun(deps)

    await expect(run(fetchMonetaAccounts())).resolves.toMatchObject({
      ok: true,
      value: {
        accounts: [
          { id: "account-0", iban: null },
          { id: "account-1", iban: null },
        ],
      },
    })
    expect(
      requests.map((request) => request.url.searchParams.get("page"))
    ).toEqual(["0", "1"])
  })

  test("reads an empty body as no accounts", async () => {
    const { deps } = createDeps(() => jsonResponse({}))
    await using run = testCreateRun(deps)

    await expect(run(fetchMonetaAccounts())).resolves.toEqual({
      ok: true,
      value: { accounts: [], entries: [] },
    })
  })
})
