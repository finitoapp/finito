import {
  evoluJsonArrayFrom,
  type KyselyNotNull,
  sqliteTrue,
} from "@evolu/common"
import { createQuery } from "../../evolu/schema.ts"
import type { BillId } from "../bill/bill-types.ts"
import { quotedAmountSatsSql } from "../shared/claimed-amount.ts"
import type { NonEmptyString, NonEmptyString255 } from "../shared/schema.ts"
import type { PaymentId, QerkoPaymentAttemptId } from "./payment-types.ts"

/**
 * Just the payment fields bill coverage needs, plus the satoshis each
 * Lightning method was quoted for. `paymentByIdQuery` cannot carry those —
 * they live on the method rows — and without them a satoshi settlement has
 * no rate to convert back to fiat with. See `calculateClaimedSum` and
 * `quotedAmountSats`.
 */
export const paymentBillCoverageByIdQuery = (idValue: PaymentId) =>
  createQuery((db) =>
    db
      .selectFrom("payment")
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
        "payment.id",
        "payment.billId",
        "payment.amount",
        "payment.currency",
        "payment.tipAmount",
        "paymentBtc.amountSats as btcAmountSats",
        "paymentCashu.amountSats as cashuAmountSats",
        "paymentLightningAddress.amountSats as lightningAddressAmountSats",
      ])
      .where("payment.id", "=", idValue)
      .where("payment.amount", "is not", null)
      .where("payment.currency", "is not", null)
      .where("payment.tipAmount", "is not", null)
      .$narrowType<{
        amount: KyselyNotNull
        currency: KyselyNotNull
        tipAmount: KyselyNotNull
      }>()
  )

export const paymentByIdQuery = (idValue: PaymentId) =>
  createQuery((db) =>
    db
      .selectFrom("payment")
      .selectAll()
      .where("id", "=", idValue)
      .where("amount", "is not", null)
      .where("currency", "is not", null)
      .where("tipAmount", "is not", null)
      .$narrowType<{
        amount: KyselyNotNull
        currency: KyselyNotNull
        tipAmount: KyselyNotNull
      }>()
  )

/**
 * Every non-deleted payment for a bill, newest first, with the transactions
 * claimed against it — the read model behind the bill detail page's
 * "payments on this bill" section. Mirrors `latestPaymentsQuery` in
 * `payment-history.tsx` (same shape, filtered by `billId` instead of capped
 * globally), so `derivePaymentStatus` can be computed the same way for each
 * row, and each row can show its payment method icons.
 *
 * `claimedTransactions` lists only claims whose `accountTransaction` is still
 * there: it feeds `derivePaymentStatus`'s `hasActiveClaim`, and a claim
 * pointing at a deleted transaction is not money that arrived — the bill's
 * own coverage (`calculateClaimedSum`) already ignores it, so counting it
 * here displayed a payment as paid while it funded nothing. Same reading
 * the editing lock settled on; see `claimedPaymentIdSet`.
 */
export const paymentsWithClaimsByBillIdQuery = (billId: BillId) =>
  createQuery((db) =>
    db
      .selectFrom("payment")
      .select([
        "payment.id",
        "payment.amount",
        "payment.currency",
        "payment.tipAmount",
        "payment.canceledAt",
        "payment.confirmedPaidAt",
        "payment.expiresAt",
        "payment.createdAt",
      ])
      .select((eb) =>
        evoluJsonArrayFrom(
          eb
            .selectFrom("reconciliationClaim")
            .innerJoin(
              "accountTransaction",
              "accountTransaction.id",
              "reconciliationClaim.accountTransactionId"
            )
            .select("accountTransaction.kind")
            .whereRef("reconciliationClaim.paymentId", "=", "payment.id")
            .where("reconciliationClaim.isDeleted", "is not", sqliteTrue)
            .where("accountTransaction.isDeleted", "is not", sqliteTrue)
            .where("accountTransaction.kind", "is not", null)
            .$narrowType<{ kind: KyselyNotNull }>()
        ).as("claimedTransactions")
      )
      .where("payment.billId", "=", billId)
      .where("payment.isDeleted", "is not", sqliteTrue)
      .where("payment.amount", "is not", null)
      .where("payment.currency", "is not", null)
      .where("payment.tipAmount", "is not", null)
      .where("payment.createdAt", "is not", null)
      .orderBy("payment.createdAt", "desc")
      .$narrowType<{
        amount: KyselyNotNull
        currency: KyselyNotNull
        tipAmount: KyselyNotNull
        createdAt: KyselyNotNull
      }>()
  )

/**
 * The account and invoice identifiers a Spark payment was prepared with, for
 * matching an incoming transfer the same way
 * `sparkReconciliationCandidateByAccountTransactionIdQuery` does.
 */
export const paymentSparkDetailsByIdQuery = (idValue: PaymentId) =>
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
      .select([
        "paymentBtc.accountId",
        "paymentBtc.amountSats",
        "paymentBtcLightning.lnInvoice",
        "paymentBtcSpark.sparkInvoice",
      ])
      .where("paymentBtc.id", "=", idValue)
      .where("paymentBtc.isDeleted", "is not", sqliteTrue)
      .where("paymentBtc.accountId", "is not", null)
      .where("paymentBtc.amountSats", "is not", null)
      .$narrowType<{
        accountId: KyselyNotNull
        amountSats: KyselyNotNull
      }>()
  )

