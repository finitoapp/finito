import type { BankQrFormat } from "@payky/core/modules/account/account-types"
import type { Language } from "@payky/web-shared/landing-redirect"

const payBySquareFor = (accountFormat: BankQrFormat): BankQrFormat =>
  accountFormat === "spayd" ? "payBySquare1_2_0" : accountFormat

export const guestBankQrFormat = (
  language: Language,
  accountFormat: BankQrFormat
): BankQrFormat => {
  const byLanguage = {
    cs: "spayd",
    sk: payBySquareFor(accountFormat),
    en: accountFormat,
  } satisfies Record<Language, BankQrFormat>
  return byLanguage[language]
}

export const otherBankQrFormat = (
  shown: BankQrFormat,
  accountFormat: BankQrFormat
): BankQrFormat => (shown === "spayd" ? payBySquareFor(accountFormat) : "spayd")
