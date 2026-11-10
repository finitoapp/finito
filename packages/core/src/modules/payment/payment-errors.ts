import type { FetchError } from "../../deps.ts"
import { defineError } from "../../error.ts"
import type { LnurlError } from "../../integrations/lnurl/lnurl-client.ts"
import type {
  LightningAddressInvoiceMismatchError,
  LightningAddressVerifyUnsupportedError,
} from "../../integrations/lnurl/lnurl-pay-client.ts"
import type { RedeemLnurlWithdrawError } from "../../integrations/lnurl/lnurl-withdraw-client.ts"
import type {
  QerkoClientError,
  QerkoNotStartedReason,
  QerkoPaymentFailureReason,
} from "../../integrations/qerko/qerko-client.ts"
import type {
  YadioApiError,
  YadioHttpError,
} from "../../integrations/yadio/yadio-client.ts"
import type { SwitchioPaymentError } from "../../switchio.ts"
import type { AccountId } from "../account/account-types.ts"
import type {
  BillNotFoundError,
  BillStatusNotAllowedError,
} from "../bill/bill-guards.ts"
import type { QerkoPluginNotPairedError } from "../qerko-plugin/qerko-plugin-actions.ts"
import type {
  FiatCurrency,
  NonEmptyString255,
  NonNegativeInteger,
} from "../shared/schema.ts"
import type {
  PaymentAccountKind,
  PaymentId,
  PaymentStatus,
} from "./payment-types.ts"

export type CreatePaymentError = BillNotFoundError | BillStatusNotAllowedError

export const createPaymentNotFoundError = defineError("PaymentNotFound")<{
  readonly id: PaymentId
}>()
export type PaymentNotFoundError = ReturnType<typeof createPaymentNotFoundError>

export const createPaymentAlreadyPaidError = defineError("PaymentAlreadyPaid")<{
  readonly id: PaymentId
}>()
export type PaymentAlreadyPaidError = ReturnType<
  typeof createPaymentAlreadyPaidError
>

export const createPaymentNotCanceledError = defineError("PaymentNotCanceled")<{
  readonly id: PaymentId
}>()
export type PaymentNotCanceledError = ReturnType<
  typeof createPaymentNotCanceledError
>

/**
 * Staff tried to record money for a payment they had already canceled. The
 * automatic matcher still claims money that arrives after a cancellation
 * (payment/0004); a person confirming it by hand is contradicting their own
 * cancellation instead, so that is refused.
 */
export const createPaymentCanceledError = defineError("PaymentCanceled")<{
  readonly id: PaymentId
}>()
export type PaymentCanceledError = ReturnType<typeof createPaymentCanceledError>

export const createPaymentNotClaimedError = defineError("PaymentNotClaimed")<{
  readonly id: PaymentId
}>()
export type PaymentNotClaimedError = ReturnType<
  typeof createPaymentNotClaimedError
>

export const createAccountSparkNotFoundError = defineError(
  "AccountSparkNotFound"
)<{
  readonly id: AccountId
}>()
export type AccountSparkNotFoundError = ReturnType<
  typeof createAccountSparkNotFoundError
>

export const createPaymentPreparationFailedError = defineError(
  "PaymentPreparationFailed"
)<{
  readonly message: string
}>()
export type PaymentPreparationFailedError = ReturnType<
  typeof createPaymentPreparationFailedError
>

export const createZeroAmountNotPayableError = defineError(
  "ZeroAmountNotPayable"
)<{
  readonly amount: number
}>()
export type ZeroAmountNotPayableError = ReturnType<
  typeof createZeroAmountNotPayableError
>

export const createPaymentNumberNotFoundError = defineError(
  "PaymentNumberNotFound"
)<{
  readonly paymentId: PaymentId
}>()
export type PaymentNumberNotFoundError = ReturnType<
  typeof createPaymentNumberNotFoundError
>

export const createCashRegisterAccountNotFoundError = defineError(
  "CashRegisterAccountNotFound"
)<{
  readonly id: AccountId
}>()
export type CashRegisterAccountNotFoundError = ReturnType<
  typeof createCashRegisterAccountNotFoundError
>

