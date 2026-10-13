import {
  evoluJsonArrayFrom,
  type KyselyNotNull,
  sqliteTrue,
} from "@evolu/common"

import { createQuery } from "../../evolu/schema.ts"
import type { DeviceId } from "../device/device-types.ts"
import type { FioPluginId } from "./fio-plugin-types.ts"
import { fioPluginId, fioSyncDeviceUptimeId } from "./fio-plugin-utils.ts"

export const fioPluginByIdQuery = (idValue: FioPluginId) =>
  createQuery((db) =>
    db
      .selectFrom("fioPlugin")
      .selectAll()
      .where("id", "=", idValue)
      .where("accountId", "is not", null)
      .where("numberOfSecondsBetweenChecks", "is not", null)
      .where("syncLookbackDays", "is not", null)
      .where("isActive", "is not", null)
      .where("isDeleted", "is not", sqliteTrue)
      .$narrowType<{
        accountId: KyselyNotNull
        numberOfSecondsBetweenChecks: KyselyNotNull
        syncLookbackDays: KyselyNotNull
        isActive: KyselyNotNull
      }>()
  )

export const fioPluginTokensByPluginIdQuery = (fioPluginId: FioPluginId) =>
  createQuery((db) =>
    db
      .selectFrom("fioPluginToken")
      .selectAll()
      .where("fioPluginId", "=", fioPluginId)
      .where("token", "is not", null)
      .where("isDeleted", "is not", sqliteTrue)
      .$narrowType<{
        fioPluginId: KyselyNotNull
        token: KyselyNotNull
      }>()
      .orderBy("createdAt")
      .orderBy("ownerId")
      .orderBy("id")
  )

export const fiatBankAccountFioPluginQuery = createQuery((db) =>
  db
    .selectFrom("fioPlugin")
    .selectAll()
    .where("id", "=", fioPluginId)
    .where("accountId", "is not", null)
    .where("numberOfSecondsBetweenChecks", "is not", null)
    .where("isActive", "is not", null)
    .where("isDeleted", "is not", sqliteTrue)
    .orderBy("createdAt", "desc")
    .limit(1)
    .$narrowType<{
      accountId: KyselyNotNull
      numberOfSecondsBetweenChecks: KyselyNotNull
      isActive: KyselyNotNull
    }>()
)

export const fioPluginSyncPointerByPluginIdQuery = (fioPluginId: FioPluginId) =>
  createQuery((db) =>
    db
      .selectFrom("fioPluginSyncPointer")
      .selectAll()
      .where("id", "=", fioPluginId)
      .where("lastSyncedDate", "is not", null)
      .where("isDeleted", "is not", sqliteTrue)
      .$narrowType<{
        lastSyncedDate: KyselyNotNull
      }>()
  )

export const fioPluginSyncLeaseByPluginIdQuery = (fioPluginId: FioPluginId) =>
  createQuery((db) =>
    db
      .selectFrom("fioPluginSyncLease")
      .select(["deviceId", "expiresAt"])
      .where("id", "=", fioPluginId)
      .where("deviceId", "is not", null)
      .where("expiresAt", "is not", null)
      .where("isDeleted", "is not", sqliteTrue)
      .$narrowType<{
        deviceId: KyselyNotNull
        expiresAt: KyselyNotNull
      }>()
  )

export const fioSyncDeviceUptimeByDeviceIdQuery = (deviceId: DeviceId) =>
  createQuery((db) =>
    db
      .selectFrom("fioSyncDeviceUptime")
      .select(["uptimePerMille", "measuredAt"])
      .where("id", "=", fioSyncDeviceUptimeId(deviceId))
      .where("uptimePerMille", "is not", null)
      .where("measuredAt", "is not", null)
      .where("isDeleted", "is not", sqliteTrue)
      .$narrowType<{
        uptimePerMille: KyselyNotNull
        measuredAt: KyselyNotNull
      }>()
  )

export const activeFioPluginsQuery = createQuery((db) =>
  db
    .selectFrom("fioPlugin")
    .innerJoin("account", "account.id", "fioPlugin.accountId")
    .innerJoin("accountIban", "accountIban.id", "account.id")
    .select((eb) => [
      "fioPlugin.id",
      "fioPlugin.accountId",
      "fioPlugin.numberOfSecondsBetweenChecks",
      "fioPlugin.syncLookbackDays",
      "accountIban.iban",
      evoluJsonArrayFrom(
        eb
          .selectFrom("fioPluginToken")
          .select(["fioPluginToken.token"])
          .whereRef("fioPluginToken.fioPluginId", "=", "fioPlugin.id")
          .where("fioPluginToken.token", "is not", null)
          .where("fioPluginToken.isDeleted", "is not", sqliteTrue)
          // `(ownerId, id)` after `createdAt` for the same reason
          // `billLinesByBillIdQuery` needs it: tokens written in one batch
          // share a `createdAt`, and the sync job compares token *order* to
          // decide whether its session still matches (`areTokensEqual`). An
          // unstable order would restart the session — and so fire an extra
          // FIO request, against a rate-limited API — for no reason.
          .orderBy("fioPluginToken.createdAt")
          .orderBy("fioPluginToken.ownerId")
          .orderBy("fioPluginToken.id")
          .$narrowType<{
            token: KyselyNotNull
          }>()
      ).as("tokens"),
    ])
    .where("fioPlugin.isActive", "=", 1)
    .where("fioPlugin.isDeleted", "is not", sqliteTrue)
    .where("account.kind", "=", "iban")
    .where("account.isDeleted", "is not", sqliteTrue)
    .where("accountIban.isDeleted", "is not", sqliteTrue)
    .where("fioPlugin.id", "is not", null)
    .where("fioPlugin.accountId", "is not", null)
    .where("fioPlugin.numberOfSecondsBetweenChecks", "is not", null)
    .where("accountIban.iban", "is not", null)
    .$narrowType<{
      id: KyselyNotNull
      accountId: KyselyNotNull
      numberOfSecondsBetweenChecks: KyselyNotNull
      iban: KyselyNotNull
    }>()
)
