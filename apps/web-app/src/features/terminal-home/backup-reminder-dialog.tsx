import { Link } from "@tanstack/react-router"
import { ShieldCheckIcon } from "lucide-react"
import { Button } from "@/components/ui/button.tsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx"
import { useBackupReminder } from "@/features/terminal-home/use-backup-reminder.ts"
import { useTranslation } from "@/hooks/use-translation.ts"

/**
 * Asks on home to back up the recovery phrase (account/0007). Closing it any
 * way puts it off for a week on this device; a click outside it does not
 * close it.
 */
export function BackupReminderDialog() {
  const { t } = useTranslation()
  const { visible, dismiss } = useBackupReminder()

  return (
    <Dialog
      open={visible}
      disablePointerDismissal
      onOpenChange={(open) => {
        if (!open) dismiss()
      }}
    >
      <DialogContent data-testid="backup-reminder" showCloseButton={false}>
        <div className="flex items-center gap-5 px-2 py-2">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheckIcon aria-hidden className="size-8" />
          </span>
          <DialogHeader className="min-w-0 flex-1">
            <DialogTitle className="text-base">
              {t("settings.security.reminder.text")}
            </DialogTitle>
            <DialogDescription>
              {t("settings.security.reminder.description")}
            </DialogDescription>
          </DialogHeader>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={dismiss}>
            {t("settings.security.reminder.later")}
          </Button>
          <Button
            nativeButton={false}
            render={<Link to="/settings/security/backup" onClick={dismiss} />}
          >
            {t("settings.security.reminder.action")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
