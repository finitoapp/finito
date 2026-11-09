import { createConsole, ok, type Task } from "@evolu/common"
import { runMain } from "@evolu/nodejs"
import { cliBackgroundJobs } from "@payky/core/background-jobs/background-jobs"
import { createNotificationStore } from "@payky/core/background-jobs/notifications"
import { runBackgroundJobs } from "@payky/core/background-jobs/run-background-jobs"
import { createDateDep, type EvoluOwnerDep } from "@payky/core/deps"
import type { EvoluDep } from "@payky/core/modules/shared/evolu-deps"
import { createInProcessLockManager } from "@payky/core/runtime/in-process-lock-manager"
import { type Command, createCommand } from "commander"
import { createFetchDep } from "./fetch.ts"

export const registerBackgroundJobsCommand =
  (program: Command): Task<void, never, EvoluDep & EvoluOwnerDep> =>
  (run) => {
    const { evolu, evoluOwner } = run.deps

    const backgroundJobsCommand = createCommand("background-jobs").description(
      "Run Payky background workers."
    )

    backgroundJobsCommand.addCommand(
      createCommand("run")
        .description("Run all registered background jobs until shutdown.")
        .action(async () => {
          const appConsole = createConsole()
          await runMain({
            console: appConsole,
            evolu,
            evoluOwner,
            ...createDateDep(),
            ...createFetchDep(),
            lockManager: createInProcessLockManager(),
            // Nothing in the CLI shows the jobs' notifications.
            notifications: createNotificationStore().notifications,
            onError: (error: unknown) => {
              appConsole.error("Background job failed.", error)
            },
          })(async (run) => {
            const backgroundJobsDisposable = await run.ok(
              runBackgroundJobs(cliBackgroundJobs)
            )
            run.deps.console.log("Background jobs are running.")
            return ok(backgroundJobsDisposable)
          })
        })
    )

    program.addCommand(backgroundJobsCommand)
    return ok(undefined)
  }
