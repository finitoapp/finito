import {
  type DeleteDatabaseError,
  type EvoluDeps,
  isNonEmptyArray,
  type KyselyNotNull,
  type MutationOptions,
  type NonEmptyReadonlyArray,
  type OwnerTransport,
  ok,
  sqliteTrue,
  type Task,
} from "@evolu/common"
import type { DeviceId } from "../modules/device/device-types.ts"
import type { DeviceEvoluDep } from "../modules/shared/evolu-deps.ts"
import { runMutationWithCompletion } from "../modules/shared/evolu-utils.ts"
import type { MasterKey } from "../modules/shared/key-derivation.ts"
import { TimestampMs } from "../modules/shared/schema.ts"
import { createAppEvolu } from "./client.ts"
import { removeDeviceAccount } from "./device-account.ts"
import {
  createDeviceQuery,
  type DeviceAccountId,
  type DeviceEvolu,
} from "./device-client.ts"
import { createQuery, type Evolu } from "./schema.ts"

/**
 * Starts syncing the account's app owner over `transports` and returns what
 * stops it again, which does nothing the second time. A removed device stops
 * before it forgets the account (access/0014): a change it writes after that
 * reaches no relay.
 */
export const startAppOwnerSync = (
  evolu: Evolu,
  transports: NonEmptyReadonlyArray<OwnerTransport>
): (() => void) => {
  const unuse = evolu.useOwner(evolu.appOwner, transports)
  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    unuse()
  }
}

/**
 * Whether the account's local copy already holds the removal of this device
 * (access/0013), synced in an earlier run whose deletion never finished:
 * the app then leaves the owner off the network and deletes the data
 * (access/0014). Before this device has registered since it was added, a
 * removed row is an old removal it rejoins over, so it does not count.
 */
export const loadRemovedHere = async ({
  evolu,
  deviceEvolu,
  accountId,
  deviceId,
}: {
  readonly evolu: Evolu
  readonly deviceEvolu: DeviceEvolu
  readonly accountId: DeviceAccountId
  readonly deviceId: DeviceId
}): Promise<boolean> => {
  // Queries of their own, not the ones `DeviceRegistration` renders from:
  // a load here would hand React promises it did not ask for.
  const [[flag], [device]] = await Promise.all([
    deviceEvolu.loadQuery(registeredHereQuery(accountId)),
    evolu.loadQuery(deviceRemovedQuery(deviceId)),
  ])
  return (
    flag?.deviceRegistered === sqliteTrue && device?.isDeleted === sqliteTrue
  )
}

const registeredHereQuery = (accountId: DeviceAccountId) =>
  createDeviceQuery((db) =>
    db
      .selectFrom("account")
      .select(["account.id", "account.deviceRegistered"])
      .where("account.id", "=", accountId)
      .where("account.deviceRegistered", "=", sqliteTrue)
  )

const deviceRemovedQuery = (deviceId: DeviceId) =>
  createQuery((db) =>
    db
      .selectFrom("device")
      .select(["device.id", "device.isDeleted"])
      .where("device.id", "=", deviceId)
      .where("device.isDeleted", "=", sqliteTrue)
  )

/**
 * Starts syncing the account's app owner, unless its local copy already
 * holds this device's removal (`loadRemovedHere`): then the owner stays off
 * the network and the app deletes the data as the device signs out
 * (access/0014). The check runs beside the client's start, which it does
 * not hold up; what this returns stops the sync, also before it started.
 */
export const startAppOwnerSyncUnlessRemoved = ({
  transports,
  ...removedHereInput
}: Parameters<typeof loadRemovedHere>[0] & {
  readonly transports: NonEmptyReadonlyArray<OwnerTransport>
}): (() => void) => {
  let stopped = false
  let stopSync: (() => void) | undefined
  void (async () => {
    let removedHere = false
    try {
      removedHere = await loadRemovedHere(removedHereInput)
    } catch {
      // Such as on a client disposed meanwhile: it syncs as it did before.
    }
    if (removedHere || stopped) return
    stopSync = startAppOwnerSync(removedHereInput.evolu, transports)
  })()
  return () => {
    stopped = true
    stopSync?.()
  }
}

/**
 * Deletes the account's app database from this device (access/0014),
 * through an instance of its own that never syncs, so it depends on no
 * client the app may be replacing meanwhile. Evolu also ends every other
 * instance of that database, in every tab. An instance opened with the
 * owner later fills again from relays, so the account must already be
 * removed from the device database.
 */
