import { deleteRemovedAccountsLocalData } from "@payky/core/evolu/account-wipe"
import { atom } from "jotai"
import { consoleAtom } from "@/atoms/console.ts"
import { deviceEvoluAtom } from "@/atoms/device-evolu.ts"
import { deviceMigrationsAtom } from "@/atoms/device-migrations.ts"
import { runAtom } from "@/atoms/run.ts"

/**
 * Deletes the app databases of accounts removed from this device that are
 * still here (access/0014), once per app start, after the device migrations
 * and before `activeAccountRowAtom` opens the active account. Never rejects:
 * what fails is logged and tried again at the next start.
 */
export const removedAccountDataAtom = atom(async (get) => {
  const deviceEvolu = await get(deviceEvoluAtom)
  await get(deviceMigrationsAtom)
  const console = get(consoleAtom)
  const run = get(runAtom)

  try {
    await using sweepRun = run.create({ ...run.deps, deviceEvolu })
    const deleted = await sweepRun.ok(deleteRemovedAccountsLocalData)
    if (deleted > 0)
      console.info("Deleted the data of removed accounts.", { deleted })
  } catch (error) {
    console.error("Deleting the data of removed accounts failed.", error)
  }
})
