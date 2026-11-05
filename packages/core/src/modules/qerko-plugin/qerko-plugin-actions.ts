import {
  err,
  type InsertValues,
  ok,
  sqliteFalse,
  sqliteTrue,
  type Task,
} from "@evolu/common"

import type { EvoluOwnerDep, FetchDep } from "../../deps.ts"
import { defineError } from "../../error.ts"
import {
  confirmQerkoPairing,
  getQerkoLocations,
  getQerkoTerminals,
  pairQerkoLocation,
  type QerkoApiDep,
  type QerkoClientError,
  type QerkoCredentials,
  type QerkoEnvironment,
  type QerkoRole,
} from "../../integrations/qerko/qerko-client.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { runMutationWithCompletion } from "../shared/evolu-utils.ts"
import { NonEmptyString255, NonEmptyStringSchema } from "../shared/schema.ts"
import type { qerkoPlugin } from "./qerko-plugin.ts"
import { qerkoPluginQuery } from "./qerko-plugin-queries.ts"
import { qerkoPluginIdByRole } from "./qerko-plugin-utils.ts"

export const createQerkoPairingInvalidCodeError = defineError(
  "QerkoPairingInvalidCode"
)<{ readonly remainingAttempts: number }>()
export type QerkoPairingInvalidCodeError = ReturnType<
  typeof createQerkoPairingInvalidCodeError
>

export const createQerkoPairingCodeExpiredError = defineError(
  "QerkoPairingCodeExpired"
)()
export type QerkoPairingCodeExpiredError = ReturnType<
  typeof createQerkoPairingCodeExpiredError
>

export const createQerkoPairingMaxAttemptsReachedError = defineError(
  "QerkoPairingMaxAttemptsReached"
)()
export type QerkoPairingMaxAttemptsReachedError = ReturnType<
  typeof createQerkoPairingMaxAttemptsReachedError
>

/** That role is not paired, so there is no API key to call Qerko with. */
export const createQerkoPluginNotPairedError = defineError(
  "QerkoPluginNotPaired"
)()
export type QerkoPluginNotPairedError = ReturnType<
  typeof createQerkoPluginNotPairedError
>

/** The API key and environment of one role's pairing, for every call it makes. */
export const loadQerkoCredentials =
  (
    role: QerkoRole
  ): Task<QerkoCredentials, QerkoPluginNotPairedError, EvoluDep> =>
  async (run) => {
    const [plugin] = await run.deps.evolu.loadQuery(qerkoPluginQuery(role))
    if (plugin === undefined) return err(createQerkoPluginNotPairedError())
    return ok({ apiKey: plugin.apiKey, environment: plugin.environment })
  }

/** Upserts the role's singleton `qerkoPlugin` row: the one write behind pairing. */
export const saveQerkoPlugin =
  (
    input: Omit<InsertValues<typeof qerkoPlugin>, "id" | "role"> & {
      readonly role: QerkoRole
    }
  ): Task<void, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evoluOwner } = run.deps

    await runMutationWithCompletion((options) =>
      run.deps.evolu.upsert(
        "qerkoPlugin",
        {
          ...input,
          id: qerkoPluginIdByRole[input.role],
          isDeleted: sqliteFalse,
        },
        { ...options, owner: evoluOwner }
      )
    )

    return ok()
  }

/** Unpairs one role: soft-deletes its row, which drops the API key with it. */
export const deleteQerkoPlugin =
  (role: QerkoRole): Task<void, never, EvoluDep & EvoluOwnerDep> =>
  async (run) => {
    const { evoluOwner } = run.deps

    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "qerkoPlugin",
        { id: qerkoPluginIdByRole[role], isDeleted: sqliteTrue },
        { ...options, owner: evoluOwner }
      )
    )

    return ok()
  }

/**
 * Exchanges the e-mailed code for the role's API key and saves the pairing.
 * The new key is proven at once with a call that also names the business:
 * `get-terminals` for the terminal, `get-locations` for a `standard` key,
 * which Qerko answers before the key is paired with a location (qerko/0007).
 * A `standard` key already paired keeps its location; a fresh one is paired
 * with `pairQerkoPaymentLocation` next. The pairing is requested with
 * `requestQerkoPairing` from the client, which needs nothing of ours.
 */
