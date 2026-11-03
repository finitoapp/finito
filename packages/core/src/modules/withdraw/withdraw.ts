import type { IndexesConfig } from "@evolu/common/local-first"

import { AccountId } from "../account/account-types.ts"
import { AccountTransactionOnchainExitSpeedSchema } from "../account-transaction/account-transaction.ts"
import { AccountTransactionId } from "../account-transaction/account-transaction-types.ts"
import {
  CashuOperationId,
  CashuQuoteIdSchema,
  MintUrlSchema,
} from "../cashu/cashu-types.ts"
import { DeviceId } from "../device/device-types.ts"
import {
  BitcoinAddressSchema,
  type InferTable,
  NonEmptyString255Schema,
  NonEmptyStringSchema,
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
  TimestampMsSchema,
} from "../shared/schema.ts"
import {
  WithdrawalFailureReasonSchema,
  WithdrawalId,
} from "./withdraw-types.ts"

/**
 * One withdrawal from a Spark wallet, written before any money leaves
 * (withdraw/0001). Its kind is whichever detail table holds its row; its state
 * is derived, not stored (withdraw/0003): done once the account transaction
 * `accountTransactionId` names exists, failed once `failedAt` is set, in
 * progress otherwise.
 */
export const withdrawal = {
  id: WithdrawalId,
  accountId: AccountId,
  deviceId: DeviceId.nullable(),
  /** What the recipient gets, never the fee. */
  amountSats: PositiveIntegerSchema,
  /** Known before sending: the movement the action or the sync job will write. */
  accountTransactionId: AccountTransactionId,
  failedAt: TimestampMsSchema.nullable(),
  /** Set together with `failedAt`. */
  failureReason: WithdrawalFailureReasonSchema.nullable(),
  /** The merchant's own note, never sent to the recipient (withdraw/0010). */
  comment: NonEmptyString255Schema.nullable(),
} as const

export const withdrawalOnchain = {
  id: WithdrawalId,
  onchainAddress: BitcoinAddressSchema,
  exitSpeed: AccountTransactionOnchainExitSpeedSchema,
  /** The quoted fee, for the movement an operator's "the money left" writes. */
  feeSats: NonNegativeIntegerSchema,
} as const

export const withdrawalLightning = {
  id: WithdrawalId,
  /** `null` when paying an invoice directly. */
  lightningAddress: NonEmptyStringSchema.nullable(),
  /** The invoice paid, for display only. */
  lnInvoice: NonEmptyStringSchema,
  /** The UUID handed to the SDK: the Spark transfer's id and idempotency key. */
  sparkTransferId: NonEmptyStringSchema,
  maxFeeSats: NonNegativeIntegerSchema,
} as const

/**
 * A Lightning withdrawal paid by melting ecash at one mint of the wallet
 * shared with Linky (cashu.md §6). Its own detail table: Spark's
 * `withdrawalLightning` and its required `sparkTransferId` stay untouched.
 * `meltOperationId` is the melt in Linky's shards, known before anything is
 * sent because it derives from the mint and the quote.
 */
export const withdrawalLightningCashu = {
  id: WithdrawalId,
  mintUrl: MintUrlSchema,
  quoteId: CashuQuoteIdSchema,
  meltOperationId: CashuOperationId,
  lnInvoice: NonEmptyStringSchema,
  /** `null` when paying an invoice directly. */
  lightningAddress: NonEmptyStringSchema.nullable(),
} as const

/**
 * Ecash handed to a Linky user as a token over a NIP-17 message
 * (withdraw/0015): the `send` in Linky's shards, known only once the swap
 * made it, so it is filled in right after; the recipient's key, and the
 * NIP-05 address the merchant named them by, when they did.
 */
export const withdrawalCashuSend = {
  id: WithdrawalId,
  mintUrl: MintUrlSchema,
  sendOperationId: CashuOperationId.nullable(),
  recipientPubkey: NonEmptyStringSchema,
  recipientAddress: NonEmptyStringSchema.nullable(),
} as const

export const withdrawalIndexes = ((create) => [
  create("withdrawal_accountId_createdAt")
    .on("withdrawal")
    .columns(["accountId", "createdAt"]),
  create("withdrawal_accountTransactionId")
    .on("withdrawal")
    .column("accountTransactionId"),
  create("withdrawalLightningCashu_meltOperationId")
    .on("withdrawalLightningCashu")
    .column("meltOperationId"),
]) satisfies IndexesConfig

export type WithdrawalRow = InferTable<typeof withdrawal>
export type WithdrawalOnchainRow = InferTable<typeof withdrawalOnchain>
export type WithdrawalLightningRow = InferTable<typeof withdrawalLightning>
export type WithdrawalLightningCashuRow = InferTable<
  typeof withdrawalLightningCashu
>
export type WithdrawalCashuSendRow = InferTable<typeof withdrawalCashuSend>
