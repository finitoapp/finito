import { id } from "@evolu/common"
import { standardSchemaToZod } from "../../zod-utils.ts"

export const FioPluginIdRaw = id("FioPlugin")
export const FioPluginId = standardSchemaToZod(FioPluginIdRaw)
export type FioPluginId = typeof FioPluginIdRaw.Output

export const FioPluginTokenIdRaw = id("FioPluginToken")
export const FioPluginTokenId = standardSchemaToZod(FioPluginTokenIdRaw)
export type FioPluginTokenId = typeof FioPluginTokenIdRaw.Output

export const FioSyncDeviceUptimeIdRaw = id("FioSyncDeviceUptime")
export const FioSyncDeviceUptimeId = standardSchemaToZod(
  FioSyncDeviceUptimeIdRaw
)
export type FioSyncDeviceUptimeId = typeof FioSyncDeviceUptimeIdRaw.Output
