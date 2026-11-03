import { type InferRow, type KyselyNotNull, sqliteTrue } from "@evolu/common"
import { createQuery } from "../../evolu/schema.ts"
import type { AccountId } from "../account/account-types.ts"
import type { AccountTransactionOnchainExitSpeed } from "../account-transaction/account-transaction.ts"
import type { AccountTransactionId } from "../account-transaction/account-transaction-types.ts"
import type { CashuOperationId, MintUrl } from "../cashu/cashu-types.ts"
import type { DeviceId } from "../device/device-types.ts"
import type { WithdrawalFailureReason, WithdrawalId } from "./withdraw-types.ts"

type QueryDb = Parameters<Parameters<typeof createQuery>[0]>[0]

/**
 * One withdrawal with its detail row, device name and account transaction.
 * The join to the account transaction does not filter `isDeleted`: a deleted
 * movement is a bookkeeping edit, not money that stayed (withdraw/0003).
 */
const selectWithdrawals = (db: QueryDb) =>
  db
    .selectFrom("withdrawal")
    .leftJoin("withdrawalOnchain", (join) =>
      join
        .onRef("withdrawalOnchain.id", "=", "withdrawal.id")
        .on("withdrawalOnchain.isDeleted", "is not", sqliteTrue)
    )
    .leftJoin("withdrawalLightning", (join) =>
      join
        .onRef("withdrawalLightning.id", "=", "withdrawal.id")
        .on("withdrawalLightning.isDeleted", "is not", sqliteTrue)
    )
    .leftJoin("withdrawalLightningCashu", (join) =>
      join
        .onRef("withdrawalLightningCashu.id", "=", "withdrawal.id")
        .on("withdrawalLightningCashu.isDeleted", "is not", sqliteTrue)
    )
    .leftJoin("withdrawalCashuSend", (join) =>
      join
        .onRef("withdrawalCashuSend.id", "=", "withdrawal.id")
        .on("withdrawalCashuSend.isDeleted", "is not", sqliteTrue)
    )
    .leftJoin("device", "device.id", "withdrawal.deviceId")
    .leftJoin(
      "accountTransaction",
      "accountTransaction.id",
      "withdrawal.accountTransactionId"
    )
    .leftJoin(
      "accountTransactionOnchain",
      "accountTransactionOnchain.id",
      "withdrawal.accountTransactionId"
    )
    .leftJoin(
      "accountTransactionLightning",
      "accountTransactionLightning.id",
      "withdrawal.accountTransactionId"
    )
    .leftJoin(
      "accountTransactionSpark",
      "accountTransactionSpark.id",
      "withdrawal.accountTransactionId"
    )
    .select([
      "withdrawal.id",
      "withdrawal.createdAt",
      "withdrawal.accountId",
      "withdrawal.deviceId",
      "withdrawal.amountSats",
      "withdrawal.accountTransactionId",
      "withdrawal.failedAt",
      "withdrawal.failureReason",
      "withdrawal.comment",
      "withdrawalOnchain.id as onchainId",
      "withdrawalOnchain.onchainAddress",
      "withdrawalOnchain.exitSpeed",
      "withdrawalOnchain.feeSats as quotedFeeSats",
      "withdrawalLightning.id as lightningId",
      "withdrawalLightning.lightningAddress",
      "withdrawalLightning.lnInvoice",
      "withdrawalLightning.sparkTransferId",
      "withdrawalLightning.maxFeeSats",
      "withdrawalLightningCashu.id as cashuId",
      "withdrawalLightningCashu.mintUrl",
      "withdrawalLightningCashu.quoteId as cashuQuoteId",
      "withdrawalLightningCashu.lnInvoice as cashuLnInvoice",
      "withdrawalLightningCashu.lightningAddress as cashuLightningAddress",
      "withdrawalCashuSend.id as cashuSendId",
      "withdrawalCashuSend.mintUrl as cashuSendMintUrl",
      "withdrawalCashuSend.sendOperationId as cashuSendOperationId",
      "withdrawalCashuSend.recipientPubkey as cashuSendRecipientPubkey",
      "withdrawalCashuSend.recipientAddress as cashuSendRecipientAddress",
      "device.name as deviceName",
      "device.isDeleted as deviceDeleted",
      "accountTransaction.id as movementId",
      "accountTransaction.isDeleted as movementDeleted",
      "accountTransaction.amount as movementAmount",
      "accountTransactionOnchain.txid",
      "accountTransactionOnchain.coopExitRequestId",
      "accountTransactionOnchain.feeSats as onchainFeeSats",
      "accountTransactionLightning.preImage",
      "accountTransactionSpark.sparkTransferId as movementSparkTransferId",
    ])
    .where("withdrawal.isDeleted", "is not", sqliteTrue)
    .where("withdrawal.createdAt", "is not", null)
    .where("withdrawal.accountId", "is not", null)
    .where("withdrawal.amountSats", "is not", null)
    .where("withdrawal.accountTransactionId", "is not", null)
    .$narrowType<{
      createdAt: KyselyNotNull
      accountId: KyselyNotNull
      amountSats: KyselyNotNull
      accountTransactionId: KyselyNotNull
    }>()

