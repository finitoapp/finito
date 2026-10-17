import type { IndexesConfig } from "@evolu/common/local-first"
import { z } from "zod"

import { AccountId } from "../account/account-types.ts"
import { BillId } from "../bill/bill-types.ts"
import {
  CashuOperationId,
  CashuQuoteIdSchema,
  MintUrlSchema,
} from "../cashu/cashu-types.ts"
import { DeviceId } from "../device/device-types.ts"
import {
  FiatCurrencySchema,
  type InferTable,
  NonEmptyString255Schema,
  NonEmptyStringSchema,
  NonNegativeIntegerSchema,
  PositiveNumberSchema,
  SpecificSymbolSchema,
  TimestampMsSchema,
  VariableSymbolSchema,
} from "../shared/schema.ts"
import { TableId } from "../table/table-types.ts"
import { SelfPayPointerSchema } from "../table-self-pay/table-self-pay-reference-utils.ts"
import { PaymentId, QerkoPaymentAttemptId } from "./payment-types.ts"

export const payment = {
  id: PaymentId,
  deviceId: DeviceId.nullable(),
  billId: BillId.nullable(),
  tableId: TableId.nullable(),
  amount: NonNegativeIntegerSchema,
  currency: FiatCurrencySchema,
  tipAmount: NonNegativeIntegerSchema,
  canceledAt: TimestampMsSchema.nullable(),
  confirmedPaidAt: TimestampMsSchema.nullable(),
  /**
   * Set once, never cleared, by app versions before overpayment
   * resolutions, which now read it as keeping the extra money claimed
   * before its first write. It resolved the duplicate-settlement collision: two
   * offline devices can each independently claim the same payment through a
   * different method (e.g. one settles it in cash while another
   * reconciles an incoming bank transfer for the same amount) — both
   * claims are real money, so neither is discarded, but the payment ends
   * up claimed for more than its own `amount`. This field records that
   * staff has seen the excess and decided how to handle it (e.g. refund),
   * silencing the warning. See docs/bill-payment-states.md.
   */
  excessAcknowledgedAt: TimestampMsSchema.nullable(),
  expiresAt: TimestampMsSchema.nullable(),
} as const

export const paymentCashRegister = {
  id: PaymentId,
  accountId: AccountId,
  receivedAmount: NonNegativeIntegerSchema.nullable(),
} as const

export const paymentBtc = {
  id: PaymentId,
  accountId: AccountId,
  amountSats: NonNegativeIntegerSchema,
  exchangeRate: PositiveNumberSchema,
  exchangeRateSource: z.enum(["yadio"]),
  exchangeRateFetchedAt: TimestampMsSchema,
} as const

export const paymentBtcLightning = {
  id: PaymentId,
  lnInvoice: NonEmptyStringSchema,
  lightningReceiveRequestId: NonEmptyStringSchema.nullable(),
  paymentHash: NonEmptyStringSchema.nullable(),
  paymentPreimage: NonEmptyStringSchema.nullable(),
} as const

export const paymentBtcSpark = {
  id: PaymentId,
  sparkInvoice: NonEmptyStringSchema,
} as const

/**
 * A card payment taken on the SwitchioPay terminal.
 *
 * `transactionId` is the ECR request id this app generates and writes
 * *before* handing control to SwitchioPay, so a payment whose result never
 * makes it back (Android can kill this WebView while the terminal app is in
 * the foreground) can still be matched against the terminal's own records.
 * It stays `null` until the first attempt is launched, and is replaced on
 * every retry.
 *
 * `unresolvedTransactionId` is set to the same id before the intent leaves
 * and cleared once the terminal gives a definite answer. While it is set, the
 * last attempt's outcome is unknown — the result was unreadable, or never
 * came back — and the card may have been charged, so
 * `payPaymentWithSwitchioCard` refuses another attempt until staff has
 * checked SwitchioPay and explicitly retries.
 *
 * The result fields are what the ECR v8 transaction result carries for
 * tracing a transaction with the acquirer; everything else the terminal
 * returns (EMV data, tokens, DCC) is deliberately dropped. See
 * `src/core/native/switchio.ts`.
 *
 * `refundId`, `deviceId` and `approvedAt` are what refunding the card needs,
 * written with the approved result (payment/0009): the terminal's id a
 * referral refund names the payment by, kept as the terminal's digits; the
 * phone whose SwitchioPay charged the card — not `payment.deviceId`, the
 * device that created the payment, since a pending payment can be paid on
 * any device — and when that phone recorded the approval, by the same clock
 * that stamps its `cardSwitchioClosure.closedAt`.
 */
