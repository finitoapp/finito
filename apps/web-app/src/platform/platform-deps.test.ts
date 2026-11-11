import type { HttpOptions, HttpResponse } from "@capacitor/core"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { apiUrl } from "@/core/app-env.ts"
import { createFetchDep } from "@/platform/platform-deps.ts"

const request = vi.fn<(options: HttpOptions) => Promise<HttpResponse>>()
const platform = vi.hoisted(() => ({ native: true }))

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => platform.native },
  CapacitorHttp: { request: (options: HttpOptions) => request(options) },
}))

const okResponse = (data: unknown): HttpResponse => ({
  data,
  status: 200,
  headers: { "content-type": "application/json" },
  url: "https://example.test/",
})

describe("createFetchDep on a native platform", () => {
  beforeEach(() => {
    platform.native = true
    request.mockReset()
  })

  test("sends no body for GET and passes timeouts as a backstop", async () => {
    request.mockResolvedValue(okResponse('{"ok":true}'))

    const response = await createFetchDep().fetch("https://example.test/", {
      headers: { "x-token": "abc" },
    })

    expect(await response.json()).toEqual({ ok: true })
    const options = request.mock.calls[0]?.[0]
    expect(options).toMatchObject({
      method: "GET",
      headers: { "x-token": "abc" },
      connectTimeout: 30_000,
      readTimeout: 30_000,
    })
    expect(options).not.toHaveProperty("data")
  })

  test("forwards a POST body and stringifies a parsed response", async () => {
    request.mockResolvedValue(okResponse({ parsed: 1 }))

    const response = await createFetchDep().fetch("https://example.test/", {
      method: "POST",
      body: "<xml/>",
    })

    expect(request.mock.calls[0]?.[0]).toMatchObject({ data: "<xml/>" })
    expect(await response.text()).toBe('{"parsed":1}')
  })

  test("rejects a pre-aborted signal without sending", async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      createFetchDep().fetch("https://example.test/", {
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ name: "AbortError" })
    expect(request).not.toHaveBeenCalled()
  })

  test("rejects as soon as the signal aborts mid-request", async () => {
    // The native request never answers, as on a stalled connection.
    request.mockReturnValue(new Promise(() => {}))
    const controller = new AbortController()

    const pending = createFetchDep().fetch("https://example.test/", {
      signal: controller.signal,
    })
    await vi.waitFor(() => {
      expect(request).toHaveBeenCalled()
    })
    controller.abort(new DOMException("Timed out", "TimeoutError"))

    await expect(pending).rejects.toMatchObject({ name: "TimeoutError" })
  })
})

const fioUrl =
  "https://fioapi.fio.cz/v1/rest/periods/secret-token/2026-11-01/2026-11-10/transactions.json"

describe("createFetchDep on a native platform with the service proxy allowed", () => {
  beforeEach(() => {
    platform.native = true
    request.mockReset()
  })

  test("calls the bank directly, whatever the consent says", async () => {
    request.mockResolvedValue(okResponse("{}"))

    await createFetchDep({ isServiceProxyEnabled: () => true }).fetch(fioUrl)

    expect(request.mock.calls[0]?.[0]).toMatchObject({ url: fioUrl })
  })
})

describe("createFetchDep in a browser", () => {
  const globalFetch = vi.fn<typeof globalThis.fetch>()

  beforeEach(() => {
    platform.native = false
    globalFetch.mockReset()
    globalFetch.mockResolvedValue(new Response("{}"))
    vi.stubGlobal("fetch", globalFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const requestedUrl = (call: number): string => {
    const input = globalFetch.mock.calls[call]?.[0]
    return input instanceof Request ? input.url : String(input)
  }

  test("reads the consent at each call, not when the dep is created", async () => {
    let consent = false
    const { fetch } = createFetchDep({ isServiceProxyEnabled: () => consent })

    await fetch(fioUrl)
    consent = true
    await fetch(fioUrl)
    consent = false
    await fetch(fioUrl)

    expect(requestedUrl(0)).toBe(fioUrl)
    expect(requestedUrl(1)).toBe(apiUrl("/api/proxy/fio"))
    expect(
      new Headers(globalFetch.mock.calls[1]?.[1]?.headers).get("x-proxy-path")
    ).toBe(new URL(fioUrl).pathname)
    expect(requestedUrl(2)).toBe(fioUrl)
    expect(request).not.toHaveBeenCalled()
  })

  test("passes a service the proxy does not cover through unchanged", async () => {
    const { fetch } = createFetchDep({ isServiceProxyEnabled: () => true })

    await fetch("https://example.test/rates")

    expect(requestedUrl(0)).toBe("https://example.test/rates")
  })

  test("leaves the proxy off when no consent reader is given", async () => {
    await createFetchDep().fetch(fioUrl)

    expect(requestedUrl(0)).toBe(fioUrl)
  })
})