/** Newest first, `limit` rows: the history page pages through it. */
export const withdrawalsByAccountQuery = (
  accountId: AccountId,
  limit: number
) =>
  createQuery((db) =>
    selectWithdrawals(db)
      .where("withdrawal.accountId", "=", accountId)
      .orderBy("withdrawal.createdAt", "desc")
      .limit(limit)
  )

export const withdrawalDetailQuery = (id: WithdrawalId) =>
  createQuery((db) => selectWithdrawals(db).where("withdrawal.id", "=", id))

export type WithdrawalQueryRow = InferRow<
  ReturnType<typeof withdrawalsByAccountQuery>
>

export type WithdrawalTarget =
  | {
      readonly kind: "onchain"
      readonly onchainAddress: string
      readonly exitSpeed: AccountTransactionOnchainExitSpeed
      readonly quotedFeeSats: number
    }
  | {
      readonly kind: "lightning"
      readonly lightningAddress: string | null
      readonly lnInvoice: string
      readonly sparkTransferId: string
      readonly maxFeeSats: number
    }
  | {
      /** A Lightning payment melted from one mint of the shared Cashu wallet. */
      readonly kind: "cashu"
      readonly mintUrl: MintUrl
      readonly lightningAddress: string | null
      readonly lnInvoice: string
      readonly quoteId: string
    }
  | {
      /** Ecash handed to a Linky user as a token (withdraw/0015). */
      readonly kind: "cashuSend"
      readonly mintUrl: MintUrl
      readonly recipientPubkey: string
      /** The NIP-05 address the merchant named them by, when they did. */
      readonly recipientAddress: string | null
      /** `null` until the swap made the token. */
      readonly sendOperationId: CashuOperationId | null
    }

export type WithdrawalState =
  | {
      readonly status: "done"
      /** The account transaction behind it was deleted afterwards. */
      readonly movementDeleted: boolean
      /** What left the wallet, fee included. */
      readonly debitedSats: number
      readonly feeSats: number
      readonly txid: string | null
      readonly coopExitRequestId: string | null
      readonly preImage: string | null
      readonly sparkTransferId: string | null
    }
  | {
      readonly status: "failed"
      readonly reason: WithdrawalFailureReason
      readonly failedAt: number
    }
  | { readonly status: "pending" }

export interface WithdrawalView {
  readonly id: WithdrawalId
  readonly createdAt: number
  readonly accountId: AccountId
  readonly deviceId: DeviceId | null
  /** `null` when unknown or deleted. */
  readonly deviceName: string | null
  readonly amountSats: number
  readonly accountTransactionId: AccountTransactionId
  /** The merchant's own note (withdraw/0010). */
  readonly comment: string | null
  readonly target: WithdrawalTarget
  readonly state: WithdrawalState
}

/**
 * Turns a query row into the union the UI works with, or `null` for a row
 * whose detail has not synced yet. A movement beats `failedAt`: if the money
 * left after all, the state corrects itself (withdraw/0003).
 */
export const toWithdrawalView = (
  row: WithdrawalQueryRow
): WithdrawalView | null => {
  const target: WithdrawalTarget | null =
    row.onchainId !== null &&
    row.onchainAddress !== null &&
    row.exitSpeed !== null &&
    row.quotedFeeSats !== null
      ? {
          kind: "onchain",
          onchainAddress: row.onchainAddress,
          exitSpeed: row.exitSpeed,
          quotedFeeSats: row.quotedFeeSats,
        }
      : row.lightningId !== null &&
          row.lnInvoice !== null &&
          row.sparkTransferId !== null &&
          row.maxFeeSats !== null
        ? {
            kind: "lightning",
            lightningAddress: row.lightningAddress,
            lnInvoice: row.lnInvoice,
            sparkTransferId: row.sparkTransferId,
            maxFeeSats: row.maxFeeSats,
          }
        : row.cashuId !== null &&
            row.mintUrl !== null &&
            row.cashuLnInvoice !== null &&
            row.cashuQuoteId !== null
          ? {
              kind: "cashu",
              mintUrl: row.mintUrl,
              lightningAddress: row.cashuLightningAddress,
              lnInvoice: row.cashuLnInvoice,
              quoteId: row.cashuQuoteId,
            }
          : row.cashuSendId !== null &&
              row.cashuSendMintUrl !== null &&
              row.cashuSendRecipientPubkey !== null
            ? {
                kind: "cashuSend",
                mintUrl: row.cashuSendMintUrl,
                recipientPubkey: row.cashuSendRecipientPubkey,
                recipientAddress: row.cashuSendRecipientAddress,
                sendOperationId: row.cashuSendOperationId,
              }
            : null
  if (target === null) return null

  const debitedSats =
    row.movementAmount === null ? row.amountSats : -row.movementAmount
  const state: WithdrawalState =
    row.movementId !== null
      ? {
          status: "done",
          movementDeleted: row.movementDeleted === sqliteTrue,
          debitedSats,
          feeSats: row.onchainFeeSats ?? debitedSats - row.amountSats,
          txid: row.txid,
          coopExitRequestId: row.coopExitRequestId,
          preImage: row.preImage,
          sparkTransferId: row.movementSparkTransferId,
        }
      : row.failedAt !== null && row.failureReason !== null
        ? {
            status: "failed",
            reason: row.failureReason,
            failedAt: row.failedAt,
          }
        : { status: "pending" }

  return {
    id: row.id,
    createdAt: Date.parse(row.createdAt),
    accountId: row.accountId,
    deviceId: row.deviceId,
    deviceName: row.deviceDeleted === sqliteTrue ? null : row.deviceName,
    amountSats: row.amountSats,
    accountTransactionId: row.accountTransactionId,
    comment: row.comment,
    target,
    state,
  }
}

