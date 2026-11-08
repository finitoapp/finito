import { describe, expect, test } from "vitest"

import { createRowId } from "../shared/evolu-utils.ts"
import { NonNegativeInteger, TimestampMs } from "../shared/schema.ts"
import { chooseSwitchioRefundKind } from "./refund-switchio-utils.ts"

const deviceId = createRowId<"Device">()
const whole = {
  deviceId,
  charged: NonNegativeInteger(27_000),
  requested: {
    goods: NonNegativeInteger(25_000),
    tip: NonNegativeInteger(2_000),
  },
  refundCount: 0,
  source: {
    deviceId,
    approvedAt: TimestampMs(1_000),
    transactionId: "payment-1",
  },
  closedSinceApproval: false,
}

describe("chooseSwitchioRefundKind", () => {
  test("reverses the whole payment on the phone that charged it, before its batch closed", () => {
    expect(chooseSwitchioRefundKind(whole)).toBe("reversal")
  })

  test.each([
    [
      "the tip stays",
      { requested: { ...whole.requested, tip: NonNegativeInteger(0) } },
    ],
    [
      "only part of the goods goes back",
      { requested: { ...whole.requested, goods: NonNegativeInteger(5_000) } },
    ],
    ["something was refunded before", { refundCount: 1 }],
    ["this is another phone", { deviceId: createRowId<"Device">() }],
    ["the batch was closed since", { closedSinceApproval: true }],
    [
      "the payment kept no approval time",
      { source: { ...whole.source, approvedAt: null } },
    ],
    [
      "the payment kept no transaction to reverse",
      { source: { ...whole.source, transactionId: null } },
    ],
    [
      "the payment kept no charging phone",
      { source: { ...whole.source, deviceId: null } },
    ],
  ] as const)("refunds to the card when %s", (_, change) => {
    expect(chooseSwitchioRefundKind({ ...whole, ...change })).toBe(
      "referralRefund"
    )
  })
})
