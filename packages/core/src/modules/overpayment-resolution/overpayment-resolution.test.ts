import { describe, expect, test } from "vitest"
import { z } from "zod"

import { createQuery } from "../../evolu/schema.ts"
import { createSyncedDevices } from "../../testing/evolu-sync.ts"
import type { AccountTransactionId } from "../account-transaction/account-transaction-types.ts"
import { AccountTransactionIdsJson } from "../account-transaction/account-transaction-utils.ts"
import {
  createRowId,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import { NonNegativeInteger } from "../shared/schema.ts"
import type { OverpaymentResolutionId } from "./overpayment-resolution-types.ts"

const createdAtQuery = (id: OverpaymentResolutionId) =>
  createQuery((db) =>
    db
      .selectFrom("overpaymentResolution")
      .select(["id", "createdAt"])
      .where("id", "=", id)
  )

describe("overpaymentResolution", () => {
  test("keeps the createdAt of its first write through a second sync", async () => {
    await using devices = await createSyncedDevices()
    const { evolu: recording } = await devices.addDevice()
    const { evolu: withdrawing } = await devices.addDevice()
    const paymentId = createRowId<"Payment">()
    const tipId = await runMutationWithCompletion(
      (options) =>
        recording.insert(
          "overpaymentResolution",
          {
            paymentId,
            kind: "tip",
            amount: NonNegativeInteger(2_000),
            currency: "CZK",
            knownTransactionIdsJson: z.encode(AccountTransactionIdsJson, [
              createRowId<"AccountTransaction">() as AccountTransactionId,
            ]),
          },
          options
        ).id
    )
    const recorded = await recording.loadQuery(createdAtQuery(tipId))

    await expect
      .poll(() => withdrawing.loadQuery(createdAtQuery(tipId)), {
        timeout: 10_000,
      })
      .toEqual(recorded)

    const withdrawalId = await runMutationWithCompletion(
      (options) =>
        withdrawing.insert(
          "overpaymentResolution",
          {
            paymentId,
            kind: "withdrawal",
            amount: NonNegativeInteger(0),
            currency: "CZK",
            knownTransactionIdsJson: z.encode(AccountTransactionIdsJson, []),
            withdrawnId: tipId,
          },
          options
        ).id
    )
    await expect
      .poll(
        async () =>
          (await recording.loadQuery(createdAtQuery(withdrawalId))).length,
        { timeout: 10_000 }
      )
      .toBe(1)
    const { evolu: joining } = await devices.addDevice()

    await expect
      .poll(() => joining.loadQuery(createdAtQuery(tipId)), {
        timeout: 10_000,
      })
      .toEqual(recorded)
    expect(await recording.loadQuery(createdAtQuery(tipId))).toEqual(recorded)
    expect(await withdrawing.loadQuery(createdAtQuery(tipId))).toEqual(recorded)
  })
})
