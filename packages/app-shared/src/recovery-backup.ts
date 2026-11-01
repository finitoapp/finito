import { TimestampMs } from "@payky/core/modules/shared/schema"
import { addDays } from "date-fns"
import { RESTORE_WORD_COUNT, splitPhraseInput } from "./restore-words.ts"

/** How many words the optional backup check asks for. */
export const VERIFY_WORD_COUNT = 3

/**
 * Picks `VERIFY_WORD_COUNT` distinct slots (zero-based, ascending) to ask
 * for. `random` is injected so tests stay deterministic.
 */
export function pickVerifyIndexes(
  random: () => number = Math.random
): ReadonlyArray<number> {
  const slots = Array.from({ length: RESTORE_WORD_COUNT }, (_, index) => index)
  const picked: number[] = []
  while (picked.length < VERIFY_WORD_COUNT) {
    const [slot] = slots.splice(Math.floor(random() * slots.length), 1)
    if (slot !== undefined) picked.push(slot)
  }
  return picked.sort((a, b) => a - b)
}

/**
 * Whether every typed answer matches the phrase word at its slot. Case and
 * surrounding whitespace do not matter. The result says nothing about which
 * answer was wrong, so a retry reveals no word.
 */
export function checkVerifyAnswers(
  mnemonic: string,
  indexes: ReadonlyArray<number>,
  answers: ReadonlyArray<string>
): boolean {
  const words = splitPhraseInput(mnemonic)
  return (
    indexes.length === answers.length &&
    indexes.every((slot, position) => {
      const expected = words[slot]
      const answer = splitPhraseInput(answers[position] ?? "")
      return (
        expected !== undefined && answer.length === 1 && answer[0] === expected
      )
    })
  )
}

/** How long "Later" or "Back up now" keeps the reminder away (account/0007). */
export const BACKUP_REMINDER_SNOOZE_DAYS = 7

/**
 * Whether the recovery-phrase backup reminder is due (account/0007): after
 * the account's first paid payment, until the phrase is verified, never on a
 * demo account, and not while this device's snooze still holds.
 */
export function isBackupReminderDue(input: {
  readonly hasPaidPayment: boolean
  readonly verifiedAt: number | null
  readonly isDemo: boolean
  readonly snoozedUntil: number | null
  readonly now: number
}): boolean {
  return (
    input.hasPaidPayment &&
    input.verifiedAt === null &&
    !input.isDemo &&
    (input.snoozedUntil === null || input.snoozedUntil <= input.now)
  )
}

/** Until when a dismissed reminder stays away. */
export function backupReminderSnoozedUntil(now: number): TimestampMs {
  return TimestampMs(addDays(now, BACKUP_REMINDER_SNOOZE_DAYS).getTime())
}
