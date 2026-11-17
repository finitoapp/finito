import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import {
  type BankPluginSyncOutcome,
  createBankPluginSyncSession,
} from "./bank-plugin-sync.ts"

const intervalMs = 60_000

/** A session whose syncs answer from `outcomes` in turn, then `synced`. */
const createSession = (
  outcomes: ReadonlyArray<BankPluginSyncOutcome | "throw">
) => {
  const remaining = [...outcomes]
  const syncTimes: number[] = []
  const errors: unknown[] = []
  const session = createBankPluginSyncSession({
    intervalMs,
    sync: async () => {
      syncTimes.push(Date.now())
      const outcome = remaining.shift() ?? "synced"
      if (outcome === "throw") throw new Error("bank down")
      return outcome
    },
    onError: (error) => {
      errors.push(error)
    },
    onDelayed: () => {},
  })
  return { session, syncTimes, errors }
}

/** The minutes after the start at which each sync ran. */
const minutes = (syncTimes: ReadonlyArray<number>) =>
  syncTimes.map((time) => time / intervalMs)

describe("bank plugin sync session", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 0 })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  test("retries one interval after a failure, then twice as long after each further one", async () => {
    const { session, syncTimes, errors } = createSession([
      "throw",
      "failed",
      "throw",
    ])
    session.start()

    await vi.advanceTimersByTimeAsync(10 * intervalMs)

    expect(minutes(syncTimes)).toEqual([0, 1, 3, 7, 8, 9, 10])
    expect(errors).toHaveLength(2)
    await session[Symbol.asyncDispose]()
  })

  test("syncs on every tick while syncs succeed", async () => {
    const { session, syncTimes } = createSession([])
    session.start()

    await vi.advanceTimersByTimeAsync(3 * intervalMs)

    expect(minutes(syncTimes)).toEqual([0, 1, 2, 3])
    await session[Symbol.asyncDispose]()
  })

  test("asks no more once a sync says it stopped", async () => {
    const { session, syncTimes } = createSession(["stopped"])
    session.start()

    await vi.advanceTimersByTimeAsync(5 * intervalMs)

    expect(minutes(syncTimes)).toEqual([0])
    await session[Symbol.asyncDispose]()
  })

  test("syncs no more once disposed", async () => {
    const { session, syncTimes } = createSession([])
    session.start()
    await vi.advanceTimersByTimeAsync(0)
    await session[Symbol.asyncDispose]()

    await vi.advanceTimersByTimeAsync(5 * intervalMs)

    expect(session.isDisposed).toBe(true)
    expect(minutes(syncTimes)).toEqual([0])
  })
})
