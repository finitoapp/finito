import {
  createServiceProxyFetch,
  ServiceProxyError,
} from "@payky/core/integrations/service-proxy/service-proxy-fetch"
import {
  isProxiedService,
  type ProxiedService,
  SERVICE_PROXY_ERROR_HEADER,
  SERVICE_PROXY_PATH_HEADER,
  SERVICE_PROXY_RELAYED,
  SERVICE_PROXY_RELAYED_HEADER,
} from "@payky/core/integrations/service-proxy/service-proxy-services"
import { describe, expect, test, vi } from "vitest"
import { handleServiceProxyRequest } from "./service-proxy.ts"

const ownOrigin = "https://payky.test"
const fioPath = "/v1/rest/last/fio-token/transactions.json"
const monetaPath = "/api/v4/vip/aisp/my/accounts?page=0&size=100"

const proxyRequest = ({
  service = "moneta",
  method = "GET",
  path = monetaPath,
  headers = {},
}: {
  readonly service?: ProxiedService
  readonly method?: string
  readonly path?: string | null
  readonly headers?: Readonly<Record<string, string>>
} = {}) =>
  new Request(`${ownOrigin}/api/proxy/${service}`, {
    method,
    headers: {
      ...(path === null ? {} : { [SERVICE_PROXY_PATH_HEADER]: path }),
      ...headers,
    },
  })

const upstreamReturning = (
  response: () => Response = () => Response.json({ accounts: [] })
) => vi.fn<typeof fetch>(() => Promise.resolve(response()))

const upstreamCall = (upstream: ReturnType<typeof upstreamReturning>) => {
  const [input, init] = upstream.mock.calls[0] ?? []
  return {
    url: input?.toString(),
    headers: Object.fromEntries(new Headers(init?.headers).entries()),
    init,
  }
}

const corsHeaderNames = (response: Response) =>
  [...response.headers.keys()].filter(
    (name) => name.startsWith("access-control-") || name === "vary"
  )

const expectProxyError = (response: Response, reason: string) => {
  expect(response.headers.get(SERVICE_PROXY_ERROR_HEADER)).toBe(reason)
  expect(response.headers.get(SERVICE_PROXY_RELAYED_HEADER)).toBeNull()
  expect([401, 403]).not.toContain(response.status)
}

const exposedHeaders = `${SERVICE_PROXY_ERROR_HEADER}, ${SERVICE_PROXY_RELAYED_HEADER}`

const allowedEnv = {
  PAYKY_SERVICE_PROXY_ALLOWED_ORIGINS:
    "https://localhost:5173, http://localhost:8081",
}

