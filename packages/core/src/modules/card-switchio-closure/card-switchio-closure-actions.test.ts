import {
  createIdFromString,
  err,
  type Result,
  testCreateRun,
} from "@evolu/common"
import { describe, expect, test } from "vitest"
import {
  createSwitchioResultUnreadableError,
  interpretSwitchioClosureResult,
  type SwitchioClosure,
  type SwitchioClosureDep,
  type SwitchioClosureError,
} from "../../switchio.ts"
import { createTestDateDep } from "../../testing/date-dep.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import { saveCardSwitchioAccount } from "../account/account-actions.ts"
import { createCardSwitchioAccountId } from "../account/account-utils.ts"
import { registerDevice } from "../device/device-actions.ts"
import { NonEmptyString255 } from "../shared/schema.ts"
import {
  closeCardSwitchioBatch,
  recordRestoredCardSwitchioClosure,
} from "./card-switchio-closure-actions.ts"
import {
  cardSwitchioClosuresQuery,
  lastCardSwitchioClosurePerDeviceQuery,
} from "./card-switchio-closure-queries.ts"

const thisDevice = createIdFromString<"Device">("closure-this-device")
const otherDevice = createIdFromString<"Device">("closure-other-device")

const batchTotals = {
  shiftNumber: 3,
  batchNumber: 42,
  debitsCount: 5,
  debitsAmount: 128_900,
  creditsCount: 1,
  creditsAmount: 9_900,
  adjsCount: 0,
  adjsAmount: 0,
}

const closedBatch = {
  resultCode: -1,
  transactionResult: JSON.stringify({
    transactionType: "CLOSE_BATCH",
    dateTimeTerminal: "Nov 8, 2026 22:14:03",
    responseCode: "OK",
    batchTotals,
  }),
}

const setUp = async (
  results: ReadonlyArray<Result<SwitchioClosure, SwitchioClosureError>> = [
    interpretSwitchioClosureResult(closedBatch),
  ]
) => {
  const testEvolu = await createEvoluTest()
  const queue = [...results]
  let calls = 0
  const dateDep = createTestDateDep()
  const switchioClosure: SwitchioClosureDep = {
    switchioClosure: {
      close: () => {
        calls += 1
        const next = queue.shift()
        return Promise.resolve(
          next ??
            err(
              createSwitchioResultUnreadableError({
                resultCode: null,
                rawResult: null,
              })
            )
        )
      },
    },
  }
  const run = testCreateRun({
    ...evoluTestDeps(testEvolu.evolu),
    ...dateDep,
    ...switchioClosure,
  })
  return {
    evolu: testEvolu.evolu,
    run,
    dateDep,
    calls: () => calls,
    async [Symbol.asyncDispose]() {
      await run[Symbol.asyncDispose]()
      await testEvolu[Symbol.asyncDispose]()
    },
  }
}

describe("closeCardSwitchioBatch", () => {
  test("records a closed batch under the device with the card account's currency", async () => {
    await using t = await setUp()
    await t.run.ok(saveCardSwitchioAccount({ enabled: true, currency: "CZK" }))

    const recorded = await t.run.orThrow(
      closeCardSwitchioBatch({ deviceId: thisDevice })
    )

    expect(recorded).toMatchObject({
      ...batchTotals,
      accountId: createCardSwitchioAccountId("CZK"),
      deviceId: thisDevice,
      currency: "CZK",
      terminalDateTime: "Nov 8, 2026 22:14:03",
    })
    await expect
      .poll(() => t.evolu.loadQuery(cardSwitchioClosuresQuery(30)))
      .toMatchObject([
        {
          id: recorded.id,
          deviceId: thisDevice,
          currency: "CZK",
          batchNumber: 42,
          debitsAmount: 128_900,
          closedAt: recorded.closedAt,
        },
      ])
  })

  test("writes nothing when the terminal does not close the batch", async () => {
    await using t = await setUp([
      interpretSwitchioClosureResult({
        resultCode: 2,
        transactionResult: JSON.stringify({ responseMessage: "Terminal busy" }),
      }),
      interpretSwitchioClosureResult({
        resultCode: 0,
        transactionResult: null,
      }),
    ])
    await t.run.ok(saveCardSwitchioAccount({ enabled: true, currency: "CZK" }))

    const busy = await t.run(closeCardSwitchioBatch({ deviceId: thisDevice }))
    const unknown = await t.run(
      closeCardSwitchioBatch({ deviceId: thisDevice })
    )

    expect(!busy.ok && busy.error.type).toBe("SwitchioClosureFailed")
    expect(!unknown.ok && unknown.error.type).toBe("SwitchioResultUnreadable")
    expect(await t.evolu.loadQuery(cardSwitchioClosuresQuery(30))).toEqual([])
  })

  test("does not launch the terminal without a card account", async () => {
    await using t = await setUp()

    const result = await t.run(closeCardSwitchioBatch({ deviceId: thisDevice }))

    expect(result).toEqual(err({ type: "CardSwitchioClosureAccountNotFound" }))
    expect(t.calls()).toBe(0)
  })
})

