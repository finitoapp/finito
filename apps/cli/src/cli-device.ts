import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { hostname, type } from "node:os"
import { join } from "node:path"
import type { Task } from "@evolu/common"

import type { EvoluOwnerDep } from "@payky/core/deps"
import { registerDevice } from "@payky/core/modules/device/device-actions"
import { DeviceId } from "@payky/core/modules/device/device-types"
import type { EvoluDep } from "@payky/core/modules/shared/evolu-deps"
import { createRowId } from "@payky/core/modules/shared/evolu-utils"
import { NonEmptyString255 } from "@payky/core/modules/shared/schema"

export const loadOrCreateCliDeviceId = (dataDir: string): DeviceId => {
  const path = join(dataDir, "device-id")
  if (existsSync(path)) return DeviceId.parse(readFileSync(path, "utf8").trim())

  const deviceId = createRowId<"Device">()
  writeFileSync(path, deviceId, { mode: 0o600, flag: "wx" })
  return deviceId
}

export const registerCliDevice = (
  id: DeviceId
): Task<void, never, EvoluDep & EvoluOwnerDep> =>
  registerDevice({
    id,
    name: NonEmptyString255(`CLI on ${hostname()}`.slice(0, 255)),
    deviceType: NonEmptyString255("cli"),
    browserName: null,
    osName: NonEmptyString255(type()),
  })
