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
import { useIsFocused } from "expo-router"
import { useAtomValue } from "jotai"
import { accountAtom } from "../../atoms/account.ts"
import { deviceEvoluAtom } from "../../atoms/device-evolu.ts"
import { useAccess } from "../../core/use-access.ts"
import {
  useDeviceEvoluQuery,
  useEvoluQuery,
} from "../../hooks/use-evolu-query.ts"

/**
 * Web's `useBackupReminder` (account/0007). The stack keeps home mounted
 * under other screens and the access gate keeps it mounted while locked, so
 * home counts as entered once it is the screen on top and the device has
 * admin.
 */
export function useBackupReminder(): BackupReminder {
  const focused = useIsFocused()
  const account = useAtomValue(accountAtom)
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const { effective } = useAccess()
  const { data: paid } = useEvoluQuery(firstPaidPaymentQuery)
  const { data: settingsRows } = useEvoluQuery(settingsQuery)
  const {
    data: [snooze],
  } = useDeviceEvoluQuery(backupReminderSnoozeQuery(account.id))

  return useBackupReminderPrompt({
    entered: focused && effective.has("admin"),
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
