import { type Version as PayBySquareVersion, Version } from "bysquare"
import {
  encode,
  type Payment as PayBySquarePayment,
  PaymentOptions,
} from "bysquare/pay"
import {
  type BankQrFormat,
  BankQrFormatSchema,
} from "../account/account-types.ts"
import { minorUnitsToFixedDecimalString } from "../shared/money.ts"
import {
  type Currency,
  Integer,
  type NonEmptyString,
  NonEmptyStringSchema,
  type SpecificSymbol,
  type VariableSymbol,
} from "../shared/schema.ts"

export interface BankQrPayload {
  readonly format: BankQrFormat
  readonly payload: NonEmptyString
}

export const bankQrFormats: ReadonlyArray<BankQrFormat> =
  BankQrFormatSchema.options

export const isBankQrFormat = (
  value: string | undefined
): value is BankQrFormat => BankQrFormatSchema.safeParse(value).success

/**
 * SPAYD 1.0 caps the recipient name (`RN`) at 35 characters, and no value may
 * hold `*`, the field separator: the spec percent-encodes it, so `%` has to
 * be encoded first to stay unambiguous.
 */
const spaydRecipientNameMaxLength = 35
const toSpaydRecipientName = (name: string): string =>
  name
    .slice(0, spaydRecipientNameMaxLength)
    .replaceAll("%", "%25")
    .replaceAll("*", "%2A")

const createSpaydQrPayload = ({
  publicName,
  iban,
  amount,
  currency,
  specificSymbol,
  variableSymbol,
}: {
  readonly publicName: string | null
  readonly iban: string
  readonly amount: number
  readonly currency: Currency
  readonly specificSymbol: SpecificSymbol | null
  readonly variableSymbol: VariableSymbol | null
}): NonEmptyString =>
  NonEmptyStringSchema.decode(
    [
      "SPD",
      "1.0",
      `ACC:${iban}`,
      // Fixed-width, not `minorUnitsToDecimalString`: that one strips trailing
      // zeros, turning every whole-crown bill's `AM:129.00` into `AM:129`.
      // Both are valid SPAYD, but not a change worth making to a payload
      // already in the field and read by other people's scanners.
      `AM:${minorUnitsToFixedDecimalString({ value: Integer(amount), currency })}`,
      `CC:${currency}`,
      "PT:IP",
      publicName === null ? null : `RN:${toSpaydRecipientName(publicName)}`,
      variableSymbol ? `X-VS:${variableSymbol}` : null,
      specificSymbol ? `X-SS:${specificSymbol}` : null,
    ]
      .filter((part) => part !== null)
      .join("*")
  )

const createPayBySquareQrPayload = ({
  publicName,
  bankAccountName,
  iban,
  amount,
  currency,
  specificSymbol,
  variableSymbol,
  version,
}: {
  readonly publicName: string | null
  readonly bankAccountName: string
  readonly iban: string
  readonly amount: number
  readonly currency: Currency
  readonly specificSymbol: SpecificSymbol | null
  readonly variableSymbol: VariableSymbol | null
  readonly version: PayBySquareVersion
}): NonEmptyString =>
  NonEmptyStringSchema.decode(
    encode(
      {
        payments: [
          {
            type: PaymentOptions.PaymentOrder,
            amount: Number(
              minorUnitsToFixedDecimalString({
                value: Integer(amount),
                currency,
              })
            ),
            currencyCode: currency,
            // Pay by square requires a beneficiary name, so without a public
            // name the payment method's own name stands in.
            beneficiary: { name: publicName ?? bankAccountName },
            bankAccounts: [{ iban }],
            ...(variableSymbol ? { variableSymbol } : {}),
            ...(specificSymbol ? { specificSymbol } : {}),
          } satisfies PayBySquarePayment,
        ],
      },
      { version }
    )
  )

/**
 * The business's public name is the recipient the customer's banking app
 * shows (payment/0034); `bankAccountName` is the payment method's name, the
 * Pay by square fallback.
 */
const createBankQrPayload = ({
  publicName,
  bankAccountName,
  format,
  iban,
  amount,
  currency,
  specificSymbol,
  variableSymbol,
}: {
  readonly publicName: string | null
  readonly bankAccountName: string
  readonly format: BankQrFormat
  readonly iban: string
  readonly amount: number
  readonly currency: Currency
  readonly specificSymbol: SpecificSymbol | null
  readonly variableSymbol: VariableSymbol | null
}): NonEmptyString =>
  format === "spayd"
    ? createSpaydQrPayload({
        publicName,
        iban,
        amount,
        currency,
        specificSymbol,
        variableSymbol,
      })
    : createPayBySquareQrPayload({
        publicName,
        bankAccountName,
        iban,
        amount,
        currency,
        specificSymbol,
        variableSymbol,
        version:
          format === "payBySquare1_0_0" ? Version["1.0.0"] : Version["1.2.0"],
      })

export const createBankQrPayloads = (
  input: Omit<Parameters<typeof createBankQrPayload>[0], "format">
): ReadonlyArray<BankQrPayload> =>
  bankQrFormats.map((format) => ({
    format,
    payload: createBankQrPayload({
      ...input,
      format,
    }),
  }))
