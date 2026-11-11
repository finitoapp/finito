import { type Result, testCreateRun } from "@evolu/common"
import type { FetchDep } from "@payky/core/deps"
import {
  createFioApiDep,
  type FioApiDep,
  fetchFioLastTransactions,
  fetchFioTransactionsByPeriod,
  setFioLastDate,
} from "@payky/core/integrations/fio/fio-client"
import {
  createMonetaApiDep,
  fetchMonetaAccounts,
  fetchMonetaTransactions,
  type MonetaApiDep,
} from "@payky/core/integrations/moneta/moneta-client"
import { createServiceProxyFetch } from "@payky/core/integrations/service-proxy/service-proxy-fetch"
import {
  type ProxiedService,
  proxiedServiceNames,
  serviceProxyEndpointPath,
} from "@payky/core/integrations/service-proxy/service-proxy-services"
import { DateStringSchema } from "@payky/core/modules/shared/schema"
import { describe, expect, test } from "vitest"
import { handleServiceProxyRequest } from "./service-proxy.ts"

/**
 * The real Fio and MONETA client Tasks, run once against the banks directly
 * and once through `createServiceProxyFetch` and `handleServiceProxyRequest`
 * wired together. Every call a client makes has to pass the proxy's
 * allowlist and reach the bank exactly as the direct call does, so a client
 * path that drifts off `proxiedServices` fails here.
 */

const apiBaseUrl = "https://payky.test"
const fioToken =
  "FioToken0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQR"
const monetaToken = "moneta-token"
/** A MONETA account id that only reaches the bank percent-encoded. */
const monetaAccountId = "acc/1 ž+="
const iban = "CZ6508000000192000145399"

const fioStatement = {
  accountStatement: {
    info: { iban, currency: "CZK" },
    transactionList: {
      transaction: [
        {
          column0: { value: 123456789, name: "ID pohybu" },
          column1: { value: "2026-05-26+02:00", name: "Datum" },
          column2: { value: "199.50", name: "Objem" },
          column3: { value: "CZK", name: "Měna" },
          column9: { value: "123456", name: "VS" },
        },
      ],
    },
  },
}

/** A ČOBS v7 incoming transfer, as `moneta-client.test.ts` describes it. */
const monetaTransaction = (entryReference: string) => ({
  entryReference,
  amount: { value: 750.5, currency: "CZK" },
  creditDebitIndicator: "CRDT",
  reversalIndicator: false,
  status: "BOOK",
  bookingDate: { date: "2026-10-30" },
})

/** Two pages of everything, so every client pages through the proxy. */
const pageCount = 2

const bankAnswer = (url: URL): Response => {
  if (url.origin === "https://fioapi.fio.cz") {
    return url.pathname.startsWith("/v1/rest/set-last-date/")
      ? new Response("", { headers: { "content-type": "text/plain" } })
      : Response.json(fioStatement)
  }
  const page = url.searchParams.get("page") ?? "0"
  if (url.pathname.endsWith("/transactions")) {
    return Response.json({
      pageCount,
      transactions: [monetaTransaction(`E-${page}`)],
    })
  }
  return Response.json({
    pageCount,
    accounts: [{ id: monetaAccountId, identification: { iban } }],
  })
}

interface BankCall {
  readonly url: string
  readonly headers: Readonly<Record<string, string>>
}

/** The banks' side: records each call exactly as it arrives. */
const createBanks = () => {
  const calls: BankCall[] = []
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    calls.push({
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
    })
    return bankAnswer(new URL(request.url))
  }
  return { calls, fetch }
}

const serviceOfEndpoint = (pathname: string): ProxiedService | undefined =>
  proxiedServiceNames.find(
    (service) => serviceProxyEndpointPath(service) === pathname
  )

/**
 * The browser's fetch with the proxy on, its calls to `/api/proxy/<service>`
 * handed to the handler as the endpoints in `api/proxy` hand them.
 */
const createProxiedFetch = (banks: ReturnType<typeof createBanks>) => {
  const proxyUrls: string[] = []
  const fetch = createServiceProxyFetch({
    isEnabled: () => true,
    apiBaseUrl,
    fetch: async (input, init) => {
      const request = new Request(input, init)
      proxyUrls.push(request.url)
      const service = serviceOfEndpoint(new URL(request.url).pathname)
      if (service === undefined) return new Response(null, { status: 404 })
      return await handleServiceProxyRequest(request, {
        service,
        fetch: banks.fetch,
        env: {},
      })
    },
  })
  return { fetch, proxyUrls }
}

type BankDeps = FioApiDep & MonetaApiDep & FetchDep

