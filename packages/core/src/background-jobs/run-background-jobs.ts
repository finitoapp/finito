import { ok, type Task } from "@evolu/common"

import type { BackgroundJobContext } from "./background-job-types.ts"

export const runBackgroundJobs =
  <TContext extends BackgroundJobContext>(
    jobs: ReadonlyArray<Task<AsyncDisposable, never, TContext>>
  ): Task<AsyncDisposable, never, TContext> =>
  async (run) => {
    const disposer = new AsyncDisposableStack()

    try {
      for (const job of jobs) {
        const result = await run(job)
        if (!result.ok) throw result.error
        const disposable = result.value
        disposer.defer(async () => {
          try {
            await disposable[Symbol.asyncDispose]()
          } catch (error) {
            run.deps.onError(error)
          }
        })
      }
    } catch (error) {
      await disposer.disposeAsync()
      throw error
    }

    return ok(disposer)
  }

/**
 * Runs `jobs` only while holding the exclusive lock `lockName` for the
 * account, waiting for it first, so of several holders — tabs of the app in
 * one browser — only one runs them at a time and the next takes over when it
 * lets go. Starts at once and returns; the jobs start once the lock is
 * granted. Disposing stops the jobs and releases the lock, or gives up
 * waiting for it.
 *
 * The lock comes from the context's `lockManager`, so it is as wide as that
 * lock manager: a browser's `navigator.locks` spans its tabs, while Android
 * WebView cannot grant it, which is why the apps use this only in a browser.
 */
export const runBackgroundJobsHoldingLock =
  <TContext extends BackgroundJobContext>(
    lockName: string,
    jobs: ReadonlyArray<Task<AsyncDisposable, never, TContext>>
  ): Task<AsyncDisposable, never, TContext> =>
  (run) => {
    // A scope of its own, not the Task's `run`, which is disposed as soon as
    // this Task returns — long before the lock may be granted.
    const lockRun = run.create()
    const waiting = new AbortController()
    let release = () => {}
    const released = new Promise<void>((resolve) => {
      release = resolve
    })
    let disposed = false
    let holding: Promise<void> | null = null

    const hold = async (): Promise<void> => {
      let started: AsyncDisposable
      try {
        started = await lockRun.ok(runBackgroundJobs(jobs))
      } catch {
        // A job that failed to start has panicked the run, which reports it;
        // an abort means the scope was disposed meanwhile.
        return
      }
      await released
      await started[Symbol.asyncDispose]()
    }

    void run.deps.lockManager
      .request(
        `${lockName}:${run.deps.evoluOwner.id}`,
        { signal: waiting.signal },
        (lock) => {
          // A lock manager that cannot honour `signal` grants the lock after
          // disposal anyway; let it go at once.
          if (lock === null || disposed) return
          holding = hold()
          return holding
        }
      )
      .catch((error: unknown) => {
        if (!waiting.signal.aborted) lockRun.deps.onError(error)
      })

    return ok({
      [Symbol.asyncDispose]: async () => {
        disposed = true
        waiting.abort()
        release()
        if (holding !== null) await holding
        await lockRun[Symbol.asyncDispose]()
      },
    })
  }