export const deleteAccountLocalData =
  (masterKey: MasterKey): Task<void, DeleteDatabaseError, EvoluDeps> =>
  async (run) => {
    await using evolu = await run.ok(
      createAppEvolu({
        masterKey,
        transports: [],
        // This instance ends with its database; nothing renders it.
        onDatabaseDeleted: () => {},
      })
    )
    return await evolu.deleteDatabase()
  }

const accountMasterKeyQuery = (accountId: DeviceAccountId) =>
  createDeviceQuery((db) =>
    db
      .selectFrom("account")
      .select(["account.id", "account.masterKey"])
      .where("account.id", "=", accountId)
      .where("account.masterKey", "is not", null)
      .$narrowType<{ masterKey: KyselyNotNull }>()
  )

/** The device's accounts but `accountId`, removed ones left out. */
const otherAccountsQuery = (accountId: DeviceAccountId) =>
  createDeviceQuery((db) =>
    db
      .selectFrom("account")
      .select("account.id")
      .where("account.id", "!=", accountId)
      .where("account.isDeleted", "is not", sqliteTrue)
      .where("account.masterKey", "is not", null)
  )

/** Removed accounts whose app database may still be on this device. */
export const removedAccountsWithLocalDataQuery = createDeviceQuery((db) =>
  db
    .selectFrom("account")
    .select(["account.id", "account.masterKey"])
    .where("account.isDeleted", "=", sqliteTrue)
    .where("account.localDataDeletedAt", "is", null)
    .where("account.masterKey", "is not", null)
    .$narrowType<{ masterKey: KyselyNotNull }>()
)

const pinAttemptIdsQuery = (accountId: DeviceAccountId) =>
  createDeviceQuery((db) =>
    db
      .selectFrom("pinAttempt")
      .select("id")
      .where("accountId", "=", accountId)
      .where("isDeleted", "is not", sqliteTrue)
  )

const pinAttemptBaseIdsQuery = (accountId: DeviceAccountId) =>
  createDeviceQuery((db) =>
    db
      .selectFrom("pinAttemptBase")
      .select("id")
      .where("accountId", "=", accountId)
      .where("isDeleted", "is not", sqliteTrue)
  )

const cashuClaimAttemptIdsQuery = (accountId: DeviceAccountId) =>
  createDeviceQuery((db) =>
    db
      .selectFrom("cashuClaimAttempt")
      .select("id")
      .where("accountId", "=", accountId)
      .where("isDeleted", "is not", sqliteTrue)
  )

const cashuKnownMintIdsQuery = (accountId: DeviceAccountId) =>
  createDeviceQuery((db) =>
    db
      .selectFrom("cashuKnownMint")
      .select("id")
      .where("accountId", "=", accountId)
      .where("isDeleted", "is not", sqliteTrue)
  )

const qerkoTerminalSelectionIdsQuery = (accountId: DeviceAccountId) =>
  createDeviceQuery((db) =>
    db
      .selectFrom("qerkoTerminalSelection")
      .select("id")
      .where("accountId", "=", accountId)
      .where("isDeleted", "is not", sqliteTrue)
  )

const accountEvoluTransportIdsQuery = (accountId: DeviceAccountId) =>
  createDeviceQuery((db) =>
    db
      .selectFrom("accountEvoluTransport")
      .select("id")
      .where("accountId", "=", accountId)
      .where("isDeleted", "is not", sqliteTrue)
  )

/**
 * Removes the account and the device rows kept for it (access/0014): its
 * PIN log, Cashu claim attempts and known mints, Qerko terminal and sync
 * transports. The Cashu counters stay: they hold no secret, and losing them
 * would let the account, added again, reuse derivation slots (cashu.md §3).
 * Resolves once the writes are applied.
 */