describe("recordRestoredCardSwitchioClosure", () => {
  test("records the same result once, whether it came back through the promise or after a restart", async () => {
    await using t = await setUp()
    await t.run.ok(saveCardSwitchioAccount({ enabled: true, currency: "CZK" }))

    const first = await t.run.orThrow(
      closeCardSwitchioBatch({ deviceId: thisDevice })
    )
    await expect
      .poll(() => t.evolu.loadQuery(cardSwitchioClosuresQuery(30)))
      .toHaveLength(1)

    t.dateDep.advance(60_000)
    const restored = await t.run.orThrow(
      recordRestoredCardSwitchioClosure({
        restored: closedBatch,
        deviceId: thisDevice,
      })
    )

    expect(restored.id).toBe(first.id)
    expect(restored.closedAt).toBe(first.closedAt)
    expect(
      await t.evolu.loadQuery(cardSwitchioClosuresQuery(30))
    ).toMatchObject([{ id: first.id, closedAt: first.closedAt }])
  })

  test("writes nothing for a restored result that cannot be read", async () => {
    await using t = await setUp()
    await t.run.ok(saveCardSwitchioAccount({ enabled: true, currency: "CZK" }))

    const result = await t.run(
      recordRestoredCardSwitchioClosure({
        restored: { resultCode: -1, transactionResult: "not json" },
        deviceId: thisDevice,
      })
    )

    expect(!result.ok && result.error.type).toBe("SwitchioResultUnreadable")
    expect(await t.evolu.loadQuery(cardSwitchioClosuresQuery(30))).toEqual([])
  })
})

describe("lastCardSwitchioClosurePerDeviceQuery", () => {
  test("lists each device's latest closure with the device's name", async () => {
    const nextBatch = (batchNumber: number) =>
      interpretSwitchioClosureResult({
        resultCode: -1,
        transactionResult: JSON.stringify({
          responseCode: "OK",
          batchTotals: { ...batchTotals, batchNumber },
        }),
      })
    await using t = await setUp([nextBatch(1), nextBatch(2), nextBatch(7)])
    await t.run.ok(saveCardSwitchioAccount({ enabled: true, currency: "CZK" }))
    for (const [id, name] of [
      [thisDevice, "Bar"],
      [otherDevice, "Terrace"],
    ] as const) {
      await t.run.ok(
        registerDevice({
          id,
          name: NonEmptyString255(name),
          deviceType: null,
          browserName: null,
          osName: null,
        })
      )
    }

    await t.run.orThrow(closeCardSwitchioBatch({ deviceId: thisDevice }))
    t.dateDep.advance(60_000)
    await t.run.orThrow(closeCardSwitchioBatch({ deviceId: thisDevice }))
    t.dateDep.advance(60_000)
    await t.run.orThrow(closeCardSwitchioBatch({ deviceId: otherDevice }))

    await expect
      .poll(() => t.evolu.loadQuery(lastCardSwitchioClosurePerDeviceQuery))
      .toMatchObject([
        { deviceId: thisDevice, deviceName: "Bar", batchNumber: 2 },
        { deviceId: otherDevice, deviceName: "Terrace", batchNumber: 7 },
      ])
  })
})
