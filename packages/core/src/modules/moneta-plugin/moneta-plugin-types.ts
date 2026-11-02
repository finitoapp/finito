import { id } from "@evolu/common"
import { z } from "zod"
import { standardSchemaToZod } from "../../zod-utils.ts"

export const MonetaPluginIdRaw = id("MonetaPlugin")
export const MonetaPluginId = standardSchemaToZod(MonetaPluginIdRaw)
export type MonetaPluginId = typeof MonetaPluginIdRaw.Output

/** The bank's own id of the merchant's account, found when the token is connected. */
export const MonetaBankAccountIdSchema = z
  .string()
  .min(1)
  .max(255)
  .brand<"MonetaBankAccountId">()
export type MonetaBankAccountId = z.output<typeof MonetaBankAccountIdSchema>
