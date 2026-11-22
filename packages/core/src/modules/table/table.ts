import { nullOr, SqliteBoolean } from "@evolu/common"

import { DeviceId } from "../device/device-types.ts"
import {
  type InferTable,
  NonEmptyString255Schema,
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
  TimestampMsSchema,
} from "../shared/schema.ts"
import { TableId } from "./table-types.ts"

export const table = {
  id: TableId,
  deviceId: DeviceId.nullable(),
  name: NonEmptyString255Schema,
  /**
   * How many people the table seats, or null when the merchant has not said
   * (catalog/0008): a count nobody knows is not shown at all.
   */
  seatCount: PositiveIntegerSchema.nullable(),
  code: NonEmptyString255Schema,
  sortOrder: NonNegativeIntegerSchema,
  selfPayEnabled: nullOr(SqliteBoolean),
  selfPayEpoch: NonNegativeIntegerSchema.nullable(),
  selfPayPublishRequestedAt: TimestampMsSchema.nullable(),
} as const

export type Table = typeof table
export type TableRow = InferTable<typeof table>
