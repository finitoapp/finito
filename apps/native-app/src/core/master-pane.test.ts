import { describe, expect, it } from "vitest"
import { hrefPath, isDetailOf } from "./master-pane.ts"

describe("master pane (navigation/0002)", () => {
  it("reads the path of a string or an object href, its params filled in", () => {
    expect(hrefPath("/settings/language")).toBe("/settings/language")
    expect(hrefPath("/bill?billId=abc")).toBe("/bill")
    expect(
      hrefPath({
        pathname: "/settings/items/[catalogItemId]",
        params: { catalogItemId: "abc" },
      })
    ).toBe("/settings/items/abc")
  })

  it("marks the row of the detail shown, and of a screen under it", () => {
    expect(isDetailOf("/settings/language", "/settings/language")).toBe(true)
    expect(
      isDetailOf(
        "/settings/payment-accounts/spark",
        "/settings/payment-accounts"
      )
    ).toBe(true)
    expect(isDetailOf("/settings/payment-accounts", "/settings/payment")).toBe(
      false
    )
    expect(isDetailOf("/settings/items/abc", "/settings/items/abd")).toBe(false)
  })
})
