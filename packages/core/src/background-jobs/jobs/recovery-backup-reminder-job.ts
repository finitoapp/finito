import { ok, type Task } from "@evolu/common"
import { backupReminderSnoozeQuery } from "../../evolu/device-account.ts"
import { settingsQuery } from "../../modules/app-settings/app-settings-queries.ts"
import { isBackupReminderDue } from "../../modules/app-settings/app-settings-utils.ts"
import { firstPaidPaymentQuery } from "../../modules/payment/payment-queries.ts"
import type { DeviceAccountDep } from "../../modules/shared/evolu-deps.ts"
import type { BackgroundJobContext } from "../background-job-types.ts"
import { createKeyedTaskQueue } from "../keyed-task-queue.ts"
import type { JobNotification } from "../notifications.ts"

/** `setTimeout` overflows past this; a longer snooze is simply re-armed. */
const MAX_TIMER_DELAY_MS = 2_147_483_647

/**
 * Raises the recovery-phrase backup notification while the reminder is due
 * (account/0007): after the account's first paid payment, until the phrase
 * is verified, and not while this device's snooze holds. It follows the paid
 * payments, the settings and the snooze, and wakes when the snooze runs out,
 * so the notification comes back without anything on screen changing. It
 * writes nothing: snoozing and verifying are the user's actions. Who may see
 * it (`admin`) is the app's renderer's call, not the job's. No job runs on a
 * demo account (demo-data/0001), so it never raises one there.
 */
export const startRecoveryBackupReminderJob: Task<
  AsyncDisposable,
  never,
  BackgroundJobContext & DeviceAccountDep
> = (run) => {
  const { evolu, deviceEvolu, deviceAccountId, date, notifications, onError } =
    run.deps
  const snoozeQuery = backupReminderSnoozeQuery(deviceAccountId)
  const scope = notifications.open("recovery-backup-reminder")
  const queue = createKeyedTaskQueue<"recompute">({ onError })
  let timer: ReturnType<typeof setTimeout> | null = null

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  const recompute = async (): Promise<void> => {
    const [paid, settings, snooze] = await Promise.all([
      evolu.loadQuery(firstPaidPaymentQuery),
      evolu.loadQuery(settingsQuery),
      deviceEvolu.loadQuery(snoozeQuery),
    ])
    if (queue.isDisposed) return

    const now = date.now().getTime()
    const snoozedUntil = snooze[0]?.backupReminderSnoozedUntil ?? null
    const due = isBackupReminderDue({
      hasPaidPayment: paid.length > 0,
      verifiedAt: settings[0]?.recoveryPhraseVerifiedAt ?? null,
      // Never true here: no job runs on a demo account.
      isDemo: false,
      snoozedUntil,
      now,
    })
    const list: ReadonlyArray<JobNotification> = due
      ? [{ type: "recoveryPhraseBackup" }]
      : []
    scope.set(list)

    clearTimer()
    if (snoozedUntil !== null && snoozedUntil > now) {
      timer = setTimeout(
        queueRecompute,
        Math.min(snoozedUntil - now, MAX_TIMER_DELAY_MS)
      )
      ;(timer as { readonly unref?: () => void }).unref?.()
    }
  }

  const queueRecompute = () => {
    queue.enqueue("recompute", recompute)
  }

  const unsubscribes = [
    evolu.subscribeQuery(firstPaidPaymentQuery)(queueRecompute),
    evolu.subscribeQuery(settingsQuery)(queueRecompute),
    deviceEvolu.subscribeQuery(snoozeQuery)(queueRecompute),
  ]
  queueRecompute()

  const disposer = new AsyncDisposableStack()
  disposer.use(scope)
  disposer.defer(async () => {
    for (const unsubscribe of unsubscribes) unsubscribe()
    clearTimer()
    await queue[Symbol.asyncDispose]()
  })

  return ok(disposer)
}