describe("handleServiceProxyRequest origin checks", () => {
  test("passes a same-origin request without an Origin header and sends no CORS headers", async () => {
    const upstream = upstreamReturning()

    const response = await handleServiceProxyRequest(proxyRequest(), {
      service: "moneta",
      fetch: upstream,
      env: allowedEnv,
    })

    expect(response.status).toBe(200)
    expect(upstream).toHaveBeenCalledOnce()
    expect(corsHeaderNames(response)).toEqual([])
  })

  test("passes a request whose Origin is its own", async () => {
    const upstream = upstreamReturning()

    const response = await handleServiceProxyRequest(
      proxyRequest({
        headers: { origin: ownOrigin, "sec-fetch-site": "same-origin" },
      }),
      { service: "moneta", fetch: upstream, env: {} }
    )

    expect(response.status).toBe(200)
    expect(corsHeaderNames(response)).toEqual([])
  })

  test("refuses a foreign Origin with 421 without calling upstream", async () => {
    const upstream = upstreamReturning()

    const response = await handleServiceProxyRequest(
      proxyRequest({ headers: { origin: "https://evil.example" } }),
      { service: "moneta", fetch: upstream, env: allowedEnv }
    )

    expect(response.status).toBe(421)
    expectProxyError(response, "foreign-origin")
    expect(upstream).not.toHaveBeenCalled()
    expect(response.headers.get("access-control-allow-origin")).toBeNull()
  })

  test.each(["cross-site", "same-site"])(
    "refuses Sec-Fetch-Site %s without an allowed Origin",
    async (fetchSite) => {
      const upstream = upstreamReturning()

      const response = await handleServiceProxyRequest(
        proxyRequest({ headers: { "sec-fetch-site": fetchSite } }),
        { service: "moneta", fetch: upstream, env: allowedEnv }
      )

      expect(response.status).toBe(421)
      expectProxyError(response, "foreign-origin")
      expect(upstream).not.toHaveBeenCalled()
    }
  )

  test("answers an origin allowed by the env with its own ACAO and a vary on origin", async () => {
    const upstream = upstreamReturning()

    const response = await handleServiceProxyRequest(
      proxyRequest({
        headers: {
          origin: "http://localhost:8081",
          "sec-fetch-site": "cross-site",
        },
      }),
      { service: "moneta", fetch: upstream, env: allowedEnv }
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:8081"
    )
    expect(response.headers.get("vary")).toBe("origin")
    expect(response.headers.get("access-control-expose-headers")).toBe(
      exposedHeaders
    )
  })

  test("answers the preflight of an allowed origin without calling upstream", async () => {
    const upstream = upstreamReturning()

    const response = await handleServiceProxyRequest(
      proxyRequest({
        method: "OPTIONS",
        path: null,
        headers: {
          origin: "https://localhost:5173",
          "access-control-request-method": "GET",
          "access-control-request-headers": "authorization, x-proxy-path",
        },
      }),
      { service: "moneta", fetch: upstream, env: allowedEnv }
    )

    expect(response.status).toBe(204)
    expect(Object.fromEntries(response.headers.entries())).toMatchObject({
      "access-control-allow-origin": "https://localhost:5173",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "accept, authorization, x-proxy-path",
      vary: "origin",
    })
    expect(upstream).not.toHaveBeenCalled()
  })

  test.each([
    ["no list", {}],
    ["an empty list", { PAYKY_SERVICE_PROXY_ALLOWED_ORIGINS: "" }],
    [
      "a list with a path in it",
      {
        PAYKY_SERVICE_PROXY_ALLOWED_ORIGINS:
          "http://localhost:8081,https://localhost:5173/app",
      },
    ],
    [
      "a list with a non-http scheme",
      { PAYKY_SERVICE_PROXY_ALLOWED_ORIGINS: "http://localhost:8081,ftp://x" },
    ],
    [
      "a list with something that is no URL",
      { PAYKY_SERVICE_PROXY_ALLOWED_ORIGINS: "http://localhost:8081,*" },
    ],
  ])("allows no foreign origin for %s in the env", async (_, env) => {
    const upstream = upstreamReturning()

    const response = await handleServiceProxyRequest(
      proxyRequest({ headers: { origin: "http://localhost:8081" } }),
      { service: "moneta", fetch: upstream, env }
    )

    expect(response.status).toBe(421)
    expectProxyError(response, "foreign-origin")
    expect(upstream).not.toHaveBeenCalled()
  })

  test("refuses the preflight of a foreign origin", async () => {
    const upstream = upstreamReturning()

    const response = await handleServiceProxyRequest(
      proxyRequest({
        method: "OPTIONS",
        path: null,
        headers: { origin: "https://evil.example" },
      }),
      { service: "moneta", fetch: upstream, env: allowedEnv }
    )

    expect(response.status).toBe(421)
    expectProxyError(response, "foreign-origin")
    expect(response.headers.get("access-control-allow-origin")).toBeNull()
  })
})

