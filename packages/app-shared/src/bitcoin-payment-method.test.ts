import type { DefaultPaymentMethod } from "@payky/core/modules/app-settings/app-settings-types"
import { describe, expect, test } from "vitest"
import {
  defaultBitcoinWallet,
  expandPaymentMethodOrder,
  groupPaymentMethodOrder,
  movePaymentMethodGroup,
} from "./bitcoin-payment-method.ts"

describe("one Bitcoin method (settings/0002)", () => {
  test("folds the three wallets into one row where the first of them sits", () => {
    expect(
      groupPaymentMethodOrder([
        "cashRegister",
        "spark",
        "iban",
        "cashu",
        "lightningAddress",
      ])
    ).toEqual(["cashRegister", "bitcoin", "iban"])
  })

  test("expands the row back to the wallets in their stored order", () => {
    const order: ReadonlyArray<DefaultPaymentMethod> = [
      "cashRegister",
      "spark",
      "iban",
      "cashu",
      "lightningAddress",
    ]
    expect(
      expandPaymentMethodOrder(["iban", "bitcoin", "cashRegister"], order)
    ).toEqual(["iban", "spark", "cashu", "lightningAddress", "cashRegister"])
  })

  test("moves the Bitcoin row as one, past a method or not at all at the edge", () => {
    const order: ReadonlyArray<DefaultPaymentMethod> = [
      "cashRegister",
      "cashu",
      "spark",
      "lightningAddress",
      "iban",
    ]
    expect(movePaymentMethodGroup(order, 1, 1)).toEqual([
      "cashRegister",
      "iban",
      "cashu",
      "spark",
      "lightningAddress",
    ])
    expect(movePaymentMethodGroup(order, 0, -1)).toBeUndefined()
    expect(movePaymentMethodGroup(order, 2, 1)).toBeUndefined()
  })

  test("starts on Spark for now (settings/0003)", () => {
    expect(defaultBitcoinWallet).toBe("spark")
  })
})
