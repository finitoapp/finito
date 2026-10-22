import { NonNegativeInteger } from "@payky/core/modules/shared/schema"
import { describe, expect, test } from "vitest"
import { guestPaidQuestion } from "./bill-edit-question.ts"
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

const beerAndWine = {
  lineNames: ["Beer", "Wine"],
  guestPaid: NonNegativeInteger(4500),
}

describe("guestPaidQuestion", () => {
  test("removing what guests paid for names the lines and the money", () => {
    expect(guestPaidQuestion(beerAndWine, "edit", text)).toEqual({
      title: t("bill.guestPaid.remove.title", { names: "Beer + Wine" }),
      description: t("bill.guestPaid.description", {
        amount: "$45.00",
        names: "Beer + Wine",
      }),
    })
    expect(guestPaidQuestion(beerAndWine, "split", text).title).toBe(
      t("bill.guestPaid.split.title", { names: "Beer + Wine" })
    )
  })
})
