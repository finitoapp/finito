import { useState } from "react"

export interface BackupReminder {
  readonly visible: boolean
  /** "Later", Escape or "Back up now": away for a week on this device. */
  readonly dismiss: () => void
}

export type BackupReminderDecision = "closed" | "pending" | "open"

/**
 * The reminder's state after one render: an entry of home starts a pending
 * decision, leaving home closes it, and a pending one settles once `due` is
 * known.
 */
export function decideBackupReminder(input: {
  readonly decision: BackupReminderDecision
  readonly wasEntered: boolean
  readonly entered: boolean
  readonly due: boolean | null
}): BackupReminderDecision {
  const decision =
    input.entered === input.wasEntered
      ? input.decision
      : input.entered
        ? "pending"
        : "closed"
  if (decision !== "pending" || input.due === null) return decision
  return input.due ? "open" : "closed"
}

/**
 * Whether the recovery-phrase backup reminder is open (account/0009), for
 * both apps. It is decided only when home is entered — `entered` turning
 * true — so a reminder that becomes due while home is in use waits for the
 * next entry instead of landing on a typed amount or a scan. `due` is `null`
 * while the wallet balances that decide it still load; an entry then waits
 * for them, as long as home stays entered.
 */
export function useBackupReminderPrompt({
  entered,
  due,
  snooze,
}: {
  readonly entered: boolean
  readonly due: boolean | null
  readonly snooze: () => void
}): BackupReminder {
  const [wasEntered, setWasEntered] = useState(false)
  const [decision, setDecision] = useState<BackupReminderDecision>("closed")

  const nextDecision = decideBackupReminder({
    decision,
    wasEntered,
    entered,
    due,
  })
  if (entered !== wasEntered) setWasEntered(entered)
  if (nextDecision !== decision) setDecision(nextDecision)

  return {
    // A balance refreshed while it is open leaves it open.
    visible: nextDecision === "open" && due !== false,
    dismiss: () => {
      setDecision("closed")
      snooze()
    },
  }
}
