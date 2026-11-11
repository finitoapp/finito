import type { BillId } from "../bill/bill-types.ts"
import type { CatalogItemId } from "../catalog-item/catalog-item-types.ts"
import type { ItemId, ItemLineType } from "../item/item-types.ts"
import type {
  FiatCurrency,
  Integer,
  NonEmptyString,
  PositiveNumber,
} from "../shared/schema.ts"
import type { TaxRateId } from "../tax-rate/tax-rate-types.ts"
import type { BillLineSummaryId } from "./bill-line-types.ts"

export interface BillLineSummary {
  readonly id: BillLineSummaryId
  readonly billId: BillId
  readonly catalogItemId: CatalogItemId | null
  readonly itemId: ItemId
  readonly type: ItemLineType
  readonly name: NonEmptyString
  readonly description: NonEmptyString | null
  readonly currency: FiatCurrency
  readonly quantity: PositiveNumber
  readonly totalAmount: Integer
  /** Frozen at the moment the underlying `item` snapshot was created. */
  readonly taxRateId: TaxRateId | null
}
