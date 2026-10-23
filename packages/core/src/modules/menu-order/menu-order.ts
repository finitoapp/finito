import type { IndexesConfig } from "@evolu/common/local-first"

import { BillId } from "../bill/bill-types.ts"
import {
  DateStringSchema,
  type InferTable,
  NonEmptyString255Schema,
  NonEmptyStringSchema,
  PositiveIntegerSchema,
  TimestampMsSchema,
} from "../shared/schema.ts"
import { SelfPayPointerSchema } from "../table-self-pay/table-self-pay-reference-utils.ts"
import { MenuOrderId, MenuVersionId } from "./menu-order-types.ts"

export const menuVersion = {
  id: MenuVersionId,
  content: NonEmptyStringSchema,
} as const

export const menuOrder = {
  id: MenuOrderId,
  billId: BillId,
  pointer: SelfPayPointerSchema,
  day: DateStringSchema,
  number: PositiveIntegerSchema,
  note: NonEmptyString255Schema.nullable(),
  servedAt: TimestampMsSchema.nullable(),
} as const

export const menuOrderIndexes = ((create) => [
  create("menuOrder_day").on("menuOrder").column("day"),
  create("menuOrder_billId").on("menuOrder").column("billId"),
]) satisfies IndexesConfig

export type MenuOrderRow = InferTable<typeof menuOrder>
export type MenuVersionRow = InferTable<typeof menuVersion>
