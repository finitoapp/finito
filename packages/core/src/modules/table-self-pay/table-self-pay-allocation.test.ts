import { testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"

import {
  addManualAmountToBill,
  appendRemoveBillLine,
  assignBillToTable,
  removeTableFromBill,
  splitBillIntoNewBill,
} from "../bill/bill-actions.ts"
import { loadBillCoverage } from "../bill/bill-guards.ts"
import type { BillId } from "../bill/bill-types.ts"
import { loadCalculatedBillLineSummaries } from "../bill-line/bill-line-actions.ts"
import { paymentWithDetailsByIdQuery } from "../payment/payment-test-fixtures.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import { reconcileAccountTransaction } from "../reconciliation-claim/reconciliation-claim-actions.ts"
import { createRowId } from "../shared/evolu-utils.ts"
import {
  NonEmptyString255,
  NonNegativeInteger,
  PositiveInteger,
} from "../shared/schema.ts"
import { createTableAtEnd } from "../table/table-actions.ts"
import { dropExpiredSelfPayViewVersions } from "./table-self-pay-actions.ts"
import {
  selfPayAllocationsByBillIdQuery,
  selfPayViewVersionsByBillIdQuery,
} from "./table-self-pay-queries.ts"
import {
  formatSelfPayBankMessage,
  type SelfPayReference,
} from "./table-self-pay-reference-utils.ts"
import type { SelfPayLineFraction } from "./table-self-pay-share-utils.ts"
import {
  createSelfPayTestContext,
  createSelfPayTestSelection,
  loadSelfPayTestView,
  openSelfPayBill,
  publishSelfPayTestSelection,
  publishSelfPayTestView,
  receiveBankTransfer,
  type SelfPayTestContext,
} from "./table-self-pay-test-fixtures.ts"
import type { SelfPayViewBill } from "./table-self-pay-view-utils.ts"

const findBill = (bills: ReadonlyArray<SelfPayViewBill>, reference: string) => {
  const bill = bills.find((candidate) => candidate.reference === reference)
  if (bill === undefined) throw new Error("Expected the bill in the view.")
  return bill
}

const selectLines = (
  context: SelfPayTestContext,
  bill: SelfPayViewBill,
  fractions: ReadonlyArray<readonly [number, number]>
) =>
  publishSelfPayTestSelection(context, bill, {
    kind: "lines",
    fractions: fractions.flatMap(
      (
        [numerator, denominator],
        position
      ): ReadonlyArray<SelfPayLineFraction> => {
        const line = bill.lines[position]
        return line === undefined || numerator === 0
          ? []
          : [{ key: line.key, numerator, denominator }]
      }
    ),
  })

const publishedBill = async (
  context: SelfPayTestContext,
  reference: SelfPayReference
) => findBill((await publishSelfPayTestView(context)).view.bills, reference)

const allocationsOf = async (context: SelfPayTestContext, billId: BillId) =>
  (
    await context.deps.evolu.loadQuery(selfPayAllocationsByBillIdQuery(billId))
  ).map(({ lineKey, amount }) => ({ lineKey, amount }))

const claimedSumOf = async (context: SelfPayTestContext, billId: BillId) => {
  await using run = testCreateRun(context.deps)
  return (await run.ok(loadBillCoverage(billId))).claimedSum
}

const tipOf = async (
  context: SelfPayTestContext,
  paymentId: PaymentId | null
) => {
  if (paymentId === null) throw new Error("Expected a self-pay payment.")
  const [payment] = await context.deps.evolu.loadQuery(
    paymentWithDetailsByIdQuery(paymentId)
  )
  return payment?.tipAmount
}

const openPizzaAndBeer = (context: SelfPayTestContext) =>
  openSelfPayBill(context, {
    lines: [
      { name: "Pizza", amount: 10_100 },
      { name: "Beer", amount: 4500 },
    ],
  })

describe("self-pay allocation", () => {
  test("marks the lines the payment's pointer names as paid", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openPizzaAndBeer(context)
    const bill = await publishedBill(context, reference)
    const [pizza, beer] = bill.lines

    const { paymentId } = await receiveBankTransfer(context, {
      amount: 6520,
      variableSymbol: reference,
      recipientMessage: formatSelfPayBankMessage({
        pointer: await selectLines(context, bill, [
          [1, 5],
          [1, 1],
        ]),
      }),
    })

    expect(await allocationsOf(context, billId)).toEqual(
      expect.arrayContaining([
        { lineKey: pizza?.key, amount: 2020 },
        { lineKey: beer?.key, amount: 4500 },
      ])
    )
    expect(await tipOf(context, paymentId)).toBe(0)
  })

  test("prices against the version the guest saw after a line was added", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openPizzaAndBeer(context)
    const seen = await publishedBill(context, reference)
    const pointer = await selectLines(context, seen, [[1, 5]])
    await using run = testCreateRun(context.deps)
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: context.deviceId,
        totalAmount: NonNegativeInteger(9900),
        name: NonEmptyString255("Tiramisu"),
        currency: "CZK",
      })
    )
    await publishSelfPayTestView(context)

    await receiveBankTransfer(context, {
      amount: 2020,
      variableSymbol: reference,
      recipientMessage: formatSelfPayBankMessage({ pointer }),
    })

    expect(await allocationsOf(context, billId)).toEqual([
      { lineKey: seen.lines[0]?.key, amount: 2020 },
    ])
  })

  test("prices a selection against the bill as it stands when no version reached this device", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openPizzaAndBeer(context)
    const bill = findBill(
      (await loadSelfPayTestView(context)).view.bills,
      reference
    )

    await receiveBankTransfer(context, {
      amount: 2020,
      variableSymbol: reference,
      recipientMessage: formatSelfPayBankMessage({
        pointer: await selectLines(context, bill, [[1, 5]]),
      }),
    })

    expect(
      await context.deps.evolu.loadQuery(
        selfPayViewVersionsByBillIdQuery(billId)
      )
    ).toEqual([])
    expect(await allocationsOf(context, billId)).toEqual([
      { lineKey: bill.lines[0]?.key, amount: 2020 },
    ])
  })

  test("counts a cut pointer toward the bill at once without allocation", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openPizzaAndBeer(context)
    const pointer = await selectLines(
      context,
      await publishedBill(context, reference),
      [[1, 5]]
    )

    const { paymentId } = await receiveBankTransfer(context, {
      amount: 2020,
      variableSymbol: reference,
      recipientMessage: `PK1${pointer.slice(0, -1)}`,
    })

    expect(await tipOf(context, paymentId)).toBe(0)
    expect(await allocationsOf(context, billId)).toEqual([])
    expect(await claimedSumOf(context, billId)).toBe(2020)
  })

  test("counts an edited pointer toward the bill without allocation once 10 minutes passed", async () => {
    await using context = await createSelfPayTestContext({ now: new Date() })
    const { billId, reference } = await openPizzaAndBeer(context)
    const pointer = await selectLines(
      context,
      await publishedBill(context, reference),
      [[1, 5]]
    )
    const edited = `${pointer.slice(0, -1)}${pointer.endsWith("A") ? "B" : "A"}`

    const { accountTransactionId, paymentId } = await receiveBankTransfer(
      context,
      {
        amount: 2020,
        variableSymbol: reference,
        recipientMessage: `PK1${edited}`,
      }
    )
    expect(paymentId).toBeNull()

    context.clock.advance(11 * 60 * 1000)
    await using run = testCreateRun(context.deps)
    const lateId = await run.ok(
      reconcileAccountTransaction(accountTransactionId)
    )

    expect(await tipOf(context, lateId)).toBe(0)
    expect(await allocationsOf(context, billId)).toEqual([])
    expect(await claimedSumOf(context, billId)).toBe(2020)
  })

  test("reads a pointer the bank wrapped onto several lines", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openPizzaAndBeer(context)
    const bill = await publishedBill(context, reference)
    const pointer = await selectLines(context, bill, [[1, 5]])

    await receiveBankTransfer(context, {
      amount: 2020,
      variableSymbol: reference,
      recipientMessage: `PK1 ${pointer.slice(0, 3)}\n${pointer.slice(3)}`,
    })

    expect(await allocationsOf(context, billId)).toEqual([
      { lineKey: bill.lines[0]?.key, amount: 2020 },
    ])
  })

  test("counts less money than the share without allocation and without a tip", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 30_000 }],
    })
    const pointer = await selectLines(
      context,
      await publishedBill(context, reference),
      [[1, 1]]
    )

    const { paymentId } = await receiveBankTransfer(context, {
      amount: 10_000,
      variableSymbol: reference,
      recipientMessage: formatSelfPayBankMessage({ pointer }),
    })

    expect(await allocationsOf(context, billId)).toEqual([])
    expect(await claimedSumOf(context, billId)).toBe(10_000)
    expect(await tipOf(context, paymentId)).toBe(0)
  })

  test("keeps what arrives above the share as the tip", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [
        { name: "Menu", amount: 20_000 },
        { name: "Wine", amount: 30_000 },
      ],
    })
    const bill = await publishedBill(context, reference)

    const { paymentId } = await receiveBankTransfer(context, {
      amount: 22_000,
      variableSymbol: reference,
      recipientMessage: formatSelfPayBankMessage({
        pointer: await selectLines(context, bill, [[1, 1]]),
      }),
    })

    expect(await allocationsOf(context, billId)).toEqual([
      { lineKey: bill.lines[0]?.key, amount: 20_000 },
    ])
    expect(await claimedSumOf(context, billId)).toBe(20_000)
    expect(await tipOf(context, paymentId)).toBe(2000)
  })

  test("credits two guests who pay the same fifth from the same view", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    const pointer = await selectLines(
      context,
      await publishedBill(context, reference),
      [[1, 5]]
    )

    for (const bankReference of ["guest-1", "guest-2"]) {
      await receiveBankTransfer(context, {
        amount: 2020,
        variableSymbol: reference,
        recipientMessage: formatSelfPayBankMessage({ pointer }),
        bankReference,
      })
    }

    expect(await allocationsOf(context, billId)).toHaveLength(2)
    expect(await claimedSumOf(context, billId)).toBe(4040)
  })

  test("settles a 579.00 bill that three guests split in thirds one after another", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [
        { name: "Pizza", amount: 18_900 },
        { name: "Beer", amount: 16_200 },
        { name: "Coffee", amount: 9800 },
        { name: "Cake", amount: 9500 },
        { name: "Water", amount: 3500 },
      ],
    })

    for (const bankReference of ["guest-1", "guest-2", "guest-3"]) {
      const pointer = await publishSelfPayTestSelection(
        context,
        await publishedBill(context, reference),
        { kind: "fractionOfBill", denominator: 3 }
      )
      await receiveBankTransfer(context, {
        amount: 19_300,
        variableSymbol: reference,
        recipientMessage: formatSelfPayBankMessage({ pointer }),
        bankReference,
      })
    }

    expect(await claimedSumOf(context, billId)).toBe(57_900)
    expect(
      (await allocationsOf(context, billId)).reduce(
        (sum, { amount }) => sum + amount,
        0
      )
    ).toBe(57_900)
  })

  test("leaves 0.02 when three guests pay a third of 98.00 from the same view", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Menu", amount: 9800 }],
    })
    const pointer = await publishSelfPayTestSelection(
      context,
      await publishedBill(context, reference),
      { kind: "fractionOfBill", denominator: 3 }
    )

    for (const bankReference of ["guest-1", "guest-2", "guest-3"]) {
      await receiveBankTransfer(context, {
        amount: 3266,
        variableSymbol: reference,
        recipientMessage: formatSelfPayBankMessage({ pointer }),
        bankReference,
      })
    }

    expect(await allocationsOf(context, billId)).toHaveLength(3)
    expect(await claimedSumOf(context, billId)).toBe(9798)
  })

  test("pays 1.67 and 2.66 of the lines for a third of each line of a 5.00 and 8.00 bill", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [
        { name: "Bread", amount: 500 },
        { name: "Soup", amount: 800 },
      ],
    })
    const bill = await publishedBill(context, reference)

    const { paymentId } = await receiveBankTransfer(context, {
      amount: 433,
      variableSymbol: reference,
      recipientMessage: formatSelfPayBankMessage({
        pointer: await selectLines(context, bill, [
          [1, 3],
          [1, 3],
        ]),
      }),
    })

    const allocations = await allocationsOf(context, billId)
    expect(allocations).toHaveLength(2)
    expect(allocations).toEqual(
      expect.arrayContaining([
        { lineKey: bill.lines[0]?.key, amount: 167 },
        { lineKey: bill.lines[1]?.key, amount: 266 },
      ])
    )
    expect(await tipOf(context, paymentId)).toBe(0)
  })

  test("keeps a minor unit paid above the share as the tip", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Coffee", amount: 9800 }],
    })
    const bill = await publishedBill(context, reference)

    const { paymentId } = await receiveBankTransfer(context, {
      amount: 3267,
      variableSymbol: reference,
      recipientMessage: formatSelfPayBankMessage({
        pointer: await selectLines(context, bill, [[1, 3]]),
      }),
    })

    expect(await allocationsOf(context, billId)).toEqual([
      { lineKey: bill.lines[0]?.key, amount: 3266 },
    ])
    expect(await tipOf(context, paymentId)).toBe(1)
  })
})

