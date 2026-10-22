import type { BillEditOutcome } from "@payky/core/modules/bill/bill-overpayment-guards"
import { NonNegativeInteger } from "@payky/core/modules/shared/schema"
import { describe, expect, test } from "vitest"
import { billEditQuestion } from "./bill-edit-question.ts"
import { paykyBrand } from "./brand.ts"
import { formatMoney } from "./format-money.ts"
import { createTranslate } from "./i18n/translate.ts"

const t = createTranslate("en", paykyBrand)
const text = {
  t,
  format: (value: NonNegativeInteger) =>
    formatMoney({ value, currency: "USD" }, "en-US"),
  formatList: (items: ReadonlyArray<string>) => items.join(" + "),
}

const staysOpen = { type: "staysOpen" } as const
const paid = { type: "paid" } as const
const overpaid = {
  type: "overpaid",
  unresolved: NonNegativeInteger(500),
} as const

const removesBeerAndWine = (
  after: Exclude<BillEditOutcome, { type: "removesGuestPaid" }>
): BillEditOutcome => ({
  type: "removesGuestPaid",
  lineNames: ["Beer", "Wine"],
  guestPaid: NonNegativeInteger(4500),
  after,
})

describe("billEditQuestion", () => {
  test("an edit that leaves the bill open goes ahead unasked", () => {
    expect(billEditQuestion(staysOpen, "edit", text)).toEqual({
      outcome: staysOpen,
      question: null,
    })
  })

  test("an edit that pays or overpays the bill says so", () => {
    expect(billEditQuestion(paid, "edit", text).question).toEqual({
      title: t("bill.cover.paid.title"),
      description: t("bill.cover.paid.description"),
    })
    expect(billEditQuestion(overpaid, "edit", text).question).toEqual({
      title: t("bill.cover.overpaid.title", { amount: "$5.00" }),
      description: t("bill.cover.overpaid.description"),
    })
  })

  test("a split that pays the bill asks with the split's description", () => {
    expect(billEditQuestion(paid, "split", text).question).toEqual({
      title: t("bill.cover.paid.title"),
      description: t("bill.cover.split.description"),
    })
  })

  test("a split that overpays the bill goes ahead unasked", () => {
    expect(
      billEditQuestion(removesBeerAndWine(overpaid), "split", text)
    ).toEqual({ outcome: overpaid, question: null })
  })

  test("removing what guests paid for names the lines and the money", () => {
    expect(
      billEditQuestion(removesBeerAndWine(staysOpen), "edit", text)
    ).toEqual({
      outcome: staysOpen,
      question: {
        title: t("bill.guestPaid.remove.title", { names: "Beer + Wine" }),
        description: t("bill.guestPaid.description", {
          amount: "$45.00",
          names: "Beer + Wine",
        }),
      },
    })
    expect(
      billEditQuestion(removesBeerAndWine(staysOpen), "split", text).question
        ?.title
    ).toBe(t("bill.guestPaid.split.title", { names: "Beer + Wine" }))
  })

  test("one question says when removing what guests paid for also covers the bill", () => {
    expect(billEditQuestion(removesBeerAndWine(paid), "edit", text)).toEqual({
      outcome: paid,
      question: {
        title: t("bill.cover.paid.title"),
        description: t("bill.guestPaid.description", {
          amount: "$45.00",
          names: "Beer + Wine",
        }),
      },
    })
    expect(
      billEditQuestion(removesBeerAndWine(overpaid), "edit", text).question
        ?.title
    ).toBe(t("bill.cover.overpaid.title", { amount: "$5.00" }))
  })
})
