import type { ItemLineType } from "../item/item-types.ts"
import { Integer } from "../shared/schema.ts"

/** What {@link allocateDiscount} reads of a bill's net line. */
export interface DiscountAllocationLine {
  /** Breaks ties, so the allocation does not depend on the lines' order. */
  readonly id: string
  readonly type: ItemLineType
  readonly totalAmount: Integer
}

/**
 * A line with its share of the bill's discount: a goods line `allocateDiscount`
 * gave one, or a frozen `paymentLine` that carries the share it was paid with.
 */
export interface DiscountShareLine {
  readonly totalAmount: Integer
  /**
   * Zero or less: the part of the bill's discount lines this line bears.
   * `null` for a line that bears none — a discount line itself, a tip, a line
   * of a bill without a discount, and every line of a payment made before
   * discounts existed.
   */
  readonly discountShare: Integer | null
}

/**
 * A discount line: a line of an item priced below zero (catalog/0002). It has
 * no VAT rate of its own; its amount is carried by the goods lines' shares.
 */
export const isDiscountLine = (
  line: Pick<DiscountShareLine, "totalAmount">
): boolean => line.totalAmount < 0

/**
 * What a line comes to once its share of the bill's discount is taken off:
 * `totalAmount + discountShare`. The amount the VAT recap splits, and the one
 * a goods line is refunded at. A line without a share (`null`) nets to its
 * own amount, so a payment frozen before discounts existed reads as it did.
 */
export const deriveLineNetAmount = (line: DiscountShareLine): Integer =>
  Integer(line.totalAmount + (line.discountShare ?? 0))

const compareIds = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0

/**
 * Spreads a bill's discount lines over its goods lines (catalog/0003), so VAT
 * can be counted from what each line really came to. Returns every line,
 * in the order given, with its `discountShare`.
 *
 * This is a fixed algorithm. A payment freezes its result into
 * `paymentLine.discountShare` (`snapshotBillLinesForPayment`), so changing it
 * changes the VAT recap of open bills and the sales statistics, but never a
 * payment that was already made. Step by step:
 *
 * 1. The discount is the sum of the lines below zero, whatever their VAT rate
 *    (a discount has none).
 * 2. It is shared by the goods lines above zero: every line but a tip. A
 *    manual amount and an item without a VAT rate take their share like any
 *    other, so the "no rate" group of the recap is discounted too. Lines are
 *    shared individually, never per VAT rate, so the recap (which groups the
 *    net lines by rate) and a refund (which reads one line) see the same
 *    numbers.
 * 3. Each line's share is proportional to its gross amount, rounded by the
 *    largest remainder: every line first takes the whole minor units of its
 *    exact share, and the units still left go one each to the lines with the
 *    largest fractional remainders, ties to the line whose `id` sorts first.
 *    The shares add up to the discount exactly, and the result does not
 *    depend on the order the lines come in.
 * 4. No line ends below zero. A line's exact share never exceeds its amount,
 *    and a line whose exact share is a fraction below its whole amount takes
 *    at most one unit more than its floor, which still leaves it at zero or
 *    above. A discount larger than the goods is shared up to the goods' total
 *    (every goods line at zero) and the rest is borne by no line: such a bill
 *    is below zero and can only be discarded (payment/0015).
 * 5. A bill without a discount, or without a goods line above zero, shares
 *    nothing: every `discountShare` is `null`. A discount on a bill without
 *    goods cannot be paid (payment/0012), and `calculateTaxRecap` shows no
 *    recap for it.
 */
export const allocateDiscount = <T extends DiscountAllocationLine>(
  lines: ReadonlyArray<T>
): ReadonlyArray<T & Pick<DiscountShareLine, "discountShare">> => {
  const discount = lines.reduce(
    (sum, line) => (isDiscountLine(line) ? sum - line.totalAmount : sum),
    0
  )
  const takers = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.type !== "tip" && line.totalAmount > 0)
    .sort((a, b) => compareIds(a.line.id, b.line.id))
  const goods = takers.reduce((sum, { line }) => sum + line.totalAmount, 0)

  if (discount === 0 || goods === 0) {
    return lines.map((line) => ({ ...line, discountShare: null }))
  }

  // Exact in `bigint`: a large bill's discount times a line's amount can pass
  // `Number.MAX_SAFE_INTEGER` before it is divided back down.
  const shared = BigInt(Math.min(discount, goods))
  const goodsTotal = BigInt(goods)
  const quotas = takers.map(({ line, index }) => {
    const exact = shared * BigInt(line.totalAmount)
    return {
      index,
      whole: Number(exact / goodsTotal),
      remainder: exact % goodsTotal,
    }
  })
  const left =
    Number(shared) - quotas.reduce((sum, quota) => sum + quota.whole, 0)
  // `sort` is stable and `quotas` is in id order, so equal remainders keep it.
  const extraUnitIndexes = new Set(
    [...quotas]
      .sort((a, b) =>
        a.remainder === b.remainder ? 0 : a.remainder > b.remainder ? -1 : 1
      )
      .slice(0, left)
      .map((quota) => quota.index)
  )
  const sharesByIndex = new Map(
    quotas.map((quota) => [
      quota.index,
      // `0 -` rather than unary minus, which would store a share of 0 as -0.
      Integer(0 - (quota.whole + (extraUnitIndexes.has(quota.index) ? 1 : 0))),
    ])
  )

  return lines.map((line, index) => ({
    ...line,
    discountShare: sharesByIndex.get(index) ?? null,
  }))
}
