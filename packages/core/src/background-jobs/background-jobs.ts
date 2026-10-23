import type {
  AppBackgroundJob,
  BackgroundJob,
  CashuBackgroundJob,
} from "./background-job-types.ts"
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
import { startSparkAccountTransactionSyncJob } from "./jobs/spark-account-transaction-sync-job.ts"
import { startTableSelfPayPublishingJob } from "./jobs/table-self-pay-publishing-job.ts"

/**
 * Right for the CLI.
 */
export const cliBackgroundJobs = [
  startFioAccountTransactionSyncJob,
  startMonetaAccountTransactionSyncJob,
  startSparkAccountTransactionSyncJob,
] satisfies ReadonlyArray<BackgroundJob>

const nativeBackgroundJobs = [
  ...cliBackgroundJobs,
  startEetReportingJob,
  startQerkoTerminalSyncJob,
  startQerkoPaymentConnectionJob,
  startQerkoPaymentSyncJob,
  startLightningAddressVerifyJob,
  startRecoveryBackupReminderJob,
  startTableSelfPayPublishingJob,
  startSelfPayPointerJob,
] satisfies ReadonlyArray<AppBackgroundJob>

/**
 * A browser or PWA can't reach the FIO or MONETA APIs directly — neither
 * answers a CORS preflight — so their sync jobs are left out there, the same
 * limitation the settings screens warn about in
 * `settings.fioPlugin.nativeRuntimeWarning` and
 * `settings.monetaPlugin.nativeRuntimeWarning`. Qerko allows cross-origin calls,
 * so its jobs run in both, Qerko payments' connection and sync included, and
 * so do the wallets behind Lightning addresses.
 */
const browserBackgroundJobs = [
  startSparkAccountTransactionSyncJob,
  startEetReportingJob,
  startQerkoTerminalSyncJob,
  startQerkoPaymentConnectionJob,
  startQerkoPaymentSyncJob,
  startLightningAddressVerifyJob,
  startRecoveryBackupReminderJob,
  startTableSelfPayPublishingJob,
  startSelfPayPointerJob,
] satisfies ReadonlyArray<AppBackgroundJob>

export function getBackgroundJobsForRuntime(
  isNativePlatform: boolean
): ReadonlyArray<AppBackgroundJob> {
  return isNativePlatform ? nativeBackgroundJobs : browserBackgroundJobs
}

/**
 * The shared Cashu wallet's job, on native and browser alike. It runs apart
 * from the others (`CashuBackgroundJobs`), so a Cashu wallet that fails to
 * start, or never does, holds up none of them.
 */
export const cashuBackgroundJobs = [
  startCashuAccountSyncJob,
] satisfies ReadonlyArray<CashuBackgroundJob>
