import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import { backupReminderSnoozedUntil } from "@payky/app-shared/recovery-backup"
import type { JobNotificationType } from "@payky/core/background-jobs/notifications"
import { snoozeBackupReminder } from "@payky/core/evolu/device-account"
import { useNavigate } from "@tanstack/react-router"
import { useAtomValue } from "jotai"
import { type LucideIcon, QrCodeIcon, ShieldCheckIcon } from "lucide-react"
import { accountAtom } from "@/atoms/account.ts"
import { deviceEvoluAtom } from "@/atoms/device-evolu.ts"

export interface NotificationAction {
  readonly label: TranslationKey
  readonly variant: "default" | "outline"
  readonly run: () => void
}

/**
 * How the app draws one type of notification a background job raises. The
 * permission that may see it is not here but in `notificationPermissions`
 * (`hooks/use-active-notifications.ts`), which home's bell reads as well.
 */
export interface NotificationRenderer {
  readonly icon: LucideIcon
  readonly title: TranslationKey
  readonly description: TranslationKey
  /** A hook: called once per card render, in the same order every time. */
  readonly useActions: () => ReadonlyArray<NotificationAction>
}

/** Puts the backup reminder off for a week on this device (account/0007). */
const useSnoozeBackupReminder = () => {
  const account = useAtomValue(accountAtom)
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  return () => {
    snoozeBackupReminder(
      deviceEvolu,
      account.id,
      backupReminderSnoozedUntil(Date.now())
    )
  }
}

/**
 * One renderer per notification type. `satisfies Record` fails the build on
 * a type without a renderer or a renderer for a type that is gone.
 */
export const notificationRenderers = {
  recoveryPhraseBackup: {
    icon: ShieldCheckIcon,
    title: "notifications.recoveryBackup.title",
    description: "notifications.recoveryBackup.description",
    useActions: () => {
      const snooze = useSnoozeBackupReminder()
      const navigate = useNavigate()
      // Back up does not snooze: the reminder stays until the backup is
      // verified, so a backup left unfinished keeps the dot lit (account/0009).
      return [
        {
          label: "notifications.recoveryBackup.later",
          variant: "outline",
          run: snooze,
        },
        {
          label: "notifications.recoveryBackup.action",
          variant: "default",
          run: () => {
            void navigate({ to: "/settings/security/backup" })
          },
        },
      ]
    },
  },
  guestsCannotPay: {
    icon: QrCodeIcon,
    title: "notifications.guestsCannotPay.title",
    description: "catalog.tables.selfPay.noPaymentMethod.description",
    useActions: () => {
      const navigate = useNavigate()
      return [
        {
          label: "catalog.tables.selfPay.noPaymentMethod.link",
          variant: "default",
          run: () => {
            void navigate({ to: "/settings/payment-accounts" })
          },
        },
      ]
    },
  },
  tableBillsUnseen: {
    icon: QrCodeIcon,
    title: "notifications.tableBillsUnseen.title",
    description: "notifications.tableBillsUnseen.description",
    useActions: () => {
      const navigate = useNavigate()
      return [
        {
          label: "notifications.tableBillsUnseen.action",
          variant: "default",
          run: () => {
            void navigate({ to: "/catalog/tables" })
          },
        },
      ]
    },
  },
} satisfies Record<JobNotificationType, NotificationRenderer>
