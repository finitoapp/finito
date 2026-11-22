import { SqliteBoolean } from "@evolu/common"
import type { IndexesConfig } from "@evolu/common/local-first"

import { AccountId } from "../account/account-types.ts"
import { DeviceId } from "../device/device-types.ts"
import {
  DateStringSchema,
  type InferTable,
  NonEmptyString255Schema,
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
  TimestampMsSchema,
} from "../shared/schema.ts"
import {
  FioPluginId,
  FioPluginTokenId,
  FioSyncDeviceUptimeId,
} from "./fio-plugin-types.ts"

export const fioPlugin = {
  id: FioPluginId,
  accountId: AccountId,
  numberOfSecondsBetweenChecks: PositiveIntegerSchema,
  syncLookbackDays: PositiveIntegerSchema,
  isActive: SqliteBoolean,
} as const

export const fioPluginSyncPointer = {
  id: FioPluginId,
  lastSyncedDate: DateStringSchema,
} as const

export const fioPluginSyncLease = {
  id: FioPluginId,
  deviceId: DeviceId,
  expiresAt: TimestampMsSchema,
} as const

export const fioSyncDeviceUptime = {
  id: FioSyncDeviceUptimeId,
  uptimePerMille: NonNegativeIntegerSchema,
  measuredAt: TimestampMsSchema,
} as const

export const fioPluginToken = {
  id: FioPluginTokenId,
  fioPluginId: FioPluginId,
  token: NonEmptyString255Schema,
} as const

export const fioPluginIndexes = ((create) => [
  create("fioPlugin_accountId").on("fioPlugin").column("accountId"),
  create("fioPluginToken_fioPluginId")
    .on("fioPluginToken")
    .column("fioPluginId"),
]) satisfies IndexesConfig

export type FioPluginRow = InferTable<typeof fioPlugin>
export type FioPluginSyncPointerRow = InferTable<typeof fioPluginSyncPointer>
export type FioPluginTokenRow = InferTable<typeof fioPluginToken>
