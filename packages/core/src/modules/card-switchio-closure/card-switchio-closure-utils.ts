import { createIdFromString } from "@evolu/common"
import type { SwitchioClosure } from "../../switchio.ts"
import type { DeviceId } from "../device/device-types.ts"
import type { CardSwitchioClosureId } from "./card-switchio-closure-types.ts"

/**
 * The id of a closure restored from a build that minted no closure id before
 * launching the terminal, derived from the device that closed it and what
 * the terminal answered, as that build recorded it — so its promise's row and
 * the restored one are still one row. Every new closure has an id of its own
 * instead (payment/0008): two closures with the same batch number and no
 * terminal time would derive the same id.
 */
export const createCardSwitchioClosureId = ({
  deviceId,
  closure,
}: {
  readonly deviceId: DeviceId
  readonly closure: Pick<SwitchioClosure, "batchNumber" | "terminalDateTime">
}): CardSwitchioClosureId =>
  createIdFromString<"CardSwitchioClosure">(
    JSON.stringify({
      deviceId,
      batchNumber: closure.batchNumber,
      terminalDateTime: closure.terminalDateTime,
    })
  )
