import { describe, expect, test } from "vitest"
import { TimestampMs } from "../shared/schema.ts"
import {
  computePaymentExpiresAt,
  DEFAULT_LIGHTNING_INVOICE_EXPIRY_SECONDS,
  derivePaymentHasCancellationCollision,
  derivePaymentStatus,
} from "./payment-status-utils.ts"

const now = new Date("2026-06-05T12:00:00.000Z")

describe("derivePaymentStatus", () => {
  test("pending when nothing else applies", () => {
    expect(
      derivePaymentStatus({
        canceledAt: null,
        confirmedPaidAt: null,
        expiresAt: null,
        hasActiveClaim: false,
        now,
      })
    ).toBe("pending")
  })

  test("expired once past expiresAt with no claim or cancellation", () => {
    expect(
      derivePaymentStatus({
        canceledAt: null,
        confirmedPaidAt: null,
        expiresAt: TimestampMs(now.getTime() - 1),
        hasActiveClaim: false,
        now,
      })
    ).toBe("expired")
  })

  test("not yet expired before expiresAt", () => {
    expect(
      derivePaymentStatus({
        canceledAt: null,
        confirmedPaidAt: null,
        expiresAt: TimestampMs(now.getTime() + 1),
        hasActiveClaim: false,
        now,
      })
    ).toBe("pending")
  })

  test("paid outranks expired — a late claim still counts as paid", () => {
    expect(
      derivePaymentStatus({
        canceledAt: null,
        confirmedPaidAt: null,
        expiresAt: TimestampMs(now.getTime() - 1),
        hasActiveClaim: true,
        now,
      })
    ).toBe("paid")
  })

  test("canceled outranks paid — an explicit cancellation wins the display", () => {
    expect(
      derivePaymentStatus({
        canceledAt: TimestampMs(now.getTime() - 1_000),
        confirmedPaidAt: null,
        expiresAt: null,
        hasActiveClaim: true,
        now,
      })
    ).toBe("canceled")
  })

  test("canceled outranks expired", () => {
    expect(
      derivePaymentStatus({
        canceledAt: TimestampMs(now.getTime() - 1_000),
        confirmedPaidAt: null,
        expiresAt: TimestampMs(now.getTime() - 1),
        hasActiveClaim: false,
        now,
      })
    ).toBe("canceled")
  })

  test("confirmedPaidAt outranks canceled — staff resolving the cancel+claim collision wins the display", () => {
    expect(
      derivePaymentStatus({
        canceledAt: TimestampMs(now.getTime() - 1_000),
        confirmedPaidAt: TimestampMs(now.getTime() - 1),
        expiresAt: null,
        hasActiveClaim: true,
        now,
      })
    ).toBe("paid")
  })

  test("confirmedPaidAt outranks expired too", () => {
    expect(
      derivePaymentStatus({
        canceledAt: TimestampMs(now.getTime() - 1_000),
        confirmedPaidAt: TimestampMs(now.getTime() - 1),
        expiresAt: TimestampMs(now.getTime() - 1),
        hasActiveClaim: true,
        now,
      })
    ).toBe("paid")
  })
})

describe("derivePaymentHasCancellationCollision", () => {
  const canceledAt = TimestampMs(now.getTime())

  test("a canceled payment with money claimed against it collides", () => {
    expect(
      derivePaymentHasCancellationCollision({
        canceledAt,
        confirmedPaidAt: null,
        hasActiveClaim: true,
      })
    ).toBe(true)
  })

  test("staff confirming it paid resolves the collision", () => {
    expect(
      derivePaymentHasCancellationCollision({
        canceledAt,
        confirmedPaidAt: TimestampMs(now.getTime() + 1),
        hasActiveClaim: true,
      })
    ).toBe(false)
  })

  test("a canceled payment with no claim, or a claimed one never canceled, does not", () => {
    expect(
      derivePaymentHasCancellationCollision({
        canceledAt,
        confirmedPaidAt: null,
        hasActiveClaim: false,
      })
    ).toBe(false)
    expect(
      derivePaymentHasCancellationCollision({
        canceledAt: null,
        confirmedPaidAt: null,
        hasActiveClaim: true,
      })
    ).toBe(false)
  })
})

describe("computePaymentExpiresAt", () => {
  test("returns null when no expiry window is given", () => {
    expect(computePaymentExpiresAt(now, undefined)).toBeNull()
  })

  test("computes an absolute timestamp from an expiry window", () => {
    expect(computePaymentExpiresAt(now, 900)).toBe(now.getTime() + 900_000)
  })

  /**
   * A regression guard for the real production gap this closes: nothing
   * previously passed `expirySeconds` when preparing a spark/Lightning
   * payment method, so `expiresAt` was always `null` in practice — see
   * docs/bill-payment-states.md and the fix in
   * `_terminal.payment_.$paymentId.tsx`'s spark preparation call.
   */
  test("the app's default Lightning invoice expiry produces a non-null expiresAt", () => {
    expect(
      computePaymentExpiresAt(now, DEFAULT_LIGHTNING_INVOICE_EXPIRY_SECONDS)
    ).toBe(now.getTime() + DEFAULT_LIGHTNING_INVOICE_EXPIRY_SECONDS * 1000)
  })
})
