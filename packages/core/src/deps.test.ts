import { testCreateRun } from "@evolu/common"
import { afterEach, describe, expect, test, vi } from "vitest"
import { APP_FETCH_TIMEOUT_MS, appFetchAsJson } from "./deps.ts"

/** A server that accepts the connection and never answers. */
const silentFetch: typeof globalThis.fetch = (_url, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))
  })

describe("appFetchAsJson", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test("fails a request nobody answers once the timeout passes", async () => {
    vi.useFakeTimers()
    await using run = testCreateRun({ fetch: silentFetch })

    const result = run(appFetchAsJson("https://bank.test/history"))
    await vi.advanceTimersByTimeAsync(APP_FETCH_TIMEOUT_MS)

    expect(await result).toMatchObject({
      ok: false,
      error: { type: "FetchError" },
    })
  })
})
