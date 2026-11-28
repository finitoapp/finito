import { sqliteFalse, sqliteTrue } from "@evolu/common"
import { z } from "zod"
import { type InferTable, NonEmptyString255Schema } from "../shared/schema.ts"
import { CountryCodeSchema, LegalEntityId } from "./legal-entity-types.ts"

/**
 * Singleton row (like `appSettings`) carrying the tenant's country,
 * VAT-payer status and public name. Both fields are nullable: an account that hasn't gone
 * through the onboarding country step, or that explicitly declined it, has
 * no row (or a row with null fields) rather than a forced default. A null
 * `vatPayer` is treated the same as `false` (not a VAT payer) everywhere —
 * see `isVatPayer` in `legal-entity-utils.ts`.
 */
export const legalEntity = {
  id: LegalEntityId,
  country: CountryCodeSchema.nullable(),
  vatPayer: z.union([z.literal(sqliteTrue), z.literal(sqliteFalse)]).nullable(),
  /**
   * The name customers know the business by, which the account's Nostr
   * profile publishes and a bank QR names as the recipient (onboarding/0016,
   * payment/0034). Not the registered company name, which may differ.
   * `null` means none is set.
   */
  publicName: NonEmptyString255Schema.nullable(),
} as const

export type LegalEntityRow = InferTable<typeof legalEntity>
