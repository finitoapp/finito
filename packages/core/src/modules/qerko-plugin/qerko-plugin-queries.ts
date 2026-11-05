import { type KyselyNotNull, sqliteTrue } from "@evolu/common"

import { createQuery } from "../../evolu/schema.ts"
import type { QerkoRole } from "../../integrations/qerko/qerko-client.ts"
import { qerkoPluginIdByRole } from "./qerko-plugin-utils.ts"

/**
 * The pairing of one role, absent while that role is not paired. The row's id
 * says its role, so the terminal's row, whose `role` predates the column and
 * is null, reads as `terminalPayments`.
 */
export const qerkoPluginQuery = (role: QerkoRole) =>
  createQuery((db) =>
    db
      .selectFrom("qerkoPlugin")
      .selectAll()
      .where("id", "=", qerkoPluginIdByRole[role])
      .where("environment", "is not", null)
      .where("apiKey", "is not", null)
      .where("apiKeyName", "is not", null)
      .where("legalEntityName", "is not", null)
      .where("identificationNumber", "is not", null)
      .where("country", "is not", null)
      .where("isDeleted", "is not", sqliteTrue)
      .$narrowType<{
        environment: KyselyNotNull
        apiKey: KyselyNotNull
        apiKeyName: KyselyNotNull
        legalEntityName: KyselyNotNull
        identificationNumber: KyselyNotNull
        country: KyselyNotNull
      }>()
  )
