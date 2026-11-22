import type { BillId } from "@payky/core/modules/bill/bill-types"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import { NonNegativeInteger } from "@payky/core/modules/shared/schema"
import { describe, expect, test } from "vitest"
import {
  type OverpaymentQueryRows,
  toOverpaymentInputs,
} from "./overpayment-input.ts"

const noClocks = {
  claims: new Map(),
  refunds: new Map(),
  resolutions: new Map(),
  acknowledgements: new Map(),
}

const paymentRow = (id: string, billId: string | null, tipAmount = 0) => ({
  id,
  billId,
  amount: 500,
  tipAmount,
  currency: "CZK",
  excessAcknowledgedAt: null,
  cashReceivedAmount: null,
})

const transactionRow = (paymentId: string, billId: string | null) => ({
  claimId: `claim-${paymentId}`,
  paymentId,
  billId,
  paymentAmount: 500,
  paymentCurrency: "CZK",
  paymentAmountSats: null,
  accountTransactionId: `tx-${paymentId}`,
  amount: 500,
  currency: "CZK",
})

const rows = {
  payments: [
    paymentRow("p1", "b1"),
    paymentRow("p2", "b2"),
    paymentRow("p3", null, 100),
  ],
  transactions: [
    transactionRow("p1", "b1"),
    transactionRow("p2", "b2"),
    transactionRow("p3", null),
  ],
  refunds: [],
  resolutions: [],
} as unknown as OverpaymentQueryRows

describe("toOverpaymentInputs", () => {
  test("a bill's input holds only that bill's rows, under its id", () => {
    const inputs = toOverpaymentInputs(
      [
        {
          billId: "b1" as BillId,
          billTotal: NonNegativeInteger(200),
          isCanceled: false,
        },
      ],
      rows,
      noClocks
    )
    const input = inputs.get("b1")
    expect(input?.billTotal).toBe(200)
    expect(input?.payments.map(({ id }) => id)).toEqual(["p1"])
    expect(input?.transactions.map(({ paymentId }) => paymentId)).toEqual([
      "p1",
    ])
    expect(inputs.has("b2")).toBe(false)
  })

  test("a payment without a bill is its own bill, totalling its amount less its tip", () => {
    const input = toOverpaymentInputs(
      [{ paymentId: "p3" as PaymentId }],
      rows,
      noClocks
    ).get("p3")
    expect(input?.billTotal).toBe(400)
    expect(input?.isCanceled).toBe(false)
    expect(input?.transactions.map(({ paymentId }) => paymentId)).toEqual([
      "p3",
    ])
  })

  test("a payment whose row has not arrived has no input", () => {
    expect(
      toOverpaymentInputs([{ paymentId: "p9" as PaymentId }], rows, noClocks)
        .size
    ).toBe(0)
  })
})
