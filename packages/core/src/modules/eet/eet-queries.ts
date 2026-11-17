import {
  evoluJsonArrayFrom,
  type KyselyNotNull,
  kyselySql,
  sqliteTrue,
} from "@evolu/common"

import { createQuery } from "../../evolu/schema.ts"
import type { BillId } from "../bill/bill-types.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import type { RefundId } from "../refund/refund-types.ts"
import { quotedAmountSatsSql } from "../shared/claimed-amount.ts"
import type { EetDateTime, EetReversalId, EetSaleId } from "./eet-types.ts"
import { eetSettingsId } from "./eet-utils.ts"

/**
 * When every reported sale of the payment `paymentId` names was confirmed,
 * `null` while one is not, or while it has none: a reversal is sent only
 * after its sales were. A correlated subquery, so a query works it out for
 * the rows it keeps rather than grouping every sale ever recorded.
 */
const saleConfirmedAtSql = (
  paymentId: "refund.paymentId" | "eetReversal.paymentId"
) =>
  kyselySql<EetDateTime | null>`(select case when count("eetSaleConfirmation"."id") = count(*) then max("eetSaleConfirmation"."receivedAt") end from "eetSale" left join "eetSaleConfirmation" on "eetSaleConfirmation"."id" = "eetSale"."id" and "eetSaleConfirmation"."isDeleted" is not ${sqliteTrue} where "eetSale"."paymentId" = ${kyselySql.ref(paymentId)} and "eetSale"."isDeleted" is not ${sqliteTrue} and "eetSale"."unsupportedReason" is null)`

export const eetSettingsQuery = createQuery((db) =>
  db
    .selectFrom("eetSettings")
    .leftJoin("eetCertificate", (join) =>
      join
        .onRef("eetCertificate.id", "=", "eetSettings.certificateId")
        .on("eetCertificate.isDeleted", "is not", sqliteTrue)
    )
    .select([
      "eetSettings.enabledAt",
      "eetSettings.environment",
      "eetSettings.establishmentId",
      "eetSettings.certificateId",
      "eetSettings.tipOwner",
      "eetCertificate.eic",
      "eetCertificate.description",
      "eetCertificate.validFrom",
      "eetCertificate.validTo",
      "eetCertificate.isTestCertificate",
    ])
    .where("eetSettings.id", "=", eetSettingsId)
    .where("eetSettings.isDeleted", "is not", sqliteTrue)
)

export const eetSigningCertificateQuery = createQuery((db) =>
  db
    .selectFrom("eetSettings")
    .innerJoin(
      "eetCertificate",
      "eetCertificate.id",
      "eetSettings.certificateId"
    )
    .select([
      "eetCertificate.eic",
      "eetCertificate.certificateDer",
      "eetCertificate.privateKeyPkcs8",
      "eetCertificate.isTestCertificate",
    ])
    .where("eetSettings.id", "=", eetSettingsId)
    .where("eetSettings.isDeleted", "is not", sqliteTrue)
    .where("eetCertificate.isDeleted", "is not", sqliteTrue)
    .where("eetCertificate.eic", "is not", null)
    .where("eetCertificate.certificateDer", "is not", null)
    .where("eetCertificate.privateKeyPkcs8", "is not", null)
    .$narrowType<{
      eic: KyselyNotNull
      certificateDer: KyselyNotNull
      privateKeyPkcs8: KyselyNotNull
    }>()
)

/**
 * Changes whenever an EET sale, extra sale or reversal may have become due:
 * a claim, sale, sale confirmation or refund was written, or the EET
 * settings changed. No row while EET is off.
 *
 * The reporting job subscribes to this instead of the queries that find
 * what is due (`eetPaymentsToReportQuery`, `eetExtraClaimsQuery`,
 * `eetRefundsToReverseQuery`). Those read every claim made since EET was
 * enabled, and Evolu re-runs every subscribed query after every write, on
 * the payment terminal on its UI thread. A count, deleted rows included,
 * changes with every row written; the latest `updatedAt` with every later
 * change. A change synced with an older timestamp than the newest row moves
 * neither, which the job's periodic check catches (eet/0013).
 */