export const paymentCardSwitchio = {
  id: PaymentId,
  accountId: AccountId,
  transactionId: NonEmptyString255Schema.nullable(),
  unresolvedTransactionId: NonEmptyString255Schema.nullable(),
  responseCode: NonEmptyString255Schema.nullable(),
  authCode: NonEmptyString255Schema.nullable(),
  sequenceNumber: NonEmptyString255Schema.nullable(),
  maskedPan: NonEmptyString255Schema.nullable(),
  cardLabel: NonEmptyString255Schema.nullable(),
  terminalId: NonEmptyString255Schema.nullable(),
  terminalDateTime: NonEmptyString255Schema.nullable(),
  refundId: NonEmptyString255Schema.nullable(),
  deviceId: DeviceId.nullable(),
  approvedAt: TimestampMsSchema.nullable(),
} as const

/**
 * A payment taken on a terminal Qerko drives remotely (qerko/0001..0005).
 *
 * Starting an attempt stores `transactionId` (a UUID, Qerko's idempotency
 * key) as both itself and `pendingTransactionId` *before* the request leaves,
 * so a crash or a dropped response still leaves something to poll. A pending
 * attempt is resolved by `syncQerkoTerminalPayment`: approved settles the
 * payment and clears both markers, a definite failure clears them, and an
 * answer of `unknown` (or an upstream timeout when starting) moves the
 * attempt to `unresolvedTransactionId`, where it stays until staff confirm
 * a retry (payment/0006). Every clear compares against the attempt's own
 * `transactionId`, so a late answer for an old attempt cannot resolve a newer
 * one.
 *
 * The trace fields are what Qerko's receipt carries; `qerkoRefundId` is what
 * a refund to the card needs (`receipt.refundId`). `chargedTipAmount` is the
 * tip the card was charged, which can exceed the payment's own when the
 * customer tipped on the terminal.
 */
export const paymentQerkoTerminal = {
  id: PaymentId,
  accountId: AccountId,
  transactionId: NonEmptyString255Schema.nullable(),
  pendingTransactionId: NonEmptyString255Schema.nullable(),
  /** When the pending attempt started: see `qerkoUnknownAttemptGraceMs`. */
  pendingSince: TimestampMsSchema.nullable(),
  unresolvedTransactionId: NonEmptyString255Schema.nullable(),
  /**
   * Why the last attempt ended without money, kept on the row so every
   * device can say so, whichever one polled the answer; cleared when the
   * next attempt starts.
   */
  failureReason: z.enum(["declined", "cancelled", "reversed"]).nullable(),
  terminalId: NonEmptyString255Schema.nullable(),
  /** The terminal's printed TID, kept so staff can tell which one a refund needs. */
  terminalTid: NonEmptyString255Schema.nullable(),
  qerkoRefundId: NonEmptyString255Schema.nullable(),
  authorizationCode: NonEmptyString255Schema.nullable(),
  cardBrand: NonEmptyString255Schema.nullable(),
  maskedPan: NonEmptyString255Schema.nullable(),
  entryMode: z.enum(["contactless", "chip", "magstripe"]).nullable(),
  sequenceNumber: NonEmptyString255Schema.nullable(),
  merchantId: NonEmptyString255Schema.nullable(),
  terminalDateTime: NonEmptyString255Schema.nullable(),
  chargedTipAmount: NonNegativeIntegerSchema.nullable(),
} as const

export const paymentIban = {
  id: PaymentId,
  accountId: AccountId,
  variableSymbol: VariableSymbolSchema.nullable(),
  specificSymbol: SpecificSymbolSchema.nullable(),
} as const

