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
import { startSparkAccountTransactionSyncJob } from "./jobs/spark-account-transaction-sync-job.ts"

/**
 * The Fio and MONETA sync jobs. They run apart from the others
 * (`BankBackgroundJobs` in the apps), started only where the device can reach
 * the banks — natively, or in a browser through the service proxy it allowed —
 * so turning that consent on or off starts or stops them alone. In a browser
 * every open tab with the consent on runs them, as another device would
 * (service-proxy/0001).
 */
export const bankBackgroundJobs = [
  startFioAccountTransactionSyncJob,
  startMonetaAccountTransactionSyncJob,
] satisfies ReadonlyArray<BackgroundJob>

/**
 * Right for the CLI, which reaches the banks directly.
 */
export const cliBackgroundJobs = [
  ...bankBackgroundJobs,
  startSparkAccountTransactionSyncJob,
] satisfies ReadonlyArray<BackgroundJob>

/**
 * The app's jobs, the same in a native runtime and in a browser or PWA. The
 * banks' jobs are left out (`bankBackgroundJobs`), and so is Cashu's
 * (`cashuBackgroundJobs`). Qerko allows cross-origin calls, so its jobs run in
 * both, Qerko payments' connection and sync included, and so do the wallets
 * behind Lightning addresses.
 */
export const appBackgroundJobs = [
  startSparkAccountTransactionSyncJob,
  startEetReportingJob,
  startQerkoTerminalSyncJob,
  startQerkoPaymentConnectionJob,
  startQerkoPaymentSyncJob,
  startLightningAddressVerifyJob,
  startRecoveryBackupReminderJob,
] satisfies ReadonlyArray<AppBackgroundJob>

/**
 * The shared Cashu wallet's job, on native and browser alike. It runs apart
 * from the others (`CashuBackgroundJobs`), so a Cashu wallet that fails to
 * start, or never does, holds up none of them.
 */
export const cashuBackgroundJobs = [
  startCashuAccountSyncJob,
] satisfies ReadonlyArray<CashuBackgroundJob>