const beerOf = async (context: SelfPayTestContext, billId: BillId) => {
  await using run = testCreateRun(context.deps)
  const beer = (await run.ok(loadCalculatedBillLineSummaries(billId))).find(
    ({ name }) => name === "Beer"
  )
  if (beer === undefined) throw new Error("Expected the beer line.")
  return beer
}

describe("self-pay allocation after the bill changed", () => {
  test.each([
    {
      move: "to another table",
      moveBill: async (context: SelfPayTestContext, billId: BillId) => {
        await using run = testCreateRun(context.deps)
        const tableId = await run.ok(
          createTableAtEnd({
            deviceId: context.deviceId,
            name: NonEmptyString255("Table 4"),
            seatCount: PositiveInteger(2),
            selfPayEnabled: 1,
          })
        )
        await run.ok(assignBillToTable({ id: billId, tableId }))
      },
    },
    {
      move: "off its table",
      moveBill: async (context: SelfPayTestContext, billId: BillId) => {
        await using run = testCreateRun(context.deps)
        await run.ok(removeTableFromBill(billId))
      },
    },
  ])(
    "keeps the guest's lines when the bill moves $move",
    async ({ moveBill }) => {
      await using context = await createSelfPayTestContext()
      const { billId, reference } = await openPizzaAndBeer(context)
      const bill = await publishedBill(context, reference)
      await moveBill(context, billId)

      await receiveBankTransfer(context, {
        amount: 2020,
        variableSymbol: reference,
        recipientMessage: formatSelfPayBankMessage({
          pointer: await selectLines(context, bill, [[1, 5]]),
        }),
      })

      expect(await allocationsOf(context, billId)).toEqual([
        { lineKey: bill.lines[0]?.key, amount: 2020 },
      ])
    }
  )

  test("counts money for a line removed meanwhile without marking it paid", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openPizzaAndBeer(context)
    const pointer = await selectLines(
      context,
      await publishedBill(context, reference),
      [
        [0, 1],
        [1, 1],
      ]
    )
    const beer = await beerOf(context, billId)
    await using run = testCreateRun(context.deps)
    await run.orThrow(
      appendRemoveBillLine({
        billId,
        deviceId: context.deviceId,
        quantity: beer.quantity,
        totalAmount: beer.totalAmount,
        lineSummary: beer,
      })
    )

    const { paymentId } = await receiveBankTransfer(context, {
      amount: 4500,
      variableSymbol: reference,
      recipientMessage: formatSelfPayBankMessage({ pointer }),
    })

    expect(await allocationsOf(context, billId)).toEqual([])
    expect(await claimedSumOf(context, billId)).toBe(4500)
    expect(await tipOf(context, paymentId)).toBe(0)
  })

  test("credits the bill the guest paid, not the bill their line was split into", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openPizzaAndBeer(context)
    const pointer = await selectLines(
      context,
      await publishedBill(context, reference),
      [
        [0, 1],
        [1, 1],
      ]
    )
    const beer = await beerOf(context, billId)
    await using run = testCreateRun(context.deps)
    const splitBillId = await run.orThrow(
      splitBillIntoNewBill({
        deviceId: context.deviceId,
        tableId: context.tableId,
        currency: "CZK",
        sourceBillId: billId,
        targetBillId: createRowId<"Bill">(),
        items: [beer],
      })
    )

    await receiveBankTransfer(context, {
      amount: 4500,
      variableSymbol: reference,
      recipientMessage: formatSelfPayBankMessage({ pointer }),
    })

    expect(await claimedSumOf(context, billId)).toBe(4500)
    expect(await allocationsOf(context, billId)).toEqual([])
    expect(await claimedSumOf(context, splitBillId)).toBe(0)
  })

  test("credits a pointer matched after its stored versions expired without marking lines paid", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openPizzaAndBeer(context)
    const pointer = await selectLines(
      context,
      await publishedBill(context, reference),
      [[1, 5]]
    )
    await receiveBankTransfer(context, {
      amount: 14_600,
      variableSymbol: reference,
    })
    const arrivedAt = context.clock.date.now().getTime()
    context.clock.advance(8 * 24 * 60 * 60 * 1000)
    await using run = testCreateRun(context.deps)
    await run.ok(dropExpiredSelfPayViewVersions())

    await receiveBankTransfer(context, {
      amount: 2020,
      variableSymbol: reference,
      recipientMessage: formatSelfPayBankMessage({ pointer }),
      occurredAt: arrivedAt,
    })

    expect(await allocationsOf(context, billId)).toEqual([])
    expect(await claimedSumOf(context, billId)).toBe(16_620)
  })
})

