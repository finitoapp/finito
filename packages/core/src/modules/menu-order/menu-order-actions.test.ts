import { sqliteTrue, testCreateRun } from "@evolu/common"
import { bytesToHex } from "@noble/hashes/utils.js"
import { describe, expect, onTestFinished, test, vi } from "vitest"
import { createQuery } from "../../evolu/schema.ts"
import {
  setMenuDayEndHour,
  setMenuOrdering,
  setOrderDevice,
  setWrittenOrders,
  setWrittenOrderTaxRate,
} from "../app-settings/app-settings-actions.ts"
import { loadBillCoverage, loadBillStatus } from "../bill/bill-guards.ts"
import type { BillId } from "../bill/bill-types.ts"
import { loadCalculatedBillLineSummaries } from "../bill-line/bill-line-actions.ts"
import {
  createCatalogItemAtEnd,
  setCatalogItemInMenu,
  setCatalogItemSoldOut,
  updateCatalogItem,
} from "../catalog-item/catalog-item-actions.ts"
import { catalogItemByIdQuery } from "../catalog-item/catalog-item-queries.ts"
import type { CatalogItemId } from "../catalog-item/catalog-item-types.ts"
import { setLegalEntity } from "../legal-entity/legal-entity-actions.ts"
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
  type SelfPayPointer,
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
import { createTaxRate } from "../tax-rate/tax-rate-actions.ts"
import { TaxRatePercentage } from "../tax-rate/tax-rate-types.ts"
import {
  acceptMenuOrder,
  deriveMenuOrderBillId,
  dropReplacedMenuVersions,
  loadMenuOrderArrivalRows,
  loadMenuOrdersNotFoundYet,
  loadMenuOrdersServedToday,
  loadMenuOrdersToServe,
  loadSelfPayMenu,
  markMenuOrderServed,
  rejectMenuOrder,
  rememberWrittenItem,
  saveSelfPayMenuVersion,
  setWrittenOrderLineTaxRate,
} from "./menu-order-actions.ts"
import {
  createSelfPayOrderSelectionText,
  createSelfPayWrittenSelectionText,
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
      .select([
        "id",
        "number",
        "note",
        "writtenAmount",
        "acceptedAt",
        "servedAt",
        "rejectedAt",
      ])
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

  test("waits unmatched when ordering is off as the money arrives", async () => {
    await using context = await createSelfPayTestContext()
    const { coffee, menu } = await openCafe(context)
    const order = await orderFrom(context, menu, [[coffee, 99]])
    await using run = testCreateRun(context.deps)
    await run.ok(setMenuOrdering({ on: false, deviceId: context.deviceId }))

    expect((await pay(context, order, 100)).paymentId).toBe(null)
    expect(await orderRowOf(context, order)).toBe(undefined)
  })

  test("takes the rest of an order already recorded, though ordering has been switched off since", async () => {
    await using context = await createSelfPayTestContext()
    const { coffee, menu } = await openCafe(context)
    const order = await orderFrom(context, menu, [[coffee, 2]])
    await pay(context, order, 6500)
    await using run = testCreateRun(context.deps)
    await run.ok(setMenuOrdering({ on: false, deviceId: context.deviceId }))

    await pay(context, order, 6500)

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
          arrived: 13_000,
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

const openBar = async (context: SelfPayTestContext) => {
  await using run = testCreateRun(context.deps)
  await run.ok(setWrittenOrders({ on: true, deviceId: context.deviceId }))
  return await publishMenu(context)
}

const writeOrder = async (
  context: SelfPayTestContext,
  menu: SelfPayMenu,
  {
    text = "2x pivo",
    amount = 9000,
    lines = [{ text, amount }],
    table = bytesToHex(
      deriveTableSelfPayKeys(selfPayTestRoot, context.tableId, 0).publicKey
    ),
  }: {
    readonly text?: string
    readonly amount?: number
    readonly lines?: ReadonlyArray<{
      readonly text: string
      readonly amount: number
    }>
    readonly table?: string
  } = {}
) => {
  const { pointer, event } = createSelfPaySelectionEvent({
    selectionText: createSelfPayWrittenSelectionText({
      tablePublicKey: table,
      menu,
      lines,
    }),
    selectionKey,
    createdAt: Math.floor(context.clock.date.now().getTime() / 1000),
  })
  await context.deps.nostrRelayClient.publish(
    context.deps.selfPayDefaultRelays,
    event
  )
  return { pointer, event, reference: deriveOrderSelfPayReference(pointer) }
}

const lineOf = async (
  context: SelfPayTestContext,
  order: { readonly pointer: SelfPayPointer }
) => {
  await using run = testCreateRun(context.deps)
  const lines = await run.ok(
    loadCalculatedBillLineSummaries(deriveMenuOrderBillId(order.pointer))
  )
  expect(lines).toHaveLength(1)
  return lines[0]
}

const createWrittenOrderTaxRate = async (context: SelfPayTestContext) => {
  await using run = testCreateRun(context.deps)
  const taxRateId = await run.ok(
    createTaxRate({
      name: NonEmptyString255("Standard"),
      rate: TaxRatePercentage(21),
      isDefault: false,
    })
  )
  await run.ok(setWrittenOrderTaxRate(taxRateId))
  return taxRateId
}

describe("the tax rate of a written line", () => {
  test("is the one the owner set for written lines", async () => {
    await using context = await createSelfPayTestContext()
    const taxRateId = await createWrittenOrderTaxRate(context)
    const menu = await openBar(context)
    const order = await writeOrder(context, menu)

    await pay(context, order, 9000)

    expect(await lineOf(context, order)).toMatchObject({ taxRateId })
  })

  test("is needed before a VAT payer's guests can write", async () => {
    await using context = await createSelfPayTestContext()
    await using run = testCreateRun(context.deps)
    await run.ok(setLegalEntity({ country: "CZ", vatPayer: true }))
    const withoutRate = await openBar(context)
    await createWrittenOrderTaxRate(context)
    const withRate = await publishMenu(context)

    expect(withoutRate.written).toBe(false)
    expect(withRate.written).toBe(true)
  })

  test("is set by staff on each line, one by one, until they accept the order", async () => {
    await using context = await createSelfPayTestContext()
    const standard = await createWrittenOrderTaxRate(context)
    await using run = testCreateRun(context.deps)
    const reduced = await run.ok(
      createTaxRate({
        name: NonEmptyString255("Reduced"),
        rate: TaxRatePercentage(1200),
        isDefault: false,
      })
    )
    const menu = await openBar(context)
    const order = await writeOrder(context, menu, {
      lines: [
        { text: "2x pivo", amount: 9000 },
        { text: "utopenec", amount: 6000 },
      ],
    })
    await pay(context, order, 15_000)
    const [toServe] = await run.ok(loadMenuOrdersToServe())
    const [, meal] = toServe?.written?.lines ?? []
    if (toServe === undefined || meal === undefined) {
      throw new Error("Expected a written order of two lines.")
    }
    const rates = async () =>
      Object.fromEntries(
        (
          await run.ok(
            loadCalculatedBillLineSummaries(
              deriveMenuOrderBillId(order.pointer)
            )
          )
        ).map(({ name, taxRateId }) => [name, taxRateId])
      )

    const switched = await run(
      setWrittenOrderLineTaxRate({
        billId: toServe.billId,
        lineId: meal.id,
        taxRateId: reduced,
      })
    )
    const afterSwitch = await rates()
    const notOffered = await run(
      setWrittenOrderLineTaxRate({
        billId: toServe.billId,
        lineId: meal.id,
        taxRateId: createRowId<"TaxRate">(),
      })
    )
    await run.ok(acceptMenuOrder(toServe.id))
    const afterAccept = await run(
      setWrittenOrderLineTaxRate({
        billId: toServe.billId,
        lineId: meal.id,
        taxRateId: standard,
      })
    )

    expect(switched.ok).toBe(true)
    expect(afterSwitch).toEqual({ "2x pivo": standard, utopenec: reduced })
    expect(notOffered).toMatchObject({
      ok: false,
      error: { type: "TaxRateNotOffered" },
    })
    expect(afterAccept).toMatchObject({
      ok: false,
      error: { type: "MenuOrderDecided" },
    })
    expect(await rates()).toEqual(afterSwitch)
  })
})

describe("a written item staff remember for the day or for good", () => {
  const rememberPaidItem = async (context: SelfPayTestContext) => {
    await using run = testCreateRun(context.deps)
    await run.ok(setMenuOrdering({ on: true, deviceId: context.deviceId }))
    const menu = await openBar(context)
    const order = await writeOrder(context, menu, {
      text: "řízek s kaší",
      amount: 18_900,
    })
    await pay(context, order, 18_900)
    const [toServe] = await run.ok(loadMenuOrdersToServe())
    const [line] = toServe?.written?.lines ?? []
    if (toServe === undefined || line === undefined) {
      throw new Error("Expected a written order.")
    }
    return async (forGood: boolean) => {
      await using rememberRun = testCreateRun(context.deps)
      return await rememberRun.orThrow(
        rememberWrittenItem({
          billId: toServe.billId,
          lineId: line.id,
          name: NonEmptyString255("Řízek"),
          unitAmount: NonNegativeInteger(19_900),
          forGood,
        })
      )
    }
  }
  const offered = async (context: SelfPayTestContext) =>
    (await publishMenu(context)).categories.flatMap(({ items }) =>
      items.map(({ name, unitAmount }) => ({ name, unitAmount }))
    )

  test("is in the menu under the name and price staff give it, at its rate, until 4:00", async () => {
    await using context = await createSelfPayTestContext()
    const taxRateId = await createWrittenOrderTaxRate(context)
    const remember = await rememberPaidItem(context)

    const id = await remember(false)
    const again = await remember(false)
    const [stored] = await context.deps.evolu.loadQuery(
      catalogItemByIdQuery(id)
    )
    const today = await offered(context)
    context.clock.advance(14 * 60 * 60 * 1000 - 1)
    const lastMoment = await offered(context)
    context.clock.advance(1)
    const nextDay = await offered(context)

    expect(again).toBe(id)
    expect(stored).toMatchObject({ taxRateId })
    expect(today).toEqual([{ name: "Řízek", unitAmount: 19_900 }])
    expect(lastMoment).toEqual(today)
    expect(nextDay).toEqual([])
  })

  test("leaves the menu at the hour the owner set", async () => {
    await using context = await createSelfPayTestContext()
    await using run = testCreateRun(context.deps)
    await run.ok(setMenuDayEndHour(NonNegativeInteger(23)))
    const remember = await rememberPaidItem(context)

    await remember(false)
    context.clock.advance(9 * 60 * 60 * 1000 - 1)
    const before = await offered(context)
    context.clock.advance(1)

    expect(before).toHaveLength(1)
    expect(await offered(context)).toEqual([])
  })

  test("added for good is still in the menu the next day", async () => {
    await using context = await createSelfPayTestContext()
    await createWrittenOrderTaxRate(context)
    const remember = await rememberPaidItem(context)

    await remember(true)
    context.clock.advance(24 * 60 * 60 * 1000)

    expect(await offered(context)).toEqual([
      { name: "Řízek", unitAmount: 19_900 },
    ])
  })

  test("remembered for today and kept for good is one catalog item that stays", async () => {
    await using context = await createSelfPayTestContext()
    await using run = testCreateRun(context.deps)
    await createWrittenOrderTaxRate(context)
    const remember = await rememberPaidItem(context)

    const id = await remember(false)
    await run.ok(setCatalogItemInMenu({ id, inMenu: true }))
    context.clock.advance(24 * 60 * 60 * 1000)
    const nextDay = await offered(context)
    const again = await remember(true)

    expect(nextDay).toEqual([{ name: "Řízek", unitAmount: 19_900 }])
    expect(again).toBe(id)
  })
})

describe("a paid written order", () => {
  test("becomes a bill of its own on the table, with one line named by the guest's text", async () => {
    await using context = await createSelfPayTestContext()
    const menu = await openBar(context)
    const order = await writeOrder(context, menu)

    const { paymentId } = await pay(context, order, 9000)

    expect(await tipOf(context, paymentId)).toBe(0)
    expect(await coverageOf(context, order)).toMatchObject({
      claimedSum: 9000,
      coverage: "paid",
    })
    expect(await lineOf(context, order)).toMatchObject({
      name: "2x pivo",
      type: "manualAmount",
      catalogItemId: null,
      taxRateId: null,
      quantity: 1,
      totalAmount: 9000,
    })
    expect(await orderRowOf(context, order)).toMatchObject({
      number: 1,
      note: null,
      writtenAmount: 9000,
    })
    const [bill] = await context.deps.evolu.loadQuery(
      billClosedAtQuery(deriveMenuOrderBillId(order.pointer))
    )
    expect(bill?.tableId).toBe(context.tableId)
    expect(bill?.closedAt).not.toBe(null)
  })

  test("takes what arrived above it as the tip", async () => {
    await using context = await createSelfPayTestContext()
    const menu = await openBar(context)
    const order = await writeOrder(context, menu)

    const { paymentId } = await pay(context, order, 10_000)

    expect(await tipOf(context, paymentId)).toBe(1000)
    expect(await lineOf(context, order)).toMatchObject({ totalAmount: 9000 })
    expect(await coverageOf(context, order)).toMatchObject({
      claimedSum: 9000,
      coverage: "paid",
    })
  })

  test("closes at what arrived when less arrives, and leaves nothing owed", async () => {
    await using context = await createSelfPayTestContext()
    const menu = await openBar(context)
    const order = await writeOrder(context, menu)

    const { paymentId } = await pay(context, order, 8000)

    expect(await tipOf(context, paymentId)).toBe(0)
    expect(await lineOf(context, order)).toMatchObject({ totalAmount: 8000 })
    expect(await coverageOf(context, order)).toMatchObject({
      billTotal: 8000,
      claimedSum: 8000,
      coverage: "paid",
    })
    expect(await orderRowOf(context, order)).toMatchObject({
      writtenAmount: 9000,
    })
  })

  test("closes at the minimum when a stranger names millions, and leaves nothing owed", async () => {
    await using context = await createSelfPayTestContext()
    const menu = await openBar(context)
    const order = await writeOrder(context, menu, { amount: 999_999_999 })

    await pay(context, order, 100)

    expect(await coverageOf(context, order)).toMatchObject({
      billTotal: 100,
      coverage: "paid",
    })
  })

  test("raises its line when the rest arrives, up to what the guest named", async () => {
    await using context = await createSelfPayTestContext()
    const menu = await openBar(context)
    const order = await writeOrder(context, menu)

    await pay(context, order, 8000)
    await pay(context, order, 1000)

    const paidInParts = await lineOf(context, order)
    await pay(context, order, 5000)

    expect(paidInParts).toMatchObject({ totalAmount: 9000 })
    expect(await lineOf(context, order)).toMatchObject({ totalAmount: 9000 })
    expect(await coverageOf(context, order)).toMatchObject({
      claimedSum: 14_000,
      coverage: "overpaid",
    })
  })

  test("of several lines fills them in the order written, and the rest raises the next", async () => {
    await using context = await createSelfPayTestContext()
    const menu = await openBar(context)
    const order = await writeOrder(context, menu, {
      lines: [
        { text: "2x pivo", amount: 5000 },
        { text: "utopenec", amount: 4000 },
      ],
    })
    const totals = async () => {
      await using run = testCreateRun(context.deps)
      const lines = await run.ok(
        loadCalculatedBillLineSummaries(deriveMenuOrderBillId(order.pointer))
      )
      return Object.fromEntries(
        lines.map(({ name, totalAmount }) => [name, totalAmount])
      )
    }

    await pay(context, order, 6000)
    const first = await totals()
    await pay(context, order, 3000)

    expect(first).toEqual({ "2x pivo": 5000, utopenec: 1000 })
    expect(await totals()).toEqual({ "2x pivo": 5000, utopenec: 4000 })
    expect(await coverageOf(context, order)).toMatchObject({
      claimedSum: 9000,
      coverage: "paid",
    })
  })

  test("counts the rest when it is below the self-pay minimum", async () => {
    await using context = await createSelfPayTestContext()
    const menu = await openBar(context)
    const order = await writeOrder(context, menu)

    await pay(context, order, 8950)
    const { paymentId } = await pay(context, order, 50)

    expect(paymentId).not.toBe(null)
    expect(await lineOf(context, order)).toMatchObject({ totalAmount: 9000 })
  })

  test("paid twice is one bill, overpaid for staff to resolve", async () => {
    await using context = await createSelfPayTestContext()
    const menu = await openBar(context)
    const order = await writeOrder(context, menu)

    await pay(context, order, 9000)
    await pay(context, order, 9000)

    expect(await lineOf(context, order)).toMatchObject({ totalAmount: 9000 })
    expect(await coverageOf(context, order)).toMatchObject({
      claimedSum: 18_000,
      coverage: "overpaid",
    })
  })

  test("is numbered with the day's menu orders", async () => {
    await using context = await createSelfPayTestContext()
    const { coffee } = await openCafe(context)
    const menu = await openBar(context)
    const ordered = await orderFrom(context, menu, [[coffee, 1]])
    const written = await writeOrder(context, menu)

    await pay(context, ordered, 6500)
    await pay(context, written, 9000)

    expect(await orderRowOf(context, ordered)).toMatchObject({ number: 1 })
    expect(await orderRowOf(context, written)).toMatchObject({ number: 2 })
  })

  test("takes the rest of an order already recorded, though writing has been switched off since", async () => {
    await using context = await createSelfPayTestContext()
    const menu = await openBar(context)
    const order = await writeOrder(context, menu)
    await pay(context, order, 8000)
    await using run = testCreateRun(context.deps)
    await run.ok(setWrittenOrders({ on: false, deviceId: context.deviceId }))

    const { paymentId } = await pay(context, order, 1000)

    expect(paymentId).not.toBe(null)
    expect(await lineOf(context, order)).toMatchObject({ totalAmount: 9000 })
  })

  test("leaves money that arrives long after its bill closed unmatched, and the order as it was", async () => {
    await using context = await createSelfPayTestContext()
    const menu = await openBar(context)
    const order = await writeOrder(context, menu)
    await pay(context, order, 8000)
    const before = await orderRowOf(context, order)
    context.clock.advance(8 * 24 * 60 * 60 * 1000)

    const { paymentId } = await pay(context, order, 1000)

    expect(paymentId).toBe(null)
    expect(await lineOf(context, order)).toMatchObject({ totalAmount: 8000 })
    expect(await orderRowOf(context, order)).toEqual(before)
    expect(await coverageOf(context, order)).toMatchObject({
      claimedSum: 8000,
      coverage: "paid",
    })
  })

  test("paid by Lightning is capped by what the money is worth", async () => {
    await using context = await createSelfPayTestContext()
    const menu = await openBar(context)
    const order = await writeOrder(context, menu)

    const { paymentId } = await payByLightning(context, order, {
      amount: 8000,
      amountSats: 3200,
    })

    expect(paymentId).not.toBe(null)
    expect(await lineOf(context, order)).toMatchObject({ totalAmount: 8000 })
  })
})

describe("money for a written order that cannot be recorded", () => {
  test("waits unmatched when writing is off as the money arrives, though the menu it names offered writing", async () => {
    await using context = await createSelfPayTestContext()
    const menu = await openBar(context)
    const order = await writeOrder(context, menu)
    await using run = testCreateRun(context.deps)
    await run.ok(setWrittenOrders({ on: false, deviceId: context.deviceId }))

    expect((await pay(context, order, 9000)).paymentId).toBe(null)
    expect(await orderRowOf(context, order)).toBe(undefined)
  })

  test("waits unmatched when it names a table without self-pay", async () => {
    await using context = await createSelfPayTestContext()
    const menu = await openBar(context)
    const order = await writeOrder(context, menu, { table: "00".repeat(32) })

    expect((await pay(context, order, 9000)).paymentId).toBe(null)
  })

  test.each([
    ["a line break", "2x pivo\nzaplaceno"],
    ["a right-to-left override", "2x pivo\u202Eonevalpaz"],
    ["only spaces", "   "],
    ["a space it would trim", " 2x pivo"],
    ["256 characters", "x".repeat(256)],
  ])(
    "waits unmatched when its text breaks the rules with %s",
    async (_name, text) => {
      await using context = await createSelfPayTestContext()
      const menu = await openBar(context)
      const order = await writeOrder(context, menu, { text })

      expect((await pay(context, order, 9000)).paymentId).toBe(null)
    }
  )

  test.each([
    ["below the self-pay minimum", 99],
    ["above what a QR payment carries", 1_000_000_000],
  ])("waits unmatched when its amount is %s", async (_name, amount) => {
    await using context = await createSelfPayTestContext()
    const menu = await openBar(context)
    const order = await writeOrder(context, menu, { amount })

    expect((await pay(context, order, 9000)).paymentId).toBe(null)
  })

  test("waits unmatched when its first payment is below the self-pay minimum", async () => {
    await using context = await createSelfPayTestContext()
    const menu = await openBar(context)
    const order = await writeOrder(context, menu)

    expect((await pay(context, order, 99)).paymentId).toBe(null)
  })

  test("waits unmatched when the order names a menu this account never published", async () => {
    await using context = await createSelfPayTestContext()
    const menu = await openBar(context)
    const order = await writeOrder(context, {
      ...menu,
      version: "0".repeat(32),
    })

    expect((await pay(context, order, 9000)).paymentId).toBe(null)
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

  test("keeps an accepted order in the list, as accepted, until it is served", async () => {
    await using context = await createSelfPayTestContext()
    const menu = await openBar(context)
    await pay(context, await writeOrder(context, menu), 9000)
    await using run = testCreateRun(context.deps)
    const [order] = await run.ok(loadMenuOrdersToServe())
    if (order === undefined) throw new Error("Expected an order to serve.")

    await run.ok(acceptMenuOrder(order.id))
    const accepted = await run.ok(loadMenuOrdersToServe())
    await run.ok(markMenuOrderServed(order.id))

    expect(order.isAccepted).toBe(false)
    expect(accepted).toEqual([
      expect.objectContaining({ id: order.id, isAccepted: true }),
    ])
    expect(await run.ok(loadMenuOrdersToServe())).toEqual([])
  })

  test("lists the orders waiting for the staff first, each part oldest first", async () => {
    await using context = await createSelfPayTestContext()
    const menu = await openBar(context)
    for (const text of ["pivo", "kofola", "rum", "voda"]) {
      await pay(context, await writeOrder(context, menu, { text }), 9000)
      context.clock.advance(60_000)
    }
    await using run = testCreateRun(context.deps)
    const [pivo, kofola, rum, voda] = await run.ok(loadMenuOrdersToServe())
    if (
      pivo === undefined ||
      kofola === undefined ||
      rum === undefined ||
      voda === undefined
    ) {
      throw new Error("Expected four orders to serve.")
    }

    await run.ok(acceptMenuOrder(rum.id))
    await run.ok(acceptMenuOrder(pivo.id))

    expect(
      (await run.ok(loadMenuOrdersToServe())).map(({ id, isAccepted }) => ({
        id,
        isAccepted,
      }))
    ).toEqual([
      { id: kofola.id, isAccepted: false },
      { id: voda.id, isAccepted: false },
      { id: pivo.id, isAccepted: true },
      { id: rum.id, isAccepted: true },
    ])
  })

  test("lists the orders served since the owner's hour, the last served first", async () => {
    await using context = await createSelfPayTestContext()
    const menu = await openBar(context)
    await pay(context, await writeOrder(context, menu, { text: "pivo" }), 9000)
    await pay(
      context,
      await writeOrder(context, menu, { text: "kofola" }),
      9000
    )
    await using run = testCreateRun(context.deps)
    const [first, second] = await run.ok(loadMenuOrdersToServe())
    if (first === undefined || second === undefined) {
      throw new Error("Expected two orders to serve.")
    }

    await run.ok(markMenuOrderServed(first.id))
    context.clock.advance(60_000)
    await run.ok(markMenuOrderServed(second.id))
    context.clock.advance(14 * 60 * 60 * 1000 - 60_000 - 1)
    const lastMoment = await run.ok(loadMenuOrdersServedToday())
    context.clock.advance(1)

    expect(lastMoment).toEqual([
      expect.objectContaining({ id: second.id, isServed: true }),
      expect.objectContaining({ id: first.id, isServed: true }),
    ])
    expect(await run.ok(loadMenuOrdersServedToday())).toEqual([])
  })

  test("takes a rejected order off the list for good, keeps its bill and payment, and names that payment for the refund", async () => {
    await using context = await createSelfPayTestContext()
    const menu = await openBar(context)
    const written = await writeOrder(context, menu)
    const { paymentId } = await pay(context, written, 9000)
    await using run = testCreateRun(context.deps)
    const [order] = await run.ok(loadMenuOrdersToServe())
    if (order === undefined) throw new Error("Expected an order to serve.")
    await run.ok(acceptMenuOrder(order.id))

    const refund = await run.ok(rejectMenuOrder(order))
    await run.ok(acceptMenuOrder(order.id))

    expect(refund).toEqual({ type: "payment", paymentId })
    expect(await run.ok(loadMenuOrdersToServe())).toEqual([])
    expect(await orderRowOf(context, written)).toMatchObject({
      number: 1,
      rejectedAt: expect.any(Number),
    })
    expect(await coverageOf(context, written)).toMatchObject({
      claimedSum: 9000,
      coverage: "paid",
    })
  })

  test("discards the bill of a rejected order not paid in full, so the table owes nothing for it", async () => {
    await using context = await createSelfPayTestContext()
    const { coffee, menu } = await openCafe(context)
    const order = await orderFrom(context, menu, [[coffee, 99]])
    await pay(context, order, 100)
    await using run = testCreateRun(context.deps)
    const [toServe] = await run.ok(loadMenuOrdersToServe())
    if (toServe === undefined) throw new Error("Expected an order to serve.")

    await run.ok(rejectMenuOrder(toServe))

    expect(
      await run.orThrow(loadBillStatus(deriveMenuOrderBillId(order.pointer)))
    ).toBe("canceled")
  })

  test("keeps the closed bill of a rejected order paid in full", async () => {
    await using context = await createSelfPayTestContext()
    const { coffee, menu } = await openCafe(context)
    const order = await orderFrom(context, menu, [[coffee, 1]])
    await pay(context, order, 6500)
    await using run = testCreateRun(context.deps)
    const [toServe] = await run.ok(loadMenuOrdersToServe())
    if (toServe === undefined) throw new Error("Expected an order to serve.")

    await run.ok(rejectMenuOrder(toServe))

    expect(
      await run.orThrow(loadBillStatus(deriveMenuOrderBillId(order.pointer)))
    ).toBe("closed")
  })

  test("leaves money that arrives after the order is rejected unmatched, named by the order's number", async () => {
    await using context = await createSelfPayTestContext()
    const menu = await openBar(context)
    const written = await writeOrder(context, menu)
    await pay(context, written, 9000)
    await using run = testCreateRun(context.deps)
    const [order] = await run.ok(loadMenuOrdersToServe())
    if (order === undefined) throw new Error("Expected an order to serve.")
    await run.ok(rejectMenuOrder(order))

    const late = await pay(context, written, 9000)

    expect(late.paymentId).toBe(null)
    expect(await run.ok(loadMenuOrdersNotFoundYet())).toEqual([
      expect.objectContaining({ amount: 9000, rejectedOrderNumber: 1 }),
    ])
  })

  test("names the bill for the refund of an order paid in two payments", async () => {
    await using context = await createSelfPayTestContext()
    const menu = await openBar(context)
    const written = await writeOrder(context, menu)
    await pay(context, written, 8000)
    await pay(context, written, 1000)
    await using run = testCreateRun(context.deps)
    const [order] = await run.ok(loadMenuOrdersToServe())
    if (order === undefined) throw new Error("Expected an order to serve.")

    expect(await run.ok(rejectMenuOrder(order))).toEqual({
      type: "bill",
      billId: deriveMenuOrderBillId(written.pointer),
    })
  })

  test("lists a written order with the whole text, as paid when the money covers what the guest named", async () => {
    await using context = await createSelfPayTestContext()
    const menu = await openBar(context)
    const text = "x".repeat(255)
    await pay(context, await writeOrder(context, menu, { text }), 9000)
    await using run = testCreateRun(context.deps)

    expect(await run.ok(loadMenuOrdersToServe())).toEqual([
      expect.objectContaining({
        number: 1,
        tableName: "Table 3",
        note: null,
        isFullyPaid: true,
        written: {
          lines: [
            expect.objectContaining({
              text,
              arrived: { value: 9000, currency: "CZK" },
              named: { value: 9000, currency: "CZK" },
            }),
          ],
          arrived: { value: 9000, currency: "CZK" },
          named: { value: 9000, currency: "CZK" },
        },
      }),
    ])
  })

  test("lists a written order line by line as the guest wrote it, filled in that order, and not fully paid when less arrived", async () => {
    await using context = await createSelfPayTestContext()
    const menu = await openBar(context)
    const lines = [
      { text: "2x pivo", amount: 5000 },
      { text: "utopenec", amount: 4000 },
      { text: "rum", amount: 2000 },
    ]
    await pay(context, await writeOrder(context, menu, { lines }), 8000)
    await using run = testCreateRun(context.deps)
    const czk = (value: number) => ({ value, currency: "CZK" })

    expect(await run.ok(loadMenuOrdersToServe())).toEqual([
      expect.objectContaining({
        isFullyPaid: false,
        written: {
          lines: [
            expect.objectContaining({
              text: "2x pivo",
              arrived: czk(5000),
              named: czk(5000),
            }),
            expect.objectContaining({
              text: "utopenec",
              arrived: czk(3000),
              named: czk(4000),
            }),
            expect.objectContaining({
              text: "rum",
              arrived: czk(0),
              named: czk(2000),
            }),
          ],
          arrived: czk(8000),
          named: czk(11_000),
        },
      }),
    ])
  })

  test("lists a menu order with nothing written", async () => {
    await using context = await createSelfPayTestContext()
    const { coffee, menu } = await openCafe(context)
    await pay(context, await orderFrom(context, menu, [[coffee, 1]]), 6500)
    await using run = testCreateRun(context.deps)

    expect(await run.ok(loadMenuOrdersToServe())).toEqual([
      expect.objectContaining({ isFullyPaid: true, written: null }),
    ])
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
      expect.objectContaining({
        amount: 6500,
        currency: "CZK",
        rejectedOrderNumber: null,
      }),
    ])
  })
})
