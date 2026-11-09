import { evoluJsonObjectFrom, sqliteTrue, testCreateRun } from "@evolu/common"

import type { EvoluOwnerDep } from "../../deps.ts"
import { createQuery } from "../../evolu/schema.ts"
import { createAccount } from "../account/account-actions.ts"
import type { AccountId } from "../account/account-types.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { SparkSecret } from "../shared/key-derivation.ts"
import { IbanSchema, NonEmptyString255 } from "../shared/schema.ts"
import type { PaymentId } from "./payment-types.ts"

export const paymentWithDetailsByIdQuery = (id: PaymentId) =>
  createQuery((db) =>
    db
      .selectFrom("payment")
      .select((eb) => [
        "payment.id",
        "payment.deviceId",
        "payment.billId",
        "payment.tableId",
        "payment.amount",
        "payment.currency",
        "payment.tipAmount",
        "payment.canceledAt",
        "payment.expiresAt",
        "payment.isDeleted",
        evoluJsonObjectFrom(
          eb
            .selectFrom("paymentCashRegister")
            .select([
              "paymentCashRegister.id",
              "paymentCashRegister.accountId",
              "paymentCashRegister.isDeleted",
            ])
            .whereRef("paymentCashRegister.id", "=", "payment.id")
        ).as("cashRegister"),
        evoluJsonObjectFrom(
          eb
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
              "paymentBtc.id",
              "paymentBtc.accountId",
              "paymentBtc.amountSats",
              "paymentBtc.exchangeRate",
              "paymentBtc.exchangeRateSource",
              "paymentBtc.exchangeRateFetchedAt",
              "paymentBtcLightning.lnInvoice",
              "paymentBtcLightning.lightningReceiveRequestId",
              "paymentBtcLightning.paymentHash",
              "paymentBtcLightning.paymentPreimage",
              "paymentBtcSpark.sparkInvoice",
              "paymentBtc.isDeleted",
            ])
            .whereRef("paymentBtc.id", "=", "payment.id")
        ).as("spark"),
        evoluJsonObjectFrom(
          eb
            .selectFrom("paymentIban")
            .select([
              "paymentIban.id",
              "paymentIban.accountId",
              "paymentIban.variableSymbol",
              "paymentIban.specificSymbol",
              "paymentIban.isDeleted",
            ])
            .whereRef("paymentIban.id", "=", "payment.id")
        ).as("iban"),
      ])
      .where("payment.id", "=", id)
  )

export const reconciliationClaimsByPaymentIdQuery = (id: PaymentId) =>
  createQuery((db) =>
    db.selectFrom("reconciliationClaim").selectAll().where("paymentId", "=", id)
  )

/** Who recorded each account transaction a payment's claims point at. */
export const accountTransactionSourcesByPaymentIdQuery = (id: PaymentId) =>
  createQuery((db) =>
    db
      .selectFrom("reconciliationClaim")
      .innerJoin(
        "accountTransactionSource",
        "accountTransactionSource.accountTransactionId",
        "reconciliationClaim.accountTransactionId"
      )
      .select(["accountTransactionSource.source"])
      .where("reconciliationClaim.paymentId", "=", id)
  )

export const accountTransactionsByPaymentIdQuery = (id: PaymentId) =>
  createQuery((db) =>
    db
      .selectFrom("reconciliationClaim")
      .innerJoin(
        "accountTransaction",
        "accountTransaction.id",
        "reconciliationClaim.accountTransactionId"
      )
      .select([
        "accountTransaction.id",
        "accountTransaction.accountId",
        "accountTransaction.kind",
        "accountTransaction.amount",
        "accountTransaction.currency",
        "accountTransaction.occurredAt",
        "accountTransaction.note",
        "accountTransaction.internalTransferGroupId",
      ])
      .where("reconciliationClaim.paymentId", "=", id)
  )

export const createPaymentAccounts = async (
  deps: EvoluDep & EvoluOwnerDep
): Promise<{
  readonly cashRegisterAccountId: AccountId
  readonly sparkAccountId: AccountId
  readonly ibanAccountId: AccountId
}> => {
  await using run = testCreateRun(deps)
  const cashRegisterAccountId = await run.ok(
    createAccount({
      deviceId: null,
      name: NonEmptyString255("Cash register"),
      cashRegister: {
        currency: "CZK",
      },
    })
  )
  const sparkAccountId = await run.ok(
    createAccount({
      deviceId: null,
      name: NonEmptyString255("Spark wallet"),
      spark: {
        secret: SparkSecret("42373a7543db65ae0228ead6c9cbffcc"),
      },
    })
  )
  const ibanAccountId = await run.ok(
    createAccount({
      deviceId: null,
      name: NonEmptyString255("Bank account"),
      iban: {
        iban: IbanSchema.decode("CZ6508000000192000145399"),
        currency: "CZK",
      },
    })
  )

  return {
    cashRegisterAccountId,
    sparkAccountId,
    ibanAccountId,
  }
}
