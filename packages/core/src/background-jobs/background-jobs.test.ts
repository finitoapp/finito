import { describe, expect, test } from "vitest"

import {
  cashuBackgroundJobs,
  cliBackgroundJobs,
  getBackgroundJobsForRuntime,
} from "./background-jobs.ts"
import { startCashuAccountSyncJob } from "./jobs/cashu-account-sync-job.ts"
import { startEetReportingJob } from "./jobs/eet-reporting-job.ts"
import { startFioAccountTransactionSyncJob } from "./jobs/fio-account-transaction-sync-job.ts"
import { startLightningAddressVerifyJob } from "./jobs/lightning-address-verify-job.ts"
import { startMonetaAccountTransactionSyncJob } from "./jobs/moneta-account-transaction-sync-job.ts"
import { startQerkoTerminalSyncJob } from "./jobs/qerko-terminal-sync-job.ts"
import { startSparkAccountTransactionSyncJob } from "./jobs/spark-account-transaction-sync-job.ts"

describe("getBackgroundJobsForRuntime", () => {
  test("does not schedule the Fio or MONETA jobs in a regular web runtime", () => {
    expect(getBackgroundJobsForRuntime(false)).toEqual([
      startSparkAccountTransactionSyncJob,
      startEetReportingJob,
      startQerkoTerminalSyncJob,
      startLightningAddressVerifyJob,
    ])
  })

  test("schedules the Fio and MONETA jobs in supported native runtimes", () => {
    expect(getBackgroundJobsForRuntime(true)).toEqual([
      startFioAccountTransactionSyncJob,
      startMonetaAccountTransactionSyncJob,
      startSparkAccountTransactionSyncJob,
      startEetReportingJob,
      startQerkoTerminalSyncJob,
      startLightningAddressVerifyJob,
    ])
  })

  test("runs the MONETA job in the CLI, which reaches the bank as the native app does", () => {
    expect(cliBackgroundJobs).toContain(startMonetaAccountTransactionSyncJob)
  })

  test("keeps EET reporting out of the CLI, which has no terminal device", () => {
    expect(cliBackgroundJobs).not.toContain(startEetReportingJob)
  })

  test("keeps the Qerko job out of the CLI, which has no terminal device", () => {
    expect(cliBackgroundJobs).not.toContain(startQerkoTerminalSyncJob)
  })

  test("keeps the Cashu job out of the CLI, which has no Linky owners", () => {
    expect(cliBackgroundJobs).not.toContain(startCashuAccountSyncJob)
  })

  test("keeps the Cashu job apart, so a Cashu wallet that fails to start stops no other job", () => {
    expect(getBackgroundJobsForRuntime(false)).not.toContain(
      startCashuAccountSyncJob
    )
    expect(getBackgroundJobsForRuntime(true)).not.toContain(
      startCashuAccountSyncJob
    )
    expect(cashuBackgroundJobs).toEqual([startCashuAccountSyncJob])
  })
})
