import { createId, createRandomBytes } from "@evolu/common"
import {
  createAccountMasterKey,
  insertAccount,
  loadActiveAccountRow,
} from "@payky/core/evolu/device-account"
import { NonEmptyString255 } from "@payky/core/modules/shared/schema"
import { createRandomDisplayName } from "@payky/core/utils/random-name"
import { atom } from "jotai"
import { appDefaultTransports } from "../core/app-brand.ts"
import { getNativeDeviceLabels } from "../platform/device-labels.ts"
import { deviceEvoluAtom } from "./device-evolu.ts"
import { deviceMigrationsAtom } from "./device-migrations.ts"
import { evoluCounterAtom } from "./evolu-counter.ts"

const activeAccountRowAtom = atom(async (get) => {
  // Bumped by `reloadAppEvoluAtom` after a switch, so the account is read again.
  get(evoluCounterAtom)
  const deviceEvolu = await get(deviceEvoluAtom)
  // Read the account only from migrated device data.
  await get(deviceMigrationsAtom)
  const activeAccountRow = await loadActiveAccountRow(deviceEvolu)

  return (
    activeAccountRow ??
    insertAccount(deviceEvolu, createAccountMasterKey(), {
      defaultTransports: appDefaultTransports,
    })
  )
})

export const accountAtom = atom(async (get) => {
  const deviceEvolu = await get(deviceEvoluAtom)
  const row = await get(activeAccountRowAtom)

  // The device id is generated once and persisted (access/0004).
  const labels = getNativeDeviceLabels()
  const device =
    row.device !== null
      ? {
          id: row.device.id,
          name: NonEmptyString255(row.device.name),
          ...labels,
        }
      : {
          id: createId<"Device">({ randomBytes: createRandomBytes() }),
          name: NonEmptyString255(createRandomDisplayName()),
          ...labels,
        }
  if (row.device === null) deviceEvolu.upsert("device", device)

  return {
    id: row.id,
    masterKey: row.masterKey,
    name: row.name,
    demo: row.demo,
    transports: row.transports,
    device,
  }
})