/**
 * A payment's Cashu method (cashu.md §4, cashu/0003): its own detail table,
 * not an extension of `paymentBtc`, so Spark and Cashu prepared on one payment
 * keep a row each. `quoteId` names the mint quote whose `topup` operation, in
 * Linky's shards, settles the Lightning leg; `receiveOperationId` is set once
 * a token for this payment arrived over nostr, before anyone receives it.
 * `quoteExpiresAt` is the quote's expiry, for the wait screen only: the
 * payment's own `expiresAt` decides its status.
 */
export const paymentCashu = {
  id: PaymentId,
  accountId: AccountId,
  amountSats: NonNegativeIntegerSchema,
  exchangeRate: PositiveNumberSchema,
  exchangeRateSource: z.enum(["yadio"]),
  exchangeRateFetchedAt: TimestampMsSchema,
  mintUrl: MintUrlSchema,
  quoteId: CashuQuoteIdSchema,
  lnInvoice: NonEmptyStringSchema,
  quoteExpiresAt: TimestampMsSchema.nullable(),
  receiveOperationId: CashuOperationId.nullable(),
} as const

/**
 * A payment's Lightning address method (lightning-address/0004): its own
 * detail table beside `paymentBtc`, as Cashu's is (cashu/0003), so Spark and
 * a Lightning address prepared on one payment keep a row each. The invoice
 * comes from the merchant's own wallet (lightning-address/0001), and
 * `verifyUrl` is its LUD-21 verify endpoint.
 *
 * `preimage` is `null` until a poll of `verifyUrl` returns one whose SHA-256
 * is `paymentHash` (lightning-address/0002); the same batch then books the
 * account transaction and claims the payment, so a row with a preimage is
 * settled. Preparing again writes a new invoice over the old one; money for
 * the old one is not watched any more, which only happens when staff asked
 * for a fresh invoice. `invoiceExpiresAt` bounds how long the background job
 * keeps polling (lightning-address/0005).
 */
export const paymentLightningAddress = {
  id: PaymentId,
  accountId: AccountId,
  amountSats: NonNegativeIntegerSchema,
  exchangeRate: PositiveNumberSchema,
  exchangeRateSource: z.enum(["yadio"]),
  exchangeRateFetchedAt: TimestampMsSchema,
  /** Lowercased, as `parseLightningInvoice` gives it. */
  lnInvoice: NonEmptyStringSchema,
  paymentHash: NonEmptyStringSchema,
  verifyUrl: NonEmptyStringSchema,
  invoiceExpiresAt: TimestampMsSchema,
  preimage: NonEmptyStringSchema.nullable(),
} as const

/**
 * A payment offered as a Qerko payment (qerko/0007): written once when the
 * method is prepared and never changed. The QR code is built from the
 * pairing's restaurant and the payment's own id, so nothing else is stored;
 * what happens in Qerko is recorded per attempt in `qerkoPaymentAttempt`.
 */
export const paymentQerkoPayment = {
  id: PaymentId,
  accountId: AccountId,
} as const

/**
 * One Qerko payment of a payment (qerko/0013). Several devices write it — the
 * one holding the websocket, every device's sync job (`get-payment`) and a
 * refund from anywhere — and Evolu merges each column by last write, so the
 * row is shaped to make every write agree:
 *
 * - its id derives from Qerko's payment id, so every writer reaches the same
 *   row and no attempt is recorded twice;
 * - `paymentId`, `qerkoPaymentId` and `startedAt` are written by `paymentStart`
 *   and the rest only ever go from null to a value (`fillQerkoPaymentAttempt`),
 *   never back or to another value. Qerko's final state does not change, so
 *   two devices writing it write the same values.
 *
 * A late `PROCESSING` therefore cannot undo a `PAID`, and a late answer for
 * one attempt cannot touch another. An attempt is in progress while
 * `closedAt` is null; `outcome` says how it ended.
 */
