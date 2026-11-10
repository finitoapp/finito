import { SqliteBoolean } from "@evolu/common"
import type { IndexesConfig } from "@evolu/common/local-first"
import { z } from "zod"

import { BillId } from "../bill/bill-types.ts"
import { PaymentId } from "../payment/payment-types.ts"
import {
  type InferTable,
  NonEmptyString255Schema,
  NonEmptyStringSchema,
  PositiveIntegerSchema,
  WssUrlSchema,
} from "../shared/schema.ts"
import { SelfPayReferenceSchema } from "./table-self-pay-reference-utils.ts"
import {
  SelfPayAllocationId,
  SelfPayRelayId,
  SelfPayViewPublicationId,
  SelfPayViewVersionId,
} from "./table-self-pay-types.ts"

export const billSelfPayReference = {
  id: BillId,
  reference: SelfPayReferenceSchema,
} as const

export const selfPayAllocation = {
  id: SelfPayAllocationId,
  paymentId: PaymentId,
  billId: BillId,
  lineKey: NonEmptyString255Schema,
  amount: PositiveIntegerSchema,
} as const

export const selfPayViewVersion = {
  id: SelfPayViewVersionId,
  billId: BillId,
  content: NonEmptyStringSchema,
} as const

export const selfPayViewPublication = {
  id: SelfPayViewPublicationId,
  eventCreatedAt: PositiveIntegerSchema,
  tag: NonEmptyString255Schema.nullable(),
  lastPublishJson: z.string().nullable(),
} as const

export const selfPayRelay = {
  id: SelfPayRelayId,
  url: WssUrlSchema,
  isActive: SqliteBoolean,
} as const

export const tableSelfPayIndexes = ((create) => [
  create("billSelfPayReference_reference")
    .on("billSelfPayReference")
    .column("reference"),
  create("selfPayAllocation_billId").on("selfPayAllocation").column("billId"),
  create("selfPayAllocation_paymentId")
    .on("selfPayAllocation")
    .column("paymentId"),
  create("selfPayViewVersion_billId").on("selfPayViewVersion").column("billId"),
  create("selfPayViewPublication_tag")
    .on("selfPayViewPublication")
    .column("tag"),
]) satisfies IndexesConfig

export type BillSelfPayReferenceRow = InferTable<typeof billSelfPayReference>
export type SelfPayAllocationRow = InferTable<typeof selfPayAllocation>
export type SelfPayViewVersionRow = InferTable<typeof selfPayViewVersion>
export type SelfPayViewPublicationRow = InferTable<
  typeof selfPayViewPublication
>
export type SelfPayRelayRow = InferTable<typeof selfPayRelay>
