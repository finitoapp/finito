import { describe, expect, test } from "vitest"

import type { OverpaymentResolutionId } from "../overpayment-resolution/overpayment-resolution-types.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import { NonNegativeInteger } from "../shared/schema.ts"
import { toBillOverpaymentInput } from "./bill-overpayment-utils.ts"

const resolution = (id: string, kind: string, amount: number) => ({
  id: id as OverpaymentResolutionId,
  paymentId: "payment" as PaymentId,
  kind,
  amount,
  knownTransactionIdsJson: "[]",
  withdrawnId: null,
})

describe("toBillOverpaymentInput", () => {
  test("leaves out a synced resolution this version cannot read", () => {
    const input = toBillOverpaymentInput(
      {
        billTotal: NonNegativeInteger(1000),
        isCanceled: false,
        payments: [],
        transactions: [],
        refunds: [],
        resolutions: [
          resolution("tip", "tip", 250),
          resolution("newer", "donation", 250),
          resolution("fraction", "kept", 2.5),
        ],
      },
      {
        claims: new Map(),
        refunds: new Map(),
        resolutions: new Map(),
        acknowledgements: new Map(),
      }
    )

    expect(input.resolutions.map(({ id }) => id)).toEqual(["tip"])
  })
})
