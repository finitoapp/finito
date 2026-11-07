import { testCreateRun } from "@evolu/common"
import { bytesToHex } from "@noble/hashes/utils.js"
import { describe, expect, test } from "vitest"
import { createEetApiDep } from "../../integrations/eet/eet-client.ts"
import { getNostrTag } from "../../integrations/nostr/nostr-event.ts"
import { createQerkoApiDep } from "../../integrations/qerko/qerko-client.ts"
import { createQerkoConnectionStatusDep } from "../../integrations/qerko/qerko-connection-status.ts"
import { createQerkoSocketDep } from "../../integrations/qerko/qerko-socket.ts"
import { createYadioApiDep } from "../../integrations/yadio/yadio-client.ts"
import {
  setMenuOrdering,
  setOrderDevice,
  setSelfPayBillsHidden,
  setWrittenOrders,
} from "../../modules/app-settings/app-settings-actions.ts"
import {
  createCatalogItemAtEnd,
  setCatalogItemInMenu,
  updateCatalogItem,
} from "../../modules/catalog-item/catalog-item-actions.ts"
import {
  acceptMenuOrder,
  loadMenuOrdersToServe,
  loadSelfPayMenu,
  markMenuOrderServed,
  rejectMenuOrder,
  saveSelfPayMenuVersion,
} from "../../modules/menu-order/menu-order-actions.ts"
import { menuVersionsNewestFirstQuery } from "../../modules/menu-order/menu-order-queries.ts"
import {
  createSelfPayOrderConfirmationFilter,
  createSelfPayOrderSelectionText,
  createSelfPayWrittenSelectionText,
  deriveSelfPayMenuItemKey,
  openSelfPayOrderConfirmation,
  type SelfPayMenu,
  SelfPayMenuSchema,
  SelfPayOrderConfirmationSchema,
} from "../../modules/menu-order/menu-order-utils.ts"
import { createRowId } from "../../modules/shared/evolu-utils.ts"
import {
  deriveSelfPayMenuKeys,
  deriveSelfPaySelectionKey,
  deriveTableSelfPayKeys,
} from "../../modules/shared/key-derivation.ts"
import {
  NonEmptyString255,
  NonNegativeInteger,
} from "../../modules/shared/schema.ts"
import { createSelfPaySelectionEvent } from "../../modules/table-self-pay/table-self-pay-pointer-utils.ts"
import {
  deriveOrderSelfPayReference,
  formatSelfPayBankMessage,
  type SelfPayPointer,
} from "../../modules/table-self-pay/table-self-pay-reference-utils.ts"
import {
  createSelfPayTestContext,
  loadSelfPayTestView,
  openSelfPayBill,
  receiveBankTransfer,
  type SelfPayTestContext,
  selfPayTestRoot,
} from "../../modules/table-self-pay/table-self-pay-test-fixtures.ts"
import {
  deriveSelfPayViewTag,
  parseSelfPayContent,
} from "../../modules/table-self-pay/table-self-pay-view-utils.ts"
import { testSyncedAppOwner } from "../../testing/app-owner-sync.ts"
import type { AppBackgroundJobContext } from "../background-job-types.ts"
import { createTableSelfPayPublishingJob } from "./table-self-pay-publishing-job.ts"

const menuKeys = deriveSelfPayMenuKeys(selfPayTestRoot)
const selectionKey = deriveSelfPaySelectionKey(selfPayTestRoot)

const startJob = async (
  context: SelfPayTestContext,
  livenessIntervalMs = 60
) => {
  const fetch = async () =>
    new Response(JSON.stringify({ BTC: 2_500_000, timestamp: 1 }))
  const jobDeps: AppBackgroundJobContext = {
    ...context.deps,
    ...createEetApiDep({ date: context.deps.date, fetch }),
    ...createQerkoApiDep({ posId: "test" }),
    ...createQerkoSocketDep(),
    ...createQerkoConnectionStatusDep(),
    ...createYadioApiDep(),
    ...testSyncedAppOwner,
    fetch,
    deviceId: context.deviceId,
    connectivity: { onOnline: () => () => undefined },
    onError: () => undefined,
  }
  const run = testCreateRun(jobDeps)
  const job = await run.ok(
    createTableSelfPayPublishingJob({ debounceMs: 5, livenessIntervalMs })
  )
  return {
    [Symbol.asyncDispose]: async () => {
      await job[Symbol.asyncDispose]()
      await run[Symbol.asyncDispose]()
    },
  }
}

