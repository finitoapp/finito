import { describe, expect, test } from "vitest"

import type { DefaultPaymentMethod } from "./app-settings-types.ts"
import {
  defaultPaymentMethodOrder,
  getFiatCurrency,
  getPaymentMethodOrder,
  parseEnabledHomeModes,
  parsePaymentMethodOrder,
  resolveTerminalHomeMode,
} from "./app-settings-utils.ts"

describe("parsePaymentMethodOrder", () => {
  test("falls back to the default order for null/undefined", () => {
    expect(parsePaymentMethodOrder(null)).toEqual(defaultPaymentMethodOrder)
    expect(parsePaymentMethodOrder(undefined)).toEqual(
      defaultPaymentMethodOrder
    )
  })

  test("falls back to the default order for invalid JSON", () => {
    expect(parsePaymentMethodOrder("not json")).toEqual(
      defaultPaymentMethodOrder
    )
  })

  test("falls back to the default order when the JSON isn't a method array", () => {
    expect(parsePaymentMethodOrder("{}")).toEqual(defaultPaymentMethodOrder)
    expect(parsePaymentMethodOrder('["unknownMethod"]')).toEqual(
      defaultPaymentMethodOrder
    )
    expect(parsePaymentMethodOrder('["iban","unknownMethod","spark"]')).toEqual(
      defaultPaymentMethodOrder
    )
  })

  test("preserves a valid stored order", () => {
    expect(
      parsePaymentMethodOrder('["iban","spark","cashRegister","cardSwitchio"]')
    ).toEqual([
      "iban",
      "spark",
      "cashRegister",
      "cardSwitchio",
      "qerkoTerminal",
      "qerkoPayment",
      "cashu",
      "lightningAddress",
    ])
  })

  test("dedups repeated methods, keeping the first occurrence", () => {
    expect(
      parsePaymentMethodOrder(
        '["iban","iban","spark","cashRegister","cardSwitchio"]'
      )
    ).toEqual([
      "iban",
      "spark",
      "cashRegister",
      "cardSwitchio",
      "qerkoTerminal",
      "qerkoPayment",
      "cashu",
      "lightningAddress",
    ])
  })

  test("appends methods missing from a partial stored order", () => {
    expect(parsePaymentMethodOrder('["iban"]')).toEqual([
      "iban",
      ...defaultPaymentMethodOrder.filter((method) => method !== "iban"),
    ])
  })
})

describe("getPaymentMethodOrder", () => {
  test("moves the default method to the front", () => {
    expect(
      getPaymentMethodOrder({
        paymentMethodOrderJson: '["iban","cashRegister","spark"]',
        defaultPaymentMethod: "spark",
      })
    ).toEqual([
      "spark",
      "iban",
      "cashRegister",
      "cardSwitchio",
      "qerkoTerminal",
      "qerkoPayment",
      "cashu",
      "lightningAddress",
    ])
  })

  test("falls back to the default order without settings", () => {
    expect(getPaymentMethodOrder(undefined)).toEqual(defaultPaymentMethodOrder)
  })

  test("keeps the stored order when the default method is one this build does not know", () => {
    expect(
      getPaymentMethodOrder({
        paymentMethodOrderJson: '["iban","cashRegister","spark"]',
        // Written by a build with one more method than this one knows.
        defaultPaymentMethod: "futureMethod" as DefaultPaymentMethod,
      })
    ).toEqual([
      "iban",
      "cashRegister",
      "spark",
      "cardSwitchio",
      "qerkoTerminal",
      "qerkoPayment",
      "cashu",
      "lightningAddress",
    ])
  })
})

describe("parseEnabledHomeModes", () => {
  test("treats an unset value as every mode", () => {
    expect(parseEnabledHomeModes(null)).toEqual(["numpad", "pos"])
    expect(parseEnabledHomeModes(undefined)).toEqual(["numpad", "pos"])
  })

  test("treats an unreadable or empty value as every mode", () => {
    expect(parseEnabledHomeModes("not json")).toEqual(["numpad", "pos"])
    expect(parseEnabledHomeModes('["unknownMode"]')).toEqual(["numpad", "pos"])
    expect(parseEnabledHomeModes("[]")).toEqual(["numpad", "pos"])
  })

  test("keeps the stored modes in their fixed order, without duplicates", () => {
    expect(parseEnabledHomeModes('["pos"]')).toEqual(["pos"])
    expect(parseEnabledHomeModes('["pos","numpad","pos"]')).toEqual([
      "numpad",
      "pos",
    ])
  })
})

describe("resolveTerminalHomeMode", () => {
  test("keeps the remembered mode while it is enabled", () => {
    expect(resolveTerminalHomeMode("pos", ["numpad", "pos"])).toBe("pos")
  })

  test("falls back to the first enabled mode when the remembered one is disabled", () => {
    expect(resolveTerminalHomeMode("pos", ["numpad"])).toBe("numpad")
    expect(resolveTerminalHomeMode("numpad", ["pos"])).toBe("pos")
  })
})

describe("getFiatCurrency", () => {
  test("takes the account's currency, or CZK before its settings exist", () => {
    expect(getFiatCurrency({ fiatCurrency: "EUR" })).toBe("EUR")
    expect(getFiatCurrency({ fiatCurrency: null })).toBe("CZK")
    expect(getFiatCurrency(undefined)).toBe("CZK")
  })
})
