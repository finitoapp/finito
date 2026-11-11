import type { IndexesConfig } from "@evolu/common/local-first"

import { CatalogItemId } from "../catalog-item/catalog-item-types.ts"
import {
  FiatCurrencySchema,
  type InferTable,
  IntegerSchema,
  NonEmptyString255Schema,
} from "../shared/schema.ts"
import { TaxRateId } from "../tax-rate/tax-rate-types.ts"
import { ItemId } from "./item-types.ts"

export const item = {
  id: ItemId,
  catalogItemId: CatalogItemId.nullable(),
  name: NonEmptyString255Schema,
  description: NonEmptyString255Schema.nullable(),
  currency: FiatCurrencySchema,
  unitAmount: IntegerSchema,
  /**
   * Frozen at snapshot time — see `createItemIdFromSnapshot` in
   * `item-utils.ts`, which includes this field in the content hash so a
   * later change to the source `catalogItem.taxRateId` produces a new
   * `item` row instead of mutating this one in place.
   */
  taxRateId: TaxRateId.nullable(),
} as const

export const itemIndexes = ((create) => [
  create("item_catalogItemId").on("item").column("catalogItemId"),
]) satisfies IndexesConfig

export type ItemRow = InferTable<typeof item>
