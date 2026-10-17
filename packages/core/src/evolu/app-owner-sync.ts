import type { Name, OwnerId } from "@evolu/common"
import {
  type SyncStateDep,
  syncStateToOwnerSyncStatus,
} from "@evolu/common/local-first"

import type { AppOwnerSyncDep } from "../deps.ts"

export const createAppOwnerSync = (
  syncState: SyncStateDep["syncState"],
  evolu: { readonly name: Name; readonly appOwner: { readonly id: OwnerId } }
): AppOwnerSyncDep["appOwnerSync"] => ({
  isSynced: () => {
    const status = syncStateToOwnerSyncStatus(
      syncState.get(),
      evolu.name,
      evolu.appOwner.id
    )
    return status.type === "Synced" || status.type === "NoRelays"
  },
  subscribe: (listener) => syncState.subscribe(listener),
})
