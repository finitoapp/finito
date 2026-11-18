import {
  createConsole,
  createIdFromString,
  err,
  ok,
  testCreateRun,
} from "@evolu/common"
import { describe, expect, test } from "vitest"

import type { DateDep, EvoluOwnerDep, FetchDep } from "../../deps.ts"
import {
  createQerkoApiDep,
  type QerkoApiDep,
} from "../../integrations/qerko/qerko-client.ts"
import {
  createQerkoRpcSession,
  type QerkoBill,
  type QerkoWirePayment,
  qerkoRpcError,
} from "../../integrations/qerko/qerko-rpc.ts"
import type { QerkoSocketHandlers } from "../../integrations/qerko/qerko-socket.ts"
import { createTestDateDep } from "../../testing/date-dep.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import {
  saveCashRegisterAccount,
  saveQerkoPaymentAccount,
  setQerkoPaymentFlows,
} from "../account/account-actions.ts"
import { createQerkoPaymentAccountId } from "../account/account-utils.ts"
import {
  addManualAmountToBill,
  cancelBill,
  createBill,
} from "../bill/bill-actions.ts"
import { loadBillStatusSnapshot } from "../bill/bill-guards.ts"
import type { BillId } from "../bill/bill-types.ts"
import { saveQerkoPlugin } from "../qerko-plugin/qerko-plugin-actions.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
  PositiveInteger,
} from "../shared/schema.ts"
import { createTable } from "../table/table-actions.ts"
import type { TableId } from "../table/table-types.ts"
import { createPayment, markPaymentPaidCash } from "./payment-actions.ts"
import {
  processQerkoPayment,
  settleQerkoPayment,
} from "./payment-qerko-payment-actions.ts"
import {
  answerQerkoGetBill,
  answerQerkoGetTableContents,
  answerQerkoGetTableList,
  answerQerkoPaymentStart,
  answerQerkoSearchBills,
} from "./payment-qerko-pos-actions.ts"
import { createQerkoTablePaymentId } from "./payment-qerko-table-utils.ts"
import {
  paymentByIdQuery,
  paymentQerkoPaymentByIdQuery,
  qerkoPaymentAttemptsByPaymentIdQuery,
} from "./payment-queries.ts"

const deviceId = createIdFromString<"Device">("qerko-connection-device")
const qerkoAccountId = createQerkoPaymentAccountId("CZK")

const setup = async () => {
  const testEvolu = await createEvoluTest()
  const deps = {
    ...evoluTestDeps(testEvolu.evolu),
    ...createTestDateDep(),
    ...createQerkoApiDep({ posId: "pos" }),
    fetch: async (input) => {
      throw new Error(`unexpected ${String(input)}`)
    },
  } satisfies EvoluDep & EvoluOwnerDep & DateDep & QerkoApiDep & FetchDep
  const run = testCreateRun(deps)

  await run.ok(
    saveQerkoPlugin({
      role: "standard",
      environment: "sandbox",
      apiKey: NonEmptyStringSchema.decode("secret"),
      apiKeyName: NonEmptyString255("Payky"),
      legalEntityName: NonEmptyString255("Cafe"),
      identificationNumber: NonEmptyString255("12345678"),
      country: "CZ",
      restaurantId: NonEmptyString255("restaurant-1"),
    })
  )
  await run.ok(saveQerkoPaymentAccount({ enabled: true, currency: "CZK" }))

  let tables = 0
  const table = async (code: string, name = `Table ${code}`) => {
    tables += 1
    return await run.ok(
      createTable({
        deviceId: null,
        name: NonEmptyString255(name),
        seatCount: null,
        code: NonEmptyString255(code),
        sortOrder: NonNegativeInteger(tables),
      })
    )
  }

  let bills = 0
  /** An open bill with a line per amount, on `tableId`. */
  const bill = async (
    tableId: TableId | null,
    amounts: ReadonlyArray<number>,
    label: string | null = null
  ) => {
    bills += 1
    const billId = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(bills),
        label: label === null ? null : NonEmptyString255(label),
        tableId,
        currency: "CZK",
      })
    )
    for (const [index, amount] of amounts.entries()) {
      await run.orThrow(
        addManualAmountToBill({
          billId,
          deviceId: null,
          name: NonEmptyString255(`Line ${index + 1}`),
          currency: "CZK",
          totalAmount: NonNegativeInteger(amount),
        })
      )
    }
    return billId
  }

  /** Pays `amount` of a bill in cash, as a split payment at the till. */
  const payCash = async (billId: BillId, amount: number) => {
    const accountId = await run.ok(
      saveCashRegisterAccount({ enabled: true, currency: "CZK" })
    )
    if (accountId === null) throw new Error("no cash register")
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(amount),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId },
      })
    )
    await run.orThrow(markPaymentPaidCash({ paymentId, accountId }))
    return paymentId
  }

  return {
    run,
    table,
    bill,
    payCash,
    flows: (flows: { readonly direct?: boolean; readonly table?: boolean }) =>
      run.ok(setQerkoPaymentFlows({ accountId: qerkoAccountId, ...flows })),
    contents: (code: string) => run.ok(answerQerkoGetTableContents(code)),
    status: (billId: BillId) => run.orThrow(loadBillStatusSnapshot(billId)),
    payment: async (qerkoPaymentId: string) =>
      (
        await testEvolu.evolu.loadQuery(
          paymentByIdQuery(createQerkoTablePaymentId(qerkoPaymentId))
        )
      )[0],
    attempts: (qerkoPaymentId: string) =>
      testEvolu.evolu.loadQuery(
        qerkoPaymentAttemptsByPaymentIdQuery(
          createQerkoTablePaymentId(qerkoPaymentId)
        )
      ),
    method: (qerkoPaymentId: string) =>
      testEvolu.evolu.loadQuery(
        paymentQerkoPaymentByIdQuery(createQerkoTablePaymentId(qerkoPaymentId))
      ),
    [Symbol.asyncDispose]: async () => {
      await run[Symbol.asyncDispose]()
      await testEvolu[Symbol.asyncDispose]()
    },
  }
}

