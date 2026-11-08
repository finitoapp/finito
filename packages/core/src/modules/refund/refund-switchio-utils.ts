import type { DeviceId } from "../device/device-types.ts"
import type { NonNegativeInteger, TimestampMs } from "../shared/schema.ts"

/**
 * How a refund to the card through SwitchioPay goes (refund/0008). A
 * reversal takes the payment back on the terminal: cheaper than a refund,
 * so it is chosen whenever it can be — when everything the card was charged
 * goes back (a reversal is always whole, tip included), nothing was refunded
 * before, this is the phone whose SwitchioPay charged the card, and that
 * phone has not closed its batch since. Anything else is a referral refund.
 *
 * The phone knows its own closures first-hand, so this never reads a stale
 * closure on it. A closure made outside Finito (in SwitchioPay, or its
 * automatic one) is not known: the terminal then declines the reversal, and
 * a referral refund is offered instead.
 */
export const chooseSwitchioRefundKind = ({
  deviceId,
  charged,
  requested,
  refundCount,
  source,
  closedSinceApproval,
}: {
  /** This phone. */
  readonly deviceId: DeviceId
  /** What the card was charged, tip included (`payment.amount`). */
  readonly charged: NonNegativeInteger
  /** The goods and the tip this refund returns. */
  readonly requested: {
    readonly goods: NonNegativeInteger
    readonly tip: NonNegativeInteger
  }
  /** Refunds of the payment already recorded, by any method. */
  readonly refundCount: number
  /** What the payment kept for its refund (payment/0009). */
  readonly source: {
    readonly deviceId: DeviceId | null
    readonly approvedAt: TimestampMs | null
    readonly transactionId: string | null
  }
  /** Whether the charging phone recorded a closure after `approvedAt`. */
  readonly closedSinceApproval: boolean
}): "reversal" | "referralRefund" =>
  refundCount === 0 &&
  requested.goods + requested.tip === charged &&
  source.deviceId === deviceId &&
  source.approvedAt !== null &&
  source.transactionId !== null &&
  !closedSinceApproval
    ? "reversal"
    : "referralRefund"
