import {
  type AppOwner,
  ok,
  testCreateConsole,
  testCreateLockManager,
  testCreateRun,
} from "@evolu/common"
import { describe, expect, test, vi } from "vitest"
import type { FetchDep } from "../deps.ts"
import type { Evolu } from "../evolu/schema.ts"
import { createInProcessLockManager } from "../runtime/in-process-lock-manager.ts"
import { testNotificationsDep } from "../testing/background-jobs.ts"
import type {
  BackgroundJob,
  BackgroundJobContext,
} from "./background-job-types.ts"
import {
  runBackgroundJobs,
  runBackgroundJobsHoldingLock,
} from "./run-background-jobs.ts"

const createBackgroundJobContext = (
  errors: unknown[] = [],
  {
    lockManager = createInProcessLockManager(),
    ownerId = "owner-1",
  }: {
    readonly lockManager?: BackgroundJobContext["lockManager"]
    readonly ownerId?: string
  } = {}
): BackgroundJobContext => ({
  console: testCreateConsole(),
  evolu: {} as Evolu,
  evoluOwner: { id: ownerId } as unknown as AppOwner,
  date: { now: () => new Date() },
  fetch: (() => {
    throw new Error("fetch is not implemented in this test.")
  }) as unknown as FetchDep["fetch"],
  lockManager,
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

/** A job that records when it starts and stops under `name`. */
const createTrackedJob = (name: string, events: string[]): BackgroundJob => {
  return () => {
    events.push(`${name} started`)
    return ok(createDisposable(() => void events.push(`${name} stopped`)))
  }
}

describe.each([
  { name: "the in-process lock manager", create: createInProcessLockManager },
  { name: "Web Locks", create: testCreateLockManager },
])("runBackgroundJobsHoldingLock over $name", ({ create }) => {
  test("starts the jobs once it holds the lock and stops them when disposed", async () => {
    const events: string[] = []
    await using run = testCreateRun(
      createBackgroundJobContext([], { lockManager: create() })
    )

    const holder = await run.ok(
      runBackgroundJobsHoldingLock("bank-jobs", [
        createTrackedJob("first", events),
        createTrackedJob("second", events),
      ])
    )
    await vi.waitFor(() => {
      expect(events).toEqual(["first started", "second started"])
    })

    await holder[Symbol.asyncDispose]()

    expect(events).toEqual([
      "first started",
      "second started",
      "second stopped",
      "first stopped",
    ])
  })

  test("lets a second holder wait until the first is disposed", async () => {
    const events: string[] = []
    const lockManager = create()
    await using firstRun = testCreateRun(
      createBackgroundJobContext([], { lockManager })
    )
    await using secondRun = testCreateRun(
      createBackgroundJobContext([], { lockManager })
    )

    const first = await firstRun.ok(
      runBackgroundJobsHoldingLock("bank-jobs", [
        createTrackedJob("first tab", events),
      ])
    )
    await vi.waitFor(() => {
      expect(events).toEqual(["first tab started"])
    })
    await using _second = await secondRun.ok(
      runBackgroundJobsHoldingLock("bank-jobs", [
        createTrackedJob("second tab", events),
      ])
    )
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(events).toEqual(["first tab started"])

    await first[Symbol.asyncDispose]()

    await vi.waitFor(() => {
      expect(events).toEqual([
        "first tab started",
        "first tab stopped",
        "second tab started",
      ])
    })
  })

  test("holds a lock of its own per account owner", async () => {
    const events: string[] = []
    const lockManager = create()
    await using firstRun = testCreateRun(
      createBackgroundJobContext([], { lockManager, ownerId: "owner-1" })
    )
    await using secondRun = testCreateRun(
      createBackgroundJobContext([], { lockManager, ownerId: "owner-2" })
    )

    await using _first = await firstRun.ok(
      runBackgroundJobsHoldingLock("bank-jobs", [
        createTrackedJob("owner-1", events),
      ])
    )
    await using _second = await secondRun.ok(
      runBackgroundJobsHoldingLock("bank-jobs", [
        createTrackedJob("owner-2", events),
      ])
    )

    await vi.waitFor(() => {
      expect(events).toEqual(["owner-1 started", "owner-2 started"])
    })
  })

  test("gives up waiting when disposed before the lock is granted", async () => {
    const events: string[] = []
    const errors: unknown[] = []
    const lockManager = create()
    await using firstRun = testCreateRun(
      createBackgroundJobContext(errors, { lockManager })
    )
    await using secondRun = testCreateRun(
      createBackgroundJobContext(errors, { lockManager })
    )

    const first = await firstRun.ok(
      runBackgroundJobsHoldingLock("bank-jobs", [
        createTrackedJob("first tab", events),
      ])
    )
    await vi.waitFor(() => {
      expect(events).toEqual(["first tab started"])
    })
    const second = await secondRun.ok(
      runBackgroundJobsHoldingLock("bank-jobs", [
        createTrackedJob("second tab", events),
      ])
    )

    await second[Symbol.asyncDispose]()
    await first[Symbol.asyncDispose]()
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(events).toEqual(["first tab started", "first tab stopped"])
    expect(errors).toEqual([])
  })
})
