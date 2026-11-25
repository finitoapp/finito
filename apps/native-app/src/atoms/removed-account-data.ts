import { deleteRemovedAccountsLocalData } from "@payky/core/evolu/account-wipe"
import { atom } from "jotai"
import { nativeConsole, nativeRun } from "../core/native-runtime.ts"
import { deviceEvoluAtom } from "./device-evolu.ts"
import { deviceMigrationsAtom } from "./device-migrations.ts"

/**
 * Deletes the app databases of accounts removed from this device that are
 * still here (access/0014), once per app start, after the device migrations
 * and before the active account opens. A database a runtime the reload
 * replaced still holds fails with `DatabaseHeldError` and is tried again at
 * the next start. Never rejects, as on web.
 */
export const removedAccountDataAtom = atom(async (get) => {
  const deviceEvolu = await get(deviceEvoluAtom)
  await get(deviceMigrationsAtom)

  try {
    await using run = nativeRun.create({ ...nativeRun.deps, deviceEvolu })
    const deleted = await run.ok(deleteRemovedAccountsLocalData)
    if (deleted > 0)
      nativeConsole.info("Deleted the data of removed accounts.", { deleted })
  } catch (error) {
    nativeConsole.error("Deleting the data of removed accounts failed.", error)
  }
})
