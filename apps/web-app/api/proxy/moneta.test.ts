import { afterEach, describe, expect, test, vi } from "vitest"
import handler, { GET, OPTIONS } from "./moneta.ts"

const path = "/api/v4/vip/aisp/my/accounts?page=0&size=100"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("MONETA proxy endpoint", () => {
  test("serves GET, OPTIONS and the default fetch with one handler", () => {
    expect(OPTIONS).toBe(GET)
    expect(handler.fetch).toBe(GET)
  })

  test("calls https://api.moneta.cz for the path in x-proxy-path", async () => {
    const upstream = vi.fn<typeof fetch>(() =>
      Promise.resolve(Response.json({ ok: true }))
    )
    vi.stubGlobal("fetch", upstream)

    const response = await GET(
      new Request("https://payky.test/api/proxy/moneta", {
        headers: { "x-proxy-path": path },
      })
    )

    expect(response.status).toBe(200)
    expect(upstream.mock.calls[0]?.[0]?.toString()).toBe(
      `https://api.moneta.cz${path}`
    )
  })

  test("reads the allowed origins from the env", async () => {
    vi.stubEnv("PAYKY_SERVICE_PROXY_ALLOWED_ORIGINS", "http://localhost:8081")

    const response = await OPTIONS(
      new Request("https://payky.test/api/proxy/moneta", {
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
