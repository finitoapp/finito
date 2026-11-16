import { DeviceId } from "../device/device-types.ts"
import {
  type InferTable,
  NonEmptyString255Schema,
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
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
  // Not read or written by any feature yet — reserved for a future QR code
  // sticker on the physical table that resolves straight to it.
  code: NonEmptyString255Schema,
  sortOrder: NonNegativeIntegerSchema,
} as const

export type Table = typeof table
export type TableRow = InferTable<typeof table>
