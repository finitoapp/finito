import { id } from "@evolu/common"
import { z } from "zod"
import { standardSchemaToZod } from "../../zod-utils.ts"

export const OverpaymentResolutionIdRaw = id("OverpaymentResolution")
export const OverpaymentResolutionId = standardSchemaToZod(
  OverpaymentResolutionIdRaw
)
export type OverpaymentResolutionId = typeof OverpaymentResolutionIdRaw.Output

export const OverpaymentResolutionKindSchema = z.enum([
  "tip",
  "kept",
  "withdrawal",
])
export type OverpaymentResolutionKind = z.output<
  typeof OverpaymentResolutionKindSchema
>