const waitFor = async (check: () => boolean | Promise<boolean>) => {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (await check()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error("Timed out waiting for the job.")
}

const publishedMenus = (context: SelfPayTestContext) =>
  context.relay
    .received()
    .filter(
      (event) =>
        event.pubkey === bytesToHex(menuKeys.publicKey) &&
        getNostrTag(event, "d") === deriveSelfPayViewTag(menuKeys.readKey)
    )
    .map((event) =>
      parseSelfPayContent(SelfPayMenuSchema, menuKeys.readKey, event.content)
    )

const openCafe = async (context: SelfPayTestContext) => {
  await using run = testCreateRun(context.deps)
  await run.ok(setMenuOrdering({ on: true, deviceId: context.deviceId }))
  const coffee = await run.ok(
    createCatalogItemAtEnd({
      deviceId: null,
      categoryId: null,
      name: NonEmptyString255("Coffee"),
      description: null,
      internalName: null,
      internalDescription: null,
      sku: null,
      currency: "CZK",
      unitAmount: NonNegativeInteger(6500),
      scanCode: null,
      taxRateId: null,
    })
  )
  await run.ok(setCatalogItemInMenu({ id: coffee, inMenu: true }))
  return coffee
}

const latestMenu = (context: SelfPayTestContext) =>
  publishedMenus(context).at(-1)

const payWrittenOrder = async (
  context: SelfPayTestContext,
  menu: SelfPayMenu,
  { named, arrived }: { readonly named: number; readonly arrived: number }
) => {
  const { pointer, event } = createSelfPaySelectionEvent({
    selectionText: createSelfPayWrittenSelectionText({
      tablePublicKey: bytesToHex(
        deriveTableSelfPayKeys(selfPayTestRoot, context.tableId, 0).publicKey
      ),
      menu,
      text: "2x pivo",
      amount: named,
    }),
    selectionKey,
    createdAt: Math.floor(context.clock.date.now().getTime() / 1000),
  })
  await context.deps.nostrRelayClient.publish(
    context.deps.selfPayDefaultRelays,
    event
  )
  await receiveBankTransfer(context, {
    amount: arrived,
    variableSymbol: deriveOrderSelfPayReference(pointer),
    recipientMessage: formatSelfPayBankMessage({ pointer }),
  })
  return pointer
}

const confirmationOf = (context: SelfPayTestContext, pointer: SelfPayPointer) =>
  openSelfPayOrderConfirmation({
    events: context.relay.received(),
    menuPublicKey: bytesToHex(menuKeys.publicKey),
    pointer,
    selectionKey,
  })

describe("publishing the menu", () => {
  test("publishes the menu from the device that takes orders, and again when a price changes", async () => {
    await using context = await createSelfPayTestContext()
    const coffee = await openCafe(context)
    await using _job = await startJob(context)
    await waitFor(() => publishedMenus(context).length > 0)

    await using run = testCreateRun(context.deps)
    await run.ok(
      updateCatalogItem({ id: coffee, unitAmount: NonNegativeInteger(7000) })
    )
    await waitFor(() => publishedMenus(context).length > 1)

    expect(
      publishedMenus(context).map(
        (menu) => menu?.categories[0]?.items[0]?.unitAmount
      )
    ).toEqual([6500, 7000])
  })

  test("publishes nothing from a device that does not take orders", async () => {
    await using context = await createSelfPayTestContext()
    await openCafe(context)
    await using run = testCreateRun(context.deps)
    await run.ok(setOrderDevice(createRowId<"Device">()))
    await using _job = await startJob(context)
    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(publishedMenus(context)).toEqual([])
  })

  test("drops no menu version from a device that does not take orders", async () => {
    await using context = await createSelfPayTestContext({ now: new Date() })
    const coffee = await openCafe(context)
    await using run = testCreateRun(context.deps)
    const saveMenu = async () => {
      const { menu } = await run.ok(loadSelfPayMenu())
      await run.ok(saveSelfPayMenuVersion(menu))
    }
    await saveMenu()
    await run.ok(
      updateCatalogItem({ id: coffee, unitAmount: NonNegativeInteger(7000) })
    )
    await saveMenu()
    context.clock.advance(8 * 24 * 60 * 60 * 1000)
    await run.ok(setOrderDevice(createRowId<"Device">()))
    await using _job = await startJob(context)
    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(
      await context.deps.evolu.loadQuery(menuVersionsNewestFirstQuery)
    ).toHaveLength(2)
  })

  test("confirms a paid order only to a page that holds its pointer", async () => {
    await using context = await createSelfPayTestContext()
    const coffee = await openCafe(context)
    await using _job = await startJob(context)
    await waitFor(() => publishedMenus(context).length > 0)
    const [menu] = publishedMenus(context)
    if (menu === undefined || menu === null) throw new Error("Expected a menu.")
    const order = createSelfPaySelectionEvent({
      selectionText: createSelfPayOrderSelectionText({
        tablePublicKey: bytesToHex(
          deriveTableSelfPayKeys(selfPayTestRoot, context.tableId, 0).publicKey
        ),
        menu,
        items: [{ key: deriveSelfPayMenuItemKey(coffee), quantity: 1 }],
        note: null,
      }),
      selectionKey,
      createdAt: Math.floor(context.clock.date.now().getTime() / 1000),
    })
    await context.deps.nostrRelayClient.publish(
      context.deps.selfPayDefaultRelays,
      order.event
    )
    await receiveBankTransfer(context, {
      amount: 6500,
      variableSymbol: deriveOrderSelfPayReference(order.pointer),
      recipientMessage: formatSelfPayBankMessage({ pointer: order.pointer }),
    })
    const confirmationOf = async (
      pointer: Parameters<typeof openSelfPayOrderConfirmation>[0]["pointer"]
    ) =>
      openSelfPayOrderConfirmation({
        events: await context.deps.nostrRelayClient.query(
          context.deps.selfPayDefaultRelays,
          createSelfPayOrderConfirmationFilter({
            menuPublicKey: bytesToHex(menuKeys.publicKey),
            pointer,
            selectionKey,
          })
        ),
        menuPublicKey: bytesToHex(menuKeys.publicKey),
        pointer,
        selectionKey,
      })
    await waitFor(async () => (await confirmationOf(order.pointer)) !== null)

    expect(await confirmationOf(order.pointer)).toMatchObject({
      number: 1,
      total: 6500,
      covered: 6500,
    })
    const anotherGuest = createSelfPaySelectionEvent({
      selectionText: "another guest",
      selectionKey,
      createdAt: 1,
    }).pointer
    expect(await confirmationOf(anotherGuest)).toBe(null)
  })
})

describe("guests writing what they pay for", () => {
  test("publishes a menu with no items that offers writing while only writing is on, and the view names it", async () => {
    await using context = await createSelfPayTestContext()
    await using run = testCreateRun(context.deps)
    await openCafe(context)
    await run.ok(setMenuOrdering({ on: false, deviceId: context.deviceId }))
    await run.ok(setWrittenOrders({ on: true, deviceId: context.deviceId }))

    await using _job = await startJob(context)
    await waitFor(() => latestMenu(context)?.written === true)

    expect(latestMenu(context)?.categories).toEqual([])
    const { view } = await loadSelfPayTestView(context)
    expect(view.menu).toEqual({
      publicKey: bytesToHex(menuKeys.publicKey),
      readKey: bytesToHex(menuKeys.readKey),
    })
  })

  test("publishes a new menu version when writing is switched on over an unchanged menu", async () => {
    await using context = await createSelfPayTestContext()
    await openCafe(context)
    await using _job = await startJob(context)
    await waitFor(() => (latestMenu(context) ?? null) !== null)
    const before = latestMenu(context)
    await using run = testCreateRun(context.deps)

    await run.ok(setWrittenOrders({ on: true, deviceId: context.deviceId }))
    await waitFor(() => latestMenu(context)?.written === true)

    expect(before?.written).toBe(false)
    expect(latestMenu(context)?.version).not.toBe(before?.version)
    expect(latestMenu(context)?.categories).toEqual(before?.categories)
  })

  test("stops offering writing once the owner switches it off", async () => {
    await using context = await createSelfPayTestContext()
    await openCafe(context)
    await using run = testCreateRun(context.deps)
    await run.ok(setWrittenOrders({ on: true, deviceId: context.deviceId }))
    await using _job = await startJob(context)
    await waitFor(() => latestMenu(context)?.written === true)

    await run.ok(setWrittenOrders({ on: false, deviceId: context.deviceId }))

    await waitFor(() => latestMenu(context)?.written === false)
  })

  test("confirms an order recorded just before both switches went off", async () => {
    await using context = await createSelfPayTestContext()
    await using run = testCreateRun(context.deps)
    await run.ok(setWrittenOrders({ on: true, deviceId: context.deviceId }))
    await using _job = await startJob(context)
    await waitFor(() => latestMenu(context)?.written === true)
    const menu = latestMenu(context)
    if (menu === undefined || menu === null) throw new Error("Expected a menu.")
    const pointer = await payWrittenOrder(context, menu, {
      named: 9000,
      arrived: 9000,
    })
    await run.ok(setWrittenOrders({ on: false, deviceId: context.deviceId }))

    await waitFor(() => confirmationOf(context, pointer) !== null)

    expect(confirmationOf(context, pointer)).toMatchObject({
      number: 1,
      total: 9000,
      covered: 9000,
    })
  })

  test("reads a menu without the flag as offering no writing", () => {
    expect(
      SelfPayMenuSchema.parse({
        v: 1,
        version: "aa".repeat(16),
        currency: "CZK",
        categories: [],
      }).written
    ).toBe(false)
  })

  test("confirms what is left of a written order that less arrived for", async () => {
    await using context = await createSelfPayTestContext()
    await using run = testCreateRun(context.deps)
    await run.ok(setWrittenOrders({ on: true, deviceId: context.deviceId }))
    await using _job = await startJob(context)
    await waitFor(() => latestMenu(context)?.written === true)
    const menu = latestMenu(context)
    if (menu === undefined || menu === null) throw new Error("Expected a menu.")

    const pointer = await payWrittenOrder(context, menu, {
      named: 9000,
      arrived: 8000,
    })
    await waitFor(() => confirmationOf(context, pointer) !== null)

    expect(confirmationOf(context, pointer)).toMatchObject({
      total: 9000,
      covered: 8000,
    })
  })

  test("tells the guest when staff accept and serve an order, and when they reject one", async () => {
    await using context = await createSelfPayTestContext()
    await using run = testCreateRun(context.deps)
    await run.ok(setWrittenOrders({ on: true, deviceId: context.deviceId }))
    await using _job = await startJob(context)
    await waitFor(() => latestMenu(context)?.written === true)
    const menu = latestMenu(context)
    if (menu === undefined || menu === null) throw new Error("Expected a menu.")
    const served = await payWrittenOrder(context, menu, {
      named: 9000,
      arrived: 9000,
    })
    const rejected = await payWrittenOrder(context, menu, {
      named: 5000,
      arrived: 5000,
    })
    await waitFor(
      () =>
        confirmationOf(context, served) !== null &&
        confirmationOf(context, rejected) !== null
    )
    const toServe = await run.ok(loadMenuOrdersToServe())
    const orderOf = (pointer: SelfPayPointer) => {
      const number = confirmationOf(context, pointer)?.number
      const order = toServe.find((candidate) => candidate.number === number)
      if (order === undefined) throw new Error("Expected an order to serve.")
      return order
    }
    const paid = confirmationOf(context, served)

    await run.ok(acceptMenuOrder(orderOf(served).id))
    await waitFor(() => confirmationOf(context, served)?.accepted !== undefined)
    await run.ok(markMenuOrderServed(orderOf(served).id))
    await waitFor(() => confirmationOf(context, served)?.served !== undefined)
    await run.ok(rejectMenuOrder(orderOf(rejected)))
    await waitFor(
      () => confirmationOf(context, rejected)?.rejected !== undefined
    )

    expect(paid).not.toHaveProperty("accepted")
    expect(confirmationOf(context, served)).toMatchObject({
      covered: 9000,
      accepted: expect.any(Number),
      served: expect.any(Number),
    })
    expect(confirmationOf(context, served)).not.toHaveProperty("rejected")
    expect(confirmationOf(context, rejected)).not.toHaveProperty("accepted")
  })

  test("reads a confirmation from a device that knows no staff states as paid and waiting", () => {
    expect(
      SelfPayOrderConfirmationSchema.parse({
        v: 1,
        number: 1,
        total: 9000,
        covered: 9000,
        at: 1_762_528_140,
      })
    ).toEqual({
      v: 1,
      number: 1,
      total: 9000,
      covered: 9000,
      at: 1_762_528_140,
    })
  })

  test("says nothing in the table's view about a paid order", async () => {
    await using context = await createSelfPayTestContext()
    await using run = testCreateRun(context.deps)
    await run.ok(setWrittenOrders({ on: true, deviceId: context.deviceId }))
    await using _job = await startJob(context)
    await waitFor(() => latestMenu(context)?.written === true)
    const menu = latestMenu(context)
    if (menu === undefined || menu === null) throw new Error("Expected a menu.")

    await payWrittenOrder(context, menu, { named: 9000, arrived: 8000 })
    const { view } = await loadSelfPayTestView(context)

    expect(view.bills).toEqual([])
    expect(view.confirmations).toEqual([])
    expect(JSON.stringify(view)).not.toContain("2x pivo")
  })
})

describe("the view while guests order from the menu", () => {
  test("names the menu and lists no bill while bill paying is off", async () => {
    await using context = await createSelfPayTestContext()
    await openCafe(context)
    await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })
    await using run = testCreateRun(context.deps)
    await run.ok(setSelfPayBillsHidden(true))

    const { view } = await loadSelfPayTestView(context)

    expect(view.bills).toEqual([])
    expect(view.menu).toEqual({
      publicKey: bytesToHex(menuKeys.publicKey),
      readKey: bytesToHex(menuKeys.readKey),
    })
  })

  test("lists the bills again and no menu with the switches back", async () => {
    await using context = await createSelfPayTestContext()
    await openSelfPayBill(context, {
      lines: [{ name: "Pizza", amount: 10_100 }],
    })

    const { view } = await loadSelfPayTestView(context)

    expect(view.bills).toHaveLength(1)
    expect(view.menu).toBe(null)
  })
})

