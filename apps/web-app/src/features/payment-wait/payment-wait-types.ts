import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type { QerkoPaymentFailureReason } from "@payky/core/integrations/qerko/qerko-client"
import type {
  AccountId,
  BankQrFormat,
} from "@payky/core/modules/account/account-types"
import type { DefaultPaymentMethod } from "@payky/core/modules/app-settings/app-settings-types"
import type { BankQrPayload } from "@payky/core/modules/payment/payment-iban-qr-payload-utils"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import type {
  FiatCurrency,
  NonNegativeInteger,
} from "@payky/core/modules/shared/schema"
import type { ReactNode } from "react"

export type PaymentMethodTab =
  | "spark"
  | "iban"
  | "cash"
  | "card"
  | "qerko"
  | "qerkoPayment"
  | "cashu"
  | "lightningAddress"

export interface PaymentMethodOptionBase {
  readonly kind: DefaultPaymentMethod
  readonly accountId: AccountId
  readonly label: string
  readonly icon: ReactNode
}

export type PaymentMethodOption = PaymentMethodOptionBase &
  (
    | { readonly id: "spark"; readonly qrPayload: string | null }
    | {
        readonly id: "iban"
        readonly qrPayload: string | null
        readonly qrPayloads: ReadonlyArray<BankQrPayload>
        readonly defaultQrFormat: BankQrFormat
        readonly iban: string | null
      }
    | { readonly id: "cash"; readonly qrPayload: null }
    | { readonly id: "card"; readonly qrPayload: null }
    | { readonly id: "qerko"; readonly qrPayload: null }
    | {
        readonly id: "qerkoPayment"
        /** Qerko's QR for the restaurant and this payment, once prepared. */
        readonly qrPayload: string | null
        /** The device serving Qerko payments, `null` when none does. */
        readonly connectionDeviceId: string | null
      }
    | {
        readonly id: "cashu"
        /** The BIP-321 URI with the mint's invoice (and later a NUT-18 request). */
        readonly qrPayload: string | null
        /** The mint quote expired: the tab offers a new one. */
        readonly quoteExpired: boolean
      }
    | {
        readonly id: "lightningAddress"
        /** The invoice the merchant's own wallet issued. */
        readonly qrPayload: string | null
      }
  )

export interface CashPaymentTabProps {
  readonly amount: NonNegativeInteger
  readonly currency: FiatCurrency
  readonly canMarkCashPaid: boolean
  readonly cashPaymentErrorKey: TranslationKey | null
  readonly cashPaymentPending: boolean
  readonly cashRegisterAccountId: AccountId | null | undefined
  readonly onMarkCashPaid: (receivedAmount: NonNegativeInteger) => void
}

export interface CardPaymentTabProps {
  readonly canPayCard: boolean
  readonly cardPaymentErrorKey: TranslationKey | null
  readonly cardPaymentPending: boolean
  readonly cardAccountId: AccountId | null | undefined
  /** Set while the last terminal attempt's outcome is unknown. */
  readonly cardUnresolvedTransactionId: string | null | undefined
  readonly onPayCard: () => void
}

/** What the Qerko tab needs of the payment: its attempt markers live in its own row. */
export interface QerkoPaymentTabProps {
  readonly qerkoPaymentId: PaymentId
  readonly qerkoAccountId: AccountId | null | undefined
  readonly qerkoPayable: boolean
  readonly qerkoPendingTransactionId: string | null | undefined
  readonly qerkoUnresolvedTransactionId: string | null | undefined
  readonly qerkoFailureReason: QerkoPaymentFailureReason | null | undefined
}

export interface IbanPaidTabProps {
  readonly canMarkIbanPaid: boolean
  readonly ibanPaymentErrorKey: TranslationKey | null
  readonly ibanPaymentPending: boolean
  readonly ibanVariableSymbol: string | null
  readonly onMarkIbanPaid: () => void
}
