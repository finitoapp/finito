import { type KyselyNotNull, sqliteTrue } from "@evolu/common"

import { createQuery } from "../../evolu/schema.ts"
import type { MonetaPluginId } from "./moneta-plugin-types.ts"
import { monetaPluginId } from "./moneta-plugin-utils.ts"

export const monetaPluginByIdQuery = (idValue: MonetaPluginId) =>
  createQuery((db) =>
    db
      .selectFrom("monetaPlugin")
      .selectAll()
      .where("id", "=", idValue)
      .where("accountId", "is not", null)
      .where("iban", "is not", null)
      .where("token", "is not", null)
      .where("monetaAccountId", "is not", null)
      .where("numberOfSecondsBetweenChecks", "is not", null)
      .where("isActive", "is not", null)
      .where("isDeleted", "is not", sqliteTrue)
      .$narrowType<{
        accountId: KyselyNotNull
        iban: KyselyNotNull
        token: KyselyNotNull
        monetaAccountId: KyselyNotNull
        numberOfSecondsBetweenChecks: KyselyNotNull
        isActive: KyselyNotNull
      }>()
  )

/** The plugin of the fiat bank account, the one the settings screens show. */
export const fiatBankAccountMonetaPluginQuery =
  monetaPluginByIdQuery(monetaPluginId)

export const monetaPluginSyncPointerByPluginIdQuery = (
  monetaPluginId: MonetaPluginId
) =>
  createQuery((db) =>
    db
      .selectFrom("monetaPluginSyncPointer")
      .selectAll()
      .where("id", "=", monetaPluginId)
      .where("lastSyncedDate", "is not", null)
      .where("isDeleted", "is not", sqliteTrue)
      .$narrowType<{
        lastSyncedDate: KyselyNotNull
      }>()
  )

/**
 * Active plugins whose account still has the IBAN their token was checked
 * against. A plugin re-pointed at an account with another IBAN drops out
 * here, so it never records that account's history under the old account's
 * bank id; the settings screen asks to connect again instead.
 */
export const activeMonetaPluginsQuery = createQuery((db) =>
  db
    .selectFrom("monetaPlugin")
    .innerJoin("account", "account.id", "monetaPlugin.accountId")
    .innerJoin("accountIban", "accountIban.id", "account.id")
    .select([
      "monetaPlugin.id",
      "monetaPlugin.accountId",
      "monetaPlugin.token",
      "monetaPlugin.monetaAccountId",
      "monetaPlugin.numberOfSecondsBetweenChecks",
      "accountIban.iban",
      "accountIban.currency",
    ])
    .whereRef("accountIban.iban", "=", "monetaPlugin.iban")
    .where("monetaPlugin.isActive", "=", 1)
    .where("monetaPlugin.isDeleted", "is not", sqliteTrue)
    .where("account.kind", "=", "iban")
    .where("account.isDeleted", "is not", sqliteTrue)
    .where("accountIban.isDeleted", "is not", sqliteTrue)
    .where("monetaPlugin.id", "is not", null)
    .where("monetaPlugin.accountId", "is not", null)
    .where("monetaPlugin.token", "is not", null)
    .where("monetaPlugin.monetaAccountId", "is not", null)
    .where("monetaPlugin.numberOfSecondsBetweenChecks", "is not", null)
    .where("accountIban.iban", "is not", null)
    .where("accountIban.currency", "is not", null)
    .$narrowType<{
      id: KyselyNotNull
      accountId: KyselyNotNull
      token: KyselyNotNull
      monetaAccountId: KyselyNotNull
      numberOfSecondsBetweenChecks: KyselyNotNull
      iban: KyselyNotNull
      currency: KyselyNotNull
    }>()
)
