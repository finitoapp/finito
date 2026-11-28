import { testCreateRun } from "@evolu/common"
import { afterEach, describe, expect, test, vi } from "vitest"

import type { FetchDep } from "../../deps.ts"
import type { FiatCurrency } from "../../modules/shared/schema.ts"
import {
  createYadioApiDep,
  fetchYadioBtcExchangeRate,
  YADIO_FETCH_TIMEOUT_MS,
  type YadioApiDep,
  type YadioApiError,
  type YadioHttpError,
} from "./yadio-client.ts"

const inputToString = (input: RequestInfo | URL): string =>
  input instanceof URL ? input.toString() : String(input)

const exchangeRateResponse = ({
  btc,
  timestamp,
}: {
  readonly btc: number
  readonly timestamp: number
}) =>
  Response.json({
    BTC: btc,
    timestamp,
  })

describe("yadio client", () => {
  test("downloads and normalizes BTC exchange rate", async () => {
    const requestedUrls: string[] = []
    const deps = {
      ...createYadioApiDep(),
      fetch: async (input) => {
        requestedUrls.push(inputToString(input))
        return exchangeRateResponse({
          btc: 1_986_543.21,
          timestamp: 1_777_777_777,
        })
      },
    } satisfies YadioApiDep & FetchDep
    await using run = testCreateRun(deps)

    await expect(
      run(fetchYadioBtcExchangeRate("CZK" satisfies FiatCurrency))
    ).resolves.toEqual({
      ok: true,
      value: {
        exchangeRate: 1_986_543.21,
        fetchedAt: 1_777_777_777,
      },
    })
    expect(requestedUrls).toEqual(["https://api.yadio.io/exrates/CZK"])
  })

  test("supports an injected base URL", async () => {
    const requestedUrls: string[] = []
    const deps = {
      ...createYadioApiDep({ baseUrl: "https://example.test" }),
      fetch: async (input) => {
        requestedUrls.push(inputToString(input))
        return exchangeRateResponse({
          btc: 1_000_000,
          timestamp: 1_777_777_777,
        })
      },
    } satisfies YadioApiDep & FetchDep
    await using run = testCreateRun(deps)

    await run(fetchYadioBtcExchangeRate("CZK" satisfies FiatCurrency))

    expect(requestedUrls).toEqual(["https://example.test/exrates/CZK"])
  })

  test("passes the task abort signal to fetch", async () => {
    const receivedSignals: Array<AbortSignal | null | undefined> = []
    const deps = {
      ...createYadioApiDep(),
      fetch: async (_input, init) => {
        receivedSignals.push(init?.signal)
        return exchangeRateResponse({
          btc: 1_000_000,
          timestamp: 1_777_777_777,
        })
      },
    } satisfies YadioApiDep & FetchDep
    await using run = testCreateRun(deps)

    await run(fetchYadioBtcExchangeRate("CZK" satisfies FiatCurrency))

    expect(receivedSignals).toHaveLength(1)
    expect(receivedSignals[0]).toBeInstanceOf(AbortSignal)
  })

  test("returns typed HTTP errors", async () => {
    const deps = {
      ...createYadioApiDep(),
      fetch: async () =>
        new Response("Service unavailable", {
          status: 503,
        }),
    } satisfies YadioApiDep & FetchDep
    await using run = testCreateRun(deps)

    await expect(
      run(fetchYadioBtcExchangeRate("CZK" satisfies FiatCurrency))
    ).resolves.toMatchObject({
      ok: false,
      error: {
        type: "YadioHttpError",
        message: "Yadio exchange rate request failed: 503",
        status: 503,
        responseBody: "Service unavailable",
      } satisfies Partial<YadioHttpError>,
    })
  })

  test("returns a typed error for a non-JSON response body", async () => {
    const deps = {
      ...createYadioApiDep(),
      fetch: async () => new Response("<html>not json</html>", { status: 200 }),
    } satisfies YadioApiDep & FetchDep
    await using run = testCreateRun(deps)

    await expect(
      run(fetchYadioBtcExchangeRate("CZK" satisfies FiatCurrency))
    ).resolves.toMatchObject({
      ok: false,
      error: {
        type: "YadioApiError",
        message: "Invalid Yadio exchange rate response.",
        status: 200,
        responseBody: "<html>not json</html>",
      } satisfies Partial<YadioApiError>,
    })
  })

  test("returns a typed error for a malformed JSON response", async () => {
    const deps = {
      ...createYadioApiDep(),
      fetch: async () => Response.json({ BTC: "not-a-number" }),
    } satisfies YadioApiDep & FetchDep
    await using run = testCreateRun(deps)

    await expect(
      run(fetchYadioBtcExchangeRate("CZK" satisfies FiatCurrency))
    ).resolves.toMatchObject({
      ok: false,
      error: {
        type: "YadioApiError",
        message: "Invalid Yadio exchange rate response.",
        status: 200,
      } satisfies Partial<YadioApiError>,
    })
  })

  test("returns a typed error for a network failure", async () => {
    const deps = {
      ...createYadioApiDep(),
      fetch: async () => {
        throw new TypeError("Failed to fetch")
      },
    } satisfies YadioApiDep & FetchDep
    await using run = testCreateRun(deps)

    await expect(
      run(fetchYadioBtcExchangeRate("CZK" satisfies FiatCurrency))
    ).resolves.toMatchObject({
      ok: false,
      error: {
        type: "FetchError",
      },
    })
  })

  test("fails a rate nobody answers after its own timeout, not the app-wide one", async () => {
    vi.useFakeTimers()
    const deps = {
      ...createYadioApiDep(),
      fetch: (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("aborted"))
          )
        }),
    } satisfies YadioApiDep & FetchDep
    await using run = testCreateRun(deps)

    const result = run(fetchYadioBtcExchangeRate("CZK" satisfies FiatCurrency))
    await vi.advanceTimersByTimeAsync(YADIO_FETCH_TIMEOUT_MS)

    expect(await result).toMatchObject({
      ok: false,
      error: { type: "FetchError" },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })
})
