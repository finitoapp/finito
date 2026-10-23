import { SelfPayReferenceSchema } from "@payky/core/modules/table-self-pay/table-self-pay-reference-utils"
import type { SelfPayViewBill } from "@payky/core/modules/table-self-pay/table-self-pay-view-utils"
import { expect, test } from "vitest"
import { guestTipAmount } from "./guest-share-choice.ts"
import {
  type GuestTipChoice,
  isCustomTipUnreadable,
  NO_TIP,
  resolveGuestTip,
} from "./guest-tip-picker.tsx"

const bill: SelfPayViewBill = {
  reference: SelfPayReferenceSchema.decode("8304853767"),
  currency: "CZK",
  total: 288_000,
  covered: 0,
  remainder: 288_000,
  lines: [],
}

const share = 144_000

const customTip = (choice: Partial<GuestTipChoice>): GuestTipChoice => ({
  ...NO_TIP,
  option: "custom",
  ...choice,
})

const tipOn = (choice: GuestTipChoice) =>
  guestTipAmount(share, resolveGuestTip(choice, bill))

test("a custom tip typed as 50 is 50.00 of the bill's currency", () => {
  const tip = tipOn(customTip({ customText: "50" }))

  expect(tip).toBe(5_000)
  expect(share + tip).toBe(149_000)
})

test("a custom tip switched to percent reads 5 as five percent of the share", () => {
  expect(tipOn(customTip({ customUnit: "percent", customText: "5" }))).toBe(
    7_200
  )
})

test("a custom tip that cannot be read is named instead of counting as no tip", () => {
  expect(isCustomTipUnreadable(customTip({ customText: "12.345" }), bill)).toBe(
    true
  )
  expect(
    isCustomTipUnreadable(
      customTip({ customUnit: "percent", customText: "9".repeat(400) }),
      bill
    )
  ).toBe(true)
  expect(
    isCustomTipUnreadable(
      customTip({ customUnit: "percent", customText: "abc" }),
      bill
    )
  ).toBe(true)
  expect(isCustomTipUnreadable(customTip({ customText: "" }), bill)).toBe(false)
  expect(isCustomTipUnreadable(customTip({ customText: "50,5" }), bill)).toBe(
    false
  )
  expect(isCustomTipUnreadable({ ...NO_TIP, customText: "abc" }, bill)).toBe(
    false
  )
})
