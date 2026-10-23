import type { KyselyNotNull } from "@evolu/common"
import { sqliteTrue } from "@evolu/common"
import type { ExpressionBuilder, Kysely } from "kysely"

import { createQuery } from "../../evolu/schema.ts"
import type {
  AccountTransactionCashuRow,
  AccountTransactionIbanRow,
  AccountTransactionRow,
} from "../account-transaction/account-transaction.ts"
import type { AccountTransactionId } from "../account-transaction/account-transaction-types.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import { quotedAmountSatsSql } from "../shared/claimed-amount.ts"
import type {
  FiatCurrency,
  NonEmptyString,
  NonNegativeInteger,
} from "../shared/schema.ts"

/**
 * A payment's claim rows as stored, whether or not their transaction still
 * exists. Not an answer to "has money arrived": that is
 * `loadPaymentHasActiveClaim` (`payment-guards.ts`), which skips a claim whose
 * transaction was deleted.
 */
export const activeReconciliationClaimsByPaymentIdQuery = (
  paymentId: PaymentId
) =>
  createQuery((db) =>
    db
      .selectFrom("reconciliationClaim")
      .selectAll()
      .where("paymentId", "=", paymentId)
      .where("isDeleted", "is not", sqliteTrue)
  )

export const activeReconciliationClaimByAccountTransactionIdQuery = (
  accountTransactionId: AccountTransactionId
) =>
  createQuery((db) =>
    db
      .selectFrom("reconciliationClaim")
      .selectAll()
      .where("accountTransactionId", "=", accountTransactionId)
      .where("isDeleted", "is not", sqliteTrue)
  )

/**
 * Every distinct account transaction actively claimed against a single
 * payment, with the real transaction amount — the basis for
 * `calculatePaymentClaimedSum`/`derivePaymentHasExcessSettlement`
 * (`payment-status-utils.ts`), which detect the duplicate-settlement
 * collision: a payment claimed for more than its own `amount`. See
 * docs/bill-payment-states.md.
 */
