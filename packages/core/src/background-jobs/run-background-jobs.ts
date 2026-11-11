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
