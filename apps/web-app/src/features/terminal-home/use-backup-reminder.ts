import {
  backupReminderSnoozedUntil,
  isBackupReminderDue,
} from "@payky/app-shared/recovery-backup"
import {
  type BackupReminder,
  useBackupReminderPrompt,
} from "@payky/app-shared/use-backup-reminder-prompt"
import {
  backupReminderSnoozeQuery,
  snoozeBackupReminder,
} from "@payky/core/evolu/device-account"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { firstPaidPaymentQuery } from "@payky/core/modules/payment/payment-queries"
import { useAtomValue } from "jotai"
import { accountAtom } from "@/atoms/account.ts"
import { deviceEvoluAtom } from "@/atoms/device-evolu.ts"
import { useAccess } from "@/hooks/use-access.ts"
import { useDeviceEvoluQuery } from "@/hooks/use-device-evolu-query.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"

/**
 * The recovery-phrase backup reminder on home (account/0007): after the
 * account's first paid payment until the phrase is verified, never on a demo
 * account, and only where this device may open Security. It opens as home
 * is entered, or as the PIN unlocks the device there.
 */
export function useBackupReminder(): BackupReminder {
  const account = useAtomValue(accountAtom)
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const { effective } = useAccess()
  const { data: paid } = useEvoluQuery(firstPaidPaymentQuery)
  const { data: settingsRows } = useEvoluQuery(settingsQuery)
  const {
    data: [snooze],
  } = useDeviceEvoluQuery(backupReminderSnoozeQuery(account.id))

  return useBackupReminderPrompt({
    entered: effective.has("admin"),
    due: isBackupReminderDue({
      hasPaidPayment: paid.length > 0,
      verifiedAt: settingsRows[0]?.recoveryPhraseVerifiedAt ?? null,
      isDemo: account.demo !== null,
      snoozedUntil: snooze?.backupReminderSnoozedUntil ?? null,
      now: Date.now(),
    }),
    snooze: () => {
      snoozeBackupReminder(
        deviceEvolu,
        account.id,
        backupReminderSnoozedUntil(Date.now())
      )
    },
  })
}