export const eetCreationTriggerQuery = createQuery((db) =>
  db
    .selectFrom("eetSettings")
    .select([
      "eetSettings.enabledAt",
      "eetSettings.tipOwner",
      kyselySql<number>`(select count(*) from "reconciliationClaim")`.as(
        "claimCount"
      ),
      kyselySql<
        string | null
      >`(select max("updatedAt") from "reconciliationClaim")`.as(
        "claimUpdatedAt"
      ),
      kyselySql<number>`(select count(*) from "eetSale")`.as("saleCount"),
      kyselySql<string | null>`(select max("updatedAt") from "eetSale")`.as(
        "saleUpdatedAt"
      ),
      kyselySql<number>`(select count(*) from "eetSaleConfirmation")`.as(
        "saleConfirmationCount"
      ),
      kyselySql<number>`(select count(*) from "refund")`.as("refundCount"),
      kyselySql<string | null>`(select max("updatedAt") from "refund")`.as(
        "refundUpdatedAt"
      ),
    ])
    .where("eetSettings.id", "=", eetSettingsId)
    .where("eetSettings.isDeleted", "is not", sqliteTrue)
    .where("eetSettings.enabledAt", "is not", null)
)

/**
 * Payments EET reports a sale for: settled first at or after EET was
 * enabled, with no sale record yet.
 *
 * Driven from the claims made since EET was enabled
 * (`reconciliationClaim_claimedAt`), so a payment settled before then, or
 * never, costs nothing. The job keeps this subscribed, and Evolu re-runs it
 * after every write (payment/0026's context).
 */
export const eetPaymentsToReportQuery = createQuery((db) =>
  db
    .selectFrom((eb) =>
      eb
        .selectFrom("eetSettings")
        .innerJoin("reconciliationClaim", (join) =>
          join.onRef(
            "reconciliationClaim.claimedAt",
            ">=",
            "eetSettings.enabledAt"
          )
        )
        .select((eb) => [
          "reconciliationClaim.paymentId",
          "eetSettings.enabledAt",
          // The first active claim decides when the payment counts as
          // settled and by what method.
          eb
            .selectFrom("reconciliationClaim as firstClaim")
            .innerJoin(
              "accountTransaction",
              "accountTransaction.id",
              "firstClaim.accountTransactionId"
            )
            .innerJoin("account", "account.id", "accountTransaction.accountId")
            .select("firstClaim.id")
            .whereRef(
              "firstClaim.paymentId",
              "=",
              "reconciliationClaim.paymentId"
            )
            .where("firstClaim.isDeleted", "is not", sqliteTrue)
            .where("accountTransaction.isDeleted", "is not", sqliteTrue)
            .where("firstClaim.claimedAt", "is not", null)
            .where("account.kind", "is not", null)
            .orderBy("firstClaim.claimedAt")
            .orderBy("firstClaim.id")
            .limit(1)
            .as("firstClaimId"),
        ])
        .distinct()
        .where("eetSettings.id", "=", eetSettingsId)
        .where("eetSettings.isDeleted", "is not", sqliteTrue)
        .where("eetSettings.enabledAt", "is not", null)
        .where("reconciliationClaim.isDeleted", "is not", sqliteTrue)
        .where((eb) =>
          eb.not(
            eb.exists(
              eb
                .selectFrom("eetSale")
                .select("eetSale.id")
                .whereRef(
                  "eetSale.paymentId",
                  "=",
                  "reconciliationClaim.paymentId"
                )
                .where("eetSale.extraFrom", "is", null)
            )
          )
        )
        .as("candidate")
    )
    .innerJoin("payment", "payment.id", "candidate.paymentId")
    .innerJoin(
      "reconciliationClaim",
      "reconciliationClaim.id",
      "candidate.firstClaimId"
    )
    .innerJoin(
      "accountTransaction",
      "accountTransaction.id",
      "reconciliationClaim.accountTransactionId"
    )
    .innerJoin("account", "account.id", "accountTransaction.accountId")
    .leftJoin("paymentCashRegister", (join) =>
      join
        .onRef("paymentCashRegister.id", "=", "payment.id")
        .on("paymentCashRegister.isDeleted", "is not", sqliteTrue)
    )
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
      "payment.tipAmount",
      "payment.currency",
      "payment.deviceId as paymentDeviceId",
      "paymentCashRegister.receivedAmount as cashReceivedAmount",
      // The first claim's own method sets the rate (`quotedAmountSats`).
      quotedAmountSatsSql({
        kind: "accountTransaction.kind",
        btc: "paymentBtc.amountSats",
        cashu: "paymentCashu.amountSats",
        lightningAddress: "paymentLightningAddress.amountSats",
      }).as("paymentAmountSats"),
      "candidate.enabledAt",
      "reconciliationClaim.claimedAt as firstClaimedAt",
      "reconciliationClaim.deviceId as firstClaimDeviceId",
      "account.kind as method",
      "accountTransaction.id as firstClaimTransactionId",
      "accountTransaction.amount as firstClaimAmount",
      "accountTransaction.currency as firstClaimCurrency",
    ])
    .where("payment.isDeleted", "is not", sqliteTrue)
    .where("payment.amount", "is not", null)
    .where("payment.tipAmount", "is not", null)
    .where("payment.currency", "is not", null)
    .whereRef("reconciliationClaim.claimedAt", ">=", "candidate.enabledAt")
    .$narrowType<{
      amount: KyselyNotNull
      tipAmount: KyselyNotNull
      currency: KyselyNotNull
      enabledAt: KyselyNotNull
      firstClaimedAt: KyselyNotNull
      method: KyselyNotNull
      firstClaimTransactionId: KyselyNotNull
      firstClaimAmount: KyselyNotNull
      firstClaimCurrency: KyselyNotNull
    }>()
)