type TableTest = Awaited<ReturnType<typeof setup>>

/** Qerko's `Payment` for the bill Payky offered, paid whole. */
const wireFor = (
  qerkoPaymentId: string,
  bill: QerkoBill,
  overrides: Partial<QerkoWirePayment> = {}
): QerkoWirePayment => ({
  id: qerkoPaymentId,
  idBill: bill.id,
  currency: bill.currency,
  state: "STARTED",
  items: bill.items.map((item) => ({ ...item })),
  parts: [],
  discount: null,
  tipBrutto: "0",
  tipNetto: "0",
  ...overrides,
})

const cardParts = (total: string): QerkoWirePayment["parts"] => [
  { provider: { id: "qerko", name: "Card", type: "CARD" }, total },
]

/** Reads the one bill Qerko gets for `code` and starts paying it. */
const startPaying = async (
  test: TableTest,
  code: string,
  qerkoPaymentId: string,
  overrides: Partial<QerkoWirePayment> = {}
) => {
  const [bill] = await test.contents(code)
  if (bill === undefined) throw new Error(`no bill on ${code}`)
  const wire = wireFor(qerkoPaymentId, bill, overrides)
  await test.run.orThrow(answerQerkoPaymentStart({ wire, deviceId }))
  return { bill, wire }
}

describe("getTableList", () => {
  test("lists the catalog's tables by code, in their order, once per code", async () => {
    await using test = await setup()
    await test.table("T1", "Window")
    await test.table("T2", "Garden")
    await test.table("T1", "Duplicate")

    expect(await test.run.ok(answerQerkoGetTableList())).toEqual([
      { id: "T1", name: "Window" },
      { id: "T2", name: "Garden" },
    ])
  })

  test("lists no tables while table payments are off", async () => {
    await using test = await setup()
    await test.table("T1")
    await test.flows({ table: false })

    expect(await test.run.ok(answerQerkoGetTableList())).toEqual([])
  })
})

