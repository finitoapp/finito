import type { DeviceAccountId, DeviceEvolu } from "../../evolu/device-client.ts"
import type { Evolu } from "../../evolu/schema.ts"

export interface EvoluDep {
  readonly evolu: Evolu
}

/** The device database: this device's accounts and settings, never synced. */
export interface DeviceEvoluDep {
  readonly deviceEvolu: DeviceEvolu
}

/** The device database and the active account's row in it. */
export interface DeviceAccountDep extends DeviceEvoluDep {
  readonly deviceAccountId: DeviceAccountId
}