export const qerkoPaymentAttempt = {
  id: QerkoPaymentAttemptId,
  paymentId: PaymentId,
  qerkoPaymentId: NonEmptyString255Schema,
  startedAt: TimestampMsSchema,
  processingAt: TimestampMsSchema.nullable(),
  closedAt: TimestampMsSchema.nullable(),
  outcome: z.enum(["paid", "failed"]).nullable(),
  /** Qerko's final state when it was not `PAID`, as Qerko named it. */
  failureReason: NonEmptyString255Schema.nullable(),
  /** The sum of `parts[].total`: what the customer paid through Qerko. */
  chargedAmount: NonNegativeIntegerSchema.nullable(),
  /** The provider types that paid (`CARD`, `MEAL_TICKET`, ...), as JSON. */
  providers: NonEmptyStringSchema.nullable(),
} as const

export const paymentSelfPay = {
  id: PaymentId,
  pointer: SelfPayPointerSchema.nullable(),
} as const

export const paymentIndexes = ((create) => [
  create("payment_billId").on("payment").column("billId"),
  create("payment_tableId").on("payment").column("tableId"),
  create("payment_createdAt").on("payment").column("createdAt"),
  // The sales statistics' cancelled-payments signal ranges over it.
  create("payment_canceledAt").on("payment").column("canceledAt"),
  create("paymentCashRegister_accountId")
    .on("paymentCashRegister")
    .column("accountId"),
  create("paymentBtc_accountId").on("paymentBtc").column("accountId"),
  create("paymentBtcLightning_lnInvoice")
    .on("paymentBtcLightning")
    .column("lnInvoice"),
  create("paymentBtcSpark_sparkInvoice")
    .on("paymentBtcSpark")
    .column("sparkInvoice"),
  create("paymentCardSwitchio_accountId")
    .on("paymentCardSwitchio")
    .column("accountId"),
  create("paymentCardSwitchio_transactionId")
    .on("paymentCardSwitchio")
    .column("transactionId"),
  create("paymentQerkoTerminal_accountId")
    .on("paymentQerkoTerminal")
    .column("accountId"),
  create("paymentQerkoTerminal_pendingTransactionId")
    .on("paymentQerkoTerminal")
    .column("pendingTransactionId"),
  create("paymentQerkoPayment_accountId")
    .on("paymentQerkoPayment")
    .column("accountId"),
  create("qerkoPaymentAttempt_paymentId_startedAt")
    .on("qerkoPaymentAttempt")
    .columns(["paymentId", "startedAt"]),
  // The sync job watches the attempts still in progress.
  create("qerkoPaymentAttempt_closedAt")
    .on("qerkoPaymentAttempt")
    .column("closedAt"),
  create("paymentIban_accountId").on("paymentIban").column("accountId"),
  create("paymentCashu_quoteId").on("paymentCashu").column("quoteId"),
  create("paymentCashu_receiveOperationId")
    .on("paymentCashu")
    .column("receiveOperationId"),
  create("paymentLightningAddress_accountId")
    .on("paymentLightningAddress")
    .column("accountId"),
  create("paymentLightningAddress_lnInvoice")
    .on("paymentLightningAddress")
    .column("lnInvoice"),
  // The verify job watches the rows still without one.
  create("paymentLightningAddress_preimage")
    .on("paymentLightningAddress")
    .column("preimage"),
  create("paymentIban_variableSymbol")
    .on("paymentIban")
    .column("variableSymbol"),
]) satisfies IndexesConfig

export type PaymentRow = InferTable<typeof payment>
export type PaymentCashRegisterRow = InferTable<typeof paymentCashRegister>
export type PaymentBtcRow = InferTable<typeof paymentBtc>
export type PaymentBtcLightningRow = InferTable<typeof paymentBtcLightning>
export type PaymentBtcSparkRow = InferTable<typeof paymentBtcSpark>
export type PaymentIbanRow = InferTable<typeof paymentIban>
export type PaymentCardSwitchioRow = InferTable<typeof paymentCardSwitchio>
export type PaymentQerkoTerminalRow = InferTable<typeof paymentQerkoTerminal>
export type PaymentQerkoPaymentRow = InferTable<typeof paymentQerkoPayment>
export type QerkoPaymentAttemptRow = InferTable<typeof qerkoPaymentAttempt>
export type PaymentCashuRow = InferTable<typeof paymentCashu>
export type PaymentLightningAddressRow = InferTable<
  typeof paymentLightningAddress
>
export type PaymentSelfPayRow = InferTable<typeof paymentSelfPay>
