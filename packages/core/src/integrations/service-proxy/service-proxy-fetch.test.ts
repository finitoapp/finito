import { testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"

import { createFioApiDep, fetchFioLastTransactions } from "../fio/fio-client.ts"
import {
  createMonetaApiDep,
  fetchMonetaAccounts,
} from "../moneta/moneta-client.ts"
import { createServiceProxyFetch } from "./service-proxy-fetch.ts"
import {
  SERVICE_PROXY_ERROR_HEADER,
  SERVICE_PROXY_PATH_HEADER,
  SERVICE_PROXY_RELAYED,
  SERVICE_PROXY_RELAYED_HEADER,
} from "./service-proxy-services.ts"

interface RecordedRequest {
  readonly url: string
  readonly init: RequestInit | undefined
}

const apiBaseUrl = "https://app.example"

/** An answer the proxy relayed from the service, marked as such. */
const relayedResponse = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: { [SERVICE_PROXY_RELAYED_HEADER]: SERVICE_PROXY_RELAYED },
  })

const createProxyFetch = ({
  enabled,
  respond = () => relayedResponse("{}"),
}: {
  readonly enabled: () => boolean
  readonly respond?: (url: string) => Response | Promise<Response>
}) => {
  const requests: RecordedRequest[] = []
  const fetch = createServiceProxyFetch({
    fetch: async (input, init) => {
      const url = input instanceof Request ? input.url : input.toString()
      requests.push({ url, init })
      return await respond(url)
    },
    apiBaseUrl,
    isEnabled: enabled,
  })

  return { fetch, requests }
}

const headersOf = (request: RecordedRequest | undefined) =>
  Object.fromEntries(new Headers(request?.init?.headers).entries())

const proxyErrorResponse = (status: number) =>
  new Response("Upstream unreachable.", {
    status,
    headers: { [SERVICE_PROXY_ERROR_HEADER]: "upstream-unreachable" },
  })