export const completeQerkoPairing =
  ({
    role,
    environment,
    pairingRequestId,
    code,
    name,
  }: {
    readonly role: QerkoRole
    readonly environment: QerkoEnvironment
    readonly pairingRequestId: string
    readonly code: string
    /** What the key is called in Qerko's list of keys. */
    readonly name: string
  }): Task<
    void,
    | QerkoPairingInvalidCodeError
    | QerkoPairingCodeExpiredError
    | QerkoPairingMaxAttemptsReachedError
    | QerkoClientError,
    QerkoApiDep & FetchDep & EvoluDep & EvoluOwnerDep
  > =>
  async (run) => {
    const confirmed = await run(
      confirmQerkoPairing({ environment, pairingRequestId, code, name })
    )
    if (!confirmed.ok) return confirmed
    const result = confirmed.value

    if (result.type === "invalidCode") {
      return err(
        createQerkoPairingInvalidCodeError({
          remainingAttempts: result.remainingAttempts,
        })
      )
    }
    if (result.type === "codeExpired") {
      return err(createQerkoPairingCodeExpiredError())
    }
    if (result.type === "maxAttemptsReached") {
      return err(createQerkoPairingMaxAttemptsReachedError())
    }

    const credentials = { apiKey: result.apiKey.token, environment }
    const key = {
      role,
      environment,
      apiKey: NonEmptyStringSchema.decode(result.apiKey.token),
      apiKeyName: NonEmptyString255(result.apiKey.name),
    }

    if (role === "standard") {
      const locations = await run(getQerkoLocations(credentials))
      if (!locations.ok) return locations
      const { legalEntity, pairedLocationId } = locations.value
      // A key already paired keeps its location; a fresh one waits for
      // `pairQerkoPaymentLocation`.
      const paired = locations.value.locations.find(
        (location) => location.id === pairedLocationId
      )
      await run.ok(
        saveQerkoPlugin({
          ...key,
          legalEntityName: NonEmptyString255(legalEntity.name),
          identificationNumber: NonEmptyString255(
            legalEntity.identificationNumber
          ),
          country: legalEntity.country,
          restaurantId:
            paired === undefined ? null : NonEmptyString255(paired.id),
          locationName:
            paired === undefined ? null : NonEmptyString255(paired.name),
        })
      )
      return ok()
    }

    const terminals = await run(getQerkoTerminals(credentials))
    if (!terminals.ok) return terminals
    const { legalEntity } = terminals.value

    await run.ok(
      saveQerkoPlugin({
        ...key,
        legalEntityName: NonEmptyString255(legalEntity.name),
        identificationNumber: NonEmptyString255(
          legalEntity.identificationNumber
        ),
        country: legalEntity.country,
      })
    )

    return ok()
  }

/**
 * Pairs the Qerko payment key with one of its company's locations
 * (qerko/0007) and keeps it as the restaurant its QR codes name. Until then
 * Qerko refuses the rest of its API, so nothing else of Qerko payments
 * starts: the method cannot be turned on, offered or connected. Nothing is
 * written when Qerko refuses, a location it no longer knows (404) included.
 */
export const pairQerkoPaymentLocation =
  ({
    locationId,
    locationName,
  }: {
    readonly locationId: string
    readonly locationName: string
  }): Task<
    void,
    QerkoPluginNotPairedError | QerkoClientError,
    QerkoApiDep & FetchDep & EvoluDep & EvoluOwnerDep
  > =>
  async (run) => {
    const credentials = await run(loadQerkoCredentials("standard"))
    if (!credentials.ok) return credentials

    const paired = await run(
      pairQerkoLocation({ credentials: credentials.value, locationId })
    )
    if (!paired.ok) return paired

    await runMutationWithCompletion((options) =>
      run.deps.evolu.update(
        "qerkoPlugin",
        {
          id: qerkoPluginIdByRole.standard,
          restaurantId: NonEmptyString255(locationId),
          locationName: NonEmptyString255(locationName.slice(0, 255) || "—"),
        },
        { ...options, owner: run.deps.evoluOwner }
      )
    )
    return ok()
  }
