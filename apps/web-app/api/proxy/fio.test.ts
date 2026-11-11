import { afterEach, describe, expect, test, vi } from "vitest"
import handler, { GET, OPTIONS } from "./fio.ts"

const path = "/v1/rest/last/fio-token/transactions.json"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("Fio proxy endpoint", () => {
  test("serves GET, OPTIONS and the default fetch with one handler", () => {
    expect(OPTIONS).toBe(GET)
    expect(handler.fetch).toBe(GET)
  })

  test("calls https://fioapi.fio.cz for the path in x-proxy-path", async () => {
    const upstream = vi.fn<typeof fetch>(() =>
      Promise.resolve(Response.json({ ok: true }))
    )
    vi.stubGlobal("fetch", upstream)

    const response = await GET(
      new Request("https://payky.test/api/proxy/fio", {
        headers: { "x-proxy-path": path },
      })
    )

    expect(response.status).toBe(200)
    expect(upstream.mock.calls[0]?.[0]?.toString()).toBe(
      `https://fioapi.fio.cz${path}`
    )
  })

  test("reads the allowed origins from the env", async () => {
    vi.stubEnv("PAYKY_SERVICE_PROXY_ALLOWED_ORIGINS", "http://localhost:8081")

    const response = await OPTIONS(
      new Request("https://payky.test/api/proxy/fio", {
        method: "OPTIONS",
        headers: { origin: "http://localhost:8081" },
      })
    )

    expect(response.status).toBe(204)
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:8081"
    )
  })
})
