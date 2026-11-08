import type { IndexesConfig } from "@evolu/common/local-first"
import { AccountId } from "../account/account-types.ts"
import { DeviceId } from "../device/device-types.ts"
import {
  FiatCurrencySchema,
  type InferTable,
  IntegerSchema,
  NonEmptyString255Schema,
  NonNegativeIntegerSchema,
  TimestampMsSchema,
} from "../shared/schema.ts"
import { CardSwitchioClosureId } from "./card-switchio-closure-types.ts"

/**
 * A batch of the SwitchioPay terminal closed from this app
 * (payment/0008). Only successful closures are kept. The terminal is the
 * device whose phone runs SwitchioPay — the result names no terminal — and
 * the id derives from the device and the result, so the same result taken
 * twice (its promise, then the restored copy) writes one row.
 */
export const cardSwitchioClosure = {
  id: CardSwitchioClosureId,
  /** The `cardSwitchio` account the batch belongs to. */
  accountId: AccountId,
  deviceId: DeviceId,
  /** The account's currency when the batch was closed; the result names none. */
  currency: FiatCurrencySchema,
  batchNumber: NonNegativeIntegerSchema,
  shiftNumber: NonNegativeIntegerSchema,
  debitsCount: NonNegativeIntegerSchema,
  /** What the cards were charged, tips included, in minor units. */
  debitsAmount: IntegerSchema,
  creditsCount: NonNegativeIntegerSchema,
  creditsAmount: IntegerSchema,
  adjsCount: NonNegativeIntegerSchema,
  /** Adjustments may be signed. */
  adjsAmount: IntegerSchema,
  /** The terminal's own time, verbatim; its format is the terminal's. */
  terminalDateTime: NonEmptyString255Schema.nullable(),
  /** When this app recorded the closure, by its own clock. */
  closedAt: TimestampMsSchema,
} as const

export const cardSwitchioClosureIndexes = ((create) => [
  create("cardSwitchioClosure_deviceId_closedAt")
    .on("cardSwitchioClosure")
    .columns(["deviceId", "closedAt"]),
]) satisfies IndexesConfig

export type CardSwitchioClosureRow = InferTable<typeof cardSwitchioClosure>
