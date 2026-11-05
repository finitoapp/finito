import type { TranslationKey } from "@payky/app-shared/i18n/resources"
import type { BankQrFormat } from "@payky/core/modules/account/account-types"
import type { PaymentId } from "@payky/core/modules/payment/payment-types"
import { BoltCardReader } from "@/features/payment-wait/payment-wait-bolt-card.tsx"
import { CardPaymentTab } from "@/features/payment-wait/payment-wait-card-tab.tsx"
import { CashPaymentTab } from "@/features/payment-wait/payment-wait-cash-tab.tsx"
import { CashuPaymentTab } from "@/features/payment-wait/payment-wait-cashu-tab.tsx"
import { IbanPaymentTab } from "@/features/payment-wait/payment-wait-iban-tab.tsx"
import { LightningAddressPaymentTab } from "@/features/payment-wait/payment-wait-lightning-address-tab.tsx"
import { QerkoPaymentTab as QerkoQrPaymentTab } from "@/features/payment-wait/payment-wait-qerko-payment-tab.tsx"
import { QerkoPaymentTab } from "@/features/payment-wait/payment-wait-qerko-tab.tsx"
import { QrPaymentRequest } from "@/features/payment-wait/payment-wait-qr-request.tsx"
import type {
  CardPaymentTabProps,
  CashPaymentTabProps,
  IbanPaidTabProps,
  PaymentMethodOption,
  QerkoPaymentTabProps,
} from "@/features/payment-wait/payment-wait-types.ts"

export function PaymentMethodTabContent({
  method,
  boltCardPaymentId,
  amount,
  currency,
  canMarkCashPaid,
  cashPaymentErrorKey,
  cashPaymentPending,
  cashRegisterAccountId,
  canPayCard,
  cardPaymentErrorKey,
  cardPaymentPending,
  cardAccountId,
  cardUnresolvedTransactionId,
  canMarkIbanPaid,
  ibanPaymentErrorKey,
  ibanPaymentPending,
  ibanVariableSymbol,
  preparingMessageKey,
  selectedIbanQrFormat,
  onSelectIbanQrFormat,
  onMarkCashPaid,
  onMarkIbanPaid,
  onPayCard,
  qerkoPaymentId,
  qerkoAccountId,
  qerkoPayable,
  qerkoPendingTransactionId,
  qerkoUnresolvedTransactionId,
  qerkoFailureReason,
  paymentId,
  paymentCreatedAt,
  payable,
  newCashuQuotePending,
  onNewCashuQuote,
}: {
  readonly method: PaymentMethodOption
  readonly paymentId: PaymentId
  readonly paymentCreatedAt: string | null
  /**
   * The payment is still waiting for money, so a tab may watch for it — the
   * Lightning address tab polls its wallet, the IBAN tab may ask the bank.
   */
  readonly payable: boolean
  readonly newCashuQuotePending: boolean
  readonly onNewCashuQuote: () => void
  /** Set while a Bolt Card may pay this payment's Lightning invoice. */
  readonly boltCardPaymentId: PaymentId | null
  readonly preparingMessageKey: TranslationKey | null
  readonly selectedIbanQrFormat: BankQrFormat | null
  readonly onSelectIbanQrFormat: (format: BankQrFormat) => void
} & CashPaymentTabProps &
  CardPaymentTabProps &
  QerkoPaymentTabProps &
  IbanPaidTabProps) {
  switch (method.id) {
    case "spark":
      return (
        <>
          <QrPaymentRequest
            qrPayload={method.qrPayload}
            preparingMessageKey={preparingMessageKey}
          />
          {boltCardPaymentId !== null ? (
            <BoltCardReader paymentId={boltCardPaymentId} />
          ) : null}
        </>
      )
    case "iban":
      return (
        <IbanPaymentTab
          paymentId={paymentId}
          accountId={method.accountId}
          createdAt={paymentCreatedAt}
          payable={payable}
          defaultQrFormat={method.defaultQrFormat}
          qrPayload={method.qrPayload}
          qrPayloads={method.qrPayloads}
          iban={method.iban}
          preparingMessageKey={preparingMessageKey}
          selectedQrFormat={selectedIbanQrFormat}
          onSelectQrFormat={onSelectIbanQrFormat}
          canMarkIbanPaid={canMarkIbanPaid}
          ibanPaymentErrorKey={ibanPaymentErrorKey}
          ibanPaymentPending={ibanPaymentPending}
          ibanVariableSymbol={ibanVariableSymbol}
          onMarkIbanPaid={onMarkIbanPaid}
        />
      )
    case "cash":
      return (
        <CashPaymentTab
          amount={amount}
          currency={currency}
          canMarkCashPaid={canMarkCashPaid}
          cashPaymentErrorKey={cashPaymentErrorKey}
          cashPaymentPending={cashPaymentPending}
          cashRegisterAccountId={cashRegisterAccountId}
          onMarkCashPaid={onMarkCashPaid}
        />
      )
    case "cashu":
      return (
        <CashuPaymentTab
          paymentId={paymentId}
          qrPayload={method.qrPayload}
          quoteExpired={method.quoteExpired}
          preparingMessageKey={preparingMessageKey}
          newQuotePending={newCashuQuotePending}
          onNewQuote={onNewCashuQuote}
        />
      )
    case "lightningAddress":
      return (
        <LightningAddressPaymentTab
          paymentId={paymentId}
          qrPayload={method.qrPayload}
          payable={payable}
          boltCardPaymentId={boltCardPaymentId}
          preparingMessageKey={preparingMessageKey}
        />
      )
    case "qerko":
      return (
        <QerkoPaymentTab
          paymentId={qerkoPaymentId}
          accountId={qerkoAccountId}
          payable={qerkoPayable}
          pendingTransactionId={qerkoPendingTransactionId}
          unresolvedTransactionId={qerkoUnresolvedTransactionId}
          failureReason={qerkoFailureReason}
        />
      )
    case "qerkoPayment":
      return (
        <QerkoQrPaymentTab
          paymentId={paymentId}
          qrPayload={method.qrPayload}
          payable={payable}
          connectionDeviceId={method.connectionDeviceId}
          preparingMessageKey={preparingMessageKey}
        />
      )
    case "card":
      return (
        <CardPaymentTab
          canPayCard={canPayCard}
          cardPaymentErrorKey={cardPaymentErrorKey}
          cardPaymentPending={cardPaymentPending}
          cardAccountId={cardAccountId}
          cardUnresolvedTransactionId={cardUnresolvedTransactionId}
          onPayCard={onPayCard}
        />
      )
  }
}
