/**
 * What removing an account from this device asks first (account/0011).
 *
 * - `backupFirst`: the active account is on no other device and its recovery
 *   phrase is not verified, so removing it would lose it for good. The
 *   backup comes first; nothing is removed.
 * - `otherDevices`: the active account stays on its other devices.
 * - `phraseOnly`: only the recovery phrase brings it back — the active
 *   account's is backed up, or the account is a demo, or it is an inactive
 *   account, whose devices and backup this device cannot read.
 */
export type AccountRemovalStep = "backupFirst" | "otherDevices" | "phraseOnly"

export const accountRemovalStep = (account: {
  readonly active: boolean
  readonly demo: boolean
  /** Devices of the account other than this one; read for the active one only. */
  readonly otherDevices: number
  /** Whether the active account's recovery phrase is verified (account/0006). */
  readonly backupVerified: boolean
}): AccountRemovalStep => {
  if (!account.active || account.demo) return "phraseOnly"
  if (account.otherDevices > 0) return "otherDevices"
  return account.backupVerified ? "phraseOnly" : "backupFirst"
}
