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

/** How long "Later" or "Back up now" keeps the reminder away (account/0009). */
export const BACKUP_REMINDER_SNOOZE_DAYS = 7

/** The reminder asks only once the wallets hold more than this (account/0009). */
export const BACKUP_REMINDER_MIN_WALLET_SATS = 10_000

/** What the reminder reads besides the wallet balances. */
export interface BackupReminderAccountState {
  readonly verifiedAt: number | null
  readonly isDemo: boolean
  readonly snoozedUntil: number | null
  readonly now: number
}

/**
 * Whether the recovery-phrase backup reminder is due (account/0009): once the
 * account's bitcoin wallets hold more than `BACKUP_REMINDER_MIN_WALLET_SATS`
 * together, until the phrase is verified, never on a demo account, and not
 * while this device's snooze still holds.
 *
 * `walletBalances` holds one balance in sats per wallet, `null` for one still
 * loading or unreadable. The answer is `null` while those decide it: no
 * balance can be negative, so the known ones already over the line make it
 * due, and it is not due only once every one is known.
 */
export function isBackupReminderDue(
  input: BackupReminderAccountState & {
    readonly walletBalances: ReadonlyArray<number | null>
  }
): boolean | null {
  if (
    input.verifiedAt !== null ||
    input.isDemo ||
    (input.snoozedUntil !== null && input.snoozedUntil > input.now)
  ) {
    return false
  }
  const known = input.walletBalances.reduce<number>(
    (sum, sats) => sum + (sats ?? 0),
    0
  )
  if (known > BACKUP_REMINDER_MIN_WALLET_SATS) return true
  return input.walletBalances.includes(null) ? null : false
}

/**
 * Whether the reminder may need the wallet balances at all, so a device
 * that will not be asked does not read them.
 */
export function mayBackupReminderBeDue(
  input: BackupReminderAccountState
): boolean {
  return isBackupReminderDue({ ...input, walletBalances: [null] }) !== false
}

/** Until when a dismissed reminder stays away. */
export function backupReminderSnoozedUntil(now: number): TimestampMs {
  return TimestampMs(addDays(now, BACKUP_REMINDER_SNOOZE_DAYS).getTime())
}
