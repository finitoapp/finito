import type { ValueOf } from "type-fest"
import { describe, expect, expectTypeOf, test } from "vitest"

import type { MasterKey } from "../modules/shared/key-derivation.ts"

import type { AppBackgroundJobContext } from "./background-job-types.ts"
import {
  cashuBackgroundJobs,
  cliBackgroundJobs,
  getBackgroundJobsForRuntime,
  nativeBackgroundJobs,
} from "./background-jobs.ts"
import { startBillClosingJob } from "./jobs/bill-closing-job.ts"
import { startCashuAccountSyncJob } from "./jobs/cashu-account-sync-job.ts"
import { startEetReportingJob } from "./jobs/eet-reporting-job.ts"
import { startFioAccountTransactionSyncJob } from "./jobs/fio-account-transaction-sync-job.ts"
import { startLightningAddressVerifyJob } from "./jobs/lightning-address-verify-job.ts"
import { startMonetaAccountTransactionSyncJob } from "./jobs/moneta-account-transaction-sync-job.ts"
import { startQerkoPaymentConnectionJob } from "./jobs/qerko-payment-connection-job.ts"
import { startQerkoPaymentSyncJob } from "./jobs/qerko-payment-sync-job.ts"
import { startQerkoTerminalSyncJob } from "./jobs/qerko-terminal-sync-job.ts"
import { startRecoveryBackupReminderJob } from "./jobs/recovery-backup-reminder-job.ts"
import { startSelfPayPointerJob } from "./jobs/self-pay-pointer-job.ts"
import { startSelfPayTestTransferJob } from "./jobs/self-pay-test-transfer-job.ts"
import { startSparkAccountTransactionSyncJob } from "./jobs/spark-account-transaction-sync-job.ts"
import { startTableSelfPayPublishingJob } from "./jobs/table-self-pay-publishing-job.ts"

describe("getBackgroundJobsForRuntime", () => {
  test("does not schedule the Fio or MONETA jobs in a regular web runtime", () => {
    expect(getBackgroundJobsForRuntime(false)).toEqual([
      startSparkAccountTransactionSyncJob,
      startEetReportingJob,
      startQerkoTerminalSyncJob,
      startQerkoPaymentConnectionJob,
      startQerkoPaymentSyncJob,
      startLightningAddressVerifyJob,
      startRecoveryBackupReminderJob,
      startTableSelfPayPublishingJob,
      startSelfPayPointerJob,
      startBillClosingJob,
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

  test("schedules the Fio and MONETA jobs in supported native runtimes", () => {
    expect(getBackgroundJobsForRuntime(true)).toEqual([
      startFioAccountTransactionSyncJob,
      startMonetaAccountTransactionSyncJob,
      startSparkAccountTransactionSyncJob,
      startEetReportingJob,
      startQerkoTerminalSyncJob,
      startLightningAddressVerifyJob,
      startTableSelfPayPublishingJob,
      startSelfPayPointerJob,
      startBillClosingJob,
      startRecoveryBackupReminderJob,
      startQerkoPaymentConnectionJob,
      startQerkoPaymentSyncJob,
    ])
  })

  test("runs the MONETA job in the CLI, which reaches the bank as the native app does", () => {
    expect(cliBackgroundJobs).toContain(startMonetaAccountTransactionSyncJob)
  })

  test("runs every other job of a native device in the CLI, EET reporting and Qerko's terminal included", () => {
    expect(nativeBackgroundJobs).toEqual([
      ...cliBackgroundJobs,
      startRecoveryBackupReminderJob,
      startQerkoPaymentConnectionJob,
      startQerkoPaymentSyncJob,
    ])
  })

  test("keeps the backup reminder out of the CLI, which has no device database or screen", () => {
    expect(cliBackgroundJobs).not.toContain(startRecoveryBackupReminderJob)
  })

  test("keeps the Cashu job out of the CLI, which has no Linky owners", () => {
    expect(cliBackgroundJobs).not.toContain(startCashuAccountSyncJob)
  })

  test("runs the self-pay test transfer job only where a test deployment asks for it", () => {
    for (const isNativePlatform of [false, true]) {
      expect(getBackgroundJobsForRuntime(isNativePlatform)).not.toContain(
        startSelfPayTestTransferJob
      )
      expect(
        getBackgroundJobsForRuntime(isNativePlatform, {
          selfPayTestTransfers: true,
        })
      ).toEqual([
        ...getBackgroundJobsForRuntime(isNativePlatform),
        startSelfPayTestTransferJob,
      ])
    }
    expect(cliBackgroundJobs).not.toContain(startSelfPayTestTransferJob)
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

describe("AppBackgroundJobContext", () => {
  test("hands jobs the self-pay root and never the master key", () => {
    expectTypeOf<AppBackgroundJobContext>().toHaveProperty("tableSelfPayRoot")
    expectTypeOf<
      Extract<ValueOf<AppBackgroundJobContext>, MasterKey>
    >().toBeNever()
  })
})