describe("looking up the selection a payment points to", () => {
  const minute = 60 * 1000

  const paidPizzaWithoutSelection = async (context: SelfPayTestContext) => {
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    const bill = await publishedBill(context, reference)
    const selection = createSelfPayTestSelection(context, bill)
    const arrival = await receiveBankTransfer(context, {
      amount: 10_100,
      variableSymbol: reference,
      recipientMessage: formatSelfPayBankMessage({
        pointer: selection.pointer,
      }),
    })
    return { billId, bill, selection, arrival }
  }

  test("credits money whose selection no relay returns without allocation once 10 minutes passed", async () => {
    await using context = await createSelfPayTestContext({ now: new Date() })
    const { billId, arrival } = await paidPizzaWithoutSelection(context)
    expect(arrival.paymentId).toBe(null)
    expect(await claimedSumOf(context, billId)).toBe(0)

    context.clock.advance(11 * minute)
    await using run = testCreateRun(context.deps)
    await run.ok(reconcileAccountTransaction(arrival.accountTransactionId))

    expect(await allocationsOf(context, billId)).toEqual([])
    expect(await claimedSumOf(context, billId)).toBe(10_100)
  })

  test("marks the lines paid when a relay returns the selection on a later try", async () => {
    await using context = await createSelfPayTestContext({ now: new Date() })
    const { billId, bill, selection, arrival } =
      await paidPizzaWithoutSelection(context)
    await context.deps.nostrRelayClient.publish(
      context.deps.selfPayDefaultRelays,
      selection.event
    )

    context.clock.advance(2 * minute)
    await using run = testCreateRun(context.deps)
    await run.ok(reconcileAccountTransaction(arrival.accountTransactionId))

    expect(await allocationsOf(context, billId)).toEqual([
      { lineKey: bill.lines[0]?.key, amount: 10_100 },
    ])
  })

  test("keeps the lines a device that found the selection recorded, when another device could not look it up", async () => {
    await using context = await createSelfPayTestContext({ now: new Date() })
    const { billId, bill, selection, arrival } =
      await paidPizzaWithoutSelection(context)
    await context.deps.nostrRelayClient.publish(
      context.deps.selfPayDefaultRelays,
      selection.event
    )
    const { nostrRelayClient: _relays, ...offline } = context.deps
    await using offlineRun = testCreateRun(offline)
    await using onlineRun = testCreateRun(context.deps)

    expect(
      await offlineRun.ok(
        reconcileAccountTransaction(arrival.accountTransactionId)
      )
    ).toBe(null)
    const recorded = await onlineRun.ok(
      reconcileAccountTransaction(arrival.accountTransactionId)
    )
    context.clock.advance(11 * minute)
    const late = await offlineRun.ok(
      reconcileAccountTransaction(arrival.accountTransactionId)
    )

    expect(late).toBe(recorded)
    expect(await allocationsOf(context, billId)).toEqual([
      { lineKey: bill.lines[0]?.key, amount: 10_100 },
    ])
  })

  test("reads no relay for selections nobody paid", async () => {
    await using context = await createSelfPayTestContext()
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    const bill = await publishedBill(context, reference)
    let queries = 0
    const counting = {
      ...context.deps,
      nostrRelayClient: {
        publish: context.deps.nostrRelayClient.publish,
        query: (
          ...query: Parameters<typeof context.deps.nostrRelayClient.query>
        ) => {
          queries++
          return context.deps.nostrRelayClient.query(...query)
        },
      },
    }

    for (let guest = 0; guest < 20; guest++) {
      const { event } = createSelfPayTestSelection(context, bill)
      await counting.nostrRelayClient.publish(
        counting.selfPayDefaultRelays,
        event
      )
    }
    await using run = testCreateRun(counting)
    await run.ok(dropExpiredSelfPayViewVersions())

    expect(queries).toBe(0)
    expect(await claimedSumOf(context, billId)).toBe(0)
  })
})
