import { testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"
import { createCashuTest, testCashuMasterKey } from "../../testing/cashu.ts"

import {
  saveCashuAccount,
  setCashuPaymentRequestLegs,
} from "./account-actions.ts"
import { cashuAccountQuery } from "./account-queries.ts"

describe("the Cashu account's payment QR legs (settings/0003)", () => {
  test("start as both and narrow to one leg on the account row", async () => {
    await using t = await createCashuTest()
    const { evolu } = t.deps
    await using run = testCreateRun({
      ...t.deps,
      masterKey: testCashuMasterKey,
    })

    expect(await run.ok(setCashuPaymentRequestLegs("cashu"))).toBeNull()

    await run.ok(saveCashuAccount({ enabled: true }))
    await expect
      .poll(() => evolu.loadQuery(cashuAccountQuery))
      .toEqual([expect.objectContaining({ paymentRequestLegs: null })])

    await run.ok(setCashuPaymentRequestLegs("lightning"))
    await expect
      .poll(() => evolu.loadQuery(cashuAccountQuery))
      .toEqual([expect.objectContaining({ paymentRequestLegs: "lightning" })])
  })
})