describe("getTableContents", () => {
  test("offers each open bill of the table line by line, the one opened first first", async () => {
    await using test = await setup()
    const tableId = await test.table("T1")
    const first = await test.bill(tableId, [12_900, 5_000])
    const second = await test.bill(tableId, [4_500], "Anna")
    await test.bill(null, [9_900])

    expect(await test.contents("T1")).toEqual([
      {
        id: first,
        name: "#1",
        currency: "CZK",
        items: [
          expect.objectContaining({
            name: "Line 1",
            price: "129",
            quantity: "1",
          }),
          expect.objectContaining({
            name: "Line 2",
            price: "50",
            quantity: "1",
          }),
        ],
        allowPartialPayment: false,
        allowTip: true,
        denyDiscounts: true,
        denyMenus: true,
      },
      expect.objectContaining({
        id: second,
        name: "Anna",
        items: [expect.objectContaining({ price: "45" })],
      }),
    ])
  })

  test("an unknown table is empty", async () => {
    await using test = await setup()
    await test.table("T1")

    expect(await test.contents("NOPE")).toEqual([])
  })

  test("an empty table is empty, and so are bills with nothing to pay", async () => {
    await using test = await setup()
    const tableId = await test.table("T1")
    expect(await test.contents("T1")).toEqual([])

    // A bill nothing was rung up on, one discarded, and one paid in full.
    await test.bill(tableId, [])
    const discarded = await test.bill(tableId, [1_000])
    await test.run.orThrow(cancelBill(discarded))
    const paid = await test.bill(tableId, [2_000])
    await test.payCash(paid, 2_000)

    expect(await test.contents("T1")).toEqual([])
  })

  test("a bill partly paid offers only what is left, as one item", async () => {
    await using test = await setup()
    const tableId = await test.table("T1")
    const billId = await test.bill(tableId, [12_900, 5_000])
    await test.payCash(billId, 5_000)

    expect(await test.contents("T1")).toEqual([
      expect.objectContaining({
        id: billId,
        items: [
          {
            id: billId,
            name: "Zbývá zaplatit",
            price: "129",
            quantity: "1",
            minQuantity: "0",
          },
        ],
        allowPartialPayment: false,
      }),
    ])
  })

  test("lists no bills while table payments are off", async () => {
    await using test = await setup()
    const tableId = await test.table("T1")
    await test.bill(tableId, [12_900])
    await test.flows({ table: false })

    expect(await test.contents("T1")).toEqual([])
  })
})

describe("getBill", () => {
  test("answers a table's bill by its id, as getTableContents lists it", async () => {
    await using test = await setup()
    const tableId = await test.table("T1")
    const billId = await test.bill(tableId, [12_900])

    const [listed] = await test.contents("T1")
    expect(await test.run(answerQerkoGetBill(billId))).toEqual({
      ok: true,
      value: listed,
    })
  })

  test.each([
    ["an unknown id", "unknown"],
    ["a malformed id", ""],
  ])("answers %s with BILL_NOT_FOUND", async (_case, idBill) => {
    await using test = await setup()

    expect(await test.run(answerQerkoGetBill(idBill))).toMatchObject({
      ok: false,
      error: { type: "QerkoBillNotFound" },
    })
  })

  test("answers a discarded bill or one with nothing to pay with BILL_CLOSED", async () => {
    await using test = await setup()
    const tableId = await test.table("T1")
    const discarded = await test.bill(tableId, [1_000])
    await test.run.orThrow(cancelBill(discarded))
    const empty = await test.bill(tableId, [])

    for (const billId of [discarded, empty]) {
      expect(await test.run(answerQerkoGetBill(billId))).toMatchObject({
        ok: false,
        error: { type: "QerkoBillClosed", id: billId },
      })
    }
  })

  test("answers a table's bill with BILL_NOT_FOUND while table payments are off", async () => {
    await using test = await setup()
    const billId = await test.bill(await test.table("T1"), [12_900])
    await test.flows({ table: false })

    expect(await test.run(answerQerkoGetBill(billId))).toMatchObject({
      ok: false,
      error: { type: "QerkoBillNotFound", idBill: billId },
    })
  })
})

