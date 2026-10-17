import type { AppOwnerSyncDep } from "../deps.ts"

export const testSyncedAppOwner: AppOwnerSyncDep = {
  appOwnerSync: {
    isSynced: () => true,
    subscribe: () => () => undefined,
  },
}