/**
 * Every claim of a payment that may have received more than its amount, for
 * `deriveDueEetExtraSale`. Only payments claimed at or after EET was enabled
 * can owe an extra sale (its `extraFrom` counts the earlier claims), so they
 * drive the query (`reconciliationClaim_claimedAt`), and its cost follows
 * the claims made since then, not the whole history.
 */
export const eetExtraClaimsQuery = createQuery((db) =>
  db
    .selectFrom("reconciliationClaim")
    .innerJoin(
      "accountTransaction",
      "accountTransaction.id",
      "reconciliationClaim.accountTransactionId"
    )
    .innerJoin("account", "account.id", "accountTransaction.accountId")
    .innerJoin("payment", "payment.id", "reconciliationClaim.paymentId")
    .innerJoin("eetSettings", (join) =>
      join
        .on("eetSettings.id", "=", eetSettingsId)
        .on("eetSettings.isDeleted", "is not", sqliteTrue)
    )
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
    .select((eb) => [
      "reconciliationClaim.id as claimId",
      "reconciliationClaim.claimedAt",
      "reconciliationClaim.deviceId",
      "reconciliationClaim.accountTransactionId",
      "account.kind as method",
      "accountTransaction.amount",
      "accountTransaction.currency",
      "payment.id as paymentId",
      "payment.billId",
      "payment.deviceId as paymentDeviceId",
      "payment.amount as paymentAmount",
      "payment.tipAmount as paymentTipAmount",
      "payment.currency as paymentCurrency",
      quotedAmountSatsSql({
        kind: "accountTransaction.kind",
        btc: "paymentBtc.amountSats",
        cashu: "paymentCashu.amountSats",
        lightningAddress: "paymentLightningAddress.amountSats",
      }).as("paymentAmountSats"),
      "eetSettings.enabledAt",
      "eetSettings.tipOwner",
      evoluJsonArrayFrom(
        eb
          .selectFrom("eetSale")
          .select("eetSale.accountTransactionId")
          .whereRef("eetSale.paymentId", "=", "payment.id")
          .where("eetSale.isDeleted", "is not", sqliteTrue)
          .where("eetSale.extraFrom", "is", null)
      ).as("sales"),
      eb
        .selectFrom("eetSale")
        .select((eb) => eb.fn.sum<number>("eetSale.amount").as("amount"))
        .whereRef("eetSale.paymentId", "=", "payment.id")
        .where("eetSale.isDeleted", "is not", sqliteTrue)
        .where("eetSale.extraFrom", "is not", null)
        .as("reportedExtra"),
    ])
    // The payments worth the full check below: claimed since EET was
    // enabled, and either settled by more than one transaction, or by one
    // larger than the payment in its currency, or by one in another
    // currency, which only the full check can compare.
    .where("reconciliationClaim.paymentId", "in", (eb) =>
      eb
        .selectFrom("eetSettings")
        .innerJoin("reconciliationClaim as sinceEnabled", (join) =>
          join.onRef("sinceEnabled.claimedAt", ">=", "eetSettings.enabledAt")
        )
        .innerJoin(
          "accountTransaction as sinceEnabledTransaction",
          "sinceEnabledTransaction.id",
          "sinceEnabled.accountTransactionId"
        )
        .innerJoin(
          "payment as sinceEnabledPayment",
          "sinceEnabledPayment.id",
          "sinceEnabled.paymentId"
        )
        .select("sinceEnabled.paymentId")
        .where("eetSettings.id", "=", eetSettingsId)
        .where("eetSettings.isDeleted", "is not", sqliteTrue)
        .where("sinceEnabled.isDeleted", "is not", sqliteTrue)
        .where((eb) =>
          eb.or([
            eb(
              "sinceEnabledTransaction.currency",
              "!=",
              eb.ref("sinceEnabledPayment.currency")
            ),
            eb(
              "sinceEnabledTransaction.amount",
              ">",
              eb.ref("sinceEnabledPayment.amount")
            ),
            eb.exists(
              eb
                .selectFrom("reconciliationClaim as secondClaim")
                .select("secondClaim.id")
                .whereRef(
                  "secondClaim.paymentId",
                  "=",
                  "sinceEnabled.paymentId"
                )
                .whereRef(
                  "secondClaim.accountTransactionId",
                  "!=",
                  "sinceEnabled.accountTransactionId"
                )
                .where("secondClaim.isDeleted", "is not", sqliteTrue)
            ),
          ])
        )
    )
    .where("reconciliationClaim.isDeleted", "is not", sqliteTrue)
    .where("reconciliationClaim.claimedAt", "is not", null)
    .where("accountTransaction.isDeleted", "is not", sqliteTrue)
    .where("accountTransaction.amount", "is not", null)
    .where("accountTransaction.currency", "is not", null)
    .where("account.kind", "is not", null)
    .where("payment.isDeleted", "is not", sqliteTrue)
    .where("payment.amount", "is not", null)
    .where("payment.currency", "is not", null)
    .where("eetSettings.enabledAt", "is not", null)
    .where((eb) =>
      eb.or([
        eb.and([
          eb("accountTransaction.currency", "=", eb.ref("payment.currency")),
          eb("accountTransaction.amount", ">", eb.ref("payment.amount")),
        ]),
        eb.and([
          eb("accountTransaction.currency", "!=", eb.ref("payment.currency")),
          eb(
            "accountTransaction.amount",
            ">",
            quotedAmountSatsSql({
              kind: "accountTransaction.kind",
              btc: "paymentBtc.amountSats",
              cashu: "paymentCashu.amountSats",
              lightningAddress: "paymentLightningAddress.amountSats",
            })
          ),
        ]),
        // Settled by more than one transaction: this claim's own is one of
        // them, so another one is enough.
        eb.exists(
          eb
            .selectFrom("reconciliationClaim as otherClaim")
            .innerJoin(
              "accountTransaction as otherTransaction",
              "otherTransaction.id",
              "otherClaim.accountTransactionId"
            )
            .select("otherClaim.id")
            .whereRef("otherClaim.paymentId", "=", "payment.id")
            .whereRef(
              "otherClaim.accountTransactionId",
              "!=",
              "reconciliationClaim.accountTransactionId"
            )
            .where("otherClaim.isDeleted", "is not", sqliteTrue)
            .where("otherClaim.claimedAt", "is not", null)
            .where("otherTransaction.isDeleted", "is not", sqliteTrue)
        ),
      ])
    )
    .$narrowType<{
      claimedAt: KyselyNotNull
      accountTransactionId: KyselyNotNull
      method: KyselyNotNull
      amount: KyselyNotNull
      currency: KyselyNotNull
      paymentAmount: KyselyNotNull
      paymentCurrency: KyselyNotNull
      enabledAt: KyselyNotNull
    }>()
)