describe("paymentStart of a table's bill", () => {
  test("makes a pending payment of the bill through Qerko, which locks the bill", async () => {
    await using test = await setup()
    const tableId = await test.table("T1")
    const billId = await test.bill(tableId, [12_900, 5_000])

    await startPaying(test, "T1", "qerko-1", { tipBrutto: "20" })

    expect(await test.payment("qerko-1")).toMatchObject({
      billId,
      tableId,
      deviceId,
      amount: 17_900,
      tipAmount: 0,
      currency: "CZK",
      canceledAt: null,
    })
    expect(await test.method("qerko-1")).toMatchObject([
      { accountId: qerkoAccountId },
    ])
    expect(await test.attempts("qerko-1")).toMatchObject([
      { qerkoPaymentId: "qerko-1", closedAt: null, tipAmount: 2_000 },
    ])
    // The bill is listed still, but a second guest is told it is locked.
    const [listed] = await test.contents("T1")
    if (listed === undefined) throw new Error("no bill")
    expect(
      await test.run(
        answerQerkoPaymentStart({ wire: wireFor("qerko-2", listed), deviceId })
      )
    ).toMatchObject({ ok: false, error: { type: "QerkoBillLocked" } })
    // Staff cannot change it mid-payment either.
    expect(
      await test.run(
        addManualAmountToBill({
          billId,
          deviceId: null,
          name: NonEmptyString255("Late beer"),
          currency: "CZK",
          totalAmount: NonNegativeInteger(5_000),
        })
      )
    ).toMatchObject({ ok: false, error: { type: "BillLocked" } })
  })

  test("records the start once, however often Qerko repeats it", async () => {
    await using test = await setup()
    await test.bill(await test.table("T1"), [12_900])
    const { wire } = await startPaying(test, "T1", "qerko-1")

    await test.run.orThrow(answerQerkoPaymentStart({ wire, deviceId }))

    expect(await test.attempts("qerko-1")).toHaveLength(1)
  })

  test.each<
    readonly [
      string,
      Partial<QerkoWirePayment>,
      "currency" | "discount" | "items",
    ]
  >([
    ["another currency", { currency: "EUR" }, "currency"],
    ["a discount", { discount: { value: "10" } }, "discount"],
    ["fewer items", { items: [] }, "items"],
  ])("refuses %s as INVALID_DATA", async (_case, overrides, reason) => {
    await using test = await setup()
    const billId = await test.bill(await test.table("T1"), [12_900, 5_000])
    const [bill] = await test.contents("T1")
    if (bill === undefined) throw new Error("no bill")

    expect(
      await test.run(
        answerQerkoPaymentStart({
          wire: wireFor("qerko-1", bill, overrides),
          deviceId,
        })
      )
    ).toMatchObject({
      ok: false,
      error: { type: "QerkoInvalidData", id: billId, reason },
    })
    expect(await test.payment("qerko-1")).toBeUndefined()
  })

  test("refuses a bill that changed since Qerko read it, and accepts it read again", async () => {
    await using test = await setup()
    const billId = await test.bill(await test.table("T1"), [12_900])
    const [stale] = await test.contents("T1")
    if (stale === undefined) throw new Error("no bill")
    await test.run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Second round"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(12_900),
      })
    )

    expect(
      await test.run(
        answerQerkoPaymentStart({ wire: wireFor("qerko-1", stale), deviceId })
      )
    ).toMatchObject({
      ok: false,
      error: { type: "QerkoInvalidData", reason: "items" },
    })

    await startPaying(test, "T1", "qerko-2")
    expect(await test.payment("qerko-2")).toMatchObject({ amount: 25_800 })
  })

  test("refuses a bill another payment locks with BILL_LOCKED", async () => {
    await using test = await setup()
    const billId = await test.bill(await test.table("T1"), [12_900])
    const [bill] = await test.contents("T1")
    if (bill === undefined) throw new Error("no bill")
    // Staff opened Charge at the till.
    await test.run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(12_900),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
      })
    )

    expect(
      await test.run(
        answerQerkoPaymentStart({ wire: wireFor("qerko-1", bill), deviceId })
      )
    ).toMatchObject({
      ok: false,
      error: { type: "QerkoBillLocked", id: billId, qerkoPaymentId: null },
    })
  })

  test("two guests starting to pay one bill at once: one pays, the other is told BILL_LOCKED", async () => {
    await using test = await setup()
    await test.bill(await test.table("T1"), [12_900])
    const [bill] = await test.contents("T1")
    if (bill === undefined) throw new Error("no bill")

    // Qerko's two calls arrive over one connection, the second before the
    // first is answered, as `createQerkoRpcSession` serves them.
    const sent: Array<{ uuid?: string; error?: { code?: string } | null }> = []
    let socket: QerkoSocketHandlers | null = null
    const unused = async () => err(qerkoRpcError("UNUSED"))
    const session = createQerkoRpcSession({
      qerkoSocket: {
        connect: (_url, handlers) => {
          socket = handlers
          return {
            send: (text) => sent.push(JSON.parse(text)),
            close: () => {},
          }
        },
      },
      console: createConsole(),
      url: "wss://test",
      posId: "pos",
      apiKey: "key",
      handlers: {
        searchBills: unused,
        getBill: unused,
        getTableList: unused,
        getTableContents: unused,
        paymentProcessed: unused,
        paymentClosed: unused,
        paymentStart: async (wire) => {
          const started = await test.run(
            answerQerkoPaymentStart({ wire, deviceId })
          )
          return started.ok ? ok(null) : err(qerkoRpcError(started.error.type))
        },
      },
      onState: () => {},
      onError: (error) => {
        throw error
      },
    })
    const connected = (): QerkoSocketHandlers => {
      if (socket === null) throw new Error("not connected")
      return socket
    }
    connected().onOpen()
    connected().onMessage(
      JSON.stringify({ type: "auth-response", authorized: true, error: null })
    )
    for (const id of ["qerko-1", "qerko-2"]) {
      connected().onMessage(
        JSON.stringify({
          type: "method-call-request",
          uuid: id,
          method: "paymentStart",
          args: [wireFor(id, bill)],
        })
      )
    }
    await expect
      .poll(() => sent.filter((message) => message.uuid?.startsWith("qerko")))
      .toHaveLength(2)
    session.close()

    expect(sent.filter((message) => message.uuid?.startsWith("qerko"))).toEqual(
      [
        expect.objectContaining({ uuid: "qerko-1", error: null }),
        expect.objectContaining({
          uuid: "qerko-2",
          error: expect.objectContaining({ code: "QerkoBillLocked" }),
        }),
      ]
    )
    expect(await test.payment("qerko-1")).toMatchObject({ amount: 12_900 })
    expect(await test.payment("qerko-2")).toBeUndefined()
  })

  test("refuses a table's bill as BILL_NOT_FOUND while table payments are off", async () => {
    await using test = await setup()
    await test.bill(await test.table("T1"), [12_900])
    const [bill] = await test.contents("T1")
    if (bill === undefined) throw new Error("no bill")
    await test.flows({ table: false })

    expect(
      await test.run(
        answerQerkoPaymentStart({ wire: wireFor("qerko-1", bill), deviceId })
      )
    ).toMatchObject({ ok: false, error: { type: "QerkoBillNotFound" } })
    expect(await test.payment("qerko-1")).toBeUndefined()
  })
})

