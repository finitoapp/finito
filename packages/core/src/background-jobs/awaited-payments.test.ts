import { createIdFromString } from "@evolu/common"
import { describe, expect, test, vi } from "vitest"
import {
  NonEmptyStringSchema,
  NonNegativeInteger,
} from "../modules/shared/schema.ts"
import {
  type AwaitedPayment,
  createAwaitedPayments,
  matchesAwaitedPayment,
} from "./awaited-payments.ts"

const accountId = createIdFromString<"Account">("account-1")
const otherAccountId = createIdFromString<"Account">("account-2")
const lnInvoice = NonEmptyStringSchema.decode("lnbc1invoice")
const sparkInvoice = NonEmptyStringSchema.decode("spark-invoice-1")

const payment: AwaitedPayment = {
  paymentId: createIdFromString<"Payment">("payment-1"),
  accountId,
  amountSats: NonNegativeInteger(1234),
  lnInvoice,
  sparkInvoice,
}

const values = {
  accountId,
  amountSats: NonNegativeInteger(1234),
  lnInvoice,
  sparkInvoice: null,
}

describe("matchesAwaitedPayment", () => {
  test.each([
    ["the Lightning invoice", values, true],
    [
      "the Spark invoice",
      { ...values, lnInvoice: null, sparkInvoice: sparkInvoice },
      true,
    ],
    [
      "one invoice while the other differs",
      {
        ...values,
        sparkInvoice: NonEmptyStringSchema.decode("spark-invoice-2"),
      },
      true,
    ],
    [
      "another amount",
      { ...values, amountSats: NonNegativeInteger(1235) },
      false,
    ],
    ["another account", { ...values, accountId: otherAccountId }, false],
    [
      "another invoice",
      { ...values, lnInvoice: NonEmptyStringSchema.decode("lnbc1other") },
      false,
    ],
    [
      "a missing invoice both sides lack",
      { ...values, lnInvoice: null, sparkInvoice: null },
      false,
    ],
  ])("compares %s", (_case, transferValues, expected) => {
    expect(matchesAwaitedPayment(payment, transferValues)).toBe(expected)
  })
})

describe("createAwaitedPayments", () => {
  test("finds a registration only by account, amount and invoice", () => {
    const awaitedPayments = createAwaitedPayments()
    using _registration = awaitedPayments.await(payment, () => undefined)

    expect(awaitedPayments.find(values)).toBe(payment)
    expect(
      awaitedPayments.find({ ...values, amountSats: NonNegativeInteger(1) })
    ).toBeUndefined()
    expect(
      awaitedPayments.find({ ...values, accountId: otherAccountId })
    ).toBeUndefined()
  })

  test("recorded runs the callback once and removes the registration", () => {
    const awaitedPayments = createAwaitedPayments()
    const onRecorded = vi.fn()
    using _registration = awaitedPayments.await(payment, onRecorded)

    awaitedPayments.recorded(payment.paymentId)
    awaitedPayments.recorded(payment.paymentId)

    expect(onRecorded).toHaveBeenCalledTimes(1)
    expect(awaitedPayments.find(values)).toBeUndefined()
  })

  test("disposing removes the registration without the callback", () => {
    const awaitedPayments = createAwaitedPayments()
    const onRecorded = vi.fn()
    const registration = awaitedPayments.await(payment, onRecorded)

    registration[Symbol.dispose]()
    awaitedPayments.recorded(payment.paymentId)

    expect(onRecorded).not.toHaveBeenCalled()
    expect(awaitedPayments.find(values)).toBeUndefined()
  })

  test("a throwing callback does not fail recorded", () => {
    const awaitedPayments = createAwaitedPayments()
    using _registration = awaitedPayments.await(payment, () => {
      throw new Error("screen failed")
    })

    expect(() => awaitedPayments.recorded(payment.paymentId)).not.toThrow()
    expect(awaitedPayments.find(values)).toBeUndefined()
  })
})
