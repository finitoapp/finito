import { createIdFromString } from "@evolu/common"
import {
  NonEmptyStringSchema,
  NonNegativeInteger,
} from "@payky/core/modules/shared/schema"
import { describe, expect, it } from "vitest"
import {
  type AwaitedPaymentSource,
  awaitedPaymentFor,
} from "./awaited-payment.ts"

const payment: AwaitedPaymentSource = {
  id: createIdFromString<"Payment">("payment-1"),
  sparkAccountId: createIdFromString<"Account">("account-1"),
  amountSats: NonNegativeInteger(1234),
  lnInvoice: NonEmptyStringSchema.decode("lnbc1invoice"),
  sparkInvoice: null,
}

describe("awaitedPaymentFor", () => {
  it("awaits a pending payment with an invoice", () => {
    expect(awaitedPaymentFor(payment, true)).toEqual({
      paymentId: payment.id,
      accountId: payment.sparkAccountId,
      amountSats: payment.amountSats,
      lnInvoice: payment.lnInvoice,
      sparkInvoice: null,
    })
    expect(
      awaitedPaymentFor(
        {
          ...payment,
          lnInvoice: null,
          sparkInvoice: NonEmptyStringSchema.decode("spark1"),
        },
        true
      )?.sparkInvoice
    ).toBe("spark1")
  })

  it("awaits nothing once the payment is no longer pending", () => {
    expect(awaitedPaymentFor(payment, false)).toBeNull()
  })

  it("awaits nothing without an invoice, a Spark account or sats", () => {
    expect(awaitedPaymentFor({ ...payment, lnInvoice: null }, true)).toBeNull()
    expect(
      awaitedPaymentFor({ ...payment, sparkAccountId: null }, true)
    ).toBeNull()
    expect(awaitedPaymentFor({ ...payment, amountSats: null }, true)).toBeNull()
  })
})
