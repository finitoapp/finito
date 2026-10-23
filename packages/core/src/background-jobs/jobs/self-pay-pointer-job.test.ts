import { testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"
import { createEetApiDep } from "../../integrations/eet/eet-client.ts"
import { createQerkoApiDep } from "../../integrations/qerko/qerko-client.ts"
import { createQerkoConnectionStatusDep } from "../../integrations/qerko/qerko-connection-status.ts"
import { createQerkoSocketDep } from "../../integrations/qerko/qerko-socket.ts"
import { createYadioApiDep } from "../../integrations/yadio/yadio-client.ts"
import { selfPayAllocationsByBillIdQuery } from "../../modules/table-self-pay/table-self-pay-queries.ts"
import { formatSelfPayBankMessage } from "../../modules/table-self-pay/table-self-pay-reference-utils.ts"
import {
  createSelfPayTestContext,
  createSelfPayTestSelection,
  openSelfPayBill,
  publishSelfPayTestView,
  receiveBankTransfer,
  type SelfPayTestContext,
} from "../../modules/table-self-pay/table-self-pay-test-fixtures.ts"
import { createTestDeviceAccountDep } from "../../testing/background-jobs.ts"
import type { AppBackgroundJobContext } from "../background-job-types.ts"
import {
  createSelfPayPointerJob,
  nextSelfPayPointerAttemptAt,
} from "./self-pay-pointer-job.ts"

const minute = 60 * 1000

const startJob = async (context: SelfPayTestContext) => {
  const errors: unknown[] = []
  const fetch = async () => new Response("{}")
  const device = await createTestDeviceAccountDep()
  const jobDeps: AppBackgroundJobContext = {
    ...context.deps,
    ...device.deviceAccount,
    ...createEetApiDep({ date: context.deps.date, fetch }),
    ...createQerkoApiDep({ posId: "test" }),
    ...createQerkoSocketDep(),
    ...createQerkoConnectionStatusDep(),
    ...createYadioApiDep(),
    fetch,
    deviceId: context.deviceId,
    connectivity: { onOnline: () => () => undefined },
    onError: (error) => {
      errors.push(error)
    },
  }
  const run = testCreateRun(jobDeps)
  const job = await run.ok(createSelfPayPointerJob({ intervalMs: 5 }))
  return {
    errors,
    [Symbol.asyncDispose]: async () => {
      await job[Symbol.asyncDispose]()
      await run[Symbol.asyncDispose]()
      await device[Symbol.asyncDispose]()
    },
  }
}

const waitFor = async (check: () => Promise<boolean>) => {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (await check()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error("Timed out waiting for the job.")
}

describe("nextSelfPayPointerAttemptAt", () => {
  test("asks again at 1, 3, 6 and 11 minutes, then every hour", () => {
    const attempts = [0]
    while (attempts.length < 7) {
      const last = attempts.at(-1) ?? 0
      attempts.push(nextSelfPayPointerAttemptAt(0, last))
    }

    expect(attempts.map((at) => at / minute)).toEqual([0, 1, 3, 6, 11, 71, 131])
  })
})

describe("self-pay pointer job", () => {
  test("marks the lines paid once the selection reaches a relay after the money", async () => {
    await using context = await createSelfPayTestContext({ now: new Date() })
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    const [bill] = (await publishSelfPayTestView(context)).view.bills
    if (bill === undefined) throw new Error("Expected the published bill.")
    const { pointer, event } = createSelfPayTestSelection(context, bill)

    const { paymentId } = await receiveBankTransfer(context, {
      amount: 10_100,
      variableSymbol: reference,
      recipientMessage: formatSelfPayBankMessage({ pointer }),
    })
    expect(paymentId).toBe(null)

    await context.deps.nostrRelayClient.publish(
      context.deps.selfPayDefaultRelays,
      event
    )
    context.clock.advance(2 * minute)
    await using job = await startJob(context)
    await waitFor(
      async () =>
        (
          await context.deps.evolu.loadQuery(
            selfPayAllocationsByBillIdQuery(billId)
          )
        ).length > 0
    )

    expect(job.errors).toEqual([])
    expect(
      (
        await context.deps.evolu.loadQuery(
          selfPayAllocationsByBillIdQuery(billId)
        )
      ).map(({ amount }) => amount)
    ).toEqual([10_100])
  })
})
