import { Version } from "bysquare"
import { decode as decodePayBySquare, PaymentOptions } from "bysquare/pay"
import { describe, expect, test } from "vitest"

import { SpecificSymbol, VariableSymbol } from "../shared/schema.ts"
import { createBankQrPayloads } from "./payment-iban-qr-payload-utils.ts"

describe("payment IBAN QR payload utils", () => {
  test("creates SPAYD and Pay by square payloads from bank payment data", () => {
    const payloads = createBankQrPayloads({
      publicName: null,
      bankAccountName: "Slovak bank account",
      iban: "SK9611000000002918599669",
      amount: 12_900,
      currency: "EUR",
      variableSymbol: VariableSymbol("1"),
      specificSymbol: SpecificSymbol("260605"),
    })

    expect(payloads).toMatchObject([
      {
        format: "spayd",
        payload:
          "SPD*1.0*ACC:SK9611000000002918599669*AM:129.00*CC:EUR*PT:IP*X-VS:1*X-SS:260605",
      },
      {
        format: "payBySquare1_0_0",
        payload: expect.not.stringContaining("SPD*"),
      },
      {
        format: "payBySquare1_2_0",
        payload: expect.not.stringContaining("SPD*"),
      },
    ])

    const payBySquarePayloads = payloads.filter(
      (payload) => payload.format !== "spayd"
    )

    expect(payBySquarePayloads).toHaveLength(2)
    for (const payBySquarePayload of payBySquarePayloads) {
      const decoded = decodePayBySquare(payBySquarePayload.payload)
      const payment = decoded.payments[0]
      expect(payment).toMatchObject({
        type: PaymentOptions.PaymentOrder,
        amount: 129,
        currencyCode: "EUR",
        variableSymbol: "1",
        specificSymbol: "260605",
        beneficiary: {
          name: "Slovak bank account",
        },
        bankAccounts: [
          {
            iban: "SK9611000000002918599669",
          },
        ],
      })
    }

    expect(
      payloads.find((payload) => payload.format === "payBySquare1_0_0")?.payload
    ).not.toBe(
      payloads.find((payload) => payload.format === "payBySquare1_2_0")?.payload
    )
  })

  test("writes the chosen Pay by square version into the QR header", () => {
    const payloads = createBankQrPayloads({
      publicName: null,
      bankAccountName: "Slovak bank account",
      iban: "SK9611000000002918599669",
      amount: 12_900,
      currency: "EUR",
      variableSymbol: null,
      specificSymbol: null,
    })
    // The payload is base32hex, which parseInt reads as radix 32: its first
    // two characters are the header's top 10 bits, the version nibble 5..2.
    const headerVersion = (format: string) => {
      const payload = payloads.find((p) => p.format === format)?.payload ?? ""
      return (Number.parseInt(payload.slice(0, 2), 32) >> 2) & 0xf
    }

    expect(headerVersion("payBySquare1_0_0")).toBe(Version["1.0.0"])
    expect(headerVersion("payBySquare1_2_0")).toBe(Version["1.2.0"])
  })

  describe("recipient name", () => {
    const createPayloads = (publicName: string | null) =>
      createBankQrPayloads({
        publicName,
        bankAccountName: "Slovak bank account",
        iban: "SK9611000000002918599669",
        amount: 12_900,
        currency: "EUR",
        variableSymbol: VariableSymbol("1"),
        specificSymbol: null,
      })
    const spaydPayload = (payloads: ReturnType<typeof createPayloads>) =>
      payloads.find((payload) => payload.format === "spayd")?.payload
    const payBySquareBeneficiaries = (
      payloads: ReturnType<typeof createPayloads>
    ) =>
      payloads
        .filter((payload) => payload.format !== "spayd")
        .map(
          (payload) =>
            decodePayBySquare(payload.payload).payments[0]?.beneficiary?.name
        )

    test("names the public name as the recipient", () => {
      const payloads = createPayloads("Kavárna U Lípy")

      expect(spaydPayload(payloads)).toBe(
        "SPD*1.0*ACC:SK9611000000002918599669*AM:129.00*CC:EUR*PT:IP*RN:Kavárna U Lípy*X-VS:1"
      )
      expect(payBySquareBeneficiaries(payloads)).toEqual([
        "Kavárna U Lípy",
        "Kavárna U Lípy",
      ])
    })

    test("leaves SPAYD without a recipient and names the bank account in Pay by square when the business has no public name", () => {
      const payloads = createPayloads(null)

      expect(spaydPayload(payloads)).not.toContain("RN:")
      expect(payBySquareBeneficiaries(payloads)).toEqual([
        "Slovak bank account",
        "Slovak bank account",
      ])
    })

    test("keeps the SPAYD recipient to 35 characters and encodes the field separator", () => {
      const payloads = createPayloads(
        "Kavárna U Lípy * 100% arabica, Praha 1, Staré Město"
      )

      expect(spaydPayload(payloads)).toContain(
        "*RN:Kavárna U Lípy %2A 100%25 arabica, Prah*X-VS:1"
      )
    })
  })
})