/**
 * The account ids of a payment's prepared methods that never expire on
 * their own — a cash register drawer, a card terminal or a bank transfer.
 * Read by
 * `preparePaymentMethod`: `payment.expiresAt` describes the payment as a
 * whole, but the methods are not mutually exclusive (a payment can offer
 * Lightning *and* cash), so the payment only expires while every prepared
 * method has an expiry window of its own. See docs/bill-payment-states.md.
 */
export const paymentNonExpiringMethodsByIdQuery = (idValue: PaymentId) =>
  createQuery((db) =>
    db
      .selectFrom("payment")
      .leftJoin("paymentIban", (join) =>
        join
          .onRef("paymentIban.id", "=", "payment.id")
          .on("paymentIban.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("paymentCashRegister", (join) =>
        join
          .onRef("paymentCashRegister.id", "=", "payment.id")
          .on("paymentCashRegister.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("paymentCardSwitchio", (join) =>
        join
          .onRef("paymentCardSwitchio.id", "=", "payment.id")
          .on("paymentCardSwitchio.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("paymentQerkoTerminal", (join) =>
        join
          .onRef("paymentQerkoTerminal.id", "=", "payment.id")
          .on("paymentQerkoTerminal.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("paymentQerkoPayment", (join) =>
        join
          .onRef("paymentQerkoPayment.id", "=", "payment.id")
          .on("paymentQerkoPayment.isDeleted", "is not", sqliteTrue)
      )
      .select([
        "paymentIban.accountId as ibanAccountId",
        "paymentCashRegister.accountId as cashRegisterAccountId",
        "paymentCardSwitchio.accountId as cardAccountId",
        "paymentQerkoTerminal.accountId as qerkoAccountId",
        "paymentQerkoPayment.accountId as qerkoPaymentAccountId",
      ])
      .where("payment.id", "=", idValue)
      .where("payment.isDeleted", "is not", sqliteTrue)
  )

/**
 * The card-terminal row of a payment, read by `payPaymentWithSwitchioCard`
 * for the previous attempt's `unresolvedTransactionId`.
 */
export const paymentCardSwitchioByIdQuery = (idValue: PaymentId) =>
  createQuery((db) =>
    db
      .selectFrom("paymentCardSwitchio")
      .select([
        "id",
        "accountId",
        "transactionId",
        "unresolvedTransactionId",
        "approvedAt",
      ])
      .where("id", "=", idValue)
      .where("isDeleted", "is not", sqliteTrue)
      .where("accountId", "is not", null)
      .$narrowType<{ accountId: KyselyNotNull }>()
  )

/**
 * The Qerko terminal row of a payment: what `startQerkoTerminalPayment` reads
 * for the previous attempt, and `syncQerkoTerminalPayment` for the one it
 * polls.
 */
/** The Qerko payment row of a payment: present once the method was prepared. */
export const paymentQerkoPaymentByIdQuery = (idValue: PaymentId) =>
  createQuery((db) =>
    db
      .selectFrom("paymentQerkoPayment")
      .select(["id", "accountId"])
      .where("id", "=", idValue)
      .where("isDeleted", "is not", sqliteTrue)
      .where("accountId", "is not", null)
      .$narrowType<{ accountId: KyselyNotNull }>()
  )

const qerkoPaymentAttemptColumns = [
  "id",
  "paymentId",
  "qerkoPaymentId",
  "startedAt",
  "processingAt",
  "closedAt",
  "outcome",
  "failureReason",
  "chargedAmount",
  "providers",
] as const

/** One Qerko attempt, by the id `createQerkoPaymentAttemptId` derives. */
export const qerkoPaymentAttemptByIdQuery = (idValue: QerkoPaymentAttemptId) =>
  createQuery((db) =>
    db
      .selectFrom("qerkoPaymentAttempt")
      .select(qerkoPaymentAttemptColumns)
      .where("id", "=", idValue)
      .where("isDeleted", "is not", sqliteTrue)
      .where("paymentId", "is not", null)
      .where("qerkoPaymentId", "is not", null)
      .where("startedAt", "is not", null)
      .$narrowType<{
        paymentId: KyselyNotNull
        qerkoPaymentId: KyselyNotNull
        startedAt: KyselyNotNull
      }>()
  )

/** A payment's Qerko attempts, oldest first: its history in Qerko. */
export const qerkoPaymentAttemptsByPaymentIdQuery = (idValue: PaymentId) =>
  createQuery((db) =>
    db
      .selectFrom("qerkoPaymentAttempt")
      .select(qerkoPaymentAttemptColumns)
      .where("paymentId", "=", idValue)
      .where("isDeleted", "is not", sqliteTrue)
      .where("qerkoPaymentId", "is not", null)
      .where("startedAt", "is not", null)
      .orderBy("startedAt")
      .orderBy("id")
      .$narrowType<{
        paymentId: KyselyNotNull
        qerkoPaymentId: KyselyNotNull
        startedAt: KyselyNotNull
      }>()
  )

/** Every Qerko attempt still in progress, whichever payment it belongs to. */
export const pendingQerkoPaymentAttemptsQuery = createQuery((db) =>
  db
    .selectFrom("qerkoPaymentAttempt")
    .select(qerkoPaymentAttemptColumns)
    .where("closedAt", "is", null)
    .where("isDeleted", "is not", sqliteTrue)
    .where("paymentId", "is not", null)
    .where("qerkoPaymentId", "is not", null)
    .where("startedAt", "is not", null)
    .orderBy("startedAt")
    .$narrowType<{
      paymentId: KyselyNotNull
      qerkoPaymentId: KyselyNotNull
      startedAt: KyselyNotNull
    }>()
)

export const paymentQerkoTerminalByIdQuery = (idValue: PaymentId) =>
  createQuery((db) =>
    db
      .selectFrom("paymentQerkoTerminal")
      .select([
        "id",
        "accountId",
        "transactionId",
        "pendingTransactionId",
        "pendingSince",
        "unresolvedTransactionId",
        "terminalId",
        "terminalTid",
        "qerkoRefundId",
      ])
      .where("id", "=", idValue)
      .where("isDeleted", "is not", sqliteTrue)
      .where("accountId", "is not", null)
      .$narrowType<{ accountId: KyselyNotNull }>()
  )

/**
 * Every payment with a Qerko attempt still to be resolved, for the sync job:
 * a pending attempt is polled until Qerko gives a final answer, on whichever
 * device is open.
 */
export const pendingQerkoTerminalPaymentsQuery = createQuery((db) =>
  db
    .selectFrom("paymentQerkoTerminal")
    .select(["id", "accountId", "pendingTransactionId"])
    .where("isDeleted", "is not", sqliteTrue)
    .where("pendingTransactionId", "is not", null)
    .where("accountId", "is not", null)
    .$narrowType<{
      accountId: KyselyNotNull
      pendingTransactionId: KyselyNotNull
    }>()
)

/** A payment's Lightning address method, for `syncLightningAddressPayment`. */
export const paymentLightningAddressByIdQuery = (idValue: PaymentId) =>
  createQuery((db) =>
    db
      .selectFrom("paymentLightningAddress")
      .select([
        "id",
        "accountId",
        "amountSats",
        "lnInvoice",
        "paymentHash",
        "verifyUrl",
        "invoiceExpiresAt",
        "preimage",
      ])
      .where("id", "=", idValue)
      .where("isDeleted", "is not", sqliteTrue)
      .where("accountId", "is not", null)
      .where("amountSats", "is not", null)
      .where("lnInvoice", "is not", null)
      .where("paymentHash", "is not", null)
      .where("verifyUrl", "is not", null)
      .where("invoiceExpiresAt", "is not", null)
      .$narrowType<{
        accountId: KyselyNotNull
        amountSats: KyselyNotNull
        lnInvoice: KyselyNotNull
        paymentHash: KyselyNotNull
        verifyUrl: KyselyNotNull
        invoiceExpiresAt: KyselyNotNull
      }>()
  )

/**
 * Every Lightning address invoice not yet proved paid, on a payment nobody
 * settled another way, for the verify job (lightning-address/0005). The job
 * itself stops a day after the invoice expired.
 */
export const unsettledLightningAddressPaymentsQuery = createQuery((db) =>
  db
    .selectFrom("paymentLightningAddress")
    .innerJoin("payment", "payment.id", "paymentLightningAddress.id")
    .select([
      "paymentLightningAddress.id",
      "paymentLightningAddress.lnInvoice",
      "paymentLightningAddress.invoiceExpiresAt",
    ])
    .where("paymentLightningAddress.isDeleted", "is not", sqliteTrue)
    .where("paymentLightningAddress.preimage", "is", null)
    .where("paymentLightningAddress.lnInvoice", "is not", null)
    .where("paymentLightningAddress.invoiceExpiresAt", "is not", null)
    .where("payment.isDeleted", "is not", sqliteTrue)
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom("reconciliationClaim")
            .innerJoin(
              "accountTransaction",
              "accountTransaction.id",
              "reconciliationClaim.accountTransactionId"
            )
            .select("reconciliationClaim.id")
            .whereRef("reconciliationClaim.paymentId", "=", "payment.id")
            .where("reconciliationClaim.isDeleted", "is not", sqliteTrue)
            .where("accountTransaction.isDeleted", "is not", sqliteTrue)
        )
      )
    )
    .$narrowType<{
      lnInvoice: KyselyNotNull
      invoiceExpiresAt: KyselyNotNull
    }>()
)

/**
 * The payment a terminal request id was launched for — how a result that
 * arrives after Android restarted the app finds its way back.
 */
export const paymentCardSwitchioByTransactionIdQuery = (
  transactionId: NonEmptyString255
) =>
  createQuery((db) =>
    db
      .selectFrom("paymentCardSwitchio")
      .select(["id", "accountId"])
      .where("transactionId", "=", transactionId)
      .where("isDeleted", "is not", sqliteTrue)
      .where("accountId", "is not", null)
      .$narrowType<{ accountId: KyselyNotNull }>()
  )

/**
 * The account, amount, and symbol identifiers an IBAN payment was prepared
 * with, for matching an incoming bank transaction the same way
 * `ibanReconciliationCandidateByAccountTransactionIdQuery` does.
 */
export const paymentIbanDetailsByIdQuery = (idValue: PaymentId) =>
  createQuery((db) =>
    db
      .selectFrom("payment")
      .innerJoin("paymentIban", (join) =>
        join
          .onRef("paymentIban.id", "=", "payment.id")
          .on("paymentIban.isDeleted", "is not", sqliteTrue)
      )
      .select([
        "payment.amount",
        "payment.currency",
        "paymentIban.accountId",
        "paymentIban.variableSymbol",
        "paymentIban.specificSymbol",
      ])
      .where("payment.id", "=", idValue)
      .where("payment.isDeleted", "is not", sqliteTrue)
      .where("payment.amount", "is not", null)
      .where("payment.currency", "is not", null)
      .where("paymentIban.accountId", "is not", null)
      .$narrowType<{
        amount: KyselyNotNull
        currency: KyselyNotNull
        accountId: KyselyNotNull
      }>()
  )

/**
 * The payment row behind the payment detail screen. Deliberately separate
 * from `paymentRequestQuery`: that one joins all five prepared-method tables
 * for the waiting screen but skips `deviceId`/`tableId`/`updatedAt`, which
 * only the detail screen reads.
 */
export const paymentDetailQuery = (paymentId: PaymentId) =>
  createQuery((db) =>
    db
      .selectFrom("payment")
      // For the satoshi amount only: the detail screen reads its claimed
      // transactions in the payment's currency, and a BTC settlement needs
      // this to convert (see `toPaymentCurrencyAmount`).
      .leftJoin("paymentBtc", (join) =>
        join
          .onRef("paymentBtc.id", "=", "payment.id")
          .on("paymentBtc.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("paymentCashRegister", (join) =>
        join
          .onRef("paymentCashRegister.id", "=", "payment.id")
          .on("paymentCashRegister.isDeleted", "is not", sqliteTrue)
      )
      .select([
        "payment.id",
        "payment.deviceId",
        "payment.billId",
        "payment.tableId",
        "payment.amount",
        "payment.currency",
        "payment.tipAmount",
        "payment.canceledAt",
        "payment.confirmedPaidAt",
        "payment.excessAcknowledgedAt",
        "payment.expiresAt",
        "payment.createdAt",
        "payment.updatedAt",
        "paymentBtc.amountSats",
        "paymentCashRegister.receivedAmount as cashReceivedAmount",
      ])
      .where("payment.id", "=", paymentId)
      .where("payment.isDeleted", "is not", sqliteTrue)
      .where("payment.amount", "is not", null)
      .where("payment.currency", "is not", null)
      .where("payment.tipAmount", "is not", null)
      .where("payment.createdAt", "is not", null)
      .$narrowType<{
        amount: KyselyNotNull
        currency: KyselyNotNull
        tipAmount: KyselyNotNull
        createdAt: KyselyNotNull
      }>()
  )

export const paymentReconciliationsQuery = (paymentId: PaymentId) =>
  createQuery((db) =>
    db
      .selectFrom("reconciliationClaim")
      .innerJoin(
        "accountTransaction",
        "accountTransaction.id",
        "reconciliationClaim.accountTransactionId"
      )
      .leftJoin("account", (join) =>
        join
          .onRef("account.id", "=", "accountTransaction.accountId")
          .on("account.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("accountTransactionSource", (join) =>
        join
          .onRef(
            "accountTransactionSource.accountTransactionId",
            "=",
            "accountTransaction.id"
          )
          .on("accountTransactionSource.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("accountTransactionIban", (join) =>
        join
          .onRef("accountTransactionIban.id", "=", "accountTransaction.id")
          .on("accountTransactionIban.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("accountTransactionSpark", (join) =>
        join
          .onRef("accountTransactionSpark.id", "=", "accountTransaction.id")
          .on("accountTransactionSpark.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("accountTransactionLightning", (join) =>
        join
          .onRef("accountTransactionLightning.id", "=", "accountTransaction.id")
          .on("accountTransactionLightning.isDeleted", "is not", sqliteTrue)
      )
      // The quote each claim is measured against (`quotedAmountSats`).
      .leftJoin("paymentBtc", (join) =>
        join
          .onRef("paymentBtc.id", "=", "reconciliationClaim.paymentId")
          .on("paymentBtc.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("paymentCashu", (join) =>
        join
          .onRef("paymentCashu.id", "=", "reconciliationClaim.paymentId")
          .on("paymentCashu.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("paymentLightningAddress", (join) =>
        join
          .onRef(
            "paymentLightningAddress.id",
            "=",
            "reconciliationClaim.paymentId"
          )
          .on("paymentLightningAddress.isDeleted", "is not", sqliteTrue)
      )
      .select([
        "reconciliationClaim.id",
        "reconciliationClaim.source",
        "reconciliationClaim.claimedAt",
        "reconciliationClaim.accountTransactionId",
        "accountTransaction.accountId",
        "accountTransaction.kind as transactionKind",
        "accountTransaction.amount as transactionAmount",
        "accountTransaction.currency as transactionCurrency",
        "accountTransaction.occurredAt as transactionOccurredAt",
        "accountTransaction.note as transactionNote",
        "account.name as accountName",
        "accountTransactionSource.source as transactionSource",
        "accountTransactionSource.recordedAt as transactionRecordedAt",
        "accountTransactionIban.variableSymbol",
        "accountTransactionIban.bankReference",
        "accountTransactionSpark.sparkTransferId",
        "accountTransactionLightning.paymentHash",
        quotedAmountSatsSql({
          kind: "accountTransaction.kind",
          btc: "paymentBtc.amountSats",
          cashu: "paymentCashu.amountSats",
          lightningAddress: "paymentLightningAddress.amountSats",
        }).as("paymentAmountSats"),
        "accountTransactionLightning.preImage as preimage",
      ])
      .where("reconciliationClaim.paymentId", "=", paymentId)
      .where("reconciliationClaim.isDeleted", "is not", sqliteTrue)
      .where("accountTransaction.isDeleted", "is not", sqliteTrue)
      .where("reconciliationClaim.source", "is not", null)
      .where("reconciliationClaim.claimedAt", "is not", null)
      .where("accountTransaction.kind", "is not", null)
      .where("accountTransaction.amount", "is not", null)
      .where("accountTransaction.currency", "is not", null)
      .where("accountTransaction.occurredAt", "is not", null)
      .orderBy("reconciliationClaim.claimedAt", "desc")
      .$narrowType<{
        source: KyselyNotNull
        claimedAt: KyselyNotNull
        transactionKind: KyselyNotNull
        transactionAmount: KyselyNotNull
        transactionCurrency: KyselyNotNull
        transactionOccurredAt: KyselyNotNull
      }>()
  )

/**
 * The most recent payments, newest first — the read model behind the
 * `/activity` list. Mirrors `latestBillsQuery` in `bill-queries.ts`: embeds
 * everything `PaymentHistoryIssues` used to load per row via separate
 * `billId`/`paymentId`-scoped queries (`useBillCoverage`,
 * `activeClaimedTransactionsByPaymentIdQuery`, `claimedPaymentsByBillIdQuery`)
 * as `evoluJsonArrayFrom` subqueries, so the whole list loads in one round
 * trip instead of a per-row Suspense waterfall:
 *
 * - `ownClaimedTransactions` — this payment's own claimed transactions
 *   (mirrors `activeClaimedTransactionsByPaymentIdQuery`), for
 *   `derivePaymentHasExcessSettlement`.
 * - `billLines` — the bill's line ledger (mirrors `billLinesByBillIdQuery`),
 *   reduced via `calculateBillLineSummaries` for the bill's total.
 * - `billClaimedTransactions` — every claimed transaction across every
 *   payment on the same bill (mirrors `claimedTransactionsByBillIdQuery`),
 *   for the bill's `coverage` and for `hasOtherClaimedPayment` (any row here
 *   whose `paymentId` isn't this payment's). Reusing this instead of also
 *   embedding `claimedPaymentsByBillIdQuery`'s looser "has any claim at all"
 *   definition is a deliberate simplification: the two definitions only
 *   differ when a claim's `accountTransaction` was itself deleted after the
 *   fact, which no domain action in this app currently does.
 *
 * A `billId`-less payment naturally gets empty `billLines`/
 * `billClaimedTransactions` (the `whereRef` never matches `NULL`), the same
 * "nothing to flag" result the old `NO_BILL_ID` sentinel produced.
 *
 * Parametrized by `limit` for the infinite-scroll list: pass
 * `limit: pageSize + 1` and slice off the extra row to detect whether more
 * payments remain without a separate count query.
 */
export const latestPaymentsQuery = (limit: number) =>
  createQuery((db) =>
    db
      .selectFrom("payment")
      // The row's title and context in the activity list: which bill/table
      // it paid, or its sequential number for a standalone payment.
      .leftJoin("bill", (join) =>
        join
          .onRef("bill.id", "=", "payment.billId")
          .on("bill.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("table", (join) =>
        join
          .onRef("table.id", "=", "bill.tableId")
          .on("table.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("paymentNumber", (join) =>
        join
          .onRef("paymentNumber.id", "=", "payment.id")
          .on("paymentNumber.isDeleted", "is not", sqliteTrue)
      )
      .select([
        "payment.id",
        "payment.billId",
        "bill.label as billLabel",
        "bill.displayNumber as billDisplayNumber",
        "table.name as tableName",
        "paymentNumber.serialNumber as paymentSerialNumber",
        "payment.amount",
        "payment.currency",
        "payment.tipAmount",
        "payment.canceledAt",
        "payment.confirmedPaidAt",
        "payment.excessAcknowledgedAt",
        "payment.expiresAt",
        "payment.createdAt",
      ])
      .select((eb) => [
        evoluJsonArrayFrom(
          eb
            .selectFrom("reconciliationClaim as ownClaim")
            .innerJoin(
              "accountTransaction as ownClaimTx",
              "ownClaimTx.id",
              "ownClaim.accountTransactionId"
            )
            .leftJoin("paymentBtc as ownPaymentBtc", (join) =>
              join
                .onRef("ownPaymentBtc.id", "=", "ownClaim.paymentId")
                .on("ownPaymentBtc.isDeleted", "is not", sqliteTrue)
            )
            .leftJoin("paymentCashu as ownPaymentCashu", (join) =>
              join
                .onRef("ownPaymentCashu.id", "=", "ownClaim.paymentId")
                .on("ownPaymentCashu.isDeleted", "is not", sqliteTrue)
            )
            .leftJoin(
              "paymentLightningAddress as ownPaymentLightningAddress",
              (join) =>
                join
                  .onRef(
                    "ownPaymentLightningAddress.id",
                    "=",
                    "ownClaim.paymentId"
                  )
                  .on(
                    "ownPaymentLightningAddress.isDeleted",
                    "is not",
                    sqliteTrue
                  )
            )
            .select([
              "ownClaim.accountTransactionId",
              "ownClaimTx.kind as transactionKind",
              "ownClaimTx.amount",
              "ownClaimTx.currency",
              quotedAmountSatsSql({
                kind: "ownClaimTx.kind",
                btc: "ownPaymentBtc.amountSats",
                cashu: "ownPaymentCashu.amountSats",
                lightningAddress: "ownPaymentLightningAddress.amountSats",
              }).as("paymentAmountSats"),
            ])
            // The claim's payment is this row's payment (see the `whereRef`
            // below), so its amount and currency come from the outer query
            // rather than a second join.
            .select((ownEb) => [
              ownEb.ref("payment.amount").as("paymentAmount"),
              ownEb.ref("payment.currency").as("paymentCurrency"),
            ])
            .whereRef("ownClaim.paymentId", "=", "payment.id")
            .where("ownClaim.isDeleted", "is not", sqliteTrue)
            .where("ownClaim.accountTransactionId", "is not", null)
            .where("ownClaimTx.currency", "is not", null)
            .where("ownClaimTx.isDeleted", "is not", sqliteTrue)
            .where("ownClaimTx.amount", "is not", null)
            .where("ownClaimTx.kind", "is not", null)
            .$narrowType<{
              accountTransactionId: KyselyNotNull
              transactionKind: KyselyNotNull
              amount: KyselyNotNull
              currency: KyselyNotNull
              paymentAmount: KyselyNotNull
              paymentCurrency: KyselyNotNull
            }>()
        ).as("ownClaimedTransactions"),
        evoluJsonArrayFrom(
          eb
            .selectFrom("billLine")
            .select([
              "billLine.id",
              "billLine.billId",
              "billLine.deviceId",
              "billLine.catalogItemId",
              "billLine.itemId",
              "billLine.type",
              "billLine.kind",
              "billLine.quantity",
              "billLine.totalAmount",
              "billLine.createdAt",
              "billLine.updatedAt",
              "billLine.isDeleted",
              "billLine.ownerId",
            ])
            .whereRef("billLine.billId", "=", "payment.billId")
            .where("billLine.billId", "is not", null)
            .where("billLine.itemId", "is not", null)
            .where("billLine.type", "is not", null)
            .where("billLine.kind", "is not", null)
            .where("billLine.quantity", "is not", null)
            .where("billLine.totalAmount", "is not", null)
            // See `billLinesByBillIdQuery` for why the tie-break matters
            // and why it is free in this exact shape.
            .orderBy("billLine.createdAt", "asc")
            .orderBy("billLine.ownerId", "asc")
            .orderBy("billLine.id", "asc")
            .$narrowType<{
              billId: KyselyNotNull
              itemId: KyselyNotNull
              type: KyselyNotNull
              kind: KyselyNotNull
              quantity: KyselyNotNull
              totalAmount: KyselyNotNull
            }>()
        ).as("billLines"),
        evoluJsonArrayFrom(
          eb
            .selectFrom("item")
            .innerJoin("billLine as itemLine", "itemLine.itemId", "item.id")
            .select([
              "item.id",
              "item.catalogItemId",
              "item.name",
              "item.description",
              "item.currency",
              "item.unitAmount",
              "item.taxRateId",
              "item.createdAt",
              "item.updatedAt",
              "item.isDeleted",
              "item.ownerId",
            ])
            .distinct()
            .whereRef("itemLine.billId", "=", "payment.billId")
            .where("item.name", "is not", null)
            .where("item.currency", "is not", null)
            .where("item.unitAmount", "is not", null)
            .$narrowType<{
              name: KyselyNotNull
              currency: KyselyNotNull
              unitAmount: KyselyNotNull
            }>()
        ).as("billItems"),
        evoluJsonArrayFrom(
          eb
            .selectFrom("payment as billPayment")
            .innerJoin("reconciliationClaim as billClaim", (join) =>
              join
                .onRef("billClaim.paymentId", "=", "billPayment.id")
                .on("billClaim.isDeleted", "is not", sqliteTrue)
            )
            .innerJoin(
              "accountTransaction as billClaimTx",
              "billClaimTx.id",
              "billClaim.accountTransactionId"
            )
            .leftJoin("paymentBtc as billPaymentBtc", (join) =>
              join
                .onRef("billPaymentBtc.id", "=", "billPayment.id")
                .on("billPaymentBtc.isDeleted", "is not", sqliteTrue)
            )
            .leftJoin("paymentCashu as billPaymentCashu", (join) =>
              join
                .onRef("billPaymentCashu.id", "=", "billPayment.id")
                .on("billPaymentCashu.isDeleted", "is not", sqliteTrue)
            )
            .leftJoin(
              "paymentLightningAddress as billPaymentLightningAddress",
              (join) =>
                join
                  .onRef(
                    "billPaymentLightningAddress.id",
                    "=",
                    "billPayment.id"
                  )
                  .on(
                    "billPaymentLightningAddress.isDeleted",
                    "is not",
                    sqliteTrue
                  )
            )
            .select([
              "billPayment.id as paymentId",
              "billPayment.tipAmount",
              "billPayment.amount as paymentAmount",
              "billPayment.currency as paymentCurrency",
              quotedAmountSatsSql({
                kind: "billClaimTx.kind",
                btc: "billPaymentBtc.amountSats",
                cashu: "billPaymentCashu.amountSats",
                lightningAddress: "billPaymentLightningAddress.amountSats",
              }).as("paymentAmountSats"),
              "billClaim.accountTransactionId",
              "billClaimTx.amount",
              "billClaimTx.currency",
            ])
            .whereRef("billPayment.billId", "=", "payment.billId")
            .where("billPayment.isDeleted", "is not", sqliteTrue)
            .where("billPayment.tipAmount", "is not", null)
            .where("billPayment.amount", "is not", null)
            .where("billPayment.currency", "is not", null)
            .where("billClaim.accountTransactionId", "is not", null)
            .where("billClaimTx.isDeleted", "is not", sqliteTrue)
            .where("billClaimTx.amount", "is not", null)
            .where("billClaimTx.currency", "is not", null)
            .$narrowType<{
              tipAmount: KyselyNotNull
              paymentAmount: KyselyNotNull
              paymentCurrency: KyselyNotNull
              accountTransactionId: KyselyNotNull
              amount: KyselyNotNull
              currency: KyselyNotNull
            }>()
        ).as("billClaimedTransactions"),
      ])
      .where("payment.isDeleted", "is not", sqliteTrue)
      .where("payment.amount", "is not", null)
      .where("payment.currency", "is not", null)
      .where("payment.tipAmount", "is not", null)
      .where("payment.createdAt", "is not", null)
      .orderBy("payment.createdAt", "desc")
      .limit(limit)
      .$narrowType<{
        amount: KyselyNotNull
        currency: KyselyNotNull
        tipAmount: KyselyNotNull
        createdAt: KyselyNotNull
      }>()
  )

export const paymentRequestQuery = (paymentId: PaymentId) =>
  createQuery((db) =>
    db
      .selectFrom("payment")
      .leftJoin("paymentBtc", (join) =>
        join
          .onRef("paymentBtc.id", "=", "payment.id")
          .on("paymentBtc.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("paymentBtcLightning", (join) =>
        join
          .onRef("paymentBtcLightning.id", "=", "payment.id")
          .on("paymentBtcLightning.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("paymentBtcSpark", (join) =>
        join
          .onRef("paymentBtcSpark.id", "=", "payment.id")
          .on("paymentBtcSpark.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("paymentIban", (join) =>
        join
          .onRef("paymentIban.id", "=", "payment.id")
          .on("paymentIban.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("paymentCashRegister", (join) =>
        join
          .onRef("paymentCashRegister.id", "=", "payment.id")
          .on("paymentCashRegister.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("paymentCardSwitchio", (join) =>
        join
          .onRef("paymentCardSwitchio.id", "=", "payment.id")
          .on("paymentCardSwitchio.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("paymentQerkoTerminal", (join) =>
        join
          .onRef("paymentQerkoTerminal.id", "=", "payment.id")
          .on("paymentQerkoTerminal.isDeleted", "is not", sqliteTrue)
      )
      .leftJoin("paymentQerkoPayment", (join) =>
        join
          .onRef("paymentQerkoPayment.id", "=", "payment.id")
          .on("paymentQerkoPayment.isDeleted", "is not", sqliteTrue)
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
        "payment.id",
        "payment.billId",
        "payment.amount",
        "payment.currency",
        "payment.tipAmount",
        "payment.canceledAt",
        "payment.confirmedPaidAt",
        "payment.expiresAt",
        "payment.createdAt",
        "paymentBtc.amountSats",
        "paymentBtcLightning.lnInvoice",
        "paymentBtcSpark.sparkInvoice",
        "paymentIban.accountId as ibanAccountId",
        "paymentIban.variableSymbol",
        "paymentIban.specificSymbol",
        "paymentCashRegister.accountId as cashRegisterAccountId",
        "paymentCardSwitchio.accountId as cardAccountId",
        "paymentCardSwitchio.unresolvedTransactionId as cardUnresolvedTransactionId",
        "paymentQerkoTerminal.accountId as qerkoAccountId",
        "paymentQerkoTerminal.pendingTransactionId as qerkoPendingTransactionId",
        "paymentQerkoTerminal.unresolvedTransactionId as qerkoUnresolvedTransactionId",
        "paymentQerkoTerminal.failureReason as qerkoFailureReason",
        "paymentQerkoTerminal.terminalId as qerkoTerminalId",
        "paymentQerkoPayment.accountId as qerkoPaymentAccountId",
        "paymentCashu.accountId as cashuAccountId",
        "paymentCashu.amountSats as cashuAmountSats",
        "paymentCashu.lnInvoice as cashuLnInvoice",
        "paymentCashu.mintUrl as cashuMintUrl",
        "paymentCashu.quoteExpiresAt as cashuQuoteExpiresAt",
        "paymentCashu.receiveOperationId as cashuReceiveOperationId",
        "paymentLightningAddress.accountId as lightningAddressAccountId",
        "paymentLightningAddress.amountSats as lightningAddressAmountSats",
        "paymentLightningAddress.lnInvoice as lightningAddressLnInvoice",
        "paymentLightningAddress.invoiceExpiresAt as lightningAddressInvoiceExpiresAt",
        "paymentLightningAddress.preimage as lightningAddressPreimage",
      ])
      .where("payment.id", "=", paymentId)
      .where("payment.isDeleted", "is not", sqliteTrue)
      .where("payment.amount", "is not", null)
      .where("payment.currency", "is not", null)
      .where("payment.tipAmount", "is not", null)
      .$narrowType<{
        amount: KyselyNotNull
        currency: KyselyNotNull
        tipAmount: KyselyNotNull
      }>()
  )

/**
 * Whether this payment has money against it, as one row or none. Joined
 * through `accountTransaction` rather than counting claims outright: a claim
 * whose transaction was deleted is not money that arrived, and the bill's
 * coverage already ignores it — see `paymentsWithClaimsByBillIdQuery` and
 * `claimedPaymentIdSet` for the same reading elsewhere.
 */
export const paymentClaimsQuery = (paymentId: PaymentId) =>
  createQuery((db) =>
    db
      .selectFrom("reconciliationClaim")
      .innerJoin(
        "accountTransaction",
        "accountTransaction.id",
        "reconciliationClaim.accountTransactionId"
      )
      .select(["reconciliationClaim.id", "reconciliationClaim.claimedAt"])
      .where("reconciliationClaim.paymentId", "=", paymentId)
      .where("reconciliationClaim.isDeleted", "is not", sqliteTrue)
      .where("accountTransaction.isDeleted", "is not", sqliteTrue)
      .limit(1)
  )

/**
 * Payments of ours this Lightning invoice belongs to, from Spark or from the
 * merchant's Lightning address. A withdrawal refuses to pay one
 * (withdraw/0006). Invoices are stored lowercase, as the SDK returns them and
 * as `parseLightningInvoice` gives them.
 */
export const paymentIdsByLnInvoiceQuery = (lnInvoice: NonEmptyString) =>
  createQuery((db) =>
    db
      .selectFrom("paymentBtcLightning")
      .select(["paymentBtcLightning.id"])
      .where("paymentBtcLightning.lnInvoice", "=", lnInvoice)
      .union(
        db
          .selectFrom("paymentLightningAddress")
          .select(["paymentLightningAddress.id"])
          .where("paymentLightningAddress.lnInvoice", "=", lnInvoice)
      )
      .limit(1)
  )

/**
 * The mint quotes of Payky's Cashu payments: which pending `topup`
 * operations in the shared wallet the Cashu job settles. Linky's own topups
 * are Linky's to resume.
 */
export const cashuPaymentQuotesQuery = createQuery((db) =>
  db
    .selectFrom("paymentCashu")
    .innerJoin("payment", "payment.id", "paymentCashu.id")
    .select(["paymentCashu.quoteId", "paymentCashu.mintUrl"])
    .where("paymentCashu.isDeleted", "is not", sqliteTrue)
    .where("payment.isDeleted", "is not", sqliteTrue)
    .where("paymentCashu.quoteId", "is not", null)
    .where("paymentCashu.mintUrl", "is not", null)
    .$narrowType<{ quoteId: KyselyNotNull; mintUrl: KyselyNotNull }>()
)

/**
 * The payments a Cashu token may pay (cashu/0006): every one with a Cashu
 * method, with what decides whether it is still open. Few rows: only
 * payments a Cashu tab was opened for.
 */
export const cashuTokenCandidatePaymentsQuery = createQuery((db) =>
  db
    .selectFrom("paymentCashu")
    .innerJoin("payment", "payment.id", "paymentCashu.id")
    .select((eb) => [
      "payment.id as paymentId",
      "payment.canceledAt",
      "payment.confirmedPaidAt",
      "payment.expiresAt",
      "paymentCashu.amountSats",
      "paymentCashu.receiveOperationId",
      eb
        .exists(
          eb
            .selectFrom("reconciliationClaim")
            .innerJoin(
              "accountTransaction",
              "accountTransaction.id",
              "reconciliationClaim.accountTransactionId"
            )
            .select("reconciliationClaim.id")
            .whereRef("reconciliationClaim.paymentId", "=", "payment.id")
            .where("reconciliationClaim.isDeleted", "is not", sqliteTrue)
            .where("accountTransaction.isDeleted", "is not", sqliteTrue)
        )
        .$castTo<0 | 1>()
        .as("hasActiveClaim"),
    ])
    .where("paymentCashu.isDeleted", "is not", sqliteTrue)
    .where("payment.isDeleted", "is not", sqliteTrue)
    .where("paymentCashu.mintUrl", "is not", null)
    .where("paymentCashu.amountSats", "is not", null)
    .$narrowType<{ mintUrl: KyselyNotNull; amountSats: KyselyNotNull }>()
)

/**
 * One payment that has fulfilled its purpose, if the account has any: money
 * claimed against it, or staff's explicit `confirmedPaidAt`. The same reading
 * as `derivePaymentStatus`'s "paid": a canceled payment counts only once
 * confirmed, and a claim on a deleted transaction is not money that arrived.
 * Created or pending payments never count.
 */
export const firstPaidPaymentQuery = createQuery((db) =>
  db
    .selectFrom("payment")
    .select("payment.id")
    .where("payment.isDeleted", "is not", sqliteTrue)
    .where((eb) =>
      eb.or([
        eb("payment.confirmedPaidAt", "is not", null),
        eb.and([
          eb("payment.canceledAt", "is", null),
          eb.exists(
            eb
              .selectFrom("reconciliationClaim")
              .innerJoin(
                "accountTransaction",
                "accountTransaction.id",
                "reconciliationClaim.accountTransactionId"
              )
              .select("reconciliationClaim.id")
              .whereRef("reconciliationClaim.paymentId", "=", "payment.id")
              .where("reconciliationClaim.isDeleted", "is not", sqliteTrue)
              .where("accountTransaction.isDeleted", "is not", sqliteTrue)
              .where("accountTransaction.kind", "is not", null)
          ),
        ]),
      ])
    )
    .limit(1)
)