const createDeps = (fetch: typeof globalThis.fetch): BankDeps => ({
  ...createFioApiDep({ tokens: [fioToken] }),
  ...createMonetaApiDep({ token: monetaToken }),
  fetch,
})

const from = DateStringSchema.decode("2026-10-29")
const to = DateStringSchema.decode("2026-10-30")

const clientCalls: ReadonlyArray<{
  readonly name: string
  readonly service: ProxiedService
  readonly callCount: number
  readonly execute: (deps: BankDeps) => Promise<Result<unknown, unknown>>
}> = [
  {
    name: "fetchFioLastTransactions",
    service: "fio",
    callCount: 1,
    execute: async (deps) => {
      await using run = testCreateRun(deps)
      return await run(fetchFioLastTransactions())
    },
  },
  {
    name: "fetchFioTransactionsByPeriod",
    service: "fio",
    callCount: 1,
    execute: async (deps) => {
      await using run = testCreateRun(deps)
      return await run(fetchFioTransactionsByPeriod({ from, to }))
    },
  },
  {
    name: "setFioLastDate",
    service: "fio",
    callCount: 1,
    execute: async (deps) => {
      await using run = testCreateRun(deps)
      return await run(setFioLastDate({ date: to }))
    },
  },
  {
    name: "fetchMonetaAccounts",
    service: "moneta",
    callCount: pageCount,
    execute: async (deps) => {
      await using run = testCreateRun(deps)
      return await run(fetchMonetaAccounts())
    },
  },
  {
    name: "fetchMonetaTransactions",
    service: "moneta",
    callCount: pageCount,
    execute: async (deps) => {
      await using run = testCreateRun(deps)
      return await run(
        fetchMonetaTransactions({ monetaAccountId, fromDate: from, toDate: to })
      )
    },
  },
]

describe("the bank clients through the service proxy", () => {
  test.each(clientCalls)(
    "$name reaches the bank through the proxy exactly as it does directly",
    async ({ service, callCount, execute }) => {
      const directBanks = createBanks()
      const direct = await execute(createDeps(directBanks.fetch))
      const proxiedBanks = createBanks()
      const proxied = createProxiedFetch(proxiedBanks)

      const result = await execute(createDeps(proxied.fetch))

      expect(direct.ok).toBe(true)
      expect(result).toEqual(direct)
      expect(proxiedBanks.calls).toHaveLength(callCount)
      expect(proxiedBanks.calls).toEqual(directBanks.calls)
      expect(proxied.proxyUrls).toEqual(
        Array.from({ length: callCount }, () =>
          new URL(serviceProxyEndpointPath(service), apiBaseUrl).toString()
        )
      )
    }
  )

  test("sends the Fio token to Fio in its path, never in a URL to the proxy", async () => {
    const banks = createBanks()
    const proxied = createProxiedFetch(banks)
    const deps = createDeps(proxied.fetch)

    for (const { service, execute } of clientCalls) {
      if (service === "fio") expect((await execute(deps)).ok).toBe(true)
    }

    expect(banks.calls.map((call) => call.url)).toEqual([
      `https://fioapi.fio.cz/v1/rest/last/${fioToken}/transactions.json`,
      `https://fioapi.fio.cz/v1/rest/periods/${fioToken}/${from}/${to}/transactions.json`,
      `https://fioapi.fio.cz/v1/rest/set-last-date/${fioToken}/${to}/`,
    ])
    for (const call of banks.calls) {
      expect(call.headers).toEqual({ accept: "application/json, text/plain" })
    }
    expect(proxied.proxyUrls).toHaveLength(3)
    for (const url of proxied.proxyUrls) expect(url).not.toContain(fioToken)
  })

  test("pages MONETA through the proxy with the bearer token and the account id encoded", async () => {
    const banks = createBanks()
    const proxied = createProxiedFetch(banks)
    const deps = createDeps(proxied.fetch)

    for (const { service, execute } of clientCalls) {
      if (service === "moneta") expect((await execute(deps)).ok).toBe(true)
    }

    const accounts = "https://api.moneta.cz/api/v4/vip/aisp/my/accounts"
    const transactions = `${accounts}/${encodeURIComponent(monetaAccountId)}/transactions`
    expect(banks.calls.map((call) => call.url)).toEqual([
      `${accounts}?page=0&size=100`,
      `${accounts}?page=1&size=100`,
      `${transactions}?fromDate=${from}&toDate=${to}&page=0&size=100`,
      `${transactions}?fromDate=${from}&toDate=${to}&page=1&size=100`,
    ])
    for (const call of banks.calls) {
      expect(call.headers).toEqual({
        accept: "application/json",
        authorization: `Bearer ${monetaToken}`,
      })
    }
  })
})
