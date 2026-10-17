import type { IndexesConfig } from "@evolu/common/local-first"
import { z } from "zod"

import { DeviceId } from "../device/device-types.ts"
import { PaymentId } from "../payment/payment-types.ts"
import {
  FiatCurrencySchema,
  type InferTable,
  NonNegativeIntegerSchema,
} from "../shared/schema.ts"
import {
  OverpaymentResolutionId,
  OverpaymentResolutionKindSchema,
} from "./overpayment-resolution-types.ts"

export const overpaymentResolution = {
  id: OverpaymentResolutionId,
  paymentId: PaymentId,
  deviceId: DeviceId.nullable(),
  kind: OverpaymentResolutionKindSchema,
  amount: NonNegativeIntegerSchema,
  currency: FiatCurrencySchema,
  knownTransactionIdsJson: z.string(),
  withdrawnId: OverpaymentResolutionId.nullable(),
} as const

export const overpaymentResolutionIndexes = ((create) => [
  create("overpaymentResolution_paymentId")
    .on("overpaymentResolution")
    .column("paymentId"),
]) satisfies IndexesConfig

export type OverpaymentResolutionRow = InferTable<typeof overpaymentResolution>
