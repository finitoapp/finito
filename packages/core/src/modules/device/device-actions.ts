import {
  type MutationOptions,
  ok,
  sqliteFalse,
  sqliteTrue,
  type Task,
} from "@evolu/common"
import { bytesToHex, randomBytes } from "@noble/hashes/utils.js"

import type { DateDep, EvoluOwnerDep } from "../../deps.ts"
import type { Evolu } from "../../evolu/schema.ts"
import type { Permission } from "../access/access-types.ts"
import { encodePermissions } from "../access/access-utils.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { runMutationWithCompletion } from "../shared/evolu-utils.ts"
import { NonEmptyString255, TimestampMs } from "../shared/schema.ts"
import { deviceByIdQuery } from "./device-queries.ts"
import type { DeviceId } from "./device-types.ts"

/**
 * Puts this device's row into the active account's app database on start
 * (access/0004, access/0013). Never writes `defaultPermissions`,
 * `pinBlockedAt` or `pinUnblockToken`, and `name` only while the row has
 * none: Evolu resolves each column last-write-wins, so writing them on every
 * start would undo what the owner set.
 *
 * `joining` is true until this device has registered since the account was
 * added to it. A joining device writes `isDeleted: false`, so an old removal
 * of this device, synced or not yet, cannot sign it out again. A device that
 * has joined never writes `isDeleted`, so a removal from another device
 * wins, and once it is here the device is `removed`: its caller signs it
 * out of the account.
 */
export const registerDevice =
  (device: {
    readonly id: DeviceId
    readonly name: NonEmptyString255
    readonly deviceType: NonEmptyString255 | null
    readonly browserName: NonEmptyString255 | null
    readonly osName: NonEmptyString255 | null
    readonly joining: boolean
  }): Task<"registered" | "removed", never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps
    const [existing] = await evolu.loadQuery(deviceByIdQuery(device.id))
    if (existing?.isDeleted === sqliteTrue && !device.joining) {
      return ok("removed")
    }
    const labels = {
      id: device.id,
      deviceType: device.deviceType,
      browserName: device.browserName,
      osName: device.osName,
    }
    const isDeleted = device.joining
      ? ({ isDeleted: sqliteFalse } as const)
      : {}

    await runMutationWithCompletion((options) => {
      const mutationOptions = { ...options, owner: evoluOwner }
      if (existing === undefined) {
        evolu.upsert(
          "device",
          { ...labels, name: device.name, ...isDeleted },
          mutationOptions
        )
      } else {
        evolu.update(
          "device",
          {
            ...labels,
            ...(existing.name === null ? { name: device.name } : {}),
            ...isDeleted,
          },
          mutationOptions
        )
      }
    })
    return ok("registered")
  }

/**
 * The plain write, for a caller folding it into its own batch, as
 * `enableAccessControl` does with the turn-on wizard's devices.
 */
export const updateDeviceDefaultPermissions = (
  evolu: Evolu,
  device: {
    readonly id: DeviceId
    readonly permissions: Iterable<Permission>
  },
  options: MutationOptions
) =>
  evolu.update(
    "device",
    {
      id: device.id,
      defaultPermissions: encodePermissions(device.permissions),
    },
    options
  )

export const setDeviceDefaultPermissions =
  (device: {
    readonly id: DeviceId
    readonly permissions: Iterable<Permission>
  }): Task<void, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps
    await runMutationWithCompletion((options) =>
      updateDeviceDefaultPermissions(evolu, device, {
        ...options,
        owner: evoluOwner,
      })
    )
    return ok()
  }

export const renameDevice =
  ({
    id,
    name,
  }: {
    readonly id: DeviceId
    readonly name: NonEmptyString255
  }): Task<void, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps
    await runMutationWithCompletion((options) =>
      evolu.update("device", { id, name }, { ...options, owner: evoluOwner })
    )
    return ok()
  }

/** Written only by the device itself, so the others can show it blocked. */
export const setDevicePinBlocked =
  ({
    id,
    blocked,
  }: {
    readonly id: DeviceId
    readonly blocked: boolean
  }): Task<void, never, EvoluDep & EvoluOwnerDep & DateDep> =>
  async (run) => {
    const { evolu, evoluOwner, date } = run.deps
    await runMutationWithCompletion((options) =>
      evolu.update(
        "device",
        {
          id,
          pinBlockedAt: blocked ? TimestampMs(date.now().getTime()) : null,
        },
        { ...options, owner: evoluOwner }
      )
    )
    return ok()
  }

/**
 * Unblocks a blocked device from another one (access/0006). A fresh random
 * token rather than a time, so changing the blocked device's clock cannot
 * make later attempts look older than the unblock.
 */
export const unblockDevice =
  (id: DeviceId): Task<void, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps
    await runMutationWithCompletion((options) =>
      evolu.update(
        "device",
        {
          id,
          pinUnblockToken: NonEmptyString255(bytesToHex(randomBytes(16))),
        },
        { ...options, owner: evoluOwner }
      )
    )
    return ok()
  }

/**
 * Removes a device row and its permissions together (access/0013): the
 * device signs itself out of the account once it sees the removal, and one
 * that joins the account again starts with none.
 */
export const removeDevice =
  (id: DeviceId): Task<void, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evolu, evoluOwner } = run.deps
    await runMutationWithCompletion((options) =>
      evolu.update(
        "device",
        { id, defaultPermissions: null, isDeleted: sqliteTrue },
        { ...options, owner: evoluOwner }
      )
    )
    return ok()
  }