const forgetDeviceAccount = async (
  deviceEvolu: DeviceEvolu,
  accountId: DeviceAccountId
): Promise<void> => {
  const [
    pinAttempts,
    pinAttemptBases,
    cashuClaimAttempts,
    cashuKnownMints,
    qerkoTerminalSelections,
    transports,
  ] = await Promise.all([
    deviceEvolu.loadQuery(pinAttemptIdsQuery(accountId)),
    deviceEvolu.loadQuery(pinAttemptBaseIdsQuery(accountId)),
    deviceEvolu.loadQuery(cashuClaimAttemptIdsQuery(accountId)),
    deviceEvolu.loadQuery(cashuKnownMintIdsQuery(accountId)),
    deviceEvolu.loadQuery(qerkoTerminalSelectionIdsQuery(accountId)),
    deviceEvolu.loadQuery(accountEvoluTransportIdsQuery(accountId)),
  ])
  const isDeleted = sqliteTrue
  await runMutationWithCompletion((options) => {
    removeDeviceAccount(deviceEvolu, accountId, options)
    for (const { id } of pinAttempts)
      deviceEvolu.update("pinAttempt", { id, isDeleted }, options)
    for (const { id } of pinAttemptBases)
      deviceEvolu.update("pinAttemptBase", { id, isDeleted }, options)
    for (const { id } of cashuClaimAttempts)
      deviceEvolu.update("cashuClaimAttempt", { id, isDeleted }, options)
    for (const { id } of cashuKnownMints)
      deviceEvolu.update("cashuKnownMint", { id, isDeleted }, options)
    for (const { id } of qerkoTerminalSelections)
      deviceEvolu.update("qerkoTerminalSelection", { id, isDeleted }, options)
    for (const { id } of transports) {
      deviceEvolu.update("accountEvoluTransport", { id, isDeleted }, options)
      deviceEvolu.update(
        "accountEvoluTransportWebsocket",
        { id, isDeleted },
        options
      )
    }
  })
}

const markLocalDataDeleted = (
  deviceEvolu: DeviceEvolu,
  accountId: DeviceAccountId,
  options?: MutationOptions
) =>
  deviceEvolu.update(
    "account",
    { id: accountId, localDataDeletedAt: TimestampMs(Date.now()) },
    options
  )

/**
 * Removes an account from this device and deletes its local data
 * (access/0014), for a device another one removed and for the merchant
 * removing an account by hand. The caller has already stopped the account
 * syncing here, if it is the active one (`startAppOwnerSync`).
 *
 * In order: the account is marked removed, so no start uses its owner
 * again; the app moves off it, by `leaveAccount` when other accounts are
 * left, or by `closeApp` when none is, which must stop rendering anything
 * that reads either database; its app database is deleted; and with no
 * account left, the whole device database too, whose deletion reloads the
 * app. A deletion that fails leaves the account for the start-up sweep
 * (`deleteRemovedAccountsLocalData`), and the device database with it, which
 * the sweep needs; a closed app then reloads.
 */
export const removeAccountFromDevice =
  ({
    accountId,
    leaveAccount,
    closeApp,
  }: {
    readonly accountId: DeviceAccountId
    readonly leaveAccount: () => void
    readonly closeApp: () => void
  }): Task<
    "accountsLeft" | "deviceDeleted",
    DeleteDatabaseError,
    EvoluDeps & DeviceEvoluDep
  > =>
  async (run) => {
    const { deviceEvolu, reloadApp } = run.deps
    // Read before the removal, though the query reads a removed one too.
    const [account] = await deviceEvolu.loadQuery(
      accountMasterKeyQuery(accountId)
    )
    await forgetDeviceAccount(deviceEvolu, accountId)
    const othersLeft = isNonEmptyArray(
      await deviceEvolu.loadQuery(otherAccountsQuery(accountId))
    )
    if (othersLeft) leaveAccount()
    else closeApp()

    if (account !== undefined) {
      const deleted = await run(deleteAccountLocalData(account.masterKey))
      if (!deleted.ok) {
        if (!othersLeft) reloadApp()
        return deleted
      }
      await runMutationWithCompletion((options) =>
        markLocalDataDeleted(deviceEvolu, accountId, options)
      )
    }
    if (othersLeft) return ok("accountsLeft")

    const deviceDeleted = await deviceEvolu.deleteDatabase()
    if (!deviceDeleted.ok) {
      reloadApp()
      return deviceDeleted
    }
    return ok("deviceDeleted")
  }

/**
 * Deletes the app database of every account removed from this device whose
 * database may still be here (access/0014): a deletion that failed or never
 * ran, and accounts removed before deleting existed. Runs at start, before
 * the active account opens. A failure is logged and tried again at the next
 * start; resolves to the number deleted.
 */
export const deleteRemovedAccountsLocalData: Task<
  number,
  never,
  EvoluDeps & DeviceEvoluDep
> = async (run) => {
  const { deviceEvolu, console } = run.deps
  const accounts = await deviceEvolu.loadQuery(
    removedAccountsWithLocalDataQuery
  )
  let deletedCount = 0
  for (const account of accounts) {
    const deleted = await run(deleteAccountLocalData(account.masterKey))
    if (!deleted.ok) {
      console.warn("Deleting a removed account's data failed.", {
        accountId: account.id,
        error: deleted.error.type,
      })
      continue
    }
    await runMutationWithCompletion((options) =>
      markLocalDataDeleted(deviceEvolu, account.id, options)
    )
    deletedCount += 1
  }
  return ok(deletedCount)
}