describe("createServiceProxyFetch", () => {
  test("sends a call to a registry origin through the proxy when enabled", async () => {
    const { fetch, requests } = createProxyFetch({ enabled: () => true })

    await fetch(
      "https://api.moneta.cz/api/v4/vip/aisp/my/accounts?page=0&size=100",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer secret",
          Cookie: "session=1",
          "X-Other": "1",
        },
      }
    )

    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe("https://app.example/api/proxy/moneta")
    expect(requests[0]?.init?.method).toBe("GET")
    expect(headersOf(requests[0])).toEqual({
      accept: "application/json",
      authorization: "Bearer secret",
      [SERVICE_PROXY_PATH_HEADER]:
        "/api/v4/vip/aisp/my/accounts?page=0&size=100",
    })
  })

  test("passes on only the headers the service lets through", async () => {
    const { fetch, requests } = createProxyFetch({ enabled: () => true })

    await fetch(
      new Request("https://fioapi.fio.cz/v1/rest/last/T/transactions.json", {
        headers: { Accept: "application/json", Authorization: "Bearer x" },
      })
    )

    expect(headersOf(requests[0])).toEqual({
      accept: "application/json",
      [SERVICE_PROXY_PATH_HEADER]: "/v1/rest/last/T/transactions.json",
    })
  })

  test("keeps the Fio token out of the URL, sending it in x-proxy-path", async () => {
    const { fetch, requests } = createProxyFetch({
      enabled: () => true,
      respond: () =>
        relayedResponse(
          JSON.stringify({
            accountStatement: {
              info: { iban: "CZ6508000000192000145399", currency: "CZK" },
              transactionList: { transaction: [] },
            },
          })
        ),
    })
    const token = "fio-secret-token"
    await using run = testCreateRun({
      ...createFioApiDep({ tokens: [token] }),
      fetch,
    })

    const result = await run(fetchFioLastTransactions())

    expect(result.ok).toBe(true)
    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe("https://app.example/api/proxy/fio")
    expect(requests[0]?.url).not.toContain(token)
    expect(headersOf(requests[0])[SERVICE_PROXY_PATH_HEADER]).toBe(
      `/v1/rest/last/${token}/transactions.json`
    )
  })

  test("asks isEnabled at each call and passes calls through while it is off", async () => {
    let enabled = false
    const { fetch, requests } = createProxyFetch({ enabled: () => enabled })
    const bankUrl = "https://fioapi.fio.cz/v1/rest/last/T/transactions.json"
    const init = { headers: { Accept: "application/json" } }

    await fetch(bankUrl, init)
    enabled = true
    await fetch(bankUrl, init)
    enabled = false
    await fetch(bankUrl, init)

    expect(requests.map((request) => request.url)).toEqual([
      bankUrl,
      "https://app.example/api/proxy/fio",
      bankUrl,
    ])
    expect(requests[0]?.init).toBe(init)
  })

  test("passes calls to other origins through untouched", async () => {
    const { fetch, requests } = createProxyFetch({ enabled: () => true })
    const init = { method: "POST", body: "{}" }

    await fetch("https://api.qerko.example/pay", init)
    await fetch("/api/donations")
    await fetch(new URL("https://fioapi.fio.cz.evil.example/v1/rest/"))

    expect(requests).toEqual([
      { url: "https://api.qerko.example/pay", init },
      { url: "/api/donations", init: undefined },
      { url: "https://fioapi.fio.cz.evil.example/v1/rest/", init: undefined },
    ])
  })

  test("refuses to proxy anything but a GET", async () => {
    const { fetch, requests } = createProxyFetch({ enabled: () => true })

    await expect(
      fetch("https://api.moneta.cz/api/v4/vip/aisp/my/accounts", {
        method: "POST",
        body: "{}",
      })
    ).rejects.toBeInstanceOf(TypeError)
    expect(requests).toEqual([])
  })

  test("turns a proxy failure into a FetchError, never MonetaUnauthorizedError", async () => {
    for (const status of [400, 401, 403, 421, 502]) {
      const { fetch } = createProxyFetch({
        enabled: () => true,
        respond: () => proxyErrorResponse(status),
      })
      await using run = testCreateRun({
        ...createMonetaApiDep({ token: "secret" }),
        fetch,
      })

      const result = await run(fetchMonetaAccounts())

      expect(result).toMatchObject({
        ok: false,
        error: {
          type: "FetchError",
          error: { name: "ServiceProxyError", service: "moneta", status },
        },
      })
    }
  })

  test("turns a proxy failure into a FetchError for Fio too", async () => {
    const { fetch } = createProxyFetch({
      enabled: () => true,
      respond: () => proxyErrorResponse(409),
    })
    await using run = testCreateRun({
      ...createFioApiDep({ tokens: ["token"] }),
      fetch,
    })

    const result = await run(fetchFioLastTransactions())

    expect(result).toMatchObject({ ok: false, error: { type: "FetchError" } })
  })

  test("returns the service's own failures as they are", async () => {
    const { fetch } = createProxyFetch({
      enabled: () => true,
      respond: () =>
        relayedResponse(JSON.stringify({ errors: [{ error: "NARR" }] }), 401),
    })
    await using run = testCreateRun({
      ...createMonetaApiDep({ token: "secret" }),
      fetch,
    })

    const result = await run(fetchMonetaAccounts())

    expect(result).toMatchObject({
      ok: false,
      error: { type: "MonetaUnauthorizedError", status: 401, code: "NARR" },
    })
  })

  test.each([
    ["401 from deployment protection", 401, "text/html", "<html>Login</html>"],
    ["403 from the firewall's challenge", 403, "text/html", "<html>Bot</html>"],
    ["429 from the platform's rate limit", 429, "text/plain", "Too Many"],
    ["404 from the platform", 404, "text/plain", "NOT_FOUND"],
    ["500 HTML error page", 500, "text/html", "<html>Error</html>"],
    ["200 the proxy never marked", 200, "application/json", '{"accounts":[]}'],
  ])(
    "turns an unmarked %s into a FetchError, never a MONETA answer",
    async (_, status, contentType, body) => {
      const { fetch } = createProxyFetch({
        enabled: () => true,
        respond: () =>
          new Response(body, {
            status,
            headers: { "content-type": contentType },
          }),
      })
      await using run = testCreateRun({
        ...createMonetaApiDep({ token: "secret" }),
        fetch,
      })

      const result = await run(fetchMonetaAccounts())

      expect(result).toMatchObject({
        ok: false,
        error: {
          type: "FetchError",
          error: {
            name: "ServiceProxyError",
            service: "moneta",
            status,
            reason: "not-relayed",
          },
        },
      })
    }
  )

  test.each([401, 403, 409, 429, 500])(
    "turns an unmarked %i into a FetchError, never a Fio HTTP error",
    async (status) => {
      const { fetch } = createProxyFetch({
        enabled: () => true,
        respond: () => new Response("<html>Error</html>", { status }),
      })
      await using run = testCreateRun({
        ...createFioApiDep({ tokens: ["token"] }),
        fetch,
      })

      const result = await run(fetchFioLastTransactions())

      expect(result).toMatchObject({
        ok: false,
        error: {
          type: "FetchError",
          error: { name: "ServiceProxyError", service: "fio", status },
        },
      })
    }
  )

  test("takes a response carrying the proxy's error header for a proxy failure, marked or not", async () => {
    const { fetch } = createProxyFetch({
      enabled: () => true,
      respond: () =>
        new Response(null, {
          status: 401,
          headers: {
            [SERVICE_PROXY_RELAYED_HEADER]: SERVICE_PROXY_RELAYED,
            [SERVICE_PROXY_ERROR_HEADER]: "foreign-origin",
          },
        }),
    })

    await expect(
      fetch("https://api.moneta.cz/api/v4/vip/aisp/my/accounts")
    ).rejects.toMatchObject({
      name: "ServiceProxyError",
      reason: "foreign-origin",
    })
  })

  test("rethrows an abort that lands on an unmarked answer as it came", async () => {
    const abortReason = new Error("aborted")
    const controller = new AbortController()
    const { fetch } = createProxyFetch({
      enabled: () => true,
      respond: () => {
        controller.abort(abortReason)
        return new Response("<html>Error</html>", { status: 500 })
      },
    })

    await expect(
      fetch("https://fioapi.fio.cz/v1/rest/last/T/transactions.json", {
        signal: controller.signal,
      })
    ).rejects.toBe(abortReason)
  })

  test("hands the caller's signal on and rethrows an abort as it came", async () => {
    const abortReason = new Error("aborted")
    const controller = new AbortController()
    const { fetch, requests } = createProxyFetch({
      enabled: () => true,
      respond: () => {
        controller.abort(abortReason)
        return proxyErrorResponse(502)
      },
    })

    await expect(
      fetch("https://fioapi.fio.cz/v1/rest/last/T/transactions.json", {
        signal: controller.signal,
      })
    ).rejects.toBe(abortReason)
    expect(requests[0]?.init?.signal).toBe(controller.signal)
  })

  test("lets a failing fetch reject with its own error", async () => {
    const failure = new TypeError("Failed to fetch")
    const { fetch } = createProxyFetch({
      enabled: () => true,
      respond: () => Promise.reject(failure),
    })

    await expect(
      fetch("https://fioapi.fio.cz/v1/rest/last/T/transactions.json")
    ).rejects.toBe(failure)
  })
})
