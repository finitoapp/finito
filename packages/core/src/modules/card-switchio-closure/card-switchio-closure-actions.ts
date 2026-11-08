import { err, ok, type Result, sqliteTrue, type Task } from "@evolu/common"

import type { DateDep, EvoluOwnerDep } from "../../deps.ts"
import { defineError } from "../../error.ts"
import {
  interpretSwitchioClosureResult,
  type SwitchioClosure,
  type SwitchioClosureDep,
  type SwitchioClosureError,
  type SwitchioNativeClosureResult,
} from "../../switchio.ts"
import { cardSwitchioAccountQuery } from "../account/account-queries.ts"
import type { AccountId } from "../account/account-types.ts"
import type { DeviceId } from "../device/device-types.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { runMutationWithCompletion } from "../shared/evolu-utils.ts"
import {
  type FiatCurrency,
  Integer,
  NonEmptyString255,
  NonNegativeInteger,
  TimestampMs,
} from "../shared/schema.ts"
import { cardSwitchioClosureByIdQuery } from "./card-switchio-closure-queries.ts"
import type { CardSwitchioClosureId } from "./card-switchio-closure-types.ts"
import { createCardSwitchioClosureId } from "./card-switchio-closure-utils.ts"

const createCardSwitchioClosureAccountNotFoundError = defineError(
  "CardSwitchioClosureAccountNotFound"
)()
export type CardSwitchioClosureAccountNotFoundError = ReturnType<
  typeof createCardSwitchioClosureAccountNotFoundError
>

export type CloseCardSwitchioBatchError =
  | CardSwitchioClosureAccountNotFoundError
  | SwitchioClosureError

/** A closure as it was recorded: the terminal's totals and what this app added. */
export interface RecordedCardSwitchioClosure extends SwitchioClosure {
  readonly id: CardSwitchioClosureId
  readonly accountId: AccountId
  readonly deviceId: DeviceId
  readonly currency: FiatCurrency
  readonly closedAt: TimestampMs
}

/** Reads the card account at closing time: its currency is the closure's. */
const loadCardSwitchioAccount =
  (): Task<
    { readonly id: AccountId; readonly currency: FiatCurrency },
    CardSwitchioClosureAccountNotFoundError,
    EvoluDep
  > =>
  async (run) => {
    const [row] = await run.deps.evolu.loadQuery(cardSwitchioAccountQuery)
    if (row === undefined || row.isDeleted === sqliteTrue) {
      return err(createCardSwitchioClosureAccountNotFoundError())
    }
    return ok({ id: row.id, currency: row.currency })
  }

/**
 * Writes one closed batch. The id derives from the device and the result, so
 * the same result recorded twice leaves one row (payment/0008); the second
 * time returns the first record untouched, keeping its `closedAt`, which
 * orders the history and bounds a closure's window.
 */
const recordCardSwitchioClosure =
  ({
    closure,
    deviceId,
  }: {
    readonly closure: SwitchioClosure
    readonly deviceId: DeviceId
  }): Task<
    RecordedCardSwitchioClosure,
    CardSwitchioClosureAccountNotFoundError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    const id = createCardSwitchioClosureId({ deviceId, closure })
    const [existing] = await run.deps.evolu.loadQuery(
      cardSwitchioClosureByIdQuery(id)
    )
    if (existing !== undefined) {
      return ok({
        ...closure,
        id,
        accountId: existing.accountId,
        deviceId,
        currency: existing.currency,
        closedAt: existing.closedAt,
      })
    }

    const account = await run(loadCardSwitchioAccount())
    if (!account.ok) return account

    const recorded: RecordedCardSwitchioClosure = {
      ...closure,
      id,
      accountId: account.value.id,
      deviceId,
      currency: account.value.currency,
      closedAt: TimestampMs(run.deps.date.now().getTime()),
    }

    await runMutationWithCompletion((options) =>
      run.deps.evolu.upsert(
        "cardSwitchioClosure",
        {
          id: recorded.id,
          accountId: recorded.accountId,
          deviceId,
          currency: recorded.currency,
          batchNumber: NonNegativeInteger(closure.batchNumber),
          shiftNumber: NonNegativeInteger(closure.shiftNumber),
          debitsCount: NonNegativeInteger(closure.debitsCount),
          debitsAmount: Integer(closure.debitsAmount),
          creditsCount: NonNegativeInteger(closure.creditsCount),
          creditsAmount: Integer(closure.creditsAmount),
          adjsCount: NonNegativeInteger(closure.adjsCount),
          adjsAmount: Integer(closure.adjsAmount),
          terminalDateTime:
            closure.terminalDateTime === null
              ? null
              : NonEmptyString255(closure.terminalDateTime.slice(0, 255)),
          closedAt: recorded.closedAt,
        },
        { ...options, owner: run.deps.evoluOwner }
      )
    )

    return ok(recorded)
  }

const recordClosureResult =
  ({
    result,
    deviceId,
  }: {
    readonly result: Result<SwitchioClosure, SwitchioClosureError>
    readonly deviceId: DeviceId
  }): Task<
    RecordedCardSwitchioClosure,
    CloseCardSwitchioBatchError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) => {
    if (!result.ok) {
      run.deps.console.warn("[switchio] Batch closure failed", result.error)
      return result
    }
    return await run(
      recordCardSwitchioClosure({ closure: result.value, deviceId })
    )
  }

/**
 * Closes the batch of the SwitchioPay terminal on this phone and records it
 * when it succeeds (payment/0008). A failed or unreadable result is returned
 * as it came and writes nothing.
 */
export const closeCardSwitchioBatch =
  ({
    deviceId,
  }: {
    readonly deviceId: DeviceId
  }): Task<
    RecordedCardSwitchioClosure,
    CloseCardSwitchioBatchError,
    EvoluDep & EvoluOwnerDep & DateDep & SwitchioClosureDep
  > =>
  async (run) => {
    const account = await run(loadCardSwitchioAccount())
    if (!account.ok) return account

    const result = await run.deps.switchioClosure.close()
    return await run(recordClosureResult({ result, deviceId }))
  }

/**
 * Records a closure result whose promise was lost when Android killed the
 * app while SwitchioPay was in the foreground. The derived id makes this
 * idempotent with the promise path.
 */
export const recordRestoredCardSwitchioClosure =
  ({
    restored,
    deviceId,
  }: {
    readonly restored: SwitchioNativeClosureResult
    readonly deviceId: DeviceId
  }): Task<
    RecordedCardSwitchioClosure,
    CloseCardSwitchioBatchError,
    EvoluDep & EvoluOwnerDep & DateDep
  > =>
  async (run) =>
    await run(
      recordClosureResult({
        result: interpretSwitchioClosureResult(restored),
        deviceId,
      })
    )
