import { testCreateRun } from "@evolu/common"
import { startEetReportingJob } from "@payky/core/background-jobs/jobs/eet-reporting-job"
import { createDateDep } from "@payky/core/deps"
import { createEvoluTest } from "@payky/core/testing/evolu"
import { createCommand } from "commander"
import { afterEach, describe, expect, test } from "vitest"

import {
  cliEetFor,
  registerBackgroundJobsCommand,
} from "./cli-background-jobs.ts"
import { createFetchDep } from "./fetch.ts"

afterEach(() => {
  process.exitCode = undefined
})

describe("background-jobs run", () => {
  test("without a recovery phrase, says it needs one and returns instead of exiting", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun({
      evolu,
      evoluOwner: evolu.appOwner,
      dataDir: ".data",
    })
    const program = createCommand()
    registerBackgroundJobsCommand(program)(run)

    await program.parseAsync(["background-jobs", "run"], { from: "user" })

    expect(run.deps.console.getEntriesSnapshot()).toMatchObject([
      {
        method: "error",
        args: [
          "Background jobs run as a device of an account. Set PAYKY_RECOVERY_MNEMONIC.",
        ],
      },
    ])
    expect(process.exitCode).toBe(1)
  })
})

describe("the jobs it runs", () => {
  test("leave EET reporting out without an EET production endpoint, so no production sale goes to the playground", () => {
    const deps = { ...createDateDep(), ...createFetchDep() }
    const withoutEndpoint = cliEetFor(deps, undefined)
    const withEndpoint = cliEetFor(
      deps,
      "https://prod.eet.cz/eet/services/EETServiceSOAP/v4"
    )

    expect(withoutEndpoint.jobs).not.toContain(startEetReportingJob)
    expect(withoutEndpoint.eetApiDep.eetApi.isProductionAvailable).toBe(false)
    expect(withEndpoint.jobs).toContain(startEetReportingJob)
    expect(withEndpoint.eetApiDep.eetApi.isProductionAvailable).toBe(true)
  })
})