export const eetSalesToDeliverQuery = createQuery((db) =>
  db
    .selectFrom("eetSale")
    .leftJoin("eetSaleConfirmation", (join) =>
      join
        .onRef("eetSaleConfirmation.id", "=", "eetSale.id")
        .on("eetSaleConfirmation.isDeleted", "is not", sqliteTrue)
    )
    .select(["eetSale.id", "eetSale.deviceId", "eetSale.saleAt"])
    .where("eetSale.isDeleted", "is not", sqliteTrue)
    .where("eetSale.deviceId", "is not", null)
    .where("eetSale.saleAt", "is not", null)
    .where("eetSale.unsupportedReason", "is", null)
    .where((eb) =>
      eb.or([
        eb("eetSale.lastAttemptResult", "is", null),
        eb("eetSale.lastAttemptResult", "=", "retry"),
      ])
    )
    .where("eetSaleConfirmation.id", "is", null)
    .orderBy("eetSale.createdAt")
    .$narrowType<{ deviceId: KyselyNotNull; saleAt: KyselyNotNull }>()
)

const eetSaleColumns = [
  "eetSale.id",
  "eetSale.paymentId",
  "eetSale.billId",
  "eetSale.deviceId",
  "eetSale.method",
  "eetSale.amount",
  "eetSale.reportedTipAmount",
  "eetSale.currency",
  "eetSale.environment",
  "eetSale.eic",
  "eetSale.establishmentId",
  "eetSale.cashRegisterId",
  "eetSale.sequenceNumber",
  "eetSale.saleAt",
  "eetSale.unsupportedReason",
  "eetSale.hadUnansweredAttempt",
  "eetSale.attemptStartedAt",
  "eetSale.lastAttemptAt",
  "eetSale.lastAttemptResult",
  "eetSale.lastErrorType",
  "eetSale.lastErrorCode",
  "eetSale.lastErrorMessage",
  "eetSale.lastGlobalTransactionId",
  "eetSale.extraFrom",
  "eetSale.accountTransactionId",
  "eetSaleConfirmation.pok",
  "eetSaleConfirmation.receivedAt",
  "eetSaleConfirmation.isTest",
  "eetSaleConfirmation.warningsJson",
  "eetSaleConfirmation.globalTransactionId",
] as const

