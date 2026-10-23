import type { IndexesConfig } from "@evolu/common/local-first"
import { z } from "zod"

import { AccountId } from "../account/account-types.ts"
import {
  CashuOperationId,
  CashuQuoteIdSchema,
  MintUrlSchema,
} from "../cashu/cashu-types.ts"
import { DeviceId } from "../device/device-types.ts"
import {
  BitcoinAddressSchema,
  ConstantSymbolSchema,
  CurrencySchema,
  type InferTable,
  IntegerSchema,
  NonEmptyString255Schema,
  NonEmptyStringSchema,
  SpecificSymbolSchema,
  SyncSourceSchema,
  TimestampMsSchema,
  VariableSymbolSchema,
} from "../shared/schema.ts"
import {
  AccountTransactionId,
  AccountTransactionKindSchema,
  AccountTransactionSourceId,
} from "./account-transaction-types.ts"

export const AccountTransactionOnchainExitSpeedSchema = z.enum([
  "fast",
  "medium",
  "slow",
])

export const accountTransaction = {
  id: AccountTransactionId,
  accountId: AccountId,
  kind: AccountTransactionKindSchema,
  amount: IntegerSchema,
  currency: CurrencySchema,
  occurredAt: TimestampMsSchema,
  note: NonEmptyStringSchema.nullable(),
  internalTransferGroupId: NonEmptyString255Schema.nullable(),
} as const

export const accountTransactionIban = {
  id: AccountTransactionId,
  variableSymbol: VariableSymbolSchema.nullable(),
  constantSymbol: ConstantSymbolSchema.nullable(),
  specificSymbol: SpecificSymbolSchema.nullable(),
  bankReference: NonEmptyString255Schema.nullable(),
  recipientMessage: NonEmptyStringSchema.nullable(),
} as const

export const accountTransactionSpark = {
  id: AccountTransactionId,
  sparkTransferId: NonEmptyStringSchema,
} as const

export const accountTransactionSparkInvoice = {
  id: AccountTransactionId,
  sparkInvoice: NonEmptyStringSchema,
} as const

export const accountTransactionLightning = {
  id: AccountTransactionId,
  lnInvoice: NonEmptyStringSchema,
  preImage: NonEmptyStringSchema.nullable(),
  paymentHash: NonEmptyStringSchema.nullable(),
} as const

export const accountTransactionOnchain = {
  id: AccountTransactionId,
  onchainAddress: BitcoinAddressSchema,
  /** `null` when an operator confirmed a withdrawal by hand (withdraw/0002). */
  coopExitRequestId: NonEmptyStringSchema.nullable(),
  exitSpeed: AccountTransactionOnchainExitSpeedSchema,
  feeSats: IntegerSchema,
  txid: NonEmptyStringSchema.nullable(),
} as const

/**
 * A movement into the shared Cashu wallet (cashu.md §5, cashu/0005): the
 * `done` `topup` or `receive` operation it books, by id. `quoteId` and
 * `mintUrl` are copied from the operation so the automatic claim finds its
 * payment without reading Linky's tables.
 */
export const accountTransactionCashu = {
  id: AccountTransactionId,
  cashuOperationId: CashuOperationId,
  quoteId: CashuQuoteIdSchema.nullable(),
  mintUrl: MintUrlSchema,
} as const

export const accountTransactionSource = {
  id: AccountTransactionSourceId,
  deviceId: DeviceId.nullable(),
  accountTransactionId: AccountTransactionId,
  source: SyncSourceSchema,
  recordedAt: TimestampMsSchema,
} as const

export const accountTransactionIndexes = ((create) => [
  create("accountTransaction_accountId")
    .on("accountTransaction")
    .column("accountId"),
  create("accountTransaction_accountId_occurredAt")
    .on("accountTransaction")
    .columns(["accountId", "occurredAt"]),
  create("accountTransaction_internalTransferGroupId")
    .on("accountTransaction")
    .column("internalTransferGroupId"),
  create("accountTransactionSpark_sparkTransferId")
    .on("accountTransactionSpark")
    .column("sparkTransferId"),
  create("accountTransactionCashu_cashuOperationId")
    .on("accountTransactionCashu")
    .column("cashuOperationId"),
  create("accountTransactionLightning_lnInvoice")
    .on("accountTransactionLightning")
    .column("lnInvoice"),
  create("accountTransactionSparkInvoice_sparkInvoice")
    .on("accountTransactionSparkInvoice")
    .column("sparkInvoice"),
  create("accountTransactionOnchain_coopExitRequestId")
    .on("accountTransactionOnchain")
    .column("coopExitRequestId"),
  create("accountTransactionIban_bankReference")
    .on("accountTransactionIban")
    .column("bankReference"),
  create("accountTransactionSource_accountTransactionId")
    .on("accountTransactionSource")
    .column("accountTransactionId"),
  create("accountTransactionSource_source")
    .on("accountTransactionSource")
    .column("source"),
]) satisfies IndexesConfig

export type AccountTransactionRow = InferTable<typeof accountTransaction>
export type AccountTransactionIbanRow = InferTable<
  typeof accountTransactionIban
>
export type AccountTransactionSparkRow = InferTable<
  typeof accountTransactionSpark
>
export type AccountTransactionSparkInvoiceRow = InferTable<
  typeof accountTransactionSparkInvoice
>
export type AccountTransactionLightningRow = InferTable<
  typeof accountTransactionLightning
>
export type AccountTransactionOnchainRow = InferTable<
  typeof accountTransactionOnchain
>
export type AccountTransactionOnchainExitSpeed = z.output<
  typeof AccountTransactionOnchainExitSpeedSchema
>
export type AccountTransactionCashuRow = InferTable<
  typeof accountTransactionCashu
>
export type AccountTransactionSourceRow = InferTable<
  typeof accountTransactionSource
>
