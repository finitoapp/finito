import type { BillOverpayment } from "@payky/core/modules/bill/bill-utils"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import {
  NonNegativeInteger,
  TimestampMs,
} from "@payky/core/modules/shared/schema"
import { describe, expect, test } from "vitest"
import { paykyBrand } from "./brand.ts"
import { formatMoney } from "./format-money.ts"
import { createTranslate } from "./i18n/translate.ts"
import {
  deriveResolveForm,
  type OverpaymentCardPayment,
  partitionOverpaymentPayments,
  paymentOptionLabel,
  resolvableFrom,
} from "./overpayment-card.ts"

const t = createTranslate("en", paykyBrand)

const payment = (
  id: string,
  overrides: Partial<OverpaymentCardPayment> = {}
): OverpaymentCardPayment => ({
  id: id as PaymentId,
  number: NonNegativeInteger(1),
  amount: NonNegativeInteger(500),
  methods: ["cashRegister"],
  createdAt: "2026-10-17T10:00:00.000Z",
  canceledAt: null,
  confirmedPaidAt: null,
  ...overrides,
})

const overpaymentOf = (
  unresolved: number,
  roomByPayment: Readonly<Record<string, number>>
): BillOverpayment => ({
  overpayment: NonNegativeInteger(unresolved),
  unresolved: NonNegativeInteger(unresolved),
  answers: [],
  roomByPayment: new Map(
    Object.entries(roomByPayment).map(([id, room]) => [
      id as PaymentId,
      NonNegativeInteger(room),
    ])
  ),
})

describe("resolvableFrom", () => {
  test("is what the payment holds, capped by what is unresolved", () => {
    const overpayment = overpaymentOf(300, { a: 500, b: 100 })
    expect(resolvableFrom(overpayment, payment("a"))).toBe(300)
    expect(resolvableFrom(overpayment, payment("b"))).toBe(100)
    expect(resolvableFrom(overpayment, payment("c"))).toBe(0)
  })
})

describe("partitionOverpaymentPayments", () => {
  test("a canceled payment whose money arrived is confirmed first, not offered", () => {
    const canceled = payment("a", { canceledAt: TimestampMs(1) })
    const confirmed = payment("b", {
      canceledAt: TimestampMs(1),
      confirmedPaidAt: TimestampMs(2),
    })
    const { collisions, holding } = partitionOverpaymentPayments(
      overpaymentOf(500, { a: 500, b: 500 }),
      [canceled, confirmed]
    )
    expect(collisions).toEqual([canceled])
    expect(holding).toEqual([confirmed])
  })

  test("only a payment that can still resolve something can return it", () => {
    const { holding, returnable } = partitionOverpaymentPayments(
      overpaymentOf(500, { a: 500, b: 0 }),
      [payment("a"), payment("b")]
    )
    expect(holding.map(({ id }) => id)).toEqual(["a", "b"])
    expect(returnable.map(({ id }) => id)).toEqual(["a"])
  })
})

describe("deriveResolveForm", () => {
  const base = {
    resolution: "kept",
    overpayment: overpaymentOf(300, { a: 500 }),
    payment: payment("a"),
    typedAmountText: null,
    amountLeft: false,
    guestLeftTip: false,
    pending: false,
    currency: "USD",
  } as const

  test("prefills what can be resolved from the payment", () => {
    const form = deriveResolveForm(base)
    expect(form.room).toBe(300)
    expect(form.amountText).toBe("3")
    expect(form.amount).toBe(300)
    expect(form.canConfirm).toBe(true)
  })

  test("an amount above the room is reported only once the field is left", () => {
    const typed = { ...base, typedAmountText: "9.00" }
    expect(deriveResolveForm(typed).amountErrorKey).toBeNull()
    expect(
      deriveResolveForm({ ...typed, amountLeft: true }).amountErrorKey
    ).toBe("overpayment.dialog.amount.aboveKeep")
    expect(
      deriveResolveForm({ ...typed, resolution: "tip", amountLeft: true })
        .amountErrorKey
    ).toBe("overpayment.dialog.amount.aboveTip")
    expect(deriveResolveForm(typed).canConfirm).toBe(false)
  })

  test("an empty or zero amount is invalid", () => {
    for (const typedAmountText of ["", "0"]) {
      const form = deriveResolveForm({
        ...base,
        typedAmountText,
        amountLeft: true,
      })
      expect(form.amount).toBeNull()
      expect(form.amountErrorKey).toBe("overpayment.dialog.amount.invalid")
    }
  })

  test("a tip is confirmed only once staff say the guest left it", () => {
    const tip = { ...base, resolution: "tip" } as const
    expect(deriveResolveForm(tip).canConfirm).toBe(false)
    expect(deriveResolveForm({ ...tip, guestLeftTip: true }).canConfirm).toBe(
      true
    )
  })

  test("nothing is confirmed without a payment or while one is recorded", () => {
    expect(deriveResolveForm({ ...base, payment: null }).canConfirm).toBe(false)
    expect(deriveResolveForm({ ...base, pending: true }).canConfirm).toBe(false)
  })
})

describe("paymentOptionLabel", () => {
  const format = (value: number) =>
    formatMoney({ value: NonNegativeInteger(value), currency: "USD" }, "en-US")
  const formatList = (items: ReadonlyArray<string>) => items.join(" + ")
  const labelOf = (option: OverpaymentCardPayment) =>
    paymentOptionLabel({
      payment: option,
      overpayment: overpaymentOf(500, { a: 500 }),
      locale: "en-US",
      t,
      format,
      formatList,
    })

  test("names the payment by number, each method once, and what it can resolve", () => {
    expect(
      labelOf(payment("a", { methods: ["cashRegister", "iban", "iban"] }))
    ).toBe(
      t("overpayment.dialog.paymentOption", {
        number: 1,
        method: `${t("paymentDetail.paymentMethod.cash")} + ${t("paymentDetail.paymentMethod.iban")}`,
        amount: "$5.00",
      })
    )
  })

  test("names a payment without a number by its time", () => {
    const label = labelOf(payment("a", { number: null }))
    expect(label).toContain(t("paymentDetail.paymentMethod.cash"))
    expect(label).toContain("$5.00")
    expect(label).not.toContain("#")
  })
})