type EetSaleRequiredColumns = {
  paymentId: KyselyNotNull
  deviceId: KyselyNotNull
  method: KyselyNotNull
  amount: KyselyNotNull
  currency: KyselyNotNull
  environment: KyselyNotNull
  eic: KyselyNotNull
  establishmentId: KyselyNotNull
  cashRegisterId: KyselyNotNull
  sequenceNumber: KyselyNotNull
  saleAt: KyselyNotNull
}

export const eetSaleByIdQuery = (saleId: EetSaleId) =>
  createQuery((db) =>
    db
      .selectFrom("eetSale")
      .leftJoin("eetSaleConfirmation", (join) =>
        join
          .onRef("eetSaleConfirmation.id", "=", "eetSale.id")
          .on("eetSaleConfirmation.isDeleted", "is not", sqliteTrue)
      )
      .select(eetSaleColumns)
      .where("eetSale.id", "=", saleId)
      .where("eetSale.isDeleted", "is not", sqliteTrue)
      .where("eetSale.paymentId", "is not", null)
      .where("eetSale.saleAt", "is not", null)
      .$narrowType<EetSaleRequiredColumns>()
  )

export const eetSalesByPaymentIdQuery = (paymentId: PaymentId) =>
  createQuery((db) =>
    db
      .selectFrom("eetSale")
      .leftJoin("eetSaleConfirmation", (join) =>
        join
          .onRef("eetSaleConfirmation.id", "=", "eetSale.id")
          .on("eetSaleConfirmation.isDeleted", "is not", sqliteTrue)
      )
      .select(eetSaleColumns)
      .where("eetSale.paymentId", "=", paymentId)
      .where("eetSale.isDeleted", "is not", sqliteTrue)
      .where("eetSale.saleAt", "is not", null)
      .orderBy("eetSale.extraFrom")
      .$narrowType<EetSaleRequiredColumns>()
  )

