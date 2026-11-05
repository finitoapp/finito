import {
  getPaymentMethodOrder,
  PaymentMethodOrderJson,
} from "@payky/core/modules/app-settings/app-settings-utils"
import { describe, expect, test } from "vitest"
import { z } from "zod"
import {
  createFinishOnboardingInput,
  onboardingPaymentMethodOrder,
  validateOnboardingForm,
} from "./onboarding-utils.ts"

describe("onboarding payment method order", () => {
  test("keeps bank transfer and card before Spark and Cashu after reading settings", () => {
    const order = getPaymentMethodOrder({
      paymentMethodOrderJson: z.encode(
        PaymentMethodOrderJson,
        onboardingPaymentMethodOrder
      ),
      defaultPaymentMethod: onboardingPaymentMethodOrder[0],
    })
    expect(order).toEqual([
      "iban",
      "cardSwitchio",
      "qerkoTerminal",
      "qerkoPayment",
      "spark",
      "cashu",
      "lightningAddress",
      "cashRegister",
    ])
  })
})

describe("validateOnboardingForm", () => {
  test("treats blank inputs as absent, not invalid", () => {
    expect(validateOnboardingForm({ iban: "  ", businessName: "" })).toEqual({
      iban: null,
      ibanInvalid: false,
      businessName: null,
      businessNameInvalid: false,
    })
  })

  test("flags an unfinished bank account and keeps no value", () => {
    const result = validateOnboardingForm({ iban: "123", businessName: "" })
    expect(result.ibanInvalid).toBe(true)
    expect(result.iban).toBeNull()
  })

  test("stores a Czech account number as IBAN", () => {
    const result = validateOnboardingForm({
      iban: "123456/0100",
      businessName: "Linden Café",
    })
    expect(result.ibanInvalid).toBe(false)
    expect(result.iban).toMatch(/^CZ\d{22}$/u)
    expect(result.businessName).toBe("Linden Café")
  })

  test("rejects a name over 255 characters", () => {
    expect(
      validateOnboardingForm({ iban: "", businessName: "x".repeat(256) })
        .businessNameInvalid
    ).toBe(true)
  })
})

describe("createFinishOnboardingInput", () => {
  test("starts Czech in CZK with iban first, with or without a bank account", () => {
    const input = createFinishOnboardingInput({
      iban: null,
      homeMode: "pos",
      tipsEnabled: false,
    })
    expect(input).toMatchObject({
      country: "CZ",
      currency: "CZK",
      iban: null,
      defaultPaymentMethod: "iban",
      homeMode: "pos",
      tipsEnabled: false,
    })
    expect(JSON.parse(input.paymentMethodOrderJson)).toEqual([
      ...onboardingPaymentMethodOrder,
    ])
  })
})
