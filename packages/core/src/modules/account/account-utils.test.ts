import { describe, expect, test } from "vitest"

import { SparkSecret } from "../shared/key-derivation.ts"
import {
  type FiatCurrency,
  IbanSchema,
  NonEmptyString255,
} from "../shared/schema.ts"
import type { AccountKind } from "./account-types.ts"
import {
  derivePaymentMethodsOffered,
  normalizeMnemonic,
  type PaymentMethodAccount,
} from "./account-utils.ts"

describe("normalizeMnemonic", () => {
  test("collapses internal whitespace runs to a single space", () => {
    expect(normalizeMnemonic("abandon   ability\tabout\nabove")).toBe(
      "abandon ability about above"
    )
  })

  test("trims leading and trailing whitespace", () => {
    expect(normalizeMnemonic("  abandon ability  ")).toBe("abandon ability")
  })

  test("leaves an already-normalized mnemonic unchanged", () => {
    expect(normalizeMnemonic("abandon ability able")).toBe(
      "abandon ability able"
    )
  })
})

describe("derivePaymentMethodsOffered", () => {
  /** An account of `kind` turned on, set up in `currency`. */
  const account = (
    kind: AccountKind,
    currency: FiatCurrency = "CZK"
  ): PaymentMethodAccount => ({
    kind,
    sparkSecret:
      kind === "spark" ? SparkSecret("42373a7543db65ae0228ead6c9cbffcc") : null,
    iban:
      kind === "iban" ? IbanSchema.decode("CZ6508000000192000145399") : null,
    ibanCurrency: kind === "iban" ? currency : null,
    cashRegisterCurrency: kind === "cashRegister" ? currency : null,
    cardCurrency: kind === "cardSwitchio" ? currency : null,
    qerkoTerminalCurrency: kind === "qerkoTerminal" ? currency : null,
    qerkoPaymentCurrency: kind === "qerkoPayment" ? currency : null,
    lightningAddress:
      kind === "lightningAddress"
        ? NonEmptyString255("cafe@example.com")
        : null,
  })

  test("offers each kind turned on once, in the payment's currency where the kind has one", () => {
    expect(
      derivePaymentMethodsOffered({
        accounts: [
          account("cashRegister"),
          account("cashRegister", "EUR"),
          account("iban", "EUR"),
          account("cardSwitchio"),
          account("spark"),
          account("cashu"),
          account("lightningAddress"),
        ],
        currency: "CZK",
        cardTerminalLinked: true,
        qerkoRestaurantPaired: true,
      })
    ).toEqual([
      "cashRegister",
      "cardSwitchio",
      "spark",
      "cashu",
      "lightningAddress",
    ])
  })

  test("leaves out an account not set up enough to take money", () => {
    expect(
      derivePaymentMethodsOffered({
        accounts: [
          { ...account("spark"), sparkSecret: null },
          { ...account("iban"), iban: null },
          { ...account("lightningAddress"), lightningAddress: null },
        ],
        currency: "CZK",
        cardTerminalLinked: true,
        qerkoRestaurantPaired: true,
      })
    ).toEqual([])
  })

  test("leaves out the card terminal where the device cannot drive it, and Qerko payments without a paired restaurant", () => {
    const accounts = [
      account("cashRegister"),
      account("cardSwitchio"),
      account("qerkoPayment"),
    ]
    expect(
      derivePaymentMethodsOffered({
        accounts,
        currency: "CZK",
        cardTerminalLinked: false,
        qerkoRestaurantPaired: false,
      })
    ).toEqual(["cashRegister"])
    expect(
      derivePaymentMethodsOffered({
        accounts,
        currency: "CZK",
        cardTerminalLinked: true,
        qerkoRestaurantPaired: true,
      })
    ).toEqual(["cashRegister", "cardSwitchio", "qerkoPayment"])
  })
})
