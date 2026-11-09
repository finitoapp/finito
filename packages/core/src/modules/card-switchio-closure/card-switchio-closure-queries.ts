import { type InferRow, type KyselyNotNull, sqliteTrue } from "@evolu/common"

import { createQuery } from "../../evolu/schema.ts"
import type { DeviceId } from "../device/device-types.ts"
import type { TimestampMs } from "../shared/schema.ts"
import type { CardSwitchioClosureId } from "./card-switchio-closure-types.ts"

const closureColumns = [
  "cardSwitchioClosure.id",
  "cardSwitchioClosure.accountId",
  "cardSwitchioClosure.deviceId",
  "cardSwitchioClosure.currency",
  "cardSwitchioClosure.batchNumber",
  "cardSwitchioClosure.shiftNumber",
  "cardSwitchioClosure.debitsCount",
  "cardSwitchioClosure.debitsAmount",
  "cardSwitchioClosure.creditsCount",
  "cardSwitchioClosure.creditsAmount",
  "cardSwitchioClosure.adjsCount",
  "cardSwitchioClosure.adjsAmount",
  "cardSwitchioClosure.terminalDateTime",
  "cardSwitchioClosure.closedAt",
  "device.name as deviceName",
] as const

type ClosureNotNull = {
  accountId: KyselyNotNull
  deviceId: KyselyNotNull
  currency: KyselyNotNull
  batchNumber: KyselyNotNull
  shiftNumber: KyselyNotNull
  debitsCount: KyselyNotNull
  debitsAmount: KyselyNotNull
  creditsCount: KyselyNotNull
  creditsAmount: KyselyNotNull
  adjsCount: KyselyNotNull
  adjsAmount: KyselyNotNull
  closedAt: KyselyNotNull
}

/** Every closure of every device, the newest first. */
export const cardSwitchioClosuresQuery = (limit: number) =>
  createQuery((db) =>
    db
      .selectFrom("cardSwitchioClosure")
      .leftJoin("device", "device.id", "cardSwitchioClosure.deviceId")
      .select(closureColumns)
      .where("cardSwitchioClosure.isDeleted", "is not", sqliteTrue)
      .where("cardSwitchioClosure.closedAt", "is not", null)
      .orderBy("cardSwitchioClosure.closedAt", "desc")
      .orderBy("cardSwitchioClosure.id")
      .limit(limit)
      .$narrowType<ClosureNotNull>()
  )

/**
 * Whether one phone closed its terminal's batch after a moment, by that
 * phone's own clock (refund/0008): the closures it recorded since. Its own
 * writes, so never stale on the phone itself.
 */
export const cardSwitchioClosuresOfDeviceSinceQuery = ({
  deviceId,
  since,
}: {
  readonly deviceId: DeviceId
  readonly since: TimestampMs
}) =>
  createQuery((db) =>
    db
      .selectFrom("cardSwitchioClosure")
      .select(["id", "closedAt"])
      .where("deviceId", "=", deviceId)
      .where("closedAt", ">", since)
      .where("isDeleted", "is not", sqliteTrue)
      .limit(1)
  )

export type CardSwitchioClosureListRow = InferRow<
  ReturnType<typeof cardSwitchioClosuresQuery>
>

/**
 * The latest closure of each device that has ever closed a batch, with the
 * device's name: the business's terminals, as far as this app knows them.
 */
export const lastCardSwitchioClosurePerDeviceQuery = createQuery((db) =>
  db
    .selectFrom("cardSwitchioClosure")
    .leftJoin("device", "device.id", "cardSwitchioClosure.deviceId")
    .select(closureColumns)
    .where("cardSwitchioClosure.isDeleted", "is not", sqliteTrue)
    .where("cardSwitchioClosure.closedAt", "is not", null)
    .where("cardSwitchioClosure.deviceId", "is not", null)
    // A removed device is no terminal to close any more; one that registers
    // again comes back. A closure by a device whose row has not synced yet
    // is still shown, as an unknown device.
    .where("device.isDeleted", "is not", sqliteTrue)
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom("cardSwitchioClosure as newer")
            .select("newer.id")
            .whereRef("newer.deviceId", "=", "cardSwitchioClosure.deviceId")
            .where("newer.isDeleted", "is not", sqliteTrue)
            .where((eb) =>
              eb.or([
                eb(
                  "newer.closedAt",
                  ">",
                  eb.ref("cardSwitchioClosure.closedAt")
                ),
                eb.and([
                  eb(
                    "newer.closedAt",
                    "=",
                    eb.ref("cardSwitchioClosure.closedAt")
                  ),
                  eb("newer.id", ">", eb.ref("cardSwitchioClosure.id")),
                ]),
              ])
            )
        )
      )
    )
    .orderBy("device.name")
    .orderBy("cardSwitchioClosure.deviceId")
    .$narrowType<ClosureNotNull>()
)

export type LastCardSwitchioClosureRow = InferRow<
  typeof lastCardSwitchioClosurePerDeviceQuery
>

/** One closure, by its derived id. */
export const cardSwitchioClosureByIdQuery = (id: CardSwitchioClosureId) =>
  createQuery((db) =>
    db
      .selectFrom("cardSwitchioClosure")
      .leftJoin("device", "device.id", "cardSwitchioClosure.deviceId")
      .select(closureColumns)
      .where("cardSwitchioClosure.id", "=", id)
      .where("cardSwitchioClosure.isDeleted", "is not", sqliteTrue)
      .where("cardSwitchioClosure.closedAt", "is not", null)
      .$narrowType<ClosureNotNull>()
  )
