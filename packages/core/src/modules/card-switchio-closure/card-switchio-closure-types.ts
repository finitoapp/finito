import { id } from "@evolu/common"
import { standardSchemaToZod } from "../../zod-utils.ts"

export const CardSwitchioClosureIdRaw = id("CardSwitchioClosure")
export const CardSwitchioClosureId = standardSchemaToZod(
  CardSwitchioClosureIdRaw
)
export type CardSwitchioClosureId = typeof CardSwitchioClosureIdRaw.Output