describe("handleServiceProxyRequest upstream checks", () => {
  test.each([
    ["a protocol-relative URL", "//evil.example/x"],
    ["an absolute URL", "https://evil.example/api/v4/vip/aisp/my/accounts"],
    [
      "an absolute URL on the service's own origin",
      "https://api.moneta.cz/api/v4/vip/aisp/my/accounts",
    ],
    ["a path off the allowlist", "/api/v4/vip/pisp/payments"],
    ["a traversal out of the allowlist", "/api/v4/vip/aisp/my/accounts/../x"],
    ["an escaped traversal", "/api/v4/vip/aisp/my/accounts/%2e%2e/x"],
    ["an empty path", ""],
  ])("refuses %s in x-proxy-path without calling upstream", async (_, path) => {
    const upstream = upstreamReturning()

    const response = await handleServiceProxyRequest(proxyRequest({ path }), {
      service: "moneta",
      fetch: upstream,
      env: {},
    })

    expect(response.status).toBe(400)
    expectProxyError(response, "path-not-allowed")
    expect(upstream).not.toHaveBeenCalled()
  })

  test("refuses a request without x-proxy-path", async () => {
    const upstream = upstreamReturning()

    const response = await handleServiceProxyRequest(
      proxyRequest({ path: null }),
      { service: "moneta", fetch: upstream, env: {} }
    )

    expect(response.status).toBe(400)
    expectProxyError(response, "path-not-allowed")
    expect(upstream).not.toHaveBeenCalled()
  })

  test("refuses another service's path", async () => {
    const upstream = upstreamReturning()

    const response = await handleServiceProxyRequest(
      proxyRequest({ service: "fio", path: monetaPath }),
      { service: "fio", fetch: upstream, env: {} }
    )

    expect(response.status).toBe(400)
    expect(upstream).not.toHaveBeenCalled()
  })

  test.each(["POST", "PUT", "DELETE", "PATCH", "HEAD"])(
    "refuses %s with 405 without calling upstream",
    async (method) => {
      const upstream = upstreamReturning()

      const response = await handleServiceProxyRequest(
        proxyRequest({ method }),
        { service: "moneta", fetch: upstream, env: {} }
      )

      expect(response.status).toBe(405)
      expectProxyError(response, "method-not-allowed")
      expect(response.headers.get("allow")).toBe("GET, OPTIONS")
      expect(upstream).not.toHaveBeenCalled()
    }
  )

  test("refuses a same-origin OPTIONS, which no browser sends as a preflight", async () => {
    const upstream = upstreamReturning()

    const response = await handleServiceProxyRequest(
      proxyRequest({ method: "OPTIONS" }),
      { service: "moneta", fetch: upstream, env: allowedEnv }
    )

    expect(response.status).toBe(405)
    expectProxyError(response, "method-not-allowed")
  })

  test("forwards MONETA's accept and authorization and nothing else", async () => {
    const upstream = upstreamReturning()

    await handleServiceProxyRequest(
      proxyRequest({
        headers: {
          accept: "application/json",
          authorization: "Bearer moneta-token",
          cookie: "session=secret",
          "user-agent": "Browser/1.0",
          "x-forwarded-for": "203.0.113.1",
        },
      }),
      { service: "moneta", fetch: upstream, env: {} }
    )

    const call = upstreamCall(upstream)
    expect(call.url).toBe(`https://api.moneta.cz${monetaPath}`)
    expect(call.headers).toEqual({
      accept: "application/json",
      authorization: "Bearer moneta-token",
    })
    expect(call.init).toMatchObject({ method: "GET", redirect: "manual" })
    expect(call.init?.body).toBeUndefined()
  })

  test("forwards only accept to Fio, never an authorization or a cookie", async () => {
    const upstream = upstreamReturning()

    await handleServiceProxyRequest(
      proxyRequest({
        service: "fio",
        path: fioPath,
        headers: {
          accept: "application/json",
          authorization: "Bearer leaked",
          cookie: "session=secret",
        },
      }),
      { service: "fio", fetch: upstream, env: {} }
    )

    const call = upstreamCall(upstream)
    expect(call.url).toBe(`https://fioapi.fio.cz${fioPath}`)
    expect(call.headers).toEqual({ accept: "application/json" })
  })

  test("passes the request's abort signal on to upstream", async () => {
    const upstream = upstreamReturning()
    const request = proxyRequest()

    await handleServiceProxyRequest(request, {
      service: "moneta",
      fetch: upstream,
      env: {},
    })

    expect(upstreamCall(upstream).init?.signal).toBe(request.signal)
  })

  test.each([200, 401, 403, 409, 500])(
    "streams upstream's %i back with its body and content-type, uncached",
    async (status) => {
      const upstream = upstreamReturning(
        () =>
          new Response('{"status":"upstream"}', {
            status,
            headers: {
              "content-type": "application/json;charset=UTF-8",
              "content-encoding": "gzip",
              "content-length": "21",
              "set-cookie": "upstream=1",
            },
          })
      )

      const response = await handleServiceProxyRequest(proxyRequest(), {
        service: "moneta",
        fetch: upstream,
        env: {},
      })

      expect(response.status).toBe(status)
      expect(await response.text()).toBe('{"status":"upstream"}')
      expect(response.headers.get(SERVICE_PROXY_ERROR_HEADER)).toBeNull()
      expect(Object.fromEntries(response.headers.entries())).toEqual({
        "cache-control": "no-store",
        "content-type": "application/json;charset=UTF-8",
        [SERVICE_PROXY_RELAYED_HEADER]: SERVICE_PROXY_RELAYED,
      })
    }
  )

  test("streams the upstream body as it arrives rather than buffering it", async () => {
    const encoder = new TextEncoder()
    let sendRest: (() => void) | undefined
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("first"))
        sendRest = () => {
          controller.enqueue(encoder.encode("second"))
          controller.close()
        }
      },
    })
    const upstream = upstreamReturning(() => new Response(body))

    const response = await handleServiceProxyRequest(proxyRequest(), {
      service: "moneta",
      fetch: upstream,
      env: {},
    })

    const reader = response.body?.getReader()
    const first = await reader?.read()
    expect(new TextDecoder().decode(first?.value)).toBe("first")
    sendRest?.()
    const second = await reader?.read()
    expect(new TextDecoder().decode(second?.value)).toBe("second")
  })

  test("answers 502 with the error header when upstream cannot be reached", async () => {
    const upstream = vi.fn<typeof fetch>(() =>
      Promise.reject(new TypeError("fetch failed"))
    )

    const response = await handleServiceProxyRequest(proxyRequest(), {
      service: "moneta",
      fetch: upstream,
      env: {},
    })

    expect(response.status).toBe(502)
    expectProxyError(response, "upstream-unreachable")
  })

  test("answers 502 instead of following an upstream redirect", async () => {
    const upstream = upstreamReturning(
      () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://evil.example/" },
        })
    )

    const response = await handleServiceProxyRequest(proxyRequest(), {
      service: "moneta",
      fetch: upstream,
      env: {},
    })

    expect(response.status).toBe(502)
    expectProxyError(response, "upstream-redirected")
    expect(response.headers.get("location")).toBeNull()
  })

  test("sends the CORS headers of an allowed origin with a proxy error too", async () => {
    const response = await handleServiceProxyRequest(
      proxyRequest({
        path: "/elsewhere",
        headers: { origin: "http://localhost:8081" },
      }),
      { service: "moneta", fetch: upstreamReturning(), env: allowedEnv }
    )

    expect(response.status).toBe(400)
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:8081"
    )
    expect(response.headers.get("access-control-expose-headers")).toBe(
      exposedHeaders
    )
  })
})

