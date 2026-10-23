import { sqliteTrue, testCreateRun } from "@evolu/common"
import { bytesToHex } from "@noble/hashes/utils.js"
import { describe, expect, onTestFinished, test, vi } from "vitest"
import { createQuery } from "../../evolu/schema.ts"
import {
  setMenuOrdering,
  setOrderDevice,
} from "../app-settings/app-settings-actions.ts"
import { loadBillCoverage } from "../bill/bill-guards.ts"
import type { BillId } from "../bill/bill-types.ts"
import { loadCalculatedBillLineSummaries } from "../bill-line/bill-line-actions.ts"
import {
  createCatalogItemAtEnd,
  setCatalogItemInMenu,
  setCatalogItemSoldOut,
  updateCatalogItem,
} from "../catalog-item/catalog-item-actions.ts"
import type { CatalogItemId } from "../catalog-item/catalog-item-types.ts"
import {
  connectMonetaPlugin,
  syncMonetaTransactions,
} from "../moneta-plugin/moneta-plugin-actions.ts"
import { paymentWithDetailsByIdQuery } from "../payment/payment-test-fixtures.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import { reconcileAccountTransaction } from "../reconciliation-claim/reconciliation-claim-actions.ts"
import {
  createRowId,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import {
  deriveSelfPaySelectionKey,
  deriveTableSelfPayKeys,
} from "../shared/key-derivation.ts"
import {
  DateStringSchema,
  IbanSchema,
  NonEmptyString255,
  NonEmptyStringSchema,
  NonNegativeInteger,
} from "../shared/schema.ts"
import { createSelfPaySelectionEvent } from "../table-self-pay/table-self-pay-pointer-utils.ts"
import {
  deriveOrderSelfPayReference,
  formatSelfPayBankMessage,
  formatSelfPayLightningMemo,
} from "../table-self-pay/table-self-pay-reference-utils.ts"
import {
  createSelfPayTestContext,
  createTestLightningInvoice,
  receiveBankTransfer,
  receiveLightningPayment,
  type SelfPayTestContext,
  selfPayTestRoot,
  signTestSelfPayRate,
} from "../table-self-pay/table-self-pay-test-fixtures.ts"
import {
  deriveMenuOrderBillId,
  dropReplacedMenuVersions,
  loadMenuOrderArrivalRows,
  loadMenuOrdersNotFoundYet,
  loadMenuOrdersToServe,
  loadSelfPayMenu,
  markMenuOrderServed,
  saveSelfPayMenuVersion,
} from "./menu-order-actions.ts"
import {
  createSelfPayOrderSelectionText,
  deriveSelfPayMenuItemKey,
  type SelfPayMenu,
  SelfPayOrderSelectionSchema,
} from "./menu-order-utils.ts"

const selectionKey = deriveSelfPaySelectionKey(selfPayTestRoot)

const billClosedAtQuery = (billId: BillId) =>
  createQuery((db) =>
    db
      .selectFrom("bill")
      .select(["closedAt", "tableId"])
      .where("id", "=", billId)
  )

const menuOrderByBillIdQuery = (billId: BillId) =>
  createQuery((db) =>
    db
      .selectFrom("menuOrder")
      .select(["id", "number", "note", "servedAt"])
      .where("billId", "=", billId)
      .where("isDeleted", "is not", sqliteTrue)
  )

const addMenuItem = async (
  context: SelfPayTestContext,
  {
    name,
    amount,
    internalName = null,
  }: {
    readonly name: string
    readonly amount: number
    readonly internalName?: string | null
  }
): Promise<CatalogItemId> => {
  await using run = testCreateRun(context.deps)
  const id = await run.ok(
    createCatalogItemAtEnd({
      deviceId: null,
      categoryId: null,
      name: NonEmptyString255(name),
      description: null,
      internalName:
        internalName === null ? null : NonEmptyString255(internalName),
      internalDescription: null,
      sku: NonEmptyString255(`SKU-${name}`),
      currency: "CZK",
      unitAmount: NonNegativeInteger(amount),
      scanCode: NonEmptyString255(`EAN${amount}`),
      taxRateId: null,
    })
  )
  await run.ok(setCatalogItemInMenu({ id, inMenu: true }))
  return id
}

const publishMenu = async (context: SelfPayTestContext) => {
  await using run = testCreateRun(context.deps)
  const { menu } = await run.ok(loadSelfPayMenu())
  await run.ok(saveSelfPayMenuVersion(menu))
  return menu
}

const openCafe = async (context: SelfPayTestContext) => {
  await using run = testCreateRun(context.deps)
  await run.ok(setMenuOrdering({ on: true, deviceId: context.deviceId }))
  const coffee = await addMenuItem(context, {
    name: "Coffee",
    amount: 6500,
    internalName: "KAFE",
  })
  const cake = await addMenuItem(context, { name: "Cake", amount: 8900 })
  return { coffee, cake, menu: await publishMenu(context) }
}

const orderFrom = async (
  context: SelfPayTestContext,
  menu: SelfPayMenu,
  items: ReadonlyArray<readonly [CatalogItemId, number]>,
  {
    publish = true,
    note = null,
  }: { publish?: boolean; note?: string | null } = {}
) => {
  const table = bytesToHex(
    deriveTableSelfPayKeys(selfPayTestRoot, context.tableId, 0).publicKey
  )
  const { pointer, event } = createSelfPaySelectionEvent({
    selectionText: createSelfPayOrderSelectionText({
      tablePublicKey: table,
      menu,
      items: items.map(([id, quantity]) => ({
        key: deriveSelfPayMenuItemKey(id),
        quantity,
      })),
      note,
    }),
    selectionKey,
    createdAt: Math.floor(context.clock.date.now().getTime() / 1000),
  })
  if (publish) {
    await context.deps.nostrRelayClient.publish(
      context.deps.selfPayDefaultRelays,
      event
    )
  }
  return { pointer, event, reference: deriveOrderSelfPayReference(pointer) }
}

const pay = (
  context: SelfPayTestContext,
  order: Awaited<ReturnType<typeof orderFrom>>,
  amount: number
) =>
  receiveBankTransfer(context, {
    amount,
    variableSymbol: order.reference,
    recipientMessage: formatSelfPayBankMessage({ pointer: order.pointer }),
    bankReference: createRowId<"Transfer">(),
  })

const payByLightning = (
  context: SelfPayTestContext,
  order: Awaited<ReturnType<typeof orderFrom>>,
  { amount, amountSats }: { amount: number; amountSats: number }
) => {
  const rate = signTestSelfPayRate(context.clock.date.now())
  return receiveLightningPayment(context, {
    amountSats,
    lnInvoice: createTestLightningInvoice({
      amountSats,
      createdAt: rate.validFrom + 60,
      memo: formatSelfPayLightningMemo({
        reference: order.reference,
        pointer: order.pointer,
        amount,
        rate,
      }),
    }),
  })
}

const coverageOf = async (
  context: SelfPayTestContext,
  order: Awaited<ReturnType<typeof orderFrom>>
) => {
  await using run = testCreateRun(context.deps)
  return await run.ok(loadBillCoverage(deriveMenuOrderBillId(order.pointer)))
}

const tipOf = async (context: SelfPayTestContext, id: PaymentId | null) => {
  if (id === null) throw new Error("Expected a payment.")
  const [payment] = await context.deps.evolu.loadQuery(
    paymentWithDetailsByIdQuery(id)
  )
  return payment?.tipAmount
}

const orderRowOf = async (
  context: SelfPayTestContext,
  order: Awaited<ReturnType<typeof orderFrom>>
) =>
  (
    await context.deps.evolu.loadQuery(
      menuOrderByBillIdQuery(deriveMenuOrderBillId(order.pointer))
    )
  )[0]

describe("the menu guests read", () => {
  test("lists what is in the menu by its public name, and nothing staff use internally", async () => {
    await using context = await createSelfPayTestContext()
    const { menu } = await openCafe(context)
    await addMenuItem(context, { name: "Water", amount: 3500 }).then(
      async (id) => {
        await using run = testCreateRun(context.deps)
        await run.ok(setCatalogItemInMenu({ id, inMenu: false }))
      }
    )
    const text = JSON.stringify(await publishMenu(context))

    expect(
      menu.categories.flatMap(({ items }) => items.map(({ name }) => name))
    ).toEqual(["Coffee", "Cake"])
    expect(text).not.toContain("KAFE")
    expect(text).not.toContain("SKU-")
    expect(text).not.toContain("EAN")
    expect(text).not.toContain("Water")
  })

  test("leaves out a sold-out item but keeps it in the menu for when it is back", async () => {
    await using context = await createSelfPayTestContext()
    const { cake } = await openCafe(context)
    await using run = testCreateRun(context.deps)

    await run.ok(setCatalogItemSoldOut({ id: cake, soldOut: true }))
    const soldOut = await publishMenu(context)
    await run.ok(setCatalogItemSoldOut({ id: cake, soldOut: false }))
    const back = await publishMenu(context)

    const names = (menu: SelfPayMenu) =>
      menu.categories.flatMap(({ items }) => items.map(({ name }) => name))
    expect(names(soldOut)).toEqual(["Coffee"])
    expect(names(back)).toEqual(["Coffee", "Cake"])
    expect(back.version).not.toBe(soldOut.version)
  })

  test("keeps the menu on offer when a week has passed since another one", async () => {
    await using context = await createSelfPayTestContext({ now: new Date() })
    const { coffee, cake, menu } = await openCafe(context)
    await using run = testCreateRun(context.deps)
    await run.ok(setCatalogItemSoldOut({ id: cake, soldOut: true }))
    await publishMenu(context)
    await run.ok(setCatalogItemSoldOut({ id: cake, soldOut: false }))
    await publishMenu(context)
    context.clock.advance(8 * 24 * 60 * 60 * 1000)

    await run.ok(dropReplacedMenuVersions(menu.version))
    const order = await orderFrom(context, menu, [[coffee, 1]])

    expect((await pay(context, order, 6500)).paymentId).not.toBe(null)
  })

  test("takes orders from a menu that is back after a week of another", async () => {
    await using context = await createSelfPayTestContext({ now: new Date() })
    const { coffee, cake, menu } = await openCafe(context)
    await using run = testCreateRun(context.deps)
    await run.ok(setCatalogItemSoldOut({ id: cake, soldOut: true }))
    const soldOut = await publishMenu(context)
    context.clock.advance(8 * 24 * 60 * 60 * 1000)
    await run.ok(dropReplacedMenuVersions(soldOut.version))

    await run.ok(setCatalogItemSoldOut({ id: cake, soldOut: false }))
    const back = await publishMenu(context)
    await run.ok(dropReplacedMenuVersions(back.version))
    const order = await orderFrom(context, back, [[coffee, 1]])

    expect(back.version).toBe(menu.version)
    expect((await pay(context, order, 6500)).paymentId).not.toBe(null)
  })

  test("keeps a menu that came back for a week after another replaces it", async () => {
    await using context = await createSelfPayTestContext({ now: new Date() })
    const evoluClock = vi
      .spyOn(Date, "now")
      .mockImplementation(() => context.deps.date.now().getTime())
    onTestFinished(() => evoluClock.mockRestore())
    const { coffee, cake, menu } = await openCafe(context)
    await using run = testCreateRun(context.deps)
    await run.ok(setCatalogItemSoldOut({ id: cake, soldOut: true }))
    await publishMenu(context)
    context.clock.advance(8 * 24 * 60 * 60 * 1000)
    await run.ok(setCatalogItemSoldOut({ id: cake, soldOut: false }))
    await publishMenu(context)
    const order = await orderFrom(context, menu, [[coffee, 1]])

    await addMenuItem(context, { name: "Tea", amount: 4000 })
    const replacing = await publishMenu(context)
    await run.ok(dropReplacedMenuVersions(replacing.version))

    expect((await pay(context, order, 6500)).paymentId).not.toBe(null)
  })

  test("drops a replaced menu a week after another replaced it, however often the new one is published", async () => {
    await using context = await createSelfPayTestContext({ now: new Date() })
    const evoluClock = vi
      .spyOn(Date, "now")
      .mockImplementation(() => context.deps.date.now().getTime())
    onTestFinished(() => evoluClock.mockRestore())
    const { coffee, cake, menu } = await openCafe(context)
    const order = await orderFrom(context, menu, [[coffee, 1]])
    await using run = testCreateRun(context.deps)
    context.clock.advance(24 * 60 * 60 * 1000)
    await run.ok(setCatalogItemSoldOut({ id: cake, soldOut: true }))
    await publishMenu(context)
    context.clock.advance(5 * 24 * 60 * 60 * 1000)
    await publishMenu(context)
    context.clock.advance(5 * 24 * 60 * 60 * 1000)
    const live = await publishMenu(context)

    await run.ok(dropReplacedMenuVersions(live.version))

    expect((await pay(context, order, 6500)).paymentId).toBe(null)
  })
})

describe("a paid order", () => {
  test("becomes a bill of its own on the table, and what arrived above it is the tip", async () => {
    await using context = await createSelfPayTestContext()
    const { coffee, cake, menu } = await openCafe(context)
    const order = await orderFrom(
      context,
      menu,
      [
        [coffee, 2],
        [cake, 1],
      ],
      { note: "bez cukru" }
    )

    const { paymentId } = await pay(context, order, 23_000)

    expect(await tipOf(context, paymentId)).toBe(1100)
    expect(await coverageOf(context, order)).toMatchObject({
      claimedSum: 21_900,
      coverage: "paid",
    })
    await using run = testCreateRun(context.deps)
    const lines = await run.ok(
      loadCalculatedBillLineSummaries(deriveMenuOrderBillId(order.pointer))
    )
    expect(lines.map(({ name, totalAmount }) => [name, totalAmount])).toEqual(
      expect.arrayContaining([
        ["Coffee", 13_000],
        ["Cake", 8900],
      ])
    )
    expect(await orderRowOf(context, order)).toMatchObject({
      number: 1,
      note: "bez cukru",
      servedAt: null,
    })
    const [bill] = await context.deps.evolu.loadQuery(
      billClosedAtQuery(deriveMenuOrderBillId(order.pointer))
    )
    expect(bill?.closedAt).not.toBe(null)
  })

  test("paid by a transfer to a MONETA account is recorded the same as to Fio", async () => {
    await using context = await createSelfPayTestContext()
    const { coffee, menu } = await openCafe(context)
    const order = await orderFrom(context, menu, [[coffee, 2]])
    const iban = IbanSchema.decode("CZ6508000000192000145399")
    const fetch: typeof globalThis.fetch = async (input) =>
      new URL(input instanceof Request ? input.url : input).pathname.endsWith(
        "/transactions"
      )
        ? Response.json({
            pageCount: 1,
            transactions: [
              {
                entryReference: "E-1",
                amount: { value: "130,00", currency: "CZK" },
                creditDebitIndicator: "CRDT",
                status: "BOOK",
                bookingDate: { date: "2026-06-05" },
                entryDetails: {
                  transactionDetails: {
                    remittanceInformation: {
                      unstructured: formatSelfPayBankMessage({
                        pointer: order.pointer,
                      }),
                      structured: {
                        creditorReferenceInformation: {
                          reference: `VS:${order.reference}`,
                        },
                      },
                    },
                  },
                },
              },
            ],
          })
        : Response.json({
            accounts: [{ id: "bank-account-1", identification: { iban } }],
          })
    await using run = testCreateRun({ ...context.deps, fetch })
    await run.orThrow(
      connectMonetaPlugin({
        accountId: context.ibanAccountId,
        iban,
        token: NonEmptyStringSchema.decode("moneta-token"),
      })
    )

    await run.orThrow(
      syncMonetaTransactions({
        fromDate: DateStringSchema.decode("2026-06-05"),
        toDate: DateStringSchema.decode("2026-06-05"),
      })
    )

    expect(await coverageOf(context, order)).toMatchObject({
      claimedSum: 13_000,
      coverage: "paid",
    })
    expect(await orderRowOf(context, order)).toMatchObject({ number: 1 })
  })

  test("paid by Lightning is recorded the same as by bank", async () => {
    await using context = await createSelfPayTestContext()
    const { coffee, cake, menu } = await openCafe(context)
    const order = await orderFrom(context, menu, [
      [coffee, 2],
      [cake, 1],
    ])

    const { paymentId } = await payByLightning(context, order, {
      amount: 23_000,
      amountSats: 9200,
    })

    if (paymentId === null) throw new Error("Expected a payment.")
    const [payment] = await context.deps.evolu.loadQuery(
      paymentWithDetailsByIdQuery(paymentId)
    )
    expect(payment).toMatchObject({
      billId: deriveMenuOrderBillId(order.pointer),
      tipAmount: 1100,
      spark: { accountId: context.sparkAccountId, amountSats: 9200 },
    })
    expect(await coverageOf(context, order)).toMatchObject({
      claimedSum: 21_900,
      coverage: "paid",
    })
    expect(await orderRowOf(context, order)).toMatchObject({ number: 1 })
  })

  test("stays open with what is left when less arrives, and closes when the rest is paid", async () => {
    await using context = await createSelfPayTestContext()
    const { coffee, cake, menu } = await openCafe(context)
    const order = await orderFrom(context, menu, [
      [coffee, 2],
      [cake, 1],
    ])

    await pay(context, order, 20_000)
    const short = await coverageOf(context, order)
    await pay(context, order, 1900)

    expect(short).toMatchObject({ claimedSum: 20_000, coverage: "underpaid" })
    expect(await coverageOf(context, order)).toMatchObject({
      claimedSum: 21_900,
      coverage: "paid",
    })
  })

  test("does not record itself again when money arrives long after its bill closed", async () => {
    await using context = await createSelfPayTestContext()
    const { coffee, menu } = await openCafe(context)
    const order = await orderFrom(context, menu, [[coffee, 1]])
    await pay(context, order, 6500)
    const before = await orderRowOf(context, order)
    context.clock.advance(8 * 24 * 60 * 60 * 1000)

    expect((await pay(context, order, 6500)).paymentId).toBe(null)
    expect(await orderRowOf(context, order)).toEqual(before)
  })

  test("paid twice is one bill, overpaid for staff to resolve", async () => {
    await using context = await createSelfPayTestContext()
    const { coffee, menu } = await openCafe(context)
    const order = await orderFrom(context, menu, [[coffee, 1]])

    await pay(context, order, 6500)
    await pay(context, order, 6500)

    expect(await coverageOf(context, order)).toMatchObject({
      claimedSum: 13_000,
      coverage: "overpaid",
    })
  })

  test("goes to its own bill when another order's bill holds the same reference", async () => {
    await using context = await createSelfPayTestContext()
    const { coffee, menu } = await openCafe(context)
    const first = await orderFrom(context, menu, [[coffee, 1]])
    await pay(context, first, 6500)
    const second = await orderFrom(context, menu, [[coffee, 2]])
    await runMutationWithCompletion((options) =>
      context.deps.evolu.upsert(
        "billSelfPayReference",
        {
          id: deriveMenuOrderBillId(first.pointer),
          reference: second.reference,
        },
        { ...options, owner: context.deps.evoluOwner }
      )
    )

    await pay(context, second, 13_000)

    expect(await coverageOf(context, first)).toMatchObject({
      claimedSum: 6500,
      coverage: "paid",
    })
    expect(await coverageOf(context, second)).toMatchObject({
      claimedSum: 13_000,
      coverage: "paid",
    })
  })

  test("charges the price of the menu the guest ordered from after a price rise", async () => {
    await using context = await createSelfPayTestContext()
    const { coffee, menu } = await openCafe(context)
    const order = await orderFrom(context, menu, [[coffee, 2]])
    await using run = testCreateRun(context.deps)
    await run.ok(
      updateCatalogItem({ id: coffee, unitAmount: NonNegativeInteger(7000) })
    )
    await publishMenu(context)

    await pay(context, order, 13_000)

    expect(await coverageOf(context, order)).toMatchObject({
      claimedSum: 13_000,
      coverage: "paid",
    })
  })

  test("records an item that sold out after the guest picked it", async () => {
    await using context = await createSelfPayTestContext()
    const { cake, menu } = await openCafe(context)
    const order = await orderFrom(context, menu, [[cake, 1]])
    await using run = testCreateRun(context.deps)
    await run.ok(setCatalogItemSoldOut({ id: cake, soldOut: true }))

    await pay(context, order, 8900)

    expect(await coverageOf(context, order)).toMatchObject({
      coverage: "paid",
    })
  })

  test("numbers the orders of a day from 1", async () => {
    await using context = await createSelfPayTestContext()
    const { coffee, menu } = await openCafe(context)
    const first = await orderFrom(context, menu, [[coffee, 1]])
    const second = await orderFrom(context, menu, [[coffee, 1]])

    await pay(context, first, 6500)
    await pay(context, second, 6500)

    expect((await orderRowOf(context, first))?.number).toBe(1)
    expect((await orderRowOf(context, second))?.number).toBe(2)
  })

  test("gives two orders paid at the same moment two numbers", async () => {
    await using context = await createSelfPayTestContext()
    const { coffee, menu } = await openCafe(context)
    const first = await orderFrom(context, menu, [[coffee, 1]])
    const second = await orderFrom(context, menu, [[coffee, 1]])

    await Promise.all([pay(context, first, 6500), pay(context, second, 6500)])

    const numbers = [
      (await orderRowOf(context, first))?.number,
      (await orderRowOf(context, second))?.number,
    ]
    expect(numbers.sort()).toEqual([1, 2])
  })
})

describe("money for an order that cannot be recorded", () => {
  test("waits unmatched when the order names a menu this account never published", async () => {
    await using context = await createSelfPayTestContext()
    const { coffee, menu } = await openCafe(context)
    const order = await orderFrom(
      context,
      { ...menu, version: "0".repeat(32) },
      [[coffee, 1]]
    )

    expect((await pay(context, order, 6500)).paymentId).toBe(null)
  })

  test("waits unmatched while no relay returns the order, and is recorded once one does", async () => {
    await using context = await createSelfPayTestContext()
    const { coffee, menu } = await openCafe(context)
    const order = await orderFrom(context, menu, [[coffee, 1]], {
      publish: false,
    })

    const { accountTransactionId, paymentId } = await pay(context, order, 6500)
    context.clock.advance(60 * 60 * 1000)
    await using run = testCreateRun(context.deps)
    const stillWaiting = await run.ok(
      reconcileAccountTransaction(accountTransactionId)
    )
    await context.deps.nostrRelayClient.publish(
      context.deps.selfPayDefaultRelays,
      order.event
    )
    const recorded = await run.ok(
      reconcileAccountTransaction(accountTransactionId)
    )

    expect(paymentId).toBe(null)
    expect(stillWaiting).toBe(null)
    expect(recorded).not.toBe(null)
    expect(await coverageOf(context, order)).toMatchObject({ coverage: "paid" })
  })

  test("is left to the device that takes orders", async () => {
    await using context = await createSelfPayTestContext()
    const { coffee, menu } = await openCafe(context)
    await using run = testCreateRun(context.deps)
    await run.ok(setOrderDevice(createRowId<"Device">()))
    const order = await orderFrom(context, menu, [[coffee, 1]])

    expect((await pay(context, order, 6500)).paymentId).toBe(null)
  })

  test("writes the same rows on two devices that both record it", async () => {
    await using context = await createSelfPayTestContext()
    const { coffee, menu } = await openCafe(context)
    const order = await orderFrom(context, menu, [[coffee, 2]])
    const selection = SelfPayOrderSelectionSchema.parse(
      JSON.parse(
        createSelfPayOrderSelectionText({
          tablePublicKey: bytesToHex(
            deriveTableSelfPayKeys(selfPayTestRoot, context.tableId, 0)
              .publicKey
          ),
          menu,
          items: [{ key: deriveSelfPayMenuItemKey(coffee), quantity: 2 }],
          note: null,
        })
      )
    )
    await using run = testCreateRun(context.deps)
    const rowsOf = () =>
      run.ok(
        loadMenuOrderArrivalRows({
          pointer: order.pointer,
          reference: order.reference,
          selection,
          deviceId: context.deviceId,
          root: selfPayTestRoot,
        })
      )

    const [first, second] = [await rowsOf(), await rowsOf()]

    expect(first?.bill.bill.id).toBe(second?.bill.bill.id)
    expect(first?.bill.lines.map(({ id }) => id)).toEqual(
      second?.bill.lines.map(({ id }) => id)
    )
    expect(first?.menuOrder.id).toBe(second?.menuOrder.id)
  })
})

describe("what staff serve", () => {
  test("lists a paid order by its number and table, with internal names and the guest's note, until it is served", async () => {
    await using context = await createSelfPayTestContext()
    const { coffee, cake, menu } = await openCafe(context)
    const order = await orderFrom(
      context,
      menu,
      [
        [coffee, 2],
        [cake, 1],
      ],
      {
        note: "bez cukru",
      }
    )
    await pay(context, order, 20_000)
    await using run = testCreateRun(context.deps)
    await run.ok(setCatalogItemSoldOut({ id: cake, soldOut: true }))

    const [toServe] = await run.ok(loadMenuOrdersToServe())
    if (toServe === undefined) throw new Error("Expected an order to serve.")
    await run.ok(markMenuOrderServed(toServe.id))

    expect(toServe).toMatchObject({
      number: 1,
      tableName: "Table 3",
      note: "bez cukru",
      isFullyPaid: false,
    })
    expect(toServe.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "KAFE",
          quantity: 2,
          isSoldOut: false,
        }),
        expect.objectContaining({ name: "Cake", quantity: 1, isSoldOut: true }),
      ])
    )
    expect(await run.ok(loadMenuOrdersToServe())).toEqual([])
  })

  test("lists money whose order no relay returned yet", async () => {
    await using context = await createSelfPayTestContext()
    const { coffee, menu } = await openCafe(context)
    const order = await orderFrom(context, menu, [[coffee, 1]], {
      publish: false,
    })
    await pay(context, order, 6500)
    await using run = testCreateRun(context.deps)

    expect(await run.ok(loadMenuOrdersNotFoundYet())).toEqual([
      expect.objectContaining({ amount: 6500, currency: "CZK" }),
    ])
  })
})