describe("an order paid in parts", () => {
  test("is confirmed paid as soon as the rest arrives, not at the next refresh", async () => {
    await using context = await createSelfPayTestContext()
    const coffee = await openCafe(context)
    await using _job = await startJob(context, 60 * 60 * 1000)
    await waitFor(() => publishedMenus(context).length > 0)
    const [menu] = publishedMenus(context)
    if (menu === undefined || menu === null) throw new Error("Expected a menu.")
    const order = createSelfPaySelectionEvent({
      selectionText: createSelfPayOrderSelectionText({
        tablePublicKey: bytesToHex(
          deriveTableSelfPayKeys(selfPayTestRoot, context.tableId, 0).publicKey
        ),
        menu,
        items: [{ key: deriveSelfPayMenuItemKey(coffee), quantity: 1 }],
        note: null,
      }),
      selectionKey,
      createdAt: Math.floor(context.clock.date.now().getTime() / 1000),
    })
    await context.deps.nostrRelayClient.publish(
      context.deps.selfPayDefaultRelays,
      order.event
    )
    const payPart = (amount: number) =>
      receiveBankTransfer(context, {
        amount,
        variableSymbol: deriveOrderSelfPayReference(order.pointer),
        recipientMessage: formatSelfPayBankMessage({ pointer: order.pointer }),
        bankReference: createRowId<"Transfer">(),
      })
    const covered = async () =>
      openSelfPayOrderConfirmation({
        events: await context.deps.nostrRelayClient.query(
          context.deps.selfPayDefaultRelays,
          createSelfPayOrderConfirmationFilter({
            menuPublicKey: bytesToHex(menuKeys.publicKey),
            pointer: order.pointer,
            selectionKey,
          })
        ),
        menuPublicKey: bytesToHex(menuKeys.publicKey),
        pointer: order.pointer,
        selectionKey,
      })

    await payPart(5000)
    await waitFor(async () => (await covered())?.covered === 5000)
    await payPart(1500)
    await waitFor(async () => (await covered())?.covered === 6500)

    expect(await covered()).toMatchObject({ total: 6500, covered: 6500 })
  })

  test("leaves the order's bill and its payment out of the table's view", async () => {
    await using context = await createSelfPayTestContext()
    const coffee = await openCafe(context)
    await using _job = await startJob(context)
    await waitFor(() => publishedMenus(context).length > 0)
    const [menu] = publishedMenus(context)
    if (menu === undefined || menu === null) throw new Error("Expected a menu.")
    const order = createSelfPaySelectionEvent({
      selectionText: createSelfPayOrderSelectionText({
        tablePublicKey: bytesToHex(
          deriveTableSelfPayKeys(selfPayTestRoot, context.tableId, 0).publicKey
        ),
        menu,
        items: [{ key: deriveSelfPayMenuItemKey(coffee), quantity: 1 }],
        note: null,
      }),
      selectionKey,
      createdAt: Math.floor(context.clock.date.now().getTime() / 1000),
    })
    await context.deps.nostrRelayClient.publish(
      context.deps.selfPayDefaultRelays,
      order.event
    )
    await receiveBankTransfer(context, {
      amount: 5000,
      variableSymbol: deriveOrderSelfPayReference(order.pointer),
      recipientMessage: formatSelfPayBankMessage({ pointer: order.pointer }),
    })

    const { view } = await loadSelfPayTestView(context)

    expect(view.bills).toEqual([])
    expect(view.confirmations).toEqual([])
  })
})
