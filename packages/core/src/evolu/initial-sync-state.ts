import type { Name, OwnerId } from "@evolu/common"
import {
  type RelaySyncState,
  relaySyncStateToStatus,
  type SyncState,
  syncStateToRelaySyncStates,
} from "@evolu/common/local-first"

/**
 * How long a restore waits with no relay actively syncing before it settles
 * on whatever the relays have shown so far. A relay that is still
 * transferring keeps it waiting indefinitely: a first download on a slow link
 * can take minutes, and that is not a failure.
 */
export const initialSyncIdleLimitMs = 20_000

/**
 * - `restored`: the account's settings are present locally.
 * - `empty`: every relay finished syncing and none of them had the settings.
 * - `failed`: the device is offline, or some relay could not be synced with,
 *   so the relays may hold data this device has not seen.
 * - `waiting`: still undecided.
 */
export type InitialSyncOutcome = "waiting" | "restored" | "empty" | "failed"

/** The relays of one owner in one database, each a transport and its route. */
export type OwnerRelays = ReadonlyArray<RelaySyncState>

/**
 * The relays of `ownerId` in the database `name`, or null while the shared
 * worker has not reported the owner. `syncStateToRelaySyncStates` alone
 * answers an empty list for an owner it does not know yet, which would read
 * as an owner with no relays and end the wait for its first sync.
 */
export const findOwnerRelays = (
  state: SyncState | null,
  name: Name,
  ownerId: OwnerId
): OwnerRelays | null => {
  const registered =
    state?.tenants.some(
      (tenant) =>
        tenant.type === "Active" &&
        tenant.name === name &&
        tenant.owners.some(
          (owner) => owner.type === "Writable" && owner.ownerId === ownerId
        )
    ) === true
  return registered ? syncStateToRelaySyncStates(state, name, ownerId) : null
}

/**
 * Whether the relay is transferring. Only over an open connection: Evolu
 * also calls a first connection still being attempted `Syncing`, but that
 * one counts towards the idle limit, or a host that drops packets would keep
 * a restore waiting until the platform gives up on it.
 */
export const isRelaySyncing = (relay: RelaySyncState): boolean =>
  relaySyncStateToStatus(relay).type === "Syncing" &&
  relay.transport.connection.type === "Open"

const isRelaySynced = (relay: RelaySyncState): boolean =>
  relaySyncStateToStatus(relay).type === "Synced"

const isRelayFailed = (relay: RelaySyncState): boolean => {
  const status = relaySyncStateToStatus(relay).type
  const { connection } = relay.transport
  return (
    status === "Error" ||
    (status === "Disconnected" &&
      connection.type === "Disconnected" &&
      connection.error !== null)
  )
}

export const evaluateInitialSync = ({
  relays,
  hasSettings,
  online,
  idleForMs,
}: {
  readonly relays: OwnerRelays | null
  readonly hasSettings: boolean
  readonly online: boolean
  /** Time since a relay of the owner was last seen syncing, or since the start. */
  readonly idleForMs: number
}): InitialSyncOutcome => {
  if (hasSettings) return "restored"
  if (!online) return "failed"

  const known = relays ?? []
  if (known.some(isRelaySyncing)) return "waiting"

  const allSynced = known.length > 0 && known.every(isRelaySynced)
  if (allSynced) return "empty"

  const settled =
    known.length > 0 &&
    known.every((relay) => isRelaySynced(relay) || isRelayFailed(relay))
  if (settled || idleForMs >= initialSyncIdleLimitMs) return "failed"

  return "waiting"
}

/**
 * Whether the owner's first sync is still transferring: a relay is syncing and
 * none has ever completed. Until it is false, a missing `appSettings` row
 * says nothing about whether the account has any.
 */
export const isInitialSyncPending = (relays: OwnerRelays): boolean =>
  relays.every((relay) => relay.route.completeAt === null) &&
  relays.some(isRelaySyncing)
