import { createIdFromString } from "@evolu/common"
import type { SwitchioClosure } from "../../switchio.ts"
import type { DeviceId } from "../device/device-types.ts"
import type { CardSwitchioClosureId } from "./card-switchio-closure-types.ts"

/**
 * The id of a closure, derived from the device that closed it and what the
 * terminal answered, so one result recorded twice — through its promise and
 * again after a restart — is one row (payment/0008).
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
