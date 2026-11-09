import { describe, expect, test } from "vitest"

import { guestBankQrFormat, otherBankQrFormat } from "./guest-bank-qr-format.ts"

describe("the guest's bank QR", () => {
  test.each([
    ["spayd", "payBySquare1_2_0"],
    ["payBySquare1_0_0", "payBySquare1_0_0"],
  ] as const)(
    "is PAY by square on a Slovak page, also for an account set to %s",
    (accountFormat, shown) => {
      expect(guestBankQrFormat("sk", accountFormat)).toBe(shown)
    }
  )

  test.each(["spayd", "payBySquare1_2_0"] as const)(
    "is QR Platba on a Czech page, also for an account set to %s",
    (accountFormat) => {
      expect(guestBankQrFormat("cs", accountFormat)).toBe("spayd")
    }
  )

  test.each(["spayd", "payBySquare1_0_0"] as const)(
    "is the account's %s on an English page",
    (accountFormat) => {
      expect(guestBankQrFormat("en", accountFormat)).toBe(accountFormat)
    }
  )

  test("offers PAY by square in the account's version under a QR Platba, and QR Platba under a PAY by square", () => {
    expect(otherBankQrFormat("spayd", "payBySquare1_0_0")).toBe(
      "payBySquare1_0_0"
    )
    expect(otherBankQrFormat("spayd", "spayd")).toBe("payBySquare1_2_0")
    expect(otherBankQrFormat("payBySquare1_2_0", "spayd")).toBe("spayd")
  })
})
