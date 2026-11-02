import { SqliteBoolean } from "@evolu/common"
import type { IndexesConfig } from "@evolu/common/local-first"

import { AccountId } from "../account/account-types.ts"
import {
  DateStringSchema,
  IbanSchema,
  type InferTable,
  NonEmptyStringSchema,
  PositiveIntegerSchema,
} from "../shared/schema.ts"
import {
  MonetaBankAccountIdSchema,
  MonetaPluginId,
} from "./moneta-plugin-types.ts"

/**
 * One token, kept on the row itself: MONETA limits calls per day, not the
 * gap between them, so there is nothing to rotate and no token table as
 * Fio's. `iban` is the account the token was checked against when it was
 * connected (`connectMonetaPlugin`) — `monetaAccountId` is that account's id
 * at the bank, so `activeMonetaPluginsQuery` syncs only while the fiat bank
 * account still has this IBAN.
 */
export const monetaPlugin = {
  id: MonetaPluginId,
  accountId: AccountId,
  iban: IbanSchema,
  // Nullable so `disconnectMonetaPlugin` can wipe it.
  token: NonEmptyStringSchema.nullable(),
  monetaAccountId: MonetaBankAccountIdSchema,
  numberOfSecondsBetweenChecks: PositiveIntegerSchema,
  isActive: SqliteBoolean,
} as const

export const monetaPluginSyncPointer = {
  id: MonetaPluginId,
  lastSyncedDate: DateStringSchema,
} as const

export const monetaPluginIndexes = ((create) => [
  create("monetaPlugin_accountId").on("monetaPlugin").column("accountId"),
]) satisfies IndexesConfig

export type MonetaPluginRow = InferTable<typeof monetaPlugin>
export type MonetaPluginSyncPointerRow = InferTable<
  typeof monetaPluginSyncPointer
>