export const createIbanAccountNotFoundError = defineError(
  "IbanAccountNotFound"
)<{
  readonly id: AccountId
}>()
export type IbanAccountNotFoundError = ReturnType<
  typeof createIbanAccountNotFoundError
>

export const createCardSwitchioAccountNotFoundError = defineError(
  "CardSwitchioAccountNotFound"
)<{
  readonly id: AccountId
}>()
export type CardSwitchioAccountNotFoundError = ReturnType<
  typeof createCardSwitchioAccountNotFoundError
>

export const createQerkoTerminalAccountNotFoundError = defineError(
  "QerkoTerminalAccountNotFound"
)<{
  readonly id: AccountId
}>()
export type QerkoTerminalAccountNotFoundError = ReturnType<
  typeof createQerkoTerminalAccountNotFoundError
>

export const createQerkoPaymentAccountNotFoundError = defineError(
  "QerkoPaymentAccountNotFound"
)<{
  readonly id: AccountId
}>()
export type QerkoPaymentAccountNotFoundError = ReturnType<
  typeof createQerkoPaymentAccountNotFoundError
>

export const createAccountCurrencyMismatchError = defineError(
  "AccountCurrencyMismatch"
)<{
  readonly accountKind: PaymentAccountKind
  readonly id: AccountId
  readonly accountCurrency: FiatCurrency
  readonly paymentCurrency: FiatCurrency
}>()
export type AccountCurrencyMismatchError = ReturnType<
  typeof createAccountCurrencyMismatchError
>

export type CreatePreparedPaymentError =
  | AccountSparkNotFoundError
  | ZeroAmountNotPayableError
  | PaymentPreparationFailedError
  | YadioHttpError
  | YadioApiError
  | FetchError
  | CreatePaymentError

export const createCashReceivedBelowChargeError = defineError(
  "CashReceivedBelowCharge"
)<{
  readonly receivedAmount: NonNegativeInteger
  readonly leastReceivedAmount: NonNegativeInteger
}>()
export type CashReceivedBelowChargeError = ReturnType<
  typeof createCashReceivedBelowChargeError
>

export type MarkPaymentPaidCashError =
  | PaymentNotFoundError
  | PaymentCanceledError
  | CashRegisterAccountNotFoundError
  | AccountCurrencyMismatchError
  | CashReceivedBelowChargeError

export type MarkPaymentPaidIbanError =
  | PaymentNotFoundError
  | PaymentCanceledError
  | IbanAccountNotFoundError
  | AccountCurrencyMismatchError

/**
 * A card payment was requested for a payment that can no longer take money
 * — already paid (possibly through another method on the same payment),
 * canceled or expired. Raised before the terminal is asked, so no card is
 * charged.
 */
export const createPaymentNotPayableError = defineError("PaymentNotPayable")<{
  readonly id: PaymentId
  readonly status: Exclude<PaymentStatus, "pending">
}>()
export type PaymentNotPayableError = ReturnType<
  typeof createPaymentNotPayableError
>

/**
 * The previous terminal attempt's outcome is unknown, so the card may have
 * been charged already. Another attempt needs staff to have checked
 * SwitchioPay first and to retry explicitly.
 */
export const createSwitchioAttemptUnresolvedError = defineError(
  "SwitchioAttemptUnresolved"
)<{
  readonly id: PaymentId
  readonly transactionId: NonEmptyString255
}>()
export type SwitchioAttemptUnresolvedError = ReturnType<
  typeof createSwitchioAttemptUnresolvedError
>

/**
 * A SwitchioPay result restored after an app restart names no request id
 * this device launched — or none at all — so it cannot be tied to a payment.
 */
export const createSwitchioRestoredResultUnmatchedError = defineError(
  "SwitchioRestoredResultUnmatched"
)<{
  readonly transactionId: string | null
}>()
export type SwitchioRestoredResultUnmatchedError = ReturnType<
  typeof createSwitchioRestoredResultUnmatchedError
>

export type PayPaymentWithSwitchioCardError =
  | PaymentNotFoundError
  | PaymentNotPayableError
  | SwitchioAttemptUnresolvedError
  | CardSwitchioAccountNotFoundError
  | AccountCurrencyMismatchError
  | SwitchioPaymentError

