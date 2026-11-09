import { sqliteFalse, sqliteTrue, testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"

import { createTestDateDep } from "../../testing/date-dep.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import { addCatalogItemToBill, createBill } from "../bill/bill-actions.ts"
import { createCatalogItem } from "../catalog-item/catalog-item-actions.ts"
import { registerDevice } from "../device/device-actions.ts"
import {
  createPayment,
  markPaymentPaidCash,
} from "../payment/payment-actions.ts"
import { createPaymentAccounts } from "../payment/payment-test-fixtures.ts"
import {
  createRowId,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import {
  NonEmptyString255,
  NonNegativeInteger,
  PositiveInteger,
  PositiveNumber,
  TimestampMs,
} from "../shared/schema.ts"
import { refundPayment } from "./refund-actions.ts"
import {
  refundablePaymentLinesQuery,
  refundByIdQuery,
  refundLinesByRefundIdQuery,
} from "./refund-queries.ts"

/** A café's bill of two espressos and a croissant, paid 160 CZK in cash. */
const setup = async () => {
  const testEvolu = await createEvoluTest()
  const { evolu } = testEvolu
  const deps = { ...evoluTestDeps(evolu), ...createTestDateDep() }
  const run = testCreateRun(deps)
  const { cashRegisterAccountId } = await createPaymentAccounts(deps)
  const deviceId = createRowId<"Device">()
  await run.ok(
    registerDevice({
      id: deviceId,
      name: NonEmptyString255("Bar"),
      deviceType: null,
      browserName: null,
      osName: null,
    })
  )

  const billId = await run.ok(
    createBill({
      deviceId: null,
      displayNumber: PositiveInteger(1),
      label: null,
      tableId: null,
      currency: "CZK",
    })
  )
  for (const [index, item] of [
    { name: "Espresso", unitAmount: 4_500, quantity: 2 },
    { name: "Croissant", unitAmount: 6_970, quantity: 1 },
  ].entries()) {
    const catalogItemId = await run.ok(
      createCatalogItem({
        deviceId: null,
        categoryId: null,
        name: NonEmptyString255(item.name),
        description: null,
        currency: "CZK",
        unitAmount: NonNegativeInteger(item.unitAmount),
        sortOrder: NonNegativeInteger(index),
        scanCode: null,
      })
    )
    await run.orThrow(
      addCatalogItemToBill({
        billId,
        deviceId: null,
        catalogItemId,
        quantity: PositiveNumber(item.quantity),
      })
    )
  }
  const paymentId = await run.orThrow(
    createPayment({
      deviceId: null,
      billId,
      tableId: null,
      amount: NonNegativeInteger(15_970),
      currency: "CZK",
      tipAmount: NonNegativeInteger(0),
      canceledAt: null,
      expiresAt: null,
      cashRegister: { accountId: cashRegisterAccountId },
    })
  )
  await run.orThrow(
    markPaymentPaidCash({
      paymentId,
      accountId: cashRegisterAccountId,
      receivedAmount: NonNegativeInteger(16_000),
    })
  )
  const lines = await evolu.loadQuery(refundablePaymentLinesQuery(paymentId))
  const lineOf = (name: string) => {
    const line = lines.find((candidate) => candidate.name === name)
    if (line === undefined) throw new Error(`Expected the ${name} line.`)
    return line
  }

  return {
    evolu,
    run,
    deviceId,
    paymentId,
    cashRegisterAccountId,
    lineOf,
    [Symbol.asyncDispose]: async () => {
      await run[Symbol.asyncDispose]()
      await testEvolu[Symbol.asyncDispose]()
    },
  }
}

describe("refundByIdQuery", () => {
  test("reads a cash refund with the cash it handed out and the device that recorded it", async () => {
    await using t = await setup()
    const refundId = await t.run.orThrow(
      refundPayment({
        paymentId: t.paymentId,
        method: "cashRegister",
        deviceId: t.deviceId,
        lines: [
          {
            paymentLineId: t.lineOf("Croissant").id,
            quantity: PositiveNumber(1),
          },
        ],
      })
    )

    await expect(t.evolu.loadQuery(refundByIdQuery(refundId))).resolves.toEqual(
      [
        expect.objectContaining({
          id: refundId,
          paymentId: t.paymentId,
          deviceId: t.deviceId,
          amount: 6_970,
          currency: "CZK",
          method: "cashRegister",
          isTip: null,
          cashHandedAmount: 7_000,
          cashAccountId: t.cashRegisterAccountId,
          deviceName: "Bar",
          cardSwitchioAccountId: null,
          cardSwitchioTransactionId: null,
          cardSwitchioKind: null,
          cardSwitchioAuthCode: null,
          cardSwitchioSequenceNumber: null,
          qerkoTerminalAccountId: null,
          qerkoTerminalTransactionId: null,
          qerkoTerminalTerminalId: null,
        }),
      ]
    )
  }, 15_000)

  test("reads a refund an older version wrote, without its cash row or device, as nulls", async () => {
    await using t = await setup()
    const refundId = createRowId<"Refund">()
    await runMutationWithCompletion((options) =>
      t.evolu.upsert(
        "refund",
        {
          id: refundId,
          paymentId: t.paymentId,
          deviceId: null,
          amount: NonNegativeInteger(4_500),
          currency: "CZK",
          method: "cashRegister",
          refundedAt: TimestampMs(1_000),
          isDeleted: sqliteFalse,
        },
        options
      )
    )

    await expect(t.evolu.loadQuery(refundByIdQuery(refundId))).resolves.toEqual(
      [
        expect.objectContaining({
          id: refundId,
          amount: 4_500,
          cashHandedAmount: null,
          cashAccountId: null,
          deviceName: null,
          cardSwitchioTransactionId: null,
          qerkoTerminalTransactionId: null,
        }),
      ]
    )
  }, 15_000)

  test("does not return a deleted refund", async () => {
    await using t = await setup()
    const refundId = await t.run.orThrow(
      refundPayment({
        paymentId: t.paymentId,
        method: "outside",
        deviceId: null,
        amount: NonNegativeInteger(1_000),
      })
    )
    await runMutationWithCompletion((options) =>
      t.evolu.update("refund", { id: refundId, isDeleted: sqliteTrue }, options)
    )

    await expect(t.evolu.loadQuery(refundByIdQuery(refundId))).resolves.toEqual(
      []
    )
  }, 15_000)
})

describe("refundLinesByRefundIdQuery", () => {
  test("reads the lines of one refund only, named by their item", async () => {
    await using t = await setup()
    const refundLines = (quantity: number) =>
      t.run.orThrow(
        refundPayment({
          paymentId: t.paymentId,
          method: "outside",
          deviceId: null,
          lines: [
            {
              paymentLineId: t.lineOf("Espresso").id,
              quantity: PositiveNumber(quantity),
            },
          ],
        })
      )
    const first = await refundLines(1)
    const second = await refundLines(1)
    const byAmount = await t.run.orThrow(
      refundPayment({
        paymentId: t.paymentId,
        method: "outside",
        deviceId: null,
        amount: NonNegativeInteger(1_000),
      })
    )

    for (const refundId of [first, second]) {
      await expect(
        t.evolu.loadQuery(refundLinesByRefundIdQuery(refundId))
      ).resolves.toMatchObject([
        { refundId, name: "Espresso", quantity: 1, amount: 4_500 },
      ])
    }
    await expect(
      t.evolu.loadQuery(refundLinesByRefundIdQuery(byAmount))
    ).resolves.toEqual([])
  }, 15_000)
})
