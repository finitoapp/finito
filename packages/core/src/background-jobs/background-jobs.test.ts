import { describe, expect, test } from "vitest"

import {
  appBackgroundJobs,
  bankBackgroundJobs,
  cashuBackgroundJobs,
  cliBackgroundJobs,
} from "./background-jobs.ts"
import { startCashuAccountSyncJob } from "./jobs/cashu-account-sync-job.ts"
import { startEetReportingJob } from "./jobs/eet-reporting-job.ts"
import { startFioAccountTransactionSyncJob } from "./jobs/fio-account-transaction-sync-job.ts"
import { startLightningAddressVerifyJob } from "./jobs/lightning-address-verify-job.ts"
import { startMonetaAccountTransactionSyncJob } from "./jobs/moneta-account-transaction-sync-job.ts"
import { startQerkoPaymentConnectionJob } from "./jobs/qerko-payment-connection-job.ts"
import { startQerkoPaymentSyncJob } from "./jobs/qerko-payment-sync-job.ts"
import { startQerkoTerminalSyncJob } from "./jobs/qerko-terminal-sync-job.ts"
import { startRecoveryBackupReminderJob } from "./jobs/recovery-backup-reminder-job.ts"
import { startSparkAccountTransactionSyncJob } from "./jobs/spark-account-transaction-sync-job.ts"

describe("background job groups", () => {
  test("keeps the Fio and MONETA jobs out of the app jobs, in a group of their own", () => {
    expect(bankBackgroundJobs).toEqual([
      startFioAccountTransactionSyncJob,
      startMonetaAccountTransactionSyncJob,
    ])
    for (const job of bankBackgroundJobs) {
      expect(appBackgroundJobs).not.toContain(job)
    }
    expect(appBackgroundJobs).toEqual([
      startSparkAccountTransactionSyncJob,
      startEetReportingJob,
      startQerkoTerminalSyncJob,
      startQerkoPaymentConnectionJob,
      startQerkoPaymentSyncJob,
      startLightningAddressVerifyJob,
      startRecoveryBackupReminderJob,
    ])
  })

  test("keeps the Qerko payment jobs out of the CLI, which no one chooses to serve them", () => {
    for (const job of [
      startQerkoPaymentConnectionJob,
      startQerkoPaymentSyncJob,
    ]) {
      expect(cliBackgroundJobs).not.toContain(job)
    }
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

  test("keeps the backup reminder out of the CLI, which has no device database or screen", () => {
    expect(cliBackgroundJobs).not.toContain(startRecoveryBackupReminderJob)
  })

  test("keeps the Cashu job out of the CLI, which has no Linky owners", () => {
    expect(cliBackgroundJobs).not.toContain(startCashuAccountSyncJob)
  })

  test("keeps the Cashu job apart, so a Cashu wallet that fails to start stops no other job", () => {
    expect(appBackgroundJobs).not.toContain(startCashuAccountSyncJob)
    expect(bankBackgroundJobs).not.toContain(startCashuAccountSyncJob)
    expect(cashuBackgroundJobs).toEqual([startCashuAccountSyncJob])
  })
})
