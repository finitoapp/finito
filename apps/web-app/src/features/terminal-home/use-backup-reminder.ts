import {
  backupReminderSnoozedUntil,
  isBackupReminderDue,
  mayBackupReminderBeDue,
} from "@payky/app-shared/recovery-backup"
import {
  type BackupReminder,
  useBackupReminderPrompt,
} from "@payky/app-shared/use-backup-reminder-prompt"
import {
  backupReminderSnoozeQuery,
  snoozeBackupReminder,
} from "@payky/core/evolu/device-account"
import { activeSparkAccountsQuery } from "@payky/core/modules/account/account-spark-queries"
import { settingsQuery } from "@payky/core/modules/app-settings/app-settings-queries"
import { sumAvailableByMint } from "@payky/core/modules/cashu/cashu-queries"
import { useQuery } from "@tanstack/react-query"
import { atom, useAtomValue } from "jotai"
import { unwrap } from "jotai/utils"
import { useEffect } from "react"
import { accountAtom } from "@/atoms/account.ts"
import { deviceEvoluAtom } from "@/atoms/device-evolu.ts"
import { cashuShardStoreAtom } from "@/atoms/evolu.ts"
import { useAccess } from "@/hooks/use-access.ts"
import { useAppRun } from "@/hooks/use-app-run.ts"
import { useDeviceEvoluQuery } from "@/hooks/use-device-evolu-query.ts"
import { useEvoluQuery } from "@/hooks/use-evolu-query.ts"

/**
 * The Cashu store, `null` while it starts or when it failed to: home must not
 * wait for, or fail with, a Cashu wallet that is slow to start.
 */
const cashuShardStoreOrNullAtom = unwrap(
  atom(async (get) => {
    try {
      return await get(cashuShardStoreAtom)
    } catch {
      return null
    }
  }),
  () => null
)

/**
 * The balance in sats of each bitcoin wallet — every active Spark wallet
 * together, then the Cashu wallet shared with Linky — `null` for one still
 * loading, being refreshed, or unreadable. Reads nothing unless `enabled`.
 */
function useWalletBalances(enabled: boolean): ReadonlyArray<number | null> {
  const appRun = useAppRun()
  const { data: sparkAccounts } = useEvoluQuery(activeSparkAccountsQuery)
  const store = useAtomValue(cashuShardStoreOrNullAtom)

  const spark = useQuery({
    queryKey: [
      "backupReminder",
      "spark-balance",
      sparkAccounts.map(({ id }) => id),
    ],
    queryFn: async () => {
      await using run = appRun()
      let total = 0
      for (const { secret } of sparkAccounts) {
        await using wallet = await run.deps.sparkWallet.create(secret)
        total += (await wallet.getBalance()).availableSats
      }
      return total
    },
    enabled: enabled && sparkAccounts.length > 0,
  })

  const cashu = useQuery({
    queryKey: ["backupReminder", "cashu-balance", store?.linkyAppOwner.id],
    queryFn: async () => {
      if (store === null) return null
      // Before Linky's owners sync, the proofs held here are a lower bound;
      // the reminder asks once they are enough.
      const balances = sumAvailableByMint(await store.loadProofs())
      return [...balances.values()].reduce((sum, sats) => sum + sats, 0)
    },
    enabled: enabled && store !== null,
  })
  const refetchCashu = cashu.refetch

  useEffect(() => {
    if (!enabled || store === null) return
    const stopChanges = store.subscribe(() => void refetchCashu())
    const stopHydration = store.subscribeHydration(() => void refetchCashu())
    return () => {
      stopChanges()
      stopHydration()
    }
  }, [enabled, store, refetchCashu])

  // A balance being fetched again counts as unknown: the cached one may be
  // from before the payment that brought home back.
  const fresh = (query: {
    readonly data: number | null | undefined
    readonly isFetching: boolean
  }) => (query.isFetching ? null : (query.data ?? null))
  return [...(sparkAccounts.length > 0 ? [fresh(spark)] : []), fresh(cashu)]
}

/**
 * The recovery-phrase backup reminder on home (account/0009): once the
 * bitcoin wallets hold more than 10,000 sats, until the phrase is verified,
 * never on a demo account, and only where this device may open Security. It
 * opens as home is entered, or as the PIN unlocks the device there.
 */
export function useBackupReminder(): BackupReminder {
  const account = useAtomValue(accountAtom)
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  const { effective } = useAccess()
  const { data: settingsRows } = useEvoluQuery(settingsQuery)
  const {
    data: [snooze],
  } = useDeviceEvoluQuery(backupReminderSnoozeQuery(account.id))

  const entered = effective.has("admin")
  const state = {
    verifiedAt: settingsRows[0]?.recoveryPhraseVerifiedAt ?? null,
    isDemo: account.demo !== null,
    snoozedUntil: snooze?.backupReminderSnoozedUntil ?? null,
    now: Date.now(),
  }
  const walletBalances = useWalletBalances(
    entered && mayBackupReminderBeDue(state)
  )

  return useBackupReminderPrompt({
    entered,
    due: isBackupReminderDue({ ...state, walletBalances }),
    snooze: () => {
      snoozeBackupReminder(
        deviceEvolu,
        account.id,
        backupReminderSnoozedUntil(Date.now())
      )
    },
  })
}
