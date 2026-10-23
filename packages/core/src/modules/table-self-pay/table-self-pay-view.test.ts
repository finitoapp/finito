import { createIdFromString, testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"
import {
  addManualAmountToBill,
  cancelBill,
  createBill,
} from "../bill/bill-actions.ts"
import { loadCalculatedBillLineSummaries } from "../bill-line/bill-line-actions.ts"
import { runMutationWithCompletion } from "../shared/evolu-utils.ts"
import {
  NonEmptyString255,
  NonNegativeInteger,
  PositiveInteger,
  TimestampMs,
} from "../shared/schema.ts"
import { createTableAtEnd } from "../table/table-actions.ts"
import { loadTableSelfPayView } from "./table-self-pay-actions.ts"
import { deriveSelfPayLineKey } from "./table-self-pay-projection-utils.ts"
import { selfPayTablesQuery } from "./table-self-pay-queries.ts"
import {
  deriveSelfPayPointerHash,
  formatSelfPayBankMessage,
} from "./table-self-pay-reference-utils.ts"
import {
  createSelfPayTestContext,
  openSelfPayBill,
  publishSelfPayTestSelection,
  publishSelfPayTestView,
  receiveBankTransfer,
  type SelfPayTestContext,
} from "./table-self-pay-test-fixtures.ts"

const loadView = async (context: SelfPayTestContext) => {
  const tables = await context.deps.evolu.loadQuery(selfPayTablesQuery)
  const table = tables.find(({ id }) => id === context.tableId)
  if (table === undefined) throw new Error("Expected the self-pay table.")
  await using run = testCreateRun(context.deps)
  return await run.ok(loadTableSelfPayView(table))
}

describe("table self-pay view", () => {
  test("lists only the open bills of the table", async () => {
    await using context = await createSelfPayTestContext()
    const open = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    const paid = await openSelfPayBill(context, {
      lines: [{ name: "Beer", amount: 4500 }],
    })
    await receiveBankTransfer(context, {
      amount: 4500,
      variableSymbol: paid.reference,
    })
    const canceled = await openSelfPayBill(context, {
      lines: [{ name: "Soup", amount: 5000 }],
    })
    await using run = testCreateRun(context.deps)
    await run.orThrow(cancelBill(canceled.billId))
    const otherTableId = await run.ok(
      createTableAtEnd({
        deviceId: context.deviceId,
        name: NonEmptyString255("Table 4"),
        seatCount: PositiveInteger(2),
        selfPayEnabled: 1,
      })
    )
    await openSelfPayBill(context, {
      lines: [{ name: "Tea", amount: 3000 }],
      tableId: otherTableId,
    })

    const { view } = await loadView(context)

    expect(view.bills.map(({ reference }) => reference)).toEqual([
      open.reference,
    ])
    expect(view.bills[0]).toMatchObject({
      currency: "CZK",
      total: 10_100,
      covered: 0,
      remainder: 10_100,
      lines: [
        {
          name: "Pizza",
          quantity: 1,
          totalAmount: 10_100,
          allocatedAmount: 0,
        },
      ],
    })
  })

  test("carries nothing about staff, devices or notes", async () => {
    await using context = await createSelfPayTestContext()
    await using run = testCreateRun(context.deps)
    const billId = await run.ok(
      createBill({
        deviceId: context.deviceId,
        displayNumber: PositiveInteger(42),
        label: NonEmptyString255("Mr. Smith, regular"),
        tableId: context.tableId,
        currency: "CZK",
      })
    )

    const { view } = await loadView(context)
    const text = JSON.stringify(view)

    expect(Object.keys(view).sort()).toEqual(
      [
        "bank",
        "bills",
        "confirmations",
        "enabled",
        "lightning",
        "payee",
        "selectionKey",
        "menu",
        "table",
        "v",
      ].sort()
    )
    expect(Object.keys(view.bills[0] ?? {}).sort()).toEqual(
      ["covered", "currency", "lines", "reference", "remainder", "total"].sort()
    )
    expect(text).not.toContain("Smith")
    expect(text).not.toContain(context.deviceId)
    expect(text).not.toContain(billId)
  })

  test("shows what is allocated to each line", async () => {
    await using context = await createSelfPayTestContext()
    const { billId } = await openSelfPayBill(context, {
      lines: [
        { name: "Pizza", amount: 10_100 },
        { name: "Beer", amount: 4500 },
      ],
    })
    await using run = testCreateRun(context.deps)
    const [pizza] = await run.ok(loadCalculatedBillLineSummaries(billId))
    if (pizza === undefined) throw new Error("Expected a pizza line.")
    const paymentId = createIdFromString<"Payment">("payment")
    await runMutationWithCompletion((options) =>
      context.deps.evolu.upsert(
        "selfPayAllocation",
        {
          id: createIdFromString<"SelfPayAllocation">("allocation"),
          paymentId,
          billId,
          lineKey: NonEmptyString255(deriveSelfPayLineKey(pizza.id)),
          amount: PositiveInteger(2020),
        },
        { ...options, owner: context.deps.evoluOwner }
      )
    )

    const { view } = await loadView(context)

    expect(
      view.bills[0]?.lines.map(({ name, allocatedAmount }) => ({
        name,
        allocatedAmount,
      }))
    ).toEqual([
      { name: "Pizza", allocatedAmount: 2020 },
      { name: "Beer", allocatedAmount: 0 },
    ])
  })

  test("moves its version forward with every change, a closing bill included", async () => {
    await using context = await createSelfPayTestContext({ now: new Date() })
    const nextSecond = () => new Promise((resolve) => setTimeout(resolve, 1100))
    const { billId, reference } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    const opened = await loadView(context)

    await nextSecond()
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
    const extended = await loadView(context)

    await nextSecond()
    await receiveBankTransfer(context, {
      amount: 14_600,
      variableSymbol: reference,
    })
    const closed = await loadView(context)

    expect(opened.view.bills).toHaveLength(1)
    expect(closed.view.bills).toEqual([])
    expect(extended.version).toBeGreaterThan(opened.version)
    expect(closed.version).toBeGreaterThan(extended.version)
  })

  test("asks to store the reference of a bill not yet published", async () => {
    await using context = await createSelfPayTestContext()
    await using run = testCreateRun(context.deps)
    const billId = await run.ok(
      createBill({
        deviceId: context.deviceId,
        displayNumber: PositiveInteger(1),
        label: null,
        tableId: context.tableId,
        currency: "CZK",
      })
    )

    const { references, view } = await loadView(context)

    expect(references).toEqual([
      { billId, reference: view.bills[0]?.reference },
    ])
  })

  test("keeps the payer's confirmation after their money closes the bill", async () => {
    await using context = await createSelfPayTestContext({ now: new Date() })
    const { reference } = await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 2020 }],
    })
    const [seen] = (await publishSelfPayTestView(context)).view.bills
    if (seen === undefined) throw new Error("Expected the published bill.")
    const pointer = await publishSelfPayTestSelection(context, seen)

    await receiveBankTransfer(context, {
      amount: 2020,
      variableSymbol: reference,
      recipientMessage: formatSelfPayBankMessage({ pointer }),
    })
    const { view } = await loadView(context)

    expect(view.bills).toEqual([])
    expect(view.confirmations).toEqual([
      {
        pointerHash: deriveSelfPayPointerHash(pointer),
        amount: 2020,
        currency: "CZK",
        at: Math.floor(context.clock.date.now().getTime() / 1000),
      },
    ])
    expect(JSON.stringify(view)).not.toContain(pointer)
  })

  test("lists confirmations only of bills that ended within the hour before the view's version", async () => {
    await using context = await createSelfPayTestContext({ now: new Date() })
    const payBill = async (name: string) => {
      const { billId, reference } = await openSelfPayBill(context, {
        lines: [{ name, amount: 2020 }],
      })
      const seen = (await publishSelfPayTestView(context)).view.bills.find(
        (bill) => bill.reference === reference
      )
      if (seen === undefined) throw new Error("Expected the published bill.")
      const pointer = await publishSelfPayTestSelection(context, seen)
      await receiveBankTransfer(context, {
        amount: 2020,
        variableSymbol: reference,
        recipientMessage: formatSelfPayBankMessage({ pointer }),
      })
      return { billId, pointer }
    }
    const longAgo = await payBill("Pizza")
    const recently = await payBill("Beer")
    const minute = 60 * 1000
    await runMutationWithCompletion((options) => {
      const owned = { ...options, owner: context.deps.evoluOwner }
      context.deps.evolu.update(
        "bill",
        { id: longAgo.billId, closedAt: TimestampMs(Date.now() - 61 * minute) },
        owned
      )
      context.deps.evolu.update(
        "bill",
        {
          id: recently.billId,
          closedAt: TimestampMs(Date.now() - 59 * minute),
        },
        owned
      )
    })
    const { view } = await loadView(context)

    expect(view.confirmations.map(({ pointerHash }) => pointerHash)).toEqual([
      deriveSelfPayPointerHash(recently.pointer),
    ])
  })
})
