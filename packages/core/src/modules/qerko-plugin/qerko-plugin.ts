import {
  QerkoCountrySchema,
  QerkoEnvironmentSchema,
  QerkoRoleSchema,
} from "../../integrations/qerko/qerko-client.ts"
import {
  type InferTable,
  NonEmptyString255Schema,
  NonEmptyStringSchema,
} from "../shared/schema.ts"
import { QerkoPluginId } from "./qerko-plugin-types.ts"

/**
 * A pairing with Qerko (qerko/0001): the API key the pairing issued, kept
 * in the synced database like the Fio token so every device of the account
 * can use it. There is one row per role (qerko/0007, `qerkoPluginIdByRole`),
 * each paired on its own. `environment` is the Qerko API the key belongs to —
 * a sandbox key is useless in production — so the two are stored together,
 * and each role has its own. Which terminal a device pays on is not here but
 * in the device database (`qerkoTerminalSelection`).
 */
export const qerkoPlugin = {
  id: QerkoPluginId,
  environment: QerkoEnvironmentSchema,
  apiKey: NonEmptyStringSchema,
  apiKeyName: NonEmptyString255Schema,
  legalEntityName: NonEmptyString255Schema,
  identificationNumber: NonEmptyString255Schema,
  country: QerkoCountrySchema,
  /** Null on the terminal's row, which predates roles. */
  role: QerkoRoleSchema.nullable(),
  /**
   * The location a `standard` key is paired with (qerko/0007): its id is the
   * restaurant Qerko payments' QR codes name. Null until a location is paired.
   */
  restaurantId: NonEmptyString255Schema.nullable(),
  /** That location's name, shown in the settings. */
  locationName: NonEmptyString255Schema.nullable(),
} as const

export type QerkoPluginRow = InferTable<typeof qerkoPlugin>
