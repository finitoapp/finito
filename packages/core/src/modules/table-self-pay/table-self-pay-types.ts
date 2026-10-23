import { id } from "@evolu/common"
import { standardSchemaToZod } from "../../zod-utils.ts"

export const SelfPayAllocationIdRaw = id("SelfPayAllocation")
export const SelfPayAllocationId = standardSchemaToZod(SelfPayAllocationIdRaw)
export type SelfPayAllocationId = typeof SelfPayAllocationIdRaw.Output

export const SelfPayViewVersionIdRaw = id("SelfPayViewVersion")
export const SelfPayViewVersionId = standardSchemaToZod(SelfPayViewVersionIdRaw)
export type SelfPayViewVersionId = typeof SelfPayViewVersionIdRaw.Output

export const SelfPayViewPublicationIdRaw = id("SelfPayViewPublication")
export const SelfPayViewPublicationId = standardSchemaToZod(
  SelfPayViewPublicationIdRaw
)
export type SelfPayViewPublicationId = typeof SelfPayViewPublicationIdRaw.Output

export const SelfPayRelayIdRaw = id("SelfPayRelay")
export const SelfPayRelayId = standardSchemaToZod(SelfPayRelayIdRaw)
export type SelfPayRelayId = typeof SelfPayRelayIdRaw.Output