export const eetSalesByBillIdQuery = (billId: BillId) =>
  createQuery((db) =>
    db
      .selectFrom("eetSale")
      .leftJoin("eetSaleConfirmation", (join) =>
        join
          .onRef("eetSaleConfirmation.id", "=", "eetSale.id")
          .on("eetSaleConfirmation.isDeleted", "is not", sqliteTrue)
      )
      .select(eetSaleColumns)
      .where("eetSale.billId", "=", billId)
      .where("eetSale.isDeleted", "is not", sqliteTrue)
      .where("eetSale.extraFrom", "is", null)
      .where("eetSale.paymentId", "is not", null)
      .where("eetSale.saleAt", "is not", null)
      .$narrowType<EetSaleRequiredColumns>()
  )

export const unconfirmedEetSalesQuery = createQuery((db) =>
  db
    .selectFrom("eetSale")
    .leftJoin("eetSaleConfirmation", (join) =>
      join
        .onRef("eetSaleConfirmation.id", "=", "eetSale.id")
        .on("eetSaleConfirmation.isDeleted", "is not", sqliteTrue)
    )
    .select(eetSaleColumns)
    .where("eetSale.isDeleted", "is not", sqliteTrue)
    .where("eetSaleConfirmation.id", "is", null)
    .where("eetSale.paymentId", "is not", null)
    .where("eetSale.saleAt", "is not", null)
    .orderBy("eetSale.saleAt", "desc")
    .$narrowType<EetSaleRequiredColumns>()
)

export const eetRefundsToReverseQuery = createQuery((db) =>
  db
    .selectFrom("refund")
    .innerJoin("eetSale", "eetSale.paymentId", "refund.paymentId")
    // The cash a refund from the register handed out (refund/0012).
    .leftJoin("refundCashRegister", (join) =>
      join
        .onRef("refundCashRegister.id", "=", "refund.id")
        .on("refundCashRegister.isDeleted", "is not", sqliteTrue)
    )
    .select([
      "refund.id",
      "refund.paymentId",
      "refund.deviceId",
      "refund.amount",
      "refundCashRegister.handedAmount as cashHandedAmount",
      "refund.isTip",
      "refund.refundedAt",
      "eetSale.id as saleId",
      saleConfirmedAtSql("refund.paymentId").as("saleConfirmedAt"),
    ])
    .where("refund.deviceId", "is not", null)
    .where("refund.isDeleted", "is not", sqliteTrue)
    .where("refund.paymentId", "is not", null)
    .where("refund.amount", "is not", null)
    .where("refund.refundedAt", "is not", null)
    .where("eetSale.isDeleted", "is not", sqliteTrue)
    .where("eetSale.extraFrom", "is", null)
    .where("eetSale.unsupportedReason", "is", null)
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom("eetReversal")
            .select("eetReversal.id")
            .whereRef("eetReversal.refundId", "=", "refund.id")
        )
      )
    )
    .orderBy("refund.refundedAt")
    .$narrowType<{
      paymentId: KyselyNotNull
      deviceId: KyselyNotNull
      amount: KyselyNotNull
      refundedAt: KyselyNotNull
    }>()
)

