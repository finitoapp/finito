import { expect, test } from "vitest"
import { guestTipAmount } from "./guest-share-choice.ts"
import {
  type GuestTipChoice,
  isCustomTipUnreadable,
  NO_TIP,
  resolveGuestTip,
} from "./guest-tip-picker.tsx"

const currency = "CZK"

const share = 144_000

const customTip = (choice: Partial<GuestTipChoice>): GuestTipChoice => ({
  ...NO_TIP,
  option: "custom",
  ...choice,
})

const tipOn = (choice: GuestTipChoice) =>
  guestTipAmount(share, resolveGuestTip(choice, currency))

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
  expect(
    isCustomTipUnreadable(customTip({ customText: "12.345" }), currency)
  ).toBe(true)
  expect(
    isCustomTipUnreadable(
      customTip({ customUnit: "percent", customText: "9".repeat(400) }),
      currency
    )
  ).toBe(true)
  expect(
    isCustomTipUnreadable(
      customTip({ customUnit: "percent", customText: "abc" }),
      currency
    )
  ).toBe(true)
  expect(isCustomTipUnreadable(customTip({ customText: "" }), currency)).toBe(
    false
  )
  expect(
    isCustomTipUnreadable(customTip({ customText: "50,5" }), currency)
  ).toBe(false)
  expect(
    isCustomTipUnreadable({ ...NO_TIP, customText: "abc" }, currency)
  ).toBe(false)
})
