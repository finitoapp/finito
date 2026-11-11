import type { IndexesConfig } from "@evolu/common/local-first"

import { BillId } from "../bill/bill-types.ts"
import { CatalogItemId } from "../catalog-item/catalog-item-types.ts"
import { DeviceId } from "../device/device-types.ts"
import { ItemId, ItemLineTypeSchema } from "../item/item-types.ts"
import {
  type InferTable,
  IntegerSchema,
  PositiveNumberSchema,
} from "../shared/schema.ts"
import { BillLineId, BillLineTagSchema } from "./bill-line-types.ts"

export const billLine = {
  id: BillLineId,
  billId: BillId,
  deviceId: DeviceId.nullable(),
  catalogItemId: CatalogItemId.nullable(),
  itemId: ItemId,
  type: ItemLineTypeSchema,
  kind: BillLineTagSchema,
  quantity: PositiveNumberSchema,
  totalAmount: IntegerSchema,
} as const

export const billLineIndexes = ((create) => [
  create("billLine_billId_createdAt")
    .on("billLine")
    .columns(["billId", "createdAt"]),
  create("billLine_itemId").on("billLine").column("itemId"),
]) satisfies IndexesConfig

export type BillLineRow = InferTable<typeof billLine>