describe("settling a table's payment", () => {
  test("PAID records the money and closes the bill, the guest's tip apart", async () => {
    await using test = await setup()
    const billId = await test.bill(await test.table("T1"), [12_900, 5_000])
    const { wire } = await startPaying(test, "T1", "qerko-1", {
      tipBrutto: "20",
    })

    expect(
      await test.run.orThrow(processQerkoPayment("qerko-1"))
    ).toMatchObject({
      items: [{ price: "129" }, { price: "50" }],
    })
    await test.run.orThrow(
      settleQerkoPayment({
        qerkoPaymentId: "qerko-1",
        state: "PAID",
        payment: { ...wire, state: "PAID", parts: cardParts("199") },
        deviceId,
      })
    )

    expect(await test.payment("qerko-1")).toMatchObject({
      amount: 19_900,
      tipAmount: 2_000,
    })
    expect(await test.status(billId)).toMatchObject({
      status: "closed",
      coverage: "paid",
      claimedSum: 17_900,
    })
    expect(await test.contents("T1")).toEqual([])
  })

  test("PAID of what was left closes a bill partly paid at the till", async () => {
    await using test = await setup()
    const billId = await test.bill(await test.table("T1"), [12_900, 5_000])
    await test.payCash(billId, 5_000)
    const { wire } = await startPaying(test, "T1", "qerko-1")

    expect(
      await test.run.orThrow(processQerkoPayment("qerko-1"))
    ).toMatchObject({ items: [{ price: "129", quantity: "1" }] })
    await test.run.orThrow(
      settleQerkoPayment({
        qerkoPaymentId: "qerko-1",
        state: "PAID",
        payment: { ...wire, state: "PAID", parts: cardParts("129") },
        deviceId,
      })
    )

    expect(await test.status(billId)).toMatchObject({
      status: "closed",
      coverage: "paid",
      claimedSum: 17_900,
    })
  })

  test("money above the bill and no tip reads as an overpaid bill", async () => {
    await using test = await setup()
    const billId = await test.bill(await test.table("T1"), [12_900])
    const { wire } = await startPaying(test, "T1", "qerko-1")

    await test.run.orThrow(
      settleQerkoPayment({
        qerkoPaymentId: "qerko-1",
        state: "PAID",
        payment: { ...wire, state: "PAID", parts: cardParts("140") },
        deviceId,
      })
    )

    expect(await test.status(billId)).toMatchObject({
      status: "closed",
      coverage: "overpaid",
      claimedSum: 14_000,
    })
  })

  test.each(["CANCELLED", "ERROR"])(
    "%s cancels the table's payment and frees the bill for the next guest",
    async (state) => {
      await using test = await setup()
      const billId = await test.bill(await test.table("T1"), [12_900])
      await startPaying(test, "T1", "qerko-1")

      await test.run.orThrow(
        settleQerkoPayment({ qerkoPaymentId: "qerko-1", state, deviceId })
      )

      expect(await test.payment("qerko-1")).toMatchObject({
        canceledAt: expect.any(Number),
      })
      expect(await test.status(billId)).toMatchObject({
        status: "open",
        claimedSum: 0,
      })
      await startPaying(test, "T1", "qerko-2")
      expect(await test.payment("qerko-2")).toMatchObject({ amount: 12_900 })
    }
  )

  test("a late CANCELLED does not undo PAID nor cancel the paid payment", async () => {
    await using test = await setup()
    const billId = await test.bill(await test.table("T1"), [12_900])
    const { wire } = await startPaying(test, "T1", "qerko-1")
    await test.run.orThrow(
      settleQerkoPayment({
        qerkoPaymentId: "qerko-1",
        state: "PAID",
        payment: { ...wire, state: "PAID", parts: cardParts("129") },
      })
    )

    await test.run.orThrow(
      settleQerkoPayment({ qerkoPaymentId: "qerko-1", state: "CANCELLED" })
    )

    expect(await test.payment("qerko-1")).toMatchObject({ canceledAt: null })
    expect(await test.status(billId)).toMatchObject({ status: "closed" })
  })

  test("paymentProcessed and paymentClosed are answered after table payments were turned off", async () => {
    await using test = await setup()
    const billId = await test.bill(await test.table("T1"), [12_900])
    const { wire } = await startPaying(test, "T1", "qerko-1")
    await test.flows({ direct: false, table: false })

    expect(await test.run(processQerkoPayment("qerko-1"))).toMatchObject({
      ok: true,
    })
    await test.run.orThrow(
      settleQerkoPayment({
        qerkoPaymentId: "qerko-1",
        state: "PAID",
        payment: { ...wire, state: "PAID", parts: cardParts("129") },
      })
    )
    expect(await test.status(billId)).toMatchObject({ status: "closed" })
  })
})