/**
 * A Bolt Card was tapped for a payment with no Lightning invoice — a Spark
 * invoice alone cannot be handed to an LNURL-withdraw service.
 */
export const createPaymentLightningInvoiceNotFoundError = defineError(
  "PaymentLightningInvoiceNotFound"
)<{
  readonly id: PaymentId
}>()
export type PaymentLightningInvoiceNotFoundError = ReturnType<
  typeof createPaymentLightningInvoiceNotFoundError
>

export type PayPaymentWithBoltCardError =
  | PaymentNotFoundError
  | PaymentNotPayableError
  | PaymentLightningInvoiceNotFoundError
  | RedeemLnurlWithdrawError

export type SettleRestoredSwitchioCardPaymentError =
  | SwitchioRestoredResultUnmatchedError
  | PaymentNotFoundError
  | CardSwitchioAccountNotFoundError
  | AccountCurrencyMismatchError
  | SwitchioPaymentError

export const createCashuAccountNotFoundError = defineError(
  "CashuAccountNotFound"
)<{ readonly id: AccountId }>()
export type CashuAccountNotFoundError = ReturnType<
  typeof createCashuAccountNotFoundError
>

/** Linky's owners did not sync in time: the shared wallet cannot be written. */
export const createCashuWalletNotSyncedError = defineError(
  "CashuWalletNotSynced"
)()
export type CashuWalletNotSyncedError = ReturnType<
  typeof createCashuWalletNotSyncedError
>

export const createLightningAddressAccountNotFoundError = defineError(
  "LightningAddressAccountNotFound"
)<{ readonly id: AccountId }>()
export type LightningAddressAccountNotFoundError = ReturnType<
  typeof createLightningAddressAccountNotFoundError
>

/** The wallet takes no payment of this many sats (LUD-06 min/maxSendable). */
export const createLightningAddressAmountOutOfRangeError = defineError(
  "LightningAddressAmountOutOfRange"
)<{
  readonly amountSats: number
  readonly minSendableSats: number
  readonly maxSendableSats: number
}>()
export type LightningAddressAmountOutOfRangeError = ReturnType<
  typeof createLightningAddressAmountOutOfRangeError
>

/**
 * The verify URL answered for another invoice than the one Payky stored, so
 * its `settled` says nothing about this payment (lightning-address/0002).
 */
export const createLightningAddressVerifyMismatchError = defineError(
  "LightningAddressVerifyMismatch"
)<{ readonly id: PaymentId }>()
export type LightningAddressVerifyMismatchError = ReturnType<
  typeof createLightningAddressVerifyMismatchError
>

export const createPaymentLightningAddressNotFoundError = defineError(
  "PaymentLightningAddressNotFound"
)<{ readonly id: PaymentId }>()
export type PaymentLightningAddressNotFoundError = ReturnType<
  typeof createPaymentLightningAddressNotFoundError
>

export type SyncLightningAddressPaymentError =
  | PaymentLightningAddressNotFoundError
  | LightningAddressVerifyMismatchError
  | LightningAddressInvoiceMismatchError
  | LnurlError

export type PrepareLightningAddressMethodError =
  | LightningAddressAccountNotFoundError
  | LightningAddressAmountOutOfRangeError
  | LightningAddressVerifyUnsupportedError
  | LightningAddressInvoiceMismatchError
  | LnurlError

export type PreparePaymentMethodError =
  | PrepareLightningAddressMethodError
  | PaymentNotFoundError
  | ZeroAmountNotPayableError
  | CashRegisterAccountNotFoundError
  | CardSwitchioAccountNotFoundError
  | QerkoTerminalAccountNotFoundError
  | QerkoPaymentAccountNotFoundError
  | AccountCurrencyMismatchError
  | AccountSparkNotFoundError
  | IbanAccountNotFoundError
  | PaymentNumberNotFoundError
  | PaymentPreparationFailedError
  | YadioHttpError
  | YadioApiError
  | FetchError

/**
 * The previous Qerko attempt's outcome is unknown (payment/0006), so the card
 * may have been charged already. Another attempt needs staff to have checked
 * the terminal first and to retry explicitly.
 */