/**
 * Lightning withdrawals of an account still waiting for an outcome: no
 * account transaction (deleted or not) and no `failedAt`. The sync job's
 * check narrows them to its window.
 */
export const pendingLightningWithdrawalsQuery = (accountId: AccountId) =>
  createQuery((db) =>
    db
      .selectFrom("withdrawal")
      .innerJoin(
        "withdrawalLightning",
        "withdrawalLightning.id",
        "withdrawal.id"
      )
      .leftJoin(
        "accountTransaction",
        "accountTransaction.id",
        "withdrawal.accountTransactionId"
      )
      .select([
        "withdrawal.id",
        "withdrawal.createdAt",
        "withdrawal.deviceId",
        "withdrawalLightning.sparkTransferId",
      ])
      .where("withdrawal.accountId", "=", accountId)
      .where("withdrawal.isDeleted", "is not", sqliteTrue)
      .where("withdrawal.failedAt", "is", null)
      .where("withdrawalLightning.isDeleted", "is not", sqliteTrue)
      .where("withdrawalLightning.sparkTransferId", "is not", null)
      .where("withdrawal.createdAt", "is not", null)
      .where("accountTransaction.id", "is", null)
      .$narrowType<{
        createdAt: KyselyNotNull
        sparkTransferId: KyselyNotNull
      }>()
  )

/** What "the money left" needs to write an on-chain withdrawal's movement. */
export const withdrawalForResolutionQuery = (id: WithdrawalId) =>
  createQuery((db) =>
    db
      .selectFrom("withdrawal")
      .innerJoin("withdrawalOnchain", "withdrawalOnchain.id", "withdrawal.id")
      .select([
        "withdrawal.accountId",
        "withdrawal.accountTransactionId",
        "withdrawal.amountSats",
        "withdrawalOnchain.onchainAddress",
        "withdrawalOnchain.exitSpeed",
        "withdrawalOnchain.feeSats",
      ])
      .where("withdrawal.id", "=", id)
      .where("withdrawal.isDeleted", "is not", sqliteTrue)
      .where("withdrawal.accountId", "is not", null)
      .where("withdrawal.accountTransactionId", "is not", null)
      .where("withdrawal.amountSats", "is not", null)
      .where("withdrawalOnchain.onchainAddress", "is not", null)
      .where("withdrawalOnchain.exitSpeed", "is not", null)
      .where("withdrawalOnchain.feeSats", "is not", null)
      .$narrowType<{
        accountId: KyselyNotNull
        accountTransactionId: KyselyNotNull
        amountSats: KyselyNotNull
        onchainAddress: KyselyNotNull
        exitSpeed: KyselyNotNull
        feeSats: KyselyNotNull
      }>()
  )

/** The withdrawal a Cashu melt pays, for settling it once the melt is decided. */
export const withdrawalByCashuMeltQuery = (meltOperationId: CashuOperationId) =>
  createQuery((db) =>
    db
      .selectFrom("withdrawalLightningCashu")
      .innerJoin("withdrawal", "withdrawal.id", "withdrawalLightningCashu.id")
      .select([
        "withdrawal.id",
        "withdrawal.accountId",
        "withdrawal.deviceId",
        "withdrawal.accountTransactionId",
        "withdrawal.failedAt",
      ])
      .where("withdrawalLightningCashu.meltOperationId", "=", meltOperationId)
      .where("withdrawal.isDeleted", "is not", sqliteTrue)
      .$narrowType<{
        accountId: KyselyNotNull
        accountTransactionId: KyselyNotNull
      }>()
  )
