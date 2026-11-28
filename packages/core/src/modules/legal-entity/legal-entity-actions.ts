import { ok, sqliteFalse, sqliteTrue, type Task } from "@evolu/common"

import type { EvoluOwnerDep } from "../../deps.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { runMutationWithCompletion } from "../shared/evolu-utils.ts"
import type { NonEmptyString255 } from "../shared/schema.ts"
import { legalEntityQuery } from "./legal-entity-queries.ts"
import type { CountryCode } from "./legal-entity-types.ts"
import { legalEntityId } from "./legal-entity-utils.ts"

/**
 * Upserts the singleton `legalEntity` row. Used by both the onboarding
 * country step and the legal-entity settings page — always writes both
 * fields together so neither can be left stale. The public name is left as
 * it is.
 */
export const setLegalEntity =
  (input: {
    readonly country: CountryCode | null
    readonly vatPayer: boolean | null
  }): Task<typeof legalEntityId, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evoluOwner } = run.deps

    await runMutationWithCompletion((options) =>
      run.deps.evolu.upsert(
        "legalEntity",
        {
          id: legalEntityId,
          country: input.country,
          vatPayer:
            input.vatPayer === null
              ? null
              : input.vatPayer
                ? sqliteTrue
                : sqliteFalse,
        },
        { ...options, owner: evoluOwner }
      )
    )
    return ok(legalEntityId)
  }

/**
 * Stores the business's public name (onboarding/0016); `null` clears it.
 * Publishing it as the Nostr profile name is the caller's.
 */
export const setLegalEntityPublicName =
  (input: {
    readonly publicName: NonEmptyString255 | null
  }): Task<void, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    await runMutationWithCompletion((options) =>
      run.deps.evolu.upsert(
        "legalEntity",
        { id: legalEntityId, publicName: input.publicName },
        { ...options, owner: run.deps.evoluOwner }
      )
    )
    return ok()
  }

/**
 * Takes the published profile's name as the public name while the account
 * has none: accounts named before the name was stored here keep it
 * (onboarding/0016). A stored name, even one differing from the profile,
 * stays; the profile editor shows the difference.
 */
export const adoptPublishedPublicName =
  (input: {
    readonly name: NonEmptyString255
  }): Task<void, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const [entity] = await run.deps.evolu.loadQuery(legalEntityQuery)
    if (entity !== undefined && entity.publicName !== null) return ok()
    return run(setLegalEntityPublicName({ publicName: input.name }))
  }
