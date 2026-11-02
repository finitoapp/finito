import { err, ok } from "@evolu/common"
import {
  MONETA_FAST_WATCH_INTERVAL_MS,
  MONETA_FAST_WATCH_WINDOW_MS,
} from "@payky/core/modules/moneta-plugin/moneta-plugin-utils"
import { DateStringSchema } from "@payky/core/modules/shared/schema"
import { describe, expect, it } from "vitest"
import {
  checkMonetaPaymentWatch,
  isMonetaPaymentWatchStopped,
  monetaPaymentWatchIntervalMs,
  monetaPaymentWatchRange,
  monetaPaymentWatchStatusKey,
  toMonetaPaymentWatchResult,
} from "./moneta-payment-watch.ts"

const unauthorized = (code: string | null) =>
  err({
    type: "MonetaUnauthorizedError" as const,
    message: "",
    status: 401 as const,
    code,
    responseBody: "",
  })

describe("toMonetaPaymentWatchResult", () => {
  it("stops on a refused token or an exceeded limit, and only then", () => {
    expect(toMonetaPaymentWatchResult(ok(null))).toBe("answered")
    expect(toMonetaPaymentWatchResult(unauthorized(null))).toBe("unauthorized")
    expect(toMonetaPaymentWatchResult(unauthorized("NARR"))).toBe("unreachable")
    expect(
      toMonetaPaymentWatchResult(
        err({
          type: "MonetaRateLimitError",
          message: "",
          status: 429,
          responseBody: "",
        })
      )
    ).toBe("rateLimited")
    expect(
      toMonetaPaymentWatchResult(err({ type: "FetchError", error: null }))
    ).toBe("unreachable")

    expect(isMonetaPaymentWatchStopped("unauthorized")).toBe(true)
    expect(isMonetaPaymentWatchStopped("rateLimited")).toBe(true)
    expect(isMonetaPaymentWatchStopped("unreachable")).toBe(false)
    expect(isMonetaPaymentWatchStopped(undefined)).toBe(false)
  })
})

describe("monetaPaymentWatchRange", () => {
  it("reads the bank days from the payment's up to today, in the bank's time zone", () => {
    // 23:30 UTC is already the next day in Prague.
    const createdAt = new Date("2026-10-30T23:30:00Z")
    const now = new Date("2026-10-31T08:00:00Z")

    expect(monetaPaymentWatchRange(createdAt, now)).toEqual({
      fromDate: "2026-10-31",
      toDate: "2026-10-31",
    })
  })
})

describe("monetaPaymentWatchIntervalMs", () => {
  it("waits one interval per page read, so a wait stays within its 150 calls", () => {
    expect(monetaPaymentWatchIntervalMs(0)).toBe(MONETA_FAST_WATCH_INTERVAL_MS)
    expect(monetaPaymentWatchIntervalMs(1)).toBe(MONETA_FAST_WATCH_INTERVAL_MS)
    expect(monetaPaymentWatchIntervalMs(3)).toBe(
      3 * MONETA_FAST_WATCH_INTERVAL_MS
    )

    for (const pagesPerCheck of [1, 2, 5, 20]) {
      const checks = Math.ceil(
        MONETA_FAST_WATCH_WINDOW_MS /
          monetaPaymentWatchIntervalMs(pagesPerCheck)
      )
      expect(checks * pagesPerCheck).toBeLessThanOrEqual(
        MONETA_FAST_WATCH_WINDOW_MS / MONETA_FAST_WATCH_INTERVAL_MS +
          pagesPerCheck
      )
    }
  })
})

describe("monetaPaymentWatchStatusKey", () => {
  it("says what the watch is doing, and why it stopped", () => {
    expect(
      monetaPaymentWatchStatusKey({ isActive: true, result: undefined })
    ).toBe("paymentWait.monetaWatch.watching")
    expect(
      monetaPaymentWatchStatusKey({ isActive: true, result: "unreachable" })
    ).toBe("paymentWait.monetaWatch.unreachable")
    expect(
      monetaPaymentWatchStatusKey({ isActive: false, result: "unauthorized" })
    ).toBe("paymentWait.monetaWatch.unauthorized")
    expect(
      monetaPaymentWatchStatusKey({ isActive: false, result: "answered" })
    ).toBeNull()
  })
})

describe("checkMonetaPaymentWatch", () => {
  const range = {
    fromDate: DateStringSchema.decode("2026-05-25"),
    toDate: DateStringSchema.decode("2026-05-26"),
  }

  it("reads a sync that throws as an unreachable bank, not as still checking", async () => {
    const failures: unknown[] = []
    const failure = new Error("loadQuery failed")

    await expect(
      checkMonetaPaymentWatch({
        sync: () => Promise.reject(failure),
        range,
        token: "token-1",
        onFailure: (error) => failures.push(error),
      })
    ).resolves.toEqual({
      result: "unreachable",
      callCount: 1,
      token: "token-1",
    })
    expect(failures).toEqual([failure])
  })

  it("passes on the calls a sync spent and reports no failure", async () => {
    const failures: unknown[] = []

    await expect(
      checkMonetaPaymentWatch({
        sync: async () =>
          ok({
            downloadedCount: 0,
            recordedCount: 0,
            claimedPaymentIds: [],
            isTruncated: false,
            callCount: 3,
          }),
        range,
        token: "token-1",
        onFailure: (error) => failures.push(error),
      })
    ).resolves.toEqual({ result: "answered", callCount: 3, token: "token-1" })
    expect(failures).toEqual([])
  })

  it("reports a failed sync and reads it as the bank's answer", async () => {
    const failures: unknown[] = []

    await expect(
      checkMonetaPaymentWatch({
        sync: async () => unauthorized(null),
        range,
        token: "token-1",
        onFailure: (error) => failures.push(error),
      })
    ).resolves.toEqual({
      result: "unauthorized",
      callCount: 1,
      token: "token-1",
    })
    expect(failures).toHaveLength(1)
  })
})