export const createQerkoAttemptUnresolvedError = defineError(
  "QerkoAttemptUnresolved"
)<{
  readonly id: PaymentId
  readonly transactionId: NonEmptyString255
}>()
export type QerkoAttemptUnresolvedError = ReturnType<
  typeof createQerkoAttemptUnresolvedError
>

/**
 * Qerko did not start the payment (`create-terminal-payment` answered with
 * something other than `started`), so no card was asked: `reason` is the
 * answer's `type`.
 */
export const createQerkoTerminalNotStartedError = defineError(
  "QerkoTerminalNotStarted"
)<{
  readonly id: PaymentId
  readonly reason: QerkoNotStartedReason
}>()
export type QerkoTerminalNotStartedError = ReturnType<
  typeof createQerkoTerminalNotStartedError
>

/** The terminal answered with a definite no. */
export const createQerkoTerminalPaymentFailedError = defineError(
  "QerkoTerminalPaymentFailed"
)<{
  readonly id: PaymentId
  readonly reason: QerkoPaymentFailureReason
}>()
export type QerkoTerminalPaymentFailedError = ReturnType<
  typeof createQerkoTerminalPaymentFailedError
>

export type StartQerkoTerminalPaymentError =
  | PaymentNotFoundError
  | PaymentNotPayableError
  | QerkoAttemptUnresolvedError
  | QerkoTerminalAccountNotFoundError
  | AccountCurrencyMismatchError
  | QerkoPluginNotPairedError
  | QerkoTerminalNotStartedError
  | QerkoTerminalPaymentFailedError
  | QerkoClientError

export type SyncQerkoTerminalPaymentError =
  | PaymentNotFoundError
  | QerkoTerminalAccountNotFoundError
  | AccountCurrencyMismatchError
  | QerkoPluginNotPairedError
  | QerkoTerminalPaymentFailedError
  | QerkoClientError

/**
 * Qerko asked for a bill Payky does not offer through Qerko: no such payment,
 * or one whose Qerko payment method was never prepared (`BILL_NOT_FOUND`).
 */
export const createQerkoBillNotFoundError = defineError("QerkoBillNotFound")<{
  readonly idBill: string
}>()
export type QerkoBillNotFoundError = ReturnType<
  typeof createQerkoBillNotFoundError
>

/** The payment is no longer waiting for money (`BILL_CLOSED`). */
export const createQerkoBillClosedError = defineError("QerkoBillClosed")<{
  readonly id: PaymentId
}>()
export type QerkoBillClosedError = ReturnType<typeof createQerkoBillClosedError>

/** Another Qerko payment of the payment is still in progress (`BILL_LOCKED`). */
export const createQerkoBillLockedError = defineError("QerkoBillLocked")<{
  readonly id: PaymentId
  readonly qerkoPaymentId: NonEmptyString255
}>()
export type QerkoBillLockedError = ReturnType<typeof createQerkoBillLockedError>

/**
 * `paymentStart` does not match the bill Payky offered — another currency or
 * amount, a discount, a tip (`INVALID_DATA`): Qerko refreshes the bill and
 * tries again.
 */
export const createQerkoInvalidDataError = defineError("QerkoInvalidData")<{
  readonly id: PaymentId
  readonly reason: "currency" | "amount" | "discount"
}>()
export type QerkoInvalidDataError = ReturnType<
  typeof createQerkoInvalidDataError
>

/** Qerko names a Qerko payment that `paymentStart` never recorded. */
export const createQerkoPaymentAttemptNotFoundError = defineError(
  "QerkoPaymentAttemptNotFound"
)<{
  readonly qerkoPaymentId: string
}>()
export type QerkoPaymentAttemptNotFoundError = ReturnType<
  typeof createQerkoPaymentAttemptNotFoundError
>

export type ResolveQerkoBillError =
  | QerkoBillNotFoundError
  | QerkoBillClosedError

export type StartQerkoPaymentError =
  | ResolveQerkoBillError
  | QerkoBillLockedError
  | QerkoInvalidDataError

export type SettleQerkoPaymentError =
  | QerkoPaymentAttemptNotFoundError
  | PaymentNotFoundError
  | QerkoPaymentAccountNotFoundError
  | AccountCurrencyMismatchError