export const eetReversalsToDeliverQuery = createQuery((db) =>
  db
    .selectFrom("eetReversal")
    .leftJoin("eetReversalConfirmation", (join) =>
      join
        .onRef("eetReversalConfirmation.id", "=", "eetReversal.id")
        .on("eetReversalConfirmation.isDeleted", "is not", sqliteTrue)
    )
    .select([
      "eetReversal.id",
      "eetReversal.deviceId",
      "eetReversal.saleAt",
      saleConfirmedAtSql("eetReversal.paymentId").as("saleConfirmedAt"),
    ])
    .where("eetReversal.isDeleted", "is not", sqliteTrue)
    .where("eetReversal.deviceId", "is not", null)
    .where("eetReversal.saleAt", "is not", null)
    .where("eetReversal.unsupportedReason", "is", null)
    .where((eb) =>
      eb.or([
        eb("eetReversal.lastAttemptResult", "is", null),
        eb("eetReversal.lastAttemptResult", "=", "retry"),
      ])
    )
    .where("eetReversalConfirmation.id", "is", null)
    .where(saleConfirmedAtSql("eetReversal.paymentId"), "is not", null)
    .orderBy("eetReversal.createdAt")
    .$narrowType<{
      deviceId: KyselyNotNull
      saleAt: KyselyNotNull
      saleConfirmedAt: KyselyNotNull
    }>()
)

const eetReversalColumns = [
  "eetReversal.id",
  "eetReversal.refundId",
  "eetReversal.saleId",
  "eetReversal.paymentId",
  "eetReversal.deviceId",
  "eetReversal.amount",
  "eetReversal.currency",
  "eetReversal.environment",
  "eetReversal.eic",
  "eetReversal.establishmentId",
  "eetReversal.cashRegisterId",
  "eetReversal.sequenceNumber",
  "eetReversal.saleAt",
  "eetReversal.unsupportedReason",
  "eetReversal.hadUnansweredAttempt",
  "eetReversal.attemptStartedAt",
  "eetReversal.lastAttemptAt",
  "eetReversal.lastAttemptResult",
  "eetReversal.lastErrorType",
  "eetReversal.lastErrorCode",
  "eetReversal.lastErrorMessage",
  "eetReversal.lastGlobalTransactionId",
  "eetReversalConfirmation.pok",
  "eetReversalConfirmation.receivedAt",
  "eetReversalConfirmation.isTest",
  "eetReversalConfirmation.warningsJson",
  "eetReversalConfirmation.globalTransactionId",
] as const

type EetReversalRequiredColumns = {
  refundId: KyselyNotNull
  saleId: KyselyNotNull
  paymentId: KyselyNotNull
  deviceId: KyselyNotNull
  amount: KyselyNotNull
  currency: KyselyNotNull
  environment: KyselyNotNull
  eic: KyselyNotNull
  establishmentId: KyselyNotNull
  cashRegisterId: KyselyNotNull
  sequenceNumber: KyselyNotNull
  saleAt: KyselyNotNull
}

/**
 * Every reversal with its confirmation and whether its sale was confirmed:
 * the one row shape the queries below share, so a screen renders a reversal
 * however it found it.
 */
const selectEetReversals = (
  db: Parameters<Parameters<typeof createQuery>[0]>[0]
) =>
  db
    .selectFrom("eetReversal")
    .leftJoin("eetReversalConfirmation", (join) =>
      join
        .onRef("eetReversalConfirmation.id", "=", "eetReversal.id")
        .on("eetReversalConfirmation.isDeleted", "is not", sqliteTrue)
    )
    .select(eetReversalColumns)
    .select(saleConfirmedAtSql("eetReversal.paymentId").as("saleConfirmedAt"))
    .where("eetReversal.isDeleted", "is not", sqliteTrue)
    .where("eetReversal.refundId", "is not", null)
    .where("eetReversal.saleAt", "is not", null)
    .$narrowType<EetReversalRequiredColumns>()

export const eetReversalByIdQuery = (reversalId: EetReversalId) =>
  createQuery((db) =>
    selectEetReversals(db).where("eetReversal.id", "=", reversalId)
  )

export const eetReversalsByPaymentIdQuery = (paymentId: PaymentId) =>
  createQuery((db) =>
    selectEetReversals(db).where("eetReversal.paymentId", "=", paymentId)
  )

/** The storno of one refund, for the refund's detail screen. */
export const eetReversalByRefundIdQuery = (refundId: RefundId) =>
  createQuery((db) =>
    selectEetReversals(db).where("eetReversal.refundId", "=", refundId)
  )

export const unconfirmedEetReversalsQuery = createQuery((db) =>
  selectEetReversals(db)
    .where("eetReversalConfirmation.id", "is", null)
    .orderBy("eetReversal.saleAt", "desc")
)
