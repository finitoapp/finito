import { type KyselyNotNull, sqliteTrue } from "@evolu/common"

import { createQuery } from "../../evolu/schema.ts"
import type { OverpaymentScopes } from "../bill/bill-types.ts"
import type { OverpaymentResolutionId } from "./overpayment-resolution-types.ts"

const overpaymentResolutionColumns = [
  "overpaymentResolution.id",
  "overpaymentResolution.paymentId",
  "payment.billId as billId",
  "overpaymentResolution.deviceId",
  "overpaymentResolution.kind",
  "overpaymentResolution.amount",
  "overpaymentResolution.currency",
  "overpaymentResolution.knownTransactionIdsJson",
  "overpaymentResolution.withdrawnId",
  "overpaymentResolution.createdAt",
] as const

type OverpaymentResolutionRequiredColumns = {
  paymentId: KyselyNotNull
  kind: KyselyNotNull
  amount: KyselyNotNull
  currency: KyselyNotNull
  knownTransactionIdsJson: KyselyNotNull
}

export const overpaymentResolutionsQuery = (scopes: OverpaymentScopes) =>
  createQuery((db) =>
    db
      .selectFrom("overpaymentResolution")
      .innerJoin("payment", "payment.id", "overpaymentResolution.paymentId")
      .select(overpaymentResolutionColumns)
      .where((eb) =>
        eb.or([
          ...(scopes.billIds.length === 0
            ? []
            : [eb("payment.billId", "in", scopes.billIds)]),
          ...(scopes.paymentIds.length === 0
            ? []
            : [eb("payment.id", "in", scopes.paymentIds)]),
        ])
      )
      .where("payment.isDeleted", "is not", sqliteTrue)
      .where("overpaymentResolution.isDeleted", "is not", sqliteTrue)
      .where("overpaymentResolution.paymentId", "is not", null)
      .where("overpaymentResolution.kind", "is not", null)
      .where("overpaymentResolution.amount", "is not", null)
      .where("overpaymentResolution.currency", "is not", null)
      .where("overpaymentResolution.knownTransactionIdsJson", "is not", null)
      .orderBy("overpaymentResolution.createdAt")
      .orderBy("overpaymentResolution.id")
      .$narrowType<OverpaymentResolutionRequiredColumns>()
  )

export const overpaymentResolutionByIdQuery = (id: OverpaymentResolutionId) =>
  createQuery((db) =>
    db
      .selectFrom("overpaymentResolution")
      .select([
        "overpaymentResolution.id",
        "overpaymentResolution.paymentId",
        "overpaymentResolution.kind",
        "overpaymentResolution.currency",
      ])
      .where("overpaymentResolution.id", "=", id)
      .where("overpaymentResolution.isDeleted", "is not", sqliteTrue)
      .where("overpaymentResolution.paymentId", "is not", null)
      .where("overpaymentResolution.kind", "is not", null)
      .where("overpaymentResolution.currency", "is not", null)
      .$narrowType<{
        paymentId: KyselyNotNull
        kind: KyselyNotNull
        currency: KyselyNotNull
      }>()
  )

export const withdrawalsOfOverpaymentResolutionQuery = (
  id: OverpaymentResolutionId
) =>
  createQuery((db) =>
    db
      .selectFrom("overpaymentResolution")
      .select(["overpaymentResolution.id"])
      .where("overpaymentResolution.withdrawnId", "=", id)
      .where("overpaymentResolution.kind", "=", "withdrawal")
      .where("overpaymentResolution.isDeleted", "is not", sqliteTrue)
  )