describe("direct payments off", () => {
  test("searchBills answers no bill and getBill BILL_NOT_FOUND for a payment's QR", async () => {
    await using test = await setup()
    const paymentId = await test.run.orThrow(
      createPayment({
        deviceId: null,
        billId: null,
        tableId: null,
        amount: NonNegativeInteger(12_900),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        qerkoPayment: { accountId: qerkoAccountId },
      })
    )
    expect(await test.run.orThrow(answerQerkoSearchBills(paymentId))).toEqual([
      expect.objectContaining({ id: paymentId }),
    ])

    await test.flows({ direct: false })

    expect(await test.run.orThrow(answerQerkoSearchBills(paymentId))).toEqual(
      []
    )
    expect(await test.run(answerQerkoGetBill(paymentId))).toMatchObject({
      ok: false,
      error: { type: "QerkoBillNotFound" },
    })
    expect(
      await test.run(
        answerQerkoPaymentStart({
          wire: {
            id: "qerko-1",
            idBill: paymentId,
            currency: "CZK",
            state: "STARTED",
            items: [{ name: "Platba", price: "129", quantity: "1" }],
            parts: [],
          },
          deviceId,
        })
      )
    ).toMatchObject({ ok: false, error: { type: "QerkoBillNotFound" } })
  })

  test("leaves table payments on", async () => {
    await using test = await setup()
    await test.bill(await test.table("T1"), [12_900])
    await test.flows({ direct: false })

    await startPaying(test, "T1", "qerko-1")
    expect(await test.payment("qerko-1")).toMatchObject({ amount: 12_900 })
  })
})
