import { testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"

import { addManualAmountToBill } from "../bill/bill-actions.ts"
import type { BillId } from "../bill/bill-types.ts"
import { NonEmptyString255, NonNegativeInteger } from "../shared/schema.ts"
import {
  dropExpiredSelfPayViewVersions,
  loadSelfPayViewVersions,
} from "./table-self-pay-actions.ts"
import { selfPayViewVersionsByBillIdQuery } from "./table-self-pay-queries.ts"
import {
  createSelfPayTestContext,
  openSelfPayBill,
  publishSelfPayTestView,
  receiveBankTransfer,
  type SelfPayTestContext,
} from "./table-self-pay-test-fixtures.ts"

const DAY_MS = 24 * 60 * 60 * 1000

const storedVersionsOf = async (context: SelfPayTestContext, billId: BillId) =>
  await context.deps.evolu.loadQuery(selfPayViewVersionsByBillIdQuery(billId))

const dropExpired = async (context: SelfPayTestContext) => {
  await using run = testCreateRun(context.deps)
  return await run.ok(dropExpiredSelfPayViewVersions())
}

describe("self-pay view versions", () => {
  test("store each published bill once, however often and by whom it is published", async () => {
    await using context = await createSelfPayTestContext()
    const { billId } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })

    const first = await publishSelfPayTestView(context)
    const second = await publishSelfPayTestView(context)

    expect(first.versions).toHaveLength(1)
    expect(second.versions).toEqual([])
    expect(await storedVersionsOf(context, billId)).toHaveLength(1)
  })

  test("keep the version a guest saw after a line is added", async () => {
    await using context = await createSelfPayTestContext()
    const { billId } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    await publishSelfPayTestView(context)
    await using run = testCreateRun(context.deps)
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: context.deviceId,
        totalAmount: NonNegativeInteger(4500),
        name: NonEmptyString255("Beer"),
        currency: "CZK",
      })
    )
    await publishSelfPayTestView(context)

    const versions = await run.ok(loadSelfPayViewVersions(billId))

    expect(
      versions.map(({ lines }) => lines.map(({ totalAmount }) => totalAmount))
    ).toEqual(expect.arrayContaining([[10_100], [10_100, 4500]]))
    expect(versions).toHaveLength(2)
  })

  test("drop a closed bill's versions 7 days after it closed", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    await publishSelfPayTestView(context)
    await receiveBankTransfer(context, {
      amount: 10_100,
      variableSymbol: reference,
    })

    context.clock.advance(6 * DAY_MS)
    expect(await dropExpired(context)).toBe(0)
    expect(await storedVersionsOf(context, billId)).toHaveLength(1)

    context.clock.advance(2 * DAY_MS)
    expect(await dropExpired(context)).toBe(1)
    expect(await storedVersionsOf(context, billId)).toEqual([])
  })
})
