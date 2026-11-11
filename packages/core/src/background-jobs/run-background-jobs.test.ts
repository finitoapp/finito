import {
  type AppOwner,
  ok,
  testCreateConsole,
  testCreateRun,
} from "@evolu/common"
import { describe, expect, test } from "vitest"
import type { FetchDep } from "../deps.ts"
import type { Evolu } from "../evolu/schema.ts"
import { createInProcessLockManager } from "../runtime/in-process-lock-manager.ts"
import { testNotificationsDep } from "../testing/background-jobs.ts"
import type {
  BackgroundJob,
  BackgroundJobContext,
} from "./background-job-types.ts"
import { runBackgroundJobs } from "./run-background-jobs.ts"

const createBackgroundJobContext = (
  errors: unknown[] = []
): BackgroundJobContext => ({
  console: testCreateConsole(),
  evolu: {} as Evolu,
  evoluOwner: {} as AppOwner,
  date: { now: () => new Date() },
  fetch: (() => {
    throw new Error("fetch is not implemented in this test.")
  }) as unknown as FetchDep["fetch"],
  lockManager: createInProcessLockManager(),
  ...testNotificationsDep(),
  onError: (error) => {
    errors.push(error)
  },
})

const createDisposable = (
  dispose: () => void | Promise<void>
): AsyncDisposable => ({
  [Symbol.asyncDispose]: () => Promise.resolve(dispose()),
})

describe("runBackgroundJobs", () => {
  test("starts every job with the shared context", async () => {
    const context = createBackgroundJobContext()
    const startedJobs: string[] = []

    const jobs: BackgroundJob[] = [
      (run) => {
        expect(run.deps.evolu).toBe(context.evolu)
        startedJobs.push("first")
        return ok(createDisposable(() => {}))
      },
      (run) => {
        expect(run.deps.evolu).toBe(context.evolu)
        startedJobs.push("second")
        return ok(createDisposable(() => {}))
      },
    ]

    await using run = testCreateRun(context)
    await using _disposable = await run.ok(runBackgroundJobs(jobs))

    expect(startedJobs).toEqual(["first", "second"])
  })

  test("disposes started jobs in reverse order", async () => {
    const context = createBackgroundJobContext()
    const disposedJobs: string[] = []

    {
      await using run = testCreateRun(context)
      await using _disposable = await run.ok(
        runBackgroundJobs([
          () => ok(createDisposable(() => void disposedJobs.push("first"))),
          () => ok(createDisposable(() => void disposedJobs.push("second"))),
          () => ok(createDisposable(() => void disposedJobs.push("third"))),
        ])
      )
    }

    expect(disposedJobs).toEqual(["third", "second", "first"])
  })

  test("continues disposing remaining jobs when one cleanup fails", async () => {
    const cleanupError = new Error("Cleanup failed.")
    const errors: unknown[] = []
    const context = createBackgroundJobContext(errors)
    const disposedJobs: string[] = []

    {
      await using run = testCreateRun(context)
      await using _disposable = await run.ok(
        runBackgroundJobs([
          () => ok(createDisposable(() => void disposedJobs.push("first"))),
          () =>
            ok(
              createDisposable(() => {
                disposedJobs.push("second")
                throw cleanupError
              })
            ),
          () => ok(createDisposable(() => void disposedJobs.push("third"))),
        ])
      )
    }

    expect(disposedJobs).toEqual(["third", "second", "first"])
    expect(errors).toEqual([cleanupError])
  })

  test("waits for async job cleanup", async () => {
    const context = createBackgroundJobContext()
    const disposedJobs: string[] = []

    {
      await using run = testCreateRun(context)
      await using _disposable = await run.ok(
        runBackgroundJobs([
          () =>
            ok(
              createDisposable(async () => {
                await Promise.resolve()
                disposedJobs.push("first")
              })
            ),
        ])
      )
    }

    expect(disposedJobs).toEqual(["first"])
  })

  test("disposes already started jobs when a later job fails to start", async () => {
    const startError = new Error("Start failed.")
    const errors: unknown[] = []
    const context = createBackgroundJobContext(errors)
    const disposedJobs: string[] = []

    const jobs: ReadonlyArray<BackgroundJob> = [
      () => ok(createDisposable(() => void disposedJobs.push("first"))),
      () => {
        throw startError
      },
      () => ok(createDisposable(() => void disposedJobs.push("third"))),
    ]

    await using run = testCreateRun(context)
    await expect(run.ok(runBackgroundJobs(jobs))).rejects.toMatchObject({
      type: "AbortError",
      reason: { type: "PanicAbortReason", defect: startError },
    })
    expect(disposedJobs).toEqual(["first"])
    expect(errors).toEqual([])
  })
})
