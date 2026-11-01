import { useState } from "react"

export interface BackupReminder {
  readonly visible: boolean
  /** "Later", Escape or "Back up now": away for a week on this device. */
  readonly dismiss: () => void
}

/**
 * Whether the recovery-phrase backup reminder is open (account/0007), for
 * both apps. It is decided only when home is entered — `entered` turning
 * true — so a reminder that becomes due while home is in use waits for the
 * next entry instead of landing on a typed amount or a scan.
 */
export function useBackupReminderPrompt({
  entered,
  due,
  snooze,
}: {
  readonly entered: boolean
  readonly due: boolean
  readonly snooze: () => void
}): BackupReminder {
  const [wasEntered, setWasEntered] = useState(false)
  const [open, setOpen] = useState(false)
  if (entered !== wasEntered) {
    setWasEntered(entered)
    setOpen(entered && due)
  }

  return {
    visible: open && due,
    dismiss: () => {
      setOpen(false)
      snooze()
    },
  }
}