describe("createServiceProxyFetch against handleServiceProxyRequest", () => {
  /**
   * The browser's wrapper over a fetch that hands each call to the handler
   * the way the `/api/proxy/<service>` endpoints do.
   */
  const createWiredProxyFetch = (upstream: typeof globalThis.fetch) =>
    createServiceProxyFetch({
      fetch: async (input, init) => {
        const request = new Request(input, init)
        const service = /^\/api\/proxy\/([^/]+)$/u.exec(
          new URL(request.url).pathname
        )?.[1]
        if (service === undefined || !isProxiedService(service)) {
          return new Response(null, { status: 404 })
        }
        return await handleServiceProxyRequest(request, {
          service,
          fetch: upstream,
          env: {},
        })
      },
      apiBaseUrl: ownOrigin,
      isEnabled: () => true,
    })

  test("carries a MONETA call through to upstream and its answer back", async () => {
    const upstream = upstreamReturning(() =>
      Response.json({ accounts: ["CZ"] }, { status: 200 })
    )
    const fetch = createWiredProxyFetch(upstream)

    const response = await fetch(`https://api.moneta.cz${monetaPath}`, {
      headers: {
        accept: "application/json",
        authorization: "Bearer moneta-token",
        cookie: "session=secret",
      },
    })

    expect(await response.json()).toEqual({ accounts: ["CZ"] })
    const call = upstreamCall(upstream)
    expect(call.url).toBe(`https://api.moneta.cz${monetaPath}`)
    expect(call.headers).toEqual({
      accept: "application/json",
      authorization: "Bearer moneta-token",
    })
  })

  test("carries a Fio call through to the same upstream path", async () => {
    const upstream = upstreamReturning(() => Response.json({}))
    const fetch = createWiredProxyFetch(upstream)

    await fetch(`https://fioapi.fio.cz${fioPath}`)

    expect(upstreamCall(upstream).url).toBe(`https://fioapi.fio.cz${fioPath}`)
  })

  test("passes MONETA's own 401 back as the service's answer", async () => {
    const upstream = upstreamReturning(
      () => new Response("Unauthorized", { status: 401 })
    )
    const fetch = createWiredProxyFetch(upstream)

    const response = await fetch(`https://api.moneta.cz${monetaPath}`)

    expect(response.status).toBe(401)
    expect(response.headers.get(SERVICE_PROXY_RELAYED_HEADER)).toBe(
      SERVICE_PROXY_RELAYED
    )
  })

  test("turns a refused path into a ServiceProxyError, not the service's answer", async () => {
    const upstream = upstreamReturning()
    const fetch = createWiredProxyFetch(upstream)

    await expect(
      fetch("https://api.moneta.cz/api/v4/vip/pisp/payments")
    ).rejects.toMatchObject({
      name: "ServiceProxyError",
      status: 400,
      reason: "path-not-allowed",
    })
    expect(upstream).not.toHaveBeenCalled()
  })

  test("turns an unreachable upstream into a ServiceProxyError", async () => {
    const fetch = createWiredProxyFetch(() =>
      Promise.reject(new TypeError("fetch failed"))
    )

    await expect(
      fetch(`https://api.moneta.cz${monetaPath}`)
    ).rejects.toBeInstanceOf(ServiceProxyError)
  })
})
