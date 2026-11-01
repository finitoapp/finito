import { createId, createRandomBytes } from "@evolu/common"
import {
  createAccountMasterKey,
  insertAccount,
  loadActiveAccountRow,
} from "@payky/core/evolu/device-account"
import { masterKeyToMnemonic } from "@payky/core/modules/shared/key-derivation"
import { NonEmptyString255 } from "@payky/core/modules/shared/schema"
import { createRandomDisplayName } from "@payky/core/utils/random-name"
import { atom } from "jotai"
import { UAParser } from "ua-parser-js"
import { deviceEvoluAtom } from "@/atoms/device-evolu.ts"
import { deviceMigrationsAtom } from "@/atoms/device-migrations.ts"
import { evoluCounterAtom } from "@/atoms/evolu-counter.ts"
import { appDefaultTransports } from "@/core/app-brand.ts"

const toOptionalDeviceLabel = (value: string | undefined) =>
  value === undefined || value === ""
    ? null
    : NonEmptyString255(value.slice(0, 255))

/** What this device is, for the device rows; read fresh on every start. */
const getDeviceLabels = () => {
  const uap = new UAParser()

  return {
    deviceType: toOptionalDeviceLabel(uap.getDevice().type),
    deviceVendor: toOptionalDeviceLabel(uap.getDevice().vendor),
    browserName: toOptionalDeviceLabel(uap.getBrowser().name),
    osName: toOptionalDeviceLabel(uap.getOS().name),
  }
}

const activeAccountRowAtom = atom(async (get) => {
  get(evoluCounterAtom) // We want to reload evolu when counter is increased
  const deviceEvolu = await get(deviceEvoluAtom)
  // The account is read from migrated device data, never from rows a pending
  // migration is about to rewrite.
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
  // Never empty: `activeAccountRowAtom` inserts an account when none is
  // active, so there is no "no account" state to handle here.
  const row = await get(activeAccountRowAtom)

  // The device id lives in the device database (access/0004); a new one is
  // a new device, which starts with no permissions.
  const labels = getDeviceLabels()
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
  if (row.device === null) {
    deviceEvolu.upsert("device", device)
  }

  return {
    id: row.id,
    masterKey: row.masterKey,
    name: row.name,
    demo: row.demo,
    transports: row.transports,
    device,
  }
})

/**
 * Split out from `accountAtom` because deriving the SLIP-39 recovery phrase
 * runs a costly PBKDF2-based encoding — only the screens that actually
 * display it should pay for it, not every consumer of the account (Evolu
 * bootstrap, `useAppRun`, ...).
 */
export const recoveryMnemonicAtom = atom(async (get) => {
  const account = await get(accountAtom)
  return masterKeyToMnemonic(account.masterKey)
})
