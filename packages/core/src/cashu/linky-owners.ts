import {
  type AppOwner,
  createAppOwner,
  createOwnerWebSocketTransport,
  deriveShardOwner,
  type Name,
  type OwnerId,
  type OwnerTransport,
  RelayUrlFromString,
  type ShardOwner,
} from "@evolu/common"

import type { SyncStateDep } from "@evolu/common/local-first"
import { findOwnerRelays } from "../evolu/initial-sync-state.ts"
import { cashuShardScope } from "../modules/cashu/cashu-types.ts"
import {
  deriveLinkyAppOwnerSecret,
  type MasterKey,
} from "../modules/shared/key-derivation.ts"
import type { LinkyOwnerSync } from "./cashu-shard-store.ts"

/**
 * Linky's identities, derived from the master key next to Payky's own owner
 * (cashu.md §1–2). Linky's app owner holds `shardPointer` and `setting`; its
 * cashu shard owners hold the shared wallet.
 */
export const deriveLinkyAppOwner = (masterKey: MasterKey): AppOwner =>
  createAppOwner(deriveLinkyAppOwnerSecret(masterKey))

/** `deriveShardOwner(linkyAppOwner, ["cashu", index])`, as Linky's shard store derives it. */
export const deriveCashuShardOwner = (
  linkyAppOwner: AppOwner,
  index: number
): ShardOwner => deriveShardOwner(linkyAppOwner, [cashuShardScope, index])

/**
 * One transport per relay for one Linky owner. The app Evolu is created
 * without transports, and Payky's own relay rows address its own owner, so
 * every Linky owner gets explicit ones. A relay URL comes from Linky's synced
 * settings too, so one Evolu cannot dial is left out; the rest are written in
 * the canonical spelling Evolu requires (`wss://evolu.linky.fit/`).
 */
export const linkyOwnerTransports = (
  ownerId: OwnerId,
  relays: ReadonlyArray<string>
): Array<OwnerTransport> =>
  relays.flatMap((relay) => {
    const url = RelayUrlFromString.fromUnknown(relay)
    return url.ok
      ? [createOwnerWebSocketTransport({ url: url.value, ownerId })]
      : []
  })

/**
 * An owner counts as synced once one of its relays completed a sync round
 * since the shared worker started (Linky's `ownerSync`, from Evolu's
 * `syncState` here instead of a worker message).
 */
export const createLinkyOwnerSync = (
  syncState: SyncStateDep["syncState"],
  name: Name
): LinkyOwnerSync => ({
  isOwnerSynced: (ownerId) =>
    findOwnerRelays(syncState.get(), name, ownerId)?.some(
      (relay) => relay.route.completeAt !== null
    ) ?? false,
  subscribe: (listener) => syncState.subscribe(listener),
})
