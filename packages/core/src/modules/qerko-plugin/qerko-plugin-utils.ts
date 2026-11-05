import { createIdFromString } from "@evolu/common"

import type { QerkoRole } from "../../integrations/qerko/qerko-client.ts"
import type { QerkoPluginId } from "./qerko-plugin-types.ts"

/**
 * One pairing per role (qerko/0007), each a singleton like the Fio plugin, so
 * its id is fixed rather than generated. The terminal's id predates roles and
 * stays as it was, so no migration is needed. A missing or deleted row means
 * that role is not paired.
 */
export const qerkoPluginIdByRole = {
  terminalPayments: createIdFromString<"QerkoPlugin">("payky-qerko-plugin"),
  standard: createIdFromString<"QerkoPlugin">("payky-qerko-plugin:standard"),
} satisfies Record<QerkoRole, QerkoPluginId>