export const activeClaimedTransactionsByPaymentIdQuery = (
  paymentId: PaymentId
) =>
  createQuery((db) =>
    db
      .selectFrom("reconciliationClaim")
      .innerJoin(
        "accountTransaction",
        "accountTransaction.id",
        "reconciliationClaim.accountTransactionId"
      )
      .innerJoin("payment", "payment.id", "reconciliationClaim.paymentId")
      .leftJoin("paymentBtc", (join) =>
        join
          .onRef("paymentBtc.id", "=", "payment.id")
          .on("paymentBtc.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("paymentCashu", (join) =>
        join
          .onRef("paymentCashu.id", "=", "payment.id")
          .on("paymentCashu.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("paymentLightningAddress", (join) =>
        join
          .onRef("paymentLightningAddress.id", "=", "payment.id")
          .on("paymentLightningAddress.isDeleted", "is not", sqliteTrue)
      )
      .select([
        "reconciliationClaim.accountTransactionId",
        "accountTransaction.amount",
        "accountTransaction.currency",
        "payment.amount as paymentAmount",
        "payment.currency as paymentCurrency",
        quotedAmountSatsSql({
          kind: "accountTransaction.kind",
          btc: "paymentBtc.amountSats",
          cashu: "paymentCashu.amountSats",
          lightningAddress: "paymentLightningAddress.amountSats",
        }).as("paymentAmountSats"),
      ])
      .where("reconciliationClaim.paymentId", "=", paymentId)
      .where("reconciliationClaim.isDeleted", "is not", sqliteTrue)
      .where("reconciliationClaim.accountTransactionId", "is not", null)
      .where("accountTransaction.isDeleted", "is not", sqliteTrue)
      .where("accountTransaction.amount", "is not", null)
      .where("accountTransaction.currency", "is not", null)
      .where("payment.amount", "is not", null)
      .where("payment.currency", "is not", null)
      .$narrowType<{
        accountTransactionId: KyselyNotNull
        amount: KyselyNotNull
        currency: KyselyNotNull
        paymentAmount: KyselyNotNull
        paymentCurrency: KyselyNotNull
      }>()
  )

type AppDb =
  Parameters<Parameters<typeof createQuery>[0]>[0] extends Pick<
    Kysely<infer Db>,
    "selectFrom"
  >
    ? Db
    : never

/**
 * The candidate queries' "this payment has been paid", in the same sense as
 * `paymentClaimsQuery`: a tombstoned claim, or one whose transaction was
 * deleted, no longer counts. An `EXISTS` rather than a left join, so several
 * claims on one payment do not multiply its row either.
 */
const hasActiveClaim = (eb: ExpressionBuilder<AppDb, "payment">) =>
  eb.exists(
    eb
      .selectFrom("reconciliationClaim")
      .innerJoin(
        "accountTransaction as claimedTransaction",
        "claimedTransaction.id",
        "reconciliationClaim.accountTransactionId"
      )
      .select("reconciliationClaim.id")
      .whereRef("reconciliationClaim.paymentId", "=", "payment.id")
      .where("reconciliationClaim.isDeleted", "is not", sqliteTrue)
      .where("claimedTransaction.isDeleted", "is not", sqliteTrue)
  )

/** A payment still waiting for money: the matcher's default candidate. */
const hasNoActiveClaim = (eb: ExpressionBuilder<AppDb, "payment">) =>
  eb.not(hasActiveClaim(eb))

const isNotSelfPayPayment = (eb: ExpressionBuilder<AppDb, "payment">) =>
  eb.not(
    eb.exists(
      eb
        .selectFrom("paymentSelfPay")
        .select("paymentSelfPay.id")
        .whereRef("paymentSelfPay.id", "=", "payment.id")
        .where("paymentSelfPay.isDeleted", "is not", sqliteTrue)
    )
  )

/**
 * A canceled payment stays a candidate on purpose: money that arrives after
 * the cancellation is claimed and surfaces as the canceled+claimed collision
 * rather than sitting unmatched. It is only the last resort, though — when a
 * live payment matches the same transaction, the live one takes it
 * (payment/0004).
 */
const liveBeforeCanceled = (eb: ExpressionBuilder<AppDb, "payment">) =>
  eb("payment.canceledAt", "is not", null)

/**
 * IBAN transactions joined to every payment whose account, symbols, amount
 * and currency they match, paid or not — the body of both candidate queries
 * below, which differ only in how many transactions they ask about. A paid
 * payment is a candidate after every unpaid one, so a second transfer for it
 * overpays it rather than staying unclaimed (payment/0007).
 */
const selectIbanReconciliationCandidates = (
  db: Pick<Kysely<AppDb>, "selectFrom">
) =>
  db
    .selectFrom("accountTransaction")
    .innerJoin(
      "accountTransactionIban",
      "accountTransactionIban.id",
      "accountTransaction.id"
    )
    .innerJoin("paymentIban", (join) =>
      join
        .onRef("paymentIban.accountId", "=", "accountTransaction.accountId")
        .onRef(
          "paymentIban.variableSymbol",
          "=",
          "accountTransactionIban.variableSymbol"
        )
        .on((eb) =>
          eb.or([
            eb(
              "paymentIban.specificSymbol",
              "=",
              eb.ref("accountTransactionIban.specificSymbol")
            ),
            eb.and([
              eb("paymentIban.specificSymbol", "is", null),
              eb("accountTransactionIban.specificSymbol", "is", null),
            ]),
          ])
        )
    )
    .innerJoin("payment", "payment.id", "paymentIban.id")
    .where("accountTransaction.kind", "=", "iban")
    .where("accountTransaction.isDeleted", "is not", sqliteTrue)
    .where("accountTransactionIban.isDeleted", "is not", sqliteTrue)
    .where("accountTransactionIban.variableSymbol", "is not", null)
    .where("paymentIban.isDeleted", "is not", sqliteTrue)
    .where("payment.isDeleted", "is not", sqliteTrue)
    .whereRef("payment.amount", "=", "accountTransaction.amount")
    .whereRef("payment.currency", "=", "accountTransaction.currency")
    .where(isNotSelfPayPayment)

export const ibanReconciliationCandidateByAccountTransactionIdQuery = (
  accountTransactionId: AccountTransactionId
) =>
  createQuery((db) =>
    selectIbanReconciliationCandidates(db)
      .select(["payment.id as paymentId"])
      .where("accountTransaction.id", "=", accountTransactionId)
      .orderBy(hasActiveClaim)
      .orderBy(liveBeforeCanceled)
      .orderBy("payment.id")
      .limit(1)
      .$narrowType<{
        paymentId: KyselyNotNull
      }>()
  )

/**
 * Which of `accountTransactionIds` some unclaimed payment matches — one query
 * for a whole sync window's unclaimed transfers, so a sync asks
 * `reconcileAccountTransaction` (and its five reads) only about the few that
 * can actually be claimed, instead of about every one of them.
 */
export const ibanTransactionsWithReconciliationCandidateQuery = (
  accountTransactionIds: ReadonlyArray<AccountTransactionId>
) =>
  createQuery((db) =>
    selectIbanReconciliationCandidates(db)
      .select(["accountTransaction.id as accountTransactionId"])
      .where("accountTransaction.id", "in", accountTransactionIds)
      .distinct()
      .orderBy("accountTransaction.id")
  )

export const ibanTransactionsNamingSelfPayQuery = (
  accountTransactionIds: ReadonlyArray<AccountTransactionId>
) =>
  createQuery((db) =>
    db
      .selectFrom("accountTransactionIban")
      .select(["accountTransactionIban.id as accountTransactionId"])
      .where("accountTransactionIban.id", "in", accountTransactionIds)
      .where("accountTransactionIban.isDeleted", "is not", sqliteTrue)
      .where((eb) =>
        eb.or([
          eb("accountTransactionIban.recipientMessage", "is not", null),
          eb.exists(
            eb
              .selectFrom("billSelfPayReference")
              .select("billSelfPayReference.id")
              .whereRef(
                "billSelfPayReference.reference",
                "=",
                "accountTransactionIban.variableSymbol"
              )
              .where("billSelfPayReference.isDeleted", "is not", sqliteTrue)
          ),
        ])
      )
      .orderBy("accountTransactionIban.id")
  )

export const ibanReconciliationCandidateByValuesQuery = ({
  accountId,
  amount,
  currency,
  variableSymbol,
  specificSymbol,
}: Pick<AccountTransactionRow, "accountId"> &
  Pick<AccountTransactionIbanRow, "variableSymbol" | "specificSymbol"> & {
    readonly amount: NonNegativeInteger
    readonly currency: FiatCurrency
  }) =>
  createQuery((db) =>
    db
      .selectFrom("paymentIban")
      .innerJoin("payment", "payment.id", "paymentIban.id")
      .select(["payment.id as paymentId"])
      .where("paymentIban.accountId", "=", accountId)
      .where("paymentIban.variableSymbol", "=", variableSymbol)
      .where("paymentIban.specificSymbol", "is", specificSymbol)
      .where("paymentIban.isDeleted", "is not", sqliteTrue)
      .where("payment.isDeleted", "is not", sqliteTrue)
      .where("payment.amount", "=", amount)
      .where("payment.currency", "=", currency)
      .where(isNotSelfPayPayment)
      .orderBy(hasActiveClaim)
      .orderBy(liveBeforeCanceled)
      .orderBy("payment.id")
      .limit(1)
      .$narrowType<{
        paymentId: KyselyNotNull
      }>()
  )

export const cashRegisterReconciliationCandidateByAccountTransactionIdQuery = (
  accountTransactionId: AccountTransactionId
) =>
  createQuery((db) =>
    db
      .selectFrom("accountTransaction")
      .innerJoin("paymentCashRegister", (join) =>
        join.onRef(
          "paymentCashRegister.accountId",
          "=",
          "accountTransaction.accountId"
        )
      )
      .innerJoin("payment", "payment.id", "paymentCashRegister.id")
      .select(["payment.id as paymentId"])
      .where("accountTransaction.id", "=", accountTransactionId)
      .where("accountTransaction.kind", "=", "cashRegister")
      .where("accountTransaction.isDeleted", "is not", sqliteTrue)
      .where("paymentCashRegister.isDeleted", "is not", sqliteTrue)
      .where("payment.isDeleted", "is not", sqliteTrue)
      .whereRef("payment.amount", "=", "accountTransaction.amount")
      .whereRef("payment.currency", "=", "accountTransaction.currency")
      .where(hasNoActiveClaim)
      .orderBy(liveBeforeCanceled)
      .orderBy("payment.id")
      .limit(1)
      .$narrowType<{
        paymentId: KyselyNotNull
      }>()
  )

export const sparkReconciliationCandidateByAccountTransactionIdQuery = (
  accountTransactionId: AccountTransactionId
) =>
  createQuery((db) =>
    db
      .selectFrom("accountTransaction")
      .innerJoin(
        "accountTransactionSpark",
        "accountTransactionSpark.id",
        "accountTransaction.id"
      )
      .leftJoin(
        "accountTransactionLightning",
        "accountTransactionLightning.id",
        "accountTransaction.id"
      )
      .leftJoin(
        "accountTransactionSparkInvoice",
        "accountTransactionSparkInvoice.id",
        "accountTransaction.id"
      )
      .innerJoin("paymentBtc", (join) =>
        join.onRef("paymentBtc.accountId", "=", "accountTransaction.accountId")
      )
      .leftJoin("paymentBtcLightning", (join) =>
        join
          .onRef("paymentBtcLightning.id", "=", "paymentBtc.id")
          .on("paymentBtcLightning.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("paymentBtcSpark", (join) =>
        join
          .onRef("paymentBtcSpark.id", "=", "paymentBtc.id")
          .on("paymentBtcSpark.isDeleted", "is not", sqliteTrue)
      )
      .innerJoin("payment", "payment.id", "paymentBtc.id")
      .select(["payment.id as paymentId"])
      .where("accountTransaction.id", "=", accountTransactionId)
      .where("accountTransaction.kind", "=", "spark")
      .where("accountTransaction.currency", "=", "BTC")
      .where("accountTransaction.isDeleted", "is not", sqliteTrue)
      .where("accountTransactionSpark.isDeleted", "is not", sqliteTrue)
      .where("paymentBtc.isDeleted", "is not", sqliteTrue)
      .where("payment.isDeleted", "is not", sqliteTrue)
      .whereRef("paymentBtc.amountSats", "=", "accountTransaction.amount")
      .where((eb) =>
        eb.or([
          eb.and([
            eb("accountTransactionLightning.isDeleted", "is not", sqliteTrue),
            eb("paymentBtcLightning.lnInvoice", "is not", null),
            eb("accountTransactionLightning.lnInvoice", "is not", null),
            eb(
              "paymentBtcLightning.lnInvoice",
              "=",
              eb.ref("accountTransactionLightning.lnInvoice")
            ),
          ]),
          eb.and([
            eb(
              "accountTransactionSparkInvoice.isDeleted",
              "is not",
              sqliteTrue
            ),
            eb("paymentBtcSpark.sparkInvoice", "is not", null),
            eb("accountTransactionSparkInvoice.sparkInvoice", "is not", null),
            eb(
              "paymentBtcSpark.sparkInvoice",
              "=",
              eb.ref("accountTransactionSparkInvoice.sparkInvoice")
            ),
          ]),
        ])
      )
      .where(hasNoActiveClaim)
      .orderBy(liveBeforeCanceled)
      .orderBy("payment.id")
      .limit(1)
      .$narrowType<{
        paymentId: KyselyNotNull
      }>()
  )

export const sparkReconciliationCandidateByValuesQuery = ({
  accountId,
  amount,
  lnInvoice,
  sparkInvoice,
}: Pick<AccountTransactionRow, "accountId"> & {
  readonly amount: NonNegativeInteger
  readonly lnInvoice: NonEmptyString | null
  readonly sparkInvoice: NonEmptyString | null
}) =>
  createQuery((db) =>
    db
      .selectFrom("paymentBtc")
      .leftJoin("paymentBtcLightning", (join) =>
        join
          .onRef("paymentBtcLightning.id", "=", "paymentBtc.id")
          .on("paymentBtcLightning.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("paymentBtcSpark", (join) =>
        join
          .onRef("paymentBtcSpark.id", "=", "paymentBtc.id")
          .on("paymentBtcSpark.isDeleted", "is not", sqliteTrue)
      )
      .innerJoin("payment", "payment.id", "paymentBtc.id")
      .select(["payment.id as paymentId"])
      .where("paymentBtc.accountId", "=", accountId)
      .where("paymentBtc.amountSats", "=", amount)
      .where("paymentBtc.isDeleted", "is not", sqliteTrue)
      .where("payment.isDeleted", "is not", sqliteTrue)
      .where((eb) =>
        eb.or([
          ...(lnInvoice === null
            ? []
            : [
                eb.and([
                  eb("paymentBtcLightning.lnInvoice", "is not", null),
                  eb("paymentBtcLightning.lnInvoice", "=", lnInvoice),
                ]),
              ]),
          ...(sparkInvoice === null
            ? []
            : [
                eb.and([
                  eb("paymentBtcSpark.sparkInvoice", "is not", null),
                  eb("paymentBtcSpark.sparkInvoice", "=", sparkInvoice),
                ]),
              ]),
        ])
      )
      .where(hasNoActiveClaim)
      .orderBy(liveBeforeCanceled)
      .orderBy("payment.id")
      .limit(1)
      .$narrowType<{
        paymentId: KyselyNotNull
      }>()
  )

/**
 * The payment a Cashu movement settles (cashu/0005): the one whose
 * `paymentCashu` names its mint quote at the payment's mint (a quote id is
 * unique only within its mint), or the token receive it holds, at whatever
 * mint: whoever received the token trusted its mint (cashu/0011). By id only, never by amount: a token after its
 * input fee would never match one. A payment that already has money against
 * it takes nothing more; the movement stays unclaimed.
 */
export const cashuReconciliationCandidateByValuesQuery = ({
  accountId,
  quoteId,
  cashuOperationId,
  mintUrl,
}: Pick<AccountTransactionRow, "accountId"> &
  Pick<
    AccountTransactionCashuRow,
    "quoteId" | "cashuOperationId" | "mintUrl"
  >) =>
  createQuery((db) =>
    db
      .selectFrom("paymentCashu")
      .innerJoin("payment", "payment.id", "paymentCashu.id")
      .select(["payment.id as paymentId"])
      .where("paymentCashu.accountId", "=", accountId)
      .where("paymentCashu.isDeleted", "is not", sqliteTrue)
      .where("payment.isDeleted", "is not", sqliteTrue)
      .where((eb) =>
        eb.or([
          ...(quoteId === null
            ? []
            : [
                eb.and([
                  eb("paymentCashu.quoteId", "=", quoteId),
                  eb("paymentCashu.mintUrl", "=", mintUrl),
                ]),
              ]),
          eb("paymentCashu.receiveOperationId", "=", cashuOperationId),
        ])
      )
      .where(hasNoActiveClaim)
      .orderBy(liveBeforeCanceled)
      .orderBy("payment.id")
      .limit(1)
      .$narrowType<{ paymentId: KyselyNotNull }>()
  )

export const cashuReconciliationCandidateByAccountTransactionIdQuery = (
  accountTransactionId: AccountTransactionId
) =>
  createQuery((db) =>
    db
      .selectFrom("accountTransaction")
      .innerJoin(
        "accountTransactionCashu",
        "accountTransactionCashu.id",
        "accountTransaction.id"
      )
      .innerJoin("paymentCashu", (join) =>
        join
          .onRef("paymentCashu.accountId", "=", "accountTransaction.accountId")
          .on((eb) =>
            eb.or([
              eb.and([
                eb(
                  "paymentCashu.quoteId",
                  "=",
                  eb.ref("accountTransactionCashu.quoteId")
                ),
                eb(
                  "paymentCashu.mintUrl",
                  "=",
                  eb.ref("accountTransactionCashu.mintUrl")
                ),
              ]),
              eb(
                "paymentCashu.receiveOperationId",
                "=",
                eb.ref("accountTransactionCashu.cashuOperationId")
              ),
            ])
          )
      )
      .innerJoin("payment", "payment.id", "paymentCashu.id")
      .select(["payment.id as paymentId"])
      .where("accountTransaction.id", "=", accountTransactionId)
      .where("accountTransaction.kind", "=", "cashu")
      .where("accountTransaction.isDeleted", "is not", sqliteTrue)
      .where("accountTransactionCashu.isDeleted", "is not", sqliteTrue)
      .where("paymentCashu.isDeleted", "is not", sqliteTrue)
      .where("payment.isDeleted", "is not", sqliteTrue)
      .where(hasNoActiveClaim)
      .orderBy(liveBeforeCanceled)
      .orderBy("payment.id")
      .limit(1)
      .$narrowType<{ paymentId: KyselyNotNull }>()
  )
