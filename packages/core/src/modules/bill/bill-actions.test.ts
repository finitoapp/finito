import { testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"
import type { DateDep, EvoluOwnerDep } from "../../deps.ts"
import { createQuery } from "../../evolu/schema.ts"
import { createTestDateDep, testFixedDate } from "../../testing/date-dep.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import { createAccount } from "../account/account-actions.ts"
import { deleteAccountTransaction } from "../account-transaction/account-transaction-actions.ts"
import {
  appendBillLines,
  loadCalculatedBillLineSummaries,
} from "../bill-line/bill-line-actions.ts"
import type { BillLineSummary } from "../bill-line/bill-line-summary.ts"
import { createCatalogItem } from "../catalog-item/catalog-item-actions.ts"
import { catalogItemByIdQuery } from "../catalog-item/catalog-item-queries.ts"
import type { CatalogItemId } from "../catalog-item/catalog-item-types.ts"
import { createOrReuseItemSnapshot } from "../item/item-actions.ts"
import { createStandaloneItemSnapshot } from "../item/item-utils.ts"
import {
  createPayment,
  markPaymentPaidCash,
} from "../payment/payment-actions.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  createRowId,
  runMutationWithCompletion,
} from "../shared/evolu-utils.ts"
import {
  Integer,
  NonEmptyString255,
  NonNegativeInteger,
  PositiveInteger,
  PositiveNumber,
} from "../shared/schema.ts"
import type { TableId } from "../table/table-types.ts"
import {
  addCatalogItemToBill,
  addManualAmountToBill,
  addTipToBill,
  appendGuardedBillLines,
  appendRemoveBillLine,
  assignBillToTable,
  cancelBill,
  closeBill,
  closeZeroBill,
  confirmBillClosedDespiteCancellation,
  createBill,
  createBillAtEnd,
  listOpenBills,
  removeTableFromBill,
  splitBill,
  splitBillIntoNewBill,
} from "./bill-actions.ts"
import { loadBill, loadBillCoverage, loadBillStatus } from "./bill-guards.ts"
import { billByIdQuery } from "./bill-queries.ts"
import { type BillId, createRandomBillId } from "./bill-types.ts"

const billLinesByBillIdQuery = (billId: BillId) =>
  createQuery((db) =>
    db
      .selectFrom("billLine")
      .selectAll()
      .where("billId", "=", billId)
      .orderBy("createdAt", "asc")
  )

const createOpenBill = async (
  deps: EvoluDep & EvoluOwnerDep,
  input?: {
    readonly displayNumber?: number
    readonly label?: string | null
  }
): Promise<BillId> => {
  await using run = testCreateRun(deps)
  const id = await run.ok(
    createBill({
      deviceId: null,
      displayNumber: PositiveInteger(input?.displayNumber ?? 1),
      label:
        input?.label !== undefined && input.label !== null
          ? NonEmptyString255(input.label)
          : null,
      tableId: null,
      currency: "CZK",
    })
  )
  return id
}

/**
 * Puts `amount` on the bill as one manual line — something to charge, since
 * a payment is refused on a bill whose goods come to nothing (payment/0012).
 */
const addChargeableLine = async (
  deps: EvoluDep & EvoluOwnerDep & DateDep,
  billId: BillId,
  amount: number
): Promise<void> => {
  await using run = testCreateRun(deps)
  await run.orThrow(
    addManualAmountToBill({
      billId,
      deviceId: null,
      name: NonEmptyString255("Dinner"),
      currency: "CZK",
      totalAmount: NonNegativeInteger(amount),
    })
  )
}

/**
 * A catalog item priced below zero — a discount (catalog/0002) — written
 * straight through the core, which takes a negative price as it stands.
 */
const createDiscountItem = async (
  deps: EvoluDep & EvoluOwnerDep & DateDep,
  unitAmount: number,
  name = "Discount"
): Promise<CatalogItemId> => {
  await using run = testCreateRun(deps)
  return await run.orThrow(
    createCatalogItem({
      deviceId: null,
      categoryId: null,
      name: NonEmptyString255(name),
      description: null,
      currency: "CZK",
      unitAmount: Integer(unitAmount),
      sortOrder: NonNegativeInteger(20),
      scanCode: null,
    })
  )
}

/**
 * Adds a manual-amount line for `amount` and confirms a cash payment that
 * covers it, so `billId` becomes derived-`closed` through the ordinary
 * automatic path (a claim covering its total) rather than through
 * `closeBill`, which is now reserved for the manual "closedAt` cache is
 * missing/stale" repair case — see `bill-actions.ts`'s doc comment.
 */
const closeBillWithCashPayment = async (
  deps: EvoluDep & EvoluOwnerDep & DateDep,
  billId: BillId,
  amount: number
): Promise<void> => {
  await using run = testCreateRun(deps)
  const accountId = await run.ok(
    createAccount({
      deviceId: null,
      name: NonEmptyString255("Cash register"),
      cashRegister: { currency: "CZK" },
    })
  )
  await run.orThrow(
    addManualAmountToBill({
      billId,
      deviceId: null,
      name: NonEmptyString255("Dinner"),
      currency: "CZK",
      totalAmount: NonNegativeInteger(amount),
    })
  )
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
}

describe("bill actions", () => {
  test("creates, loads, assigns, and unassigns a bill through real Evolu", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)

    const id = await run.ok(
      createBill({
        deviceId: null,
        displayNumber: PositiveInteger(42),
        label: NonEmptyString255("Dinner"),
        tableId: null,
        currency: "CZK",
      })
    )

    await expect
      .poll(() => evolu.loadQuery(billByIdQuery(id)))
      .toMatchObject([
        {
          id,
          deviceId: null,
          displayNumber: 42,
          label: "Dinner",
          tableId: null,
          currency: "CZK",
        },
      ])

    await expect(run(loadBill(id))).resolves.toMatchObject({
      ok: true,
      value: {
        id,
        displayNumber: 42,
        currency: "CZK",
      },
    })
    await expect(run.orThrow(loadBillStatus(id))).resolves.toBe("open")

    await run.ok(assignBillToTable({ id, tableId: "table-1" as TableId }))
    await expect
      .poll(() => evolu.loadQuery(billByIdQuery(id)))
      .toMatchObject([
        {
          id,
          tableId: "table-1",
        },
      ])

    await run.ok(removeTableFromBill(id))
    await expect
      .poll(() => evolu.loadQuery(billByIdQuery(id)))
      .toMatchObject([
        {
          id,
          tableId: null,
        },
      ])
  }, 15_000)

  test("appends bills with an increasing displayNumber, skipping closed ones", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)

    const firstId = createRandomBillId()
    await run.ok(
      createBillAtEnd({
        id: firstId,
        deviceId: null,
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    await run.orThrow(cancelBill(firstId))
    const secondId = createRandomBillId()
    await run.ok(
      createBillAtEnd({
        id: secondId,
        deviceId: null,
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )

    await expect
      .poll(() => evolu.loadQuery(billByIdQuery(firstId)))
      .toMatchObject([{ id: firstId, displayNumber: 1 }])
    await expect
      .poll(() => evolu.loadQuery(billByIdQuery(secondId)))
      .toMatchObject([{ id: secondId, displayNumber: 2 }])
  }, 15_000)

  test("continues from the highest displayNumber, not the last-written one", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)

    // 10 written after 9, so the highest number is not the newest row, and the
    // two disagree under a lexical comparison ("9" > "10") — which would hand
    // out 10 a second time and collide with an existing bill. `displayNumber`
    // lives in an `any` column, so nothing about the storage type settles
    // which comparison SQLite applies; only a case with a two-digit number
    // does. The rest of this file never gets past single digits.
    await createOpenBill(deps, { displayNumber: 9 })
    await createOpenBill(deps, { displayNumber: 10 })

    const nextId = createRandomBillId()
    await run.ok(
      createBillAtEnd({
        id: nextId,
        deviceId: null,
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )

    await expect
      .poll(() => evolu.loadQuery(billByIdQuery(nextId)))
      .toMatchObject([{ id: nextId, displayNumber: 11 }])
  }, 15_000)

  test("lists only open bills with calculated items", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)

    const openId = await createOpenBill(deps, {
      displayNumber: 1,
      label: "Open",
    })
    const closedId = await createOpenBill(deps, {
      displayNumber: 2,
      label: "Closed",
    })
    const canceledId = await createOpenBill(deps, {
      displayNumber: 3,
      label: "Canceled",
    })

    await run.orThrow(
      addManualAmountToBill({
        billId: openId,
        deviceId: null,
        name: NonEmptyString255("Service"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(1_000),
      })
    )
    await closeBillWithCashPayment(deps, closedId, 2_000)
    await run.orThrow(cancelBill(canceledId))

    await expect
      .poll(() => run.ok(listOpenBills()))
      .toMatchObject([
        {
          bill: {
            id: openId,
          },
          items: [
            {
              name: "Service",
              quantity: 1,
              totalAmount: 1_000,
            },
          ],
        },
      ])
    await expect(run.orThrow(loadBillStatus(openId))).resolves.toBe("open")
  }, 15_000)

  test("closeBill repairs a closedAt the automatic write could not know about", async () => {
    // The cause behind the limitation the next test covers, rather than a
    // hand-nulled cache. `loadBillClosedAtIfCovered` gives up when the
    // payment's bill row does not resolve, which under multi-device sync is a
    // real ordering: the payment and its claim arrive from the device that
    // took the money before the bill they belong to does. Nothing is wrong
    // with that — `closedAt` is only a cache — but it does mean `closeBill`
    // is the only thing that can ever fill it in afterwards.
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)

    const billId = createRandomBillId()
    const accountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Cash register"),
        cashRegister: { currency: "CZK" },
      })
    )

    // Written directly: `createPayment` would refuse, since it requires the
    // bill to be open — which is exactly the situation being simulated, a
    // payment row that exists here before its bill does.
    const paymentId = createRowId<"Payment">()
    await runMutationWithCompletion((options) =>
      evolu.upsert(
        "payment",
        {
          id: paymentId,
          deviceId: null,
          billId,
          tableId: null,
          amount: NonNegativeInteger(1_000),
          currency: "CZK",
          tipAmount: NonNegativeInteger(0),
          canceledAt: null,
          confirmedPaidAt: null,
          excessAcknowledgedAt: null,
          expiresAt: null,
        },
        { ...options, owner: evolu.appOwner }
      )
    )
    await run.orThrow(markPaymentPaidCash({ paymentId, accountId }))

    // Now the bill and its line catch up. Appended unguarded on purpose: by
    // this point the bill's live coverage already reads `closed`, so the
    // ordinary editing actions would (correctly) refuse to touch it.
    await run.ok(
      createBillAtEnd({
        id: billId,
        deviceId: null,
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )
    const dinner = await run.ok(
      createOrReuseItemSnapshot(
        createStandaloneItemSnapshot({
          catalogItemId: null,
          name: NonEmptyString255("Dinner"),
          description: null,
          currency: "CZK",
          unitAmount: NonNegativeInteger(1_000),
          taxRateId: null,
        })
      )
    )
    await run.ok(
      appendBillLines([
        {
          billId,
          deviceId: null,
          catalogItemId: null,
          itemId: dinner.id,
          type: "manualAmount",
          kind: "add",
          quantity: PositiveNumber(1),
          totalAmount: NonNegativeInteger(1_000),
        },
      ])
    )

    // Live coverage says closed, the cache says nothing, and the cheap list
    // view believes the cache.
    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")
    await expect
      .poll(() => evolu.loadQuery(billByIdQuery(billId)))
      .toMatchObject([{ id: billId, closedAt: null }])
    await expect
      .poll(() => run.ok(listOpenBills()))
      .toMatchObject([{ bill: { id: billId } }])

    // Which is what `closeBill` exists for.
    await expect(run(closeBill(billId))).resolves.toEqual({
      ok: true,
      value: billId,
    })
    await expect
      .poll(() => evolu.loadQuery(billByIdQuery(billId)))
      .toMatchObject([{ id: billId, closedAt: testFixedDate.getTime() }])
    await expect.poll(() => run.ok(listOpenBills())).toEqual([])
  }, 15_000)

  test("a bill can linger in listOpenBills after it's already closed, if its closedAt cache never got written", async () => {
    // This is the one documented limitation of the `closedAt` cache (see
    // docs/bill-payment-states.md's "`closedAt` is a cache, not a status"):
    // `openBillsQuery`/`listOpenBills` filter on the cache for cheapness,
    // not on live coverage, so a bill whose cache write never landed (the
    // multi-device race described there) can still show up as "open" even
    // though `loadBillStatus` already correctly reports it `closed`. Nothing
    // money-correctness-related is affected — only this one list view.
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)

    const billId = await createOpenBill(deps, { displayNumber: 1 })
    await closeBillWithCashPayment(deps, billId, 1_000)
    evolu.update("bill", { id: billId, closedAt: null })
    await expect
      .poll(() => evolu.loadQuery(billByIdQuery(billId)))
      .toMatchObject([{ id: billId, closedAt: null }])

    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")
    await expect
      .poll(() => run.ok(listOpenBills()))
      .toMatchObject([{ bill: { id: billId } }])
  }, 15_000)

  test("returns the tip line, not a manual-amount line sharing its item snapshot", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const billId = await createOpenBill(deps)

    // `item` ids are content-addressed over name/description/currency/
    // unitAmount/taxRateId — *not* over the line's `type` (see
    // `createItemIdFromSnapshot`). So a manual amount and a tip with the same
    // name and amount share one `item` row, while staying two distinct
    // `BillLineSummary`s, whose ids do include `type`. Each action has to
    // return its own line.
    const manualLineSummary = await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Tip"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(500),
      })
    )
    const tipLineSummary = await run.orThrow(
      addTipToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Tip"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(500),
      })
    )

    expect(manualLineSummary.itemId).toBe(tipLineSummary.itemId)
    expect(manualLineSummary.type).toBe("manualAmount")
    expect(tipLineSummary.type).toBe("tip")
    expect(tipLineSummary.id).not.toBe(manualLineSummary.id)
  }, 15_000)

  test("rounds a catalog line total for a fractional quantity", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const billId = await createOpenBill(deps)
    const catalogItemId = await run.orThrow(
      createCatalogItem({
        deviceId: null,
        categoryId: null,
        name: NonEmptyString255("Cheese"),
        description: null,
        currency: "CZK",
        unitAmount: NonNegativeInteger(1_999),
        sortOrder: NonNegativeInteger(10),
        scanCode: null,
      })
    )

    const { line, summary } = await run.orThrow(
      addCatalogItemToBill({
        billId,
        deviceId: null,
        catalogItemId,
        quantity: PositiveNumber(0.7),
        expectedDiscount: null,
      })
    )

    expect(summary).toMatchObject({ quantity: 0.7, totalAmount: 1_399 })
    // The line it wrote carries the same rounded amount, for undo to take off.
    expect(line).toMatchObject({
      kind: "add",
      type: "catalogItem",
      quantity: 0.7,
      totalAmount: 1_399,
      itemId: summary.itemId,
    })
  }, 15_000)

  test("adds catalog, manual amount, and tip lines to a bill", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const billId = await createOpenBill(deps)
    const catalogItemId = await run.orThrow(
      createCatalogItem({
        deviceId: null,
        categoryId: null,
        name: NonEmptyString255("Coffee"),
        description: NonEmptyString255("Double espresso"),
        currency: "CZK",
        unitAmount: NonNegativeInteger(5_900),
        sortOrder: NonNegativeInteger(10),
        scanCode: null,
      })
    )

    const { summary: catalogLineSummary } = await run.orThrow(
      addCatalogItemToBill({
        billId,
        deviceId: null,
        catalogItemId,
        quantity: PositiveNumber(2),
        expectedDiscount: null,
      })
    )
    const manualLineSummary = await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Custom discount correction"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(1_500),
      })
    )
    const tipLineSummary = await run.orThrow(
      addTipToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Tip"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(2_000),
      })
    )

    expect(catalogLineSummary).toMatchObject({
      billId,
      catalogItemId,
      type: "catalogItem",
      name: "Coffee",
      description: "Double espresso",
      quantity: 2,
      totalAmount: 11_800,
    })
    expect(manualLineSummary).toMatchObject({
      billId,
      catalogItemId: null,
      type: "manualAmount",
      name: "Custom discount correction",
      quantity: 1,
      totalAmount: 1_500,
    })
    expect(tipLineSummary).toMatchObject({
      billId,
      catalogItemId: null,
      type: "tip",
      name: "Tip",
      quantity: 1,
      totalAmount: 2_000,
    })

    await expect
      .poll(() => run.ok(loadCalculatedBillLineSummaries(billId)))
      .toMatchObject([
        {
          name: "Coffee",
          type: "catalogItem",
          quantity: 2,
          totalAmount: 11_800,
        },
        {
          name: "Custom discount correction",
          type: "manualAmount",
          quantity: 1,
          totalAmount: 1_500,
        },
        {
          name: "Tip",
          type: "tip",
          quantity: 1,
          totalAmount: 2_000,
        },
      ])
  }, 15_000)

  test("returns an error when adding a missing catalog item", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const billId = await createOpenBill(deps)

    await expect(
      run(
        addCatalogItemToBill({
          billId,
          deviceId: null,
          catalogItemId: "catalog-item-1" as CatalogItemId,
          quantity: PositiveNumber(1),
          expectedDiscount: null,
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: {
        id: "catalog-item-1",
      },
    })
  }, 15_000)

  test("appends a remove line and removes depleted bill line summaries", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const billId = await createOpenBill(deps)
    const lineSummary = await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Manual charge"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(5_000),
      })
    )

    const afterPartialRemove = await run.orThrow(
      appendRemoveBillLine({
        billId,
        deviceId: null,
        lineSummary,
        quantity: PositiveNumber(0.25),
        totalAmount: NonNegativeInteger(1_250),
      })
    )

    expect(afterPartialRemove).toMatchObject({
      id: lineSummary.id,
      quantity: 0.75,
      totalAmount: 3_750,
    })
    expect(afterPartialRemove).not.toBeNull()
    if (afterPartialRemove === null) return

    const afterFullRemove = await run.orThrow(
      appendRemoveBillLine({
        billId,
        deviceId: null,
        lineSummary: afterPartialRemove,
        quantity: PositiveNumber(0.75),
        totalAmount: NonNegativeInteger(3_750),
      })
    )

    expect(afterFullRemove).toBeNull()
    await expect
      .poll(() => run.ok(loadCalculatedBillLineSummaries(billId)))
      .toMatchObject([])
    await expect
      .poll(() => evolu.loadQuery(billLinesByBillIdQuery(billId)))
      .toHaveLength(3)
  }, 15_000)

  test("refuses a removal of another sign, or of more than the line holds, writing nothing", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const billId = await createOpenBill(deps)
    const lineSummary = await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Manual charge"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(5_000),
      })
    )
    const remove = (quantity: number, totalAmount: number) =>
      run(
        appendRemoveBillLine({
          billId,
          deviceId: null,
          lineSummary,
          quantity: PositiveNumber(quantity),
          totalAmount: Integer(totalAmount),
        })
      )

    // A negative amount would raise the bill; more than the line would turn
    // the goods into a discount nobody added.
    for (const [quantity, totalAmount] of [
      [1, -500],
      [1, 6_000],
      [2, 5_000],
    ] as const) {
      await expect(remove(quantity, totalAmount)).resolves.toMatchObject({
        ok: false,
        error: {
          type: "BillLineRemovalOutOfRange",
          availableQuantity: 1,
          availableTotalAmount: 5_000,
        },
      })
    }
    await expect(
      evolu.loadQuery(billLinesByBillIdQuery(billId))
    ).resolves.toHaveLength(1)

    // The whole line comes off, and then there is nothing left to take.
    await expect(remove(1, 5_000)).resolves.toMatchObject({ ok: true })
    await expect(remove(1, 5_000)).resolves.toMatchObject({
      ok: false,
      error: { type: "BillLineRemovalOutOfRange", availableQuantity: 0 },
    })
  }, 15_000)

  test("refuses a split into the bill it splits, writing nothing", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const billId = await createOpenBill(deps)
    const lineSummary = await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Coffee"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(500),
      })
    )

    await expect(
      run(
        splitBill({
          sourceBillId: billId,
          targetBillId: billId,
          items: [lineSummary],
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "BillSplitSameBill", id: billId },
    })
    await expect(
      evolu.loadQuery(billLinesByBillIdQuery(billId))
    ).resolves.toHaveLength(1)
    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("open")
  }, 15_000)

  test("splits selected items from a source bill into an existing target bill", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const sourceBillId = await createOpenBill(deps, {
      displayNumber: 1,
      label: "Source",
    })
    const targetBillId = await createOpenBill(deps, {
      displayNumber: 2,
      label: "Target",
    })
    const lineSummary = await run.orThrow(
      addManualAmountToBill({
        billId: sourceBillId,
        deviceId: null,
        name: NonEmptyString255("Shared dish"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(12_000),
      })
    )

    const result = await run.orThrow(
      splitBill({
        sourceBillId,
        targetBillId,
        items: [lineSummary],
      })
    )

    expect(result).toMatchObject({
      bill: {
        id: targetBillId,
        label: "Target",
      },
      items: [
        {
          billId: targetBillId,
          name: "Shared dish",
          quantity: 1,
          totalAmount: 12_000,
        },
      ],
      // Moving the source's only line fully empties it, so it's
      // auto-canceled in the same batch — see `willEmptySourceBill`.
      sourceCanceled: true,
    })
    await expect
      .poll(() => run.ok(loadCalculatedBillLineSummaries(sourceBillId)))
      .toMatchObject([])
    await expect
      .poll(() => evolu.loadQuery(billByIdQuery(sourceBillId)))
      .toMatchObject([{ id: sourceBillId, canceledAt: expect.any(Number) }])
    await expect
      .poll(() => run.ok(loadCalculatedBillLineSummaries(targetBillId)))
      .toMatchObject([
        {
          billId: targetBillId,
          name: "Shared dish",
        },
      ])
  }, 15_000)

  test("splitBill leaves the source bill open when items remain on it", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const sourceBillId = await createOpenBill(deps, { displayNumber: 1 })
    const targetBillId = await createOpenBill(deps, { displayNumber: 2 })
    const movedLine = await run.orThrow(
      addManualAmountToBill({
        billId: sourceBillId,
        deviceId: null,
        name: NonEmptyString255("Coffee"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(500),
      })
    )
    await run.orThrow(
      addManualAmountToBill({
        billId: sourceBillId,
        deviceId: null,
        name: NonEmptyString255("Tea"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(400),
      })
    )

    const result = await run.orThrow(
      splitBill({
        sourceBillId,
        targetBillId,
        items: [movedLine],
      })
    )

    expect(result.sourceCanceled).toBe(false)
    await expect
      .poll(() => run.ok(loadCalculatedBillLineSummaries(sourceBillId)))
      .toMatchObject([{ name: "Tea" }])
    await expect
      .poll(() => evolu.loadQuery(billByIdQuery(sourceBillId)))
      .toMatchObject([{ id: sourceBillId, canceledAt: null }])
  }, 15_000)

  test("splitBill with nothing selected is a no-op instead of hanging", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const sourceBillId = await createOpenBill(deps, { displayNumber: 1 })
    const targetBillId = await createOpenBill(deps, { displayNumber: 2 })
    await run.orThrow(
      addManualAmountToBill({
        billId: sourceBillId,
        deviceId: null,
        name: NonEmptyString255("Coffee"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(500),
      })
    )

    // Writing nothing has to skip the mutation batch entirely: the
    // `onComplete` behind `runMutationWithCompletion` only fires once Evolu
    // applies a mutation, so an empty batch never resolves.
    const result = await run.orThrow(
      splitBill({ sourceBillId, targetBillId, items: [] })
    )

    expect(result.sourceCanceled).toBe(false)
    expect(result.items).toEqual([])
    await expect
      .poll(() => run.ok(loadCalculatedBillLineSummaries(sourceBillId)))
      .toMatchObject([{ name: "Coffee" }])
    await expect
      .poll(() => evolu.loadQuery(billByIdQuery(sourceBillId)))
      .toMatchObject([{ id: sourceBillId, canceledAt: null }])
  }, 15_000)

  test("splitBill refuses a line already removed from the source, leaving it open", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const sourceBillId = await createOpenBill(deps, { displayNumber: 1 })
    const targetBillId = await createOpenBill(deps, { displayNumber: 2 })
    const movedLine = await run.orThrow(
      addManualAmountToBill({
        billId: sourceBillId,
        deviceId: null,
        name: NonEmptyString255("Coffee"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(500),
      })
    )

    // The line is gone from the source before the split lands — the shape a
    // concurrent edit (or a stale split screen) leaves behind.
    await run.orThrow(
      appendRemoveBillLine({
        billId: sourceBillId,
        deviceId: null,
        quantity: movedLine.quantity,
        totalAmount: movedLine.totalAmount,
        lineSummary: movedLine,
      })
    )

    // This used to go through and assert only that the source stayed open.
    // It did — but the target gained an `add` for 500 the source no longer
    // held, so 0 across the two bills became 500. The move is refused now,
    // which keeps the source open for the same reason and without inventing
    // the money.
    await expect(
      run(splitBill({ sourceBillId, targetBillId, items: [movedLine] }))
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "BillSplitSelectionStale", availableQuantity: 0 },
    })
    await expect(
      run.ok(loadCalculatedBillLineSummaries(targetBillId))
    ).resolves.toEqual([])
    await expect
      .poll(() => evolu.loadQuery(billByIdQuery(sourceBillId)))
      .toMatchObject([{ id: sourceBillId, canceledAt: null }])
  }, 15_000)

  test("returns an error when splitting into a missing target bill", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const sourceBillId = await createOpenBill(deps)

    await expect(
      run(
        splitBill({
          sourceBillId,
          targetBillId: "bill-missing" as BillId,
          items: [],
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: {
        id: "bill-missing",
      },
    })
  }, 15_000)

  test("splits selected items from a source bill into a newly created bill in one call", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const sourceBillId = await createOpenBill(deps, {
      displayNumber: 1,
      label: "Source",
    })
    const lineSummary = await run.orThrow(
      addManualAmountToBill({
        billId: sourceBillId,
        deviceId: null,
        name: NonEmptyString255("Shared dish"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(12_000),
      })
    )
    const targetBillId = createRandomBillId()

    const result = await run.orThrow(
      splitBillIntoNewBill({
        sourceBillId,
        targetBillId,
        deviceId: null,
        tableId: null,
        currency: "CZK",
        items: [lineSummary],
      })
    )

    expect(result).toBe(targetBillId)
    await expect
      .poll(() => evolu.loadQuery(billByIdQuery(targetBillId)))
      .toMatchObject([{ id: targetBillId, currency: "CZK" }])
    await expect
      .poll(() => run.ok(loadCalculatedBillLineSummaries(sourceBillId)))
      .toMatchObject([])
    // Moving the source's only line fully empties it, so it's auto-canceled
    // in the same batch — see `willEmptySourceBill`.
    await expect
      .poll(() => evolu.loadQuery(billByIdQuery(sourceBillId)))
      .toMatchObject([{ id: sourceBillId, canceledAt: expect.any(Number) }])
    await expect
      .poll(() => run.ok(loadCalculatedBillLineSummaries(targetBillId)))
      .toMatchObject([
        {
          billId: targetBillId,
          name: "Shared dish",
          quantity: 1,
          totalAmount: 12_000,
        },
      ])
  }, 15_000)

  test("splitBillIntoNewBill leaves the source bill open when items remain on it", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const sourceBillId = await createOpenBill(deps, { displayNumber: 1 })
    const movedLine = await run.orThrow(
      addManualAmountToBill({
        billId: sourceBillId,
        deviceId: null,
        name: NonEmptyString255("Coffee"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(500),
      })
    )
    await run.orThrow(
      addManualAmountToBill({
        billId: sourceBillId,
        deviceId: null,
        name: NonEmptyString255("Tea"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(400),
      })
    )
    const targetBillId = createRandomBillId()

    await run.orThrow(
      splitBillIntoNewBill({
        sourceBillId,
        targetBillId,
        deviceId: null,
        tableId: null,
        currency: "CZK",
        items: [movedLine],
      })
    )

    await expect
      .poll(() => run.ok(loadCalculatedBillLineSummaries(sourceBillId)))
      .toMatchObject([{ name: "Tea" }])
    await expect
      .poll(() => evolu.loadQuery(billByIdQuery(sourceBillId)))
      .toMatchObject([{ id: sourceBillId, canceledAt: null }])
  }, 15_000)

  test("reports a canceled bill as not open even while a pending payment locks it", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const billId = await createOpenBill(deps, { displayNumber: 1 })
    const accountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Cash register"),
        cashRegister: { currency: "CZK" },
      })
    )
    await addChargeableLine(deps, billId, 1_000)
    await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(1_000),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId },
      })
    )
    // `cancelBill` has no lock check of its own, so this bill ends up both
    // canceled *and* locked by a live payment.
    await run.orThrow(cancelBill(billId))

    // `requireEditableBill` runs the status guard and the lock check
    // concurrently; this pins which of the two errors wins, so the reads can
    // be reordered without silently changing what a caller sees.
    await expect(
      run(
        addManualAmountToBill({
          billId,
          deviceId: null,
          name: NonEmptyString255("Dinner"),
          currency: "CZK",
          totalAmount: NonNegativeInteger(500),
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "BillStatusNotAllowed" },
    })
  }, 15_000)

  test("refuses a split selecting more of a line than the source holds", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const sourceBillId = await createOpenBill(deps, { displayNumber: 1 })
    const targetBillId = await createOpenBill(deps, { displayNumber: 2 })
    const lineSummary = await run.orThrow(
      addManualAmountToBill({
        billId: sourceBillId,
        deviceId: null,
        name: NonEmptyString255("Dish"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(1_000),
      })
    )

    // What a stale split screen sends: the line was reduced (here or on
    // another device) after it was opened. Left unchecked this wrote a
    // `remove` for 3x1000 on a source holding 1x1000 — whose own summaries
    // clamp at zero — and an `add` for 3000 on the target, turning 1000
    // across the two bills into 3000 and reporting success.
    const total = async (billId: BillId) =>
      (await run.ok(loadCalculatedBillLineSummaries(billId))).reduce(
        (sum, summary) => sum + summary.totalAmount,
        0
      )

    await expect(
      run(
        splitBill({
          sourceBillId,
          targetBillId,
          items: [
            {
              ...lineSummary,
              quantity: PositiveNumber(3),
              totalAmount: NonNegativeInteger(3_000),
            },
          ],
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: {
        type: "BillSplitSelectionStale",
        selectedQuantity: 3,
        availableQuantity: 1,
        selectedTotalAmount: 3_000,
        availableTotalAmount: 1_000,
      },
    })
    await expect(total(sourceBillId)).resolves.toBe(1_000)
    await expect(total(targetBillId)).resolves.toBe(0)
  }, 15_000)

  test("refuses a split selecting a line the source bill does not hold", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const sourceBillId = await createOpenBill(deps, { displayNumber: 1 })
    const targetBillId = await createOpenBill(deps, { displayNumber: 2 })
    await run.orThrow(
      addManualAmountToBill({
        billId: sourceBillId,
        deviceId: null,
        name: NonEmptyString255("Dish"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(1_000),
      })
    )
    // A line from the *target* bill: the summary id is derived from the bill
    // too, so a selection belonging to another bill is caught by the same
    // check as a vanished one.
    const otherBillLine = await run.orThrow(
      addManualAmountToBill({
        billId: targetBillId,
        deviceId: null,
        name: NonEmptyString255("Elsewhere"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(500),
      })
    )

    await expect(
      run(splitBill({ sourceBillId, targetBillId, items: [otherBillLine] }))
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "BillSplitSelectionStale", availableQuantity: 0 },
    })
  }, 15_000)

  test("sums a line selected twice instead of taking the last entry", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const sourceBillId = await createOpenBill(deps, { displayNumber: 1 })
    const targetBillId = await createOpenBill(deps, { displayNumber: 2 })
    const catalogItemId = await run.orThrow(
      createCatalogItem({
        deviceId: null,
        categoryId: null,
        name: NonEmptyString255("Coffee"),
        description: null,
        currency: "CZK",
        unitAmount: NonNegativeInteger(1_000),
        sortOrder: NonNegativeInteger(0),
        scanCode: null,
      })
    )
    const { summary: lineSummary } = await run.orThrow(
      addCatalogItemToBill({
        billId: sourceBillId,
        deviceId: null,
        catalogItemId,
        quantity: PositiveNumber(5),
        expectedDiscount: null,
      })
    )

    // Two partial selections of the same line, together exactly the whole
    // line. Keyed by id while keeping only the last entry, this compared
    // 3 >= 5 and left a fully emptied source bill open.
    const partial = (quantity: number, totalAmount: number) => ({
      ...lineSummary,
      quantity: PositiveNumber(quantity),
      totalAmount: NonNegativeInteger(totalAmount),
    })

    await expect(
      run(
        splitBill({
          sourceBillId,
          targetBillId,
          items: [partial(2, 2_000), partial(3, 3_000)],
        })
      )
    ).resolves.toMatchObject({ ok: true, value: { sourceCanceled: true } })

    // And the same two selections over-reaching by one are refused, rather
    // than passing because the last entry alone happened to fit.
    const overSourceBillId = await createOpenBill(deps, { displayNumber: 3 })
    const { summary: overLine } = await run.orThrow(
      addCatalogItemToBill({
        billId: overSourceBillId,
        deviceId: null,
        catalogItemId,
        quantity: PositiveNumber(4),
        expectedDiscount: null,
      })
    )
    await expect(
      run(
        splitBill({
          sourceBillId: overSourceBillId,
          targetBillId,
          items: [
            { ...overLine, quantity: PositiveNumber(2) },
            { ...overLine, quantity: PositiveNumber(3) },
          ],
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "BillSplitSelectionStale", selectedQuantity: 5 },
    })
  }, 15_000)

  test("reports the bill's own refusal ahead of a missing catalog item", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const billId = await createOpenBill(deps, { displayNumber: 1 })
    const accountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Cash register"),
        cashRegister: { currency: "CZK" },
      })
    )
    await addChargeableLine(deps, billId, 1_000)
    await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(1_000),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId },
      })
    )

    // Both checks fail: the bill is locked by a pending payment *and* the
    // catalog item does not exist. The guard's answer is the one that
    // matters to the operator, and it stays that way now the two reads run
    // concurrently rather than one gating the other.
    await expect(
      run(
        addCatalogItemToBill({
          billId,
          deviceId: null,
          catalogItemId: "catalog-missing" as CatalogItemId,
          quantity: PositiveNumber(1),
          expectedDiscount: null,
        })
      )
    ).resolves.toMatchObject({ ok: false, error: { type: "BillLocked" } })
  }, 15_000)

  test("reports a missing catalog item on an otherwise editable bill", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const billId = await createOpenBill(deps, { displayNumber: 1 })

    await expect(
      run(
        addCatalogItemToBill({
          billId,
          deviceId: null,
          catalogItemId: "catalog-missing" as CatalogItemId,
          quantity: PositiveNumber(1),
          expectedDiscount: null,
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "CatalogItemNotFound", id: "catalog-missing" },
    })
  }, 15_000)

  test("locks a bill whose only claim lost the transaction behind it", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const billId = await createOpenBill(deps, { displayNumber: 1 })
    await closeBillWithCashPayment(deps, billId, 1_000)

    // Settled, so nothing is outstanding and the cart is closed to edits.
    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")

    const [transaction] = await evolu.loadQuery(
      createQuery((db) => db.selectFrom("accountTransaction").select(["id"]))
    )
    if (transaction === undefined) throw new Error("no account transaction")
    await run.ok(deleteAccountTransaction(transaction.id))

    // The claim outlives the transaction it pointed at. Coverage already
    // reads that correctly — `calculateClaimedSum` cannot count a
    // transaction that is not there — so the bill is `open` again and its
    // payment is once more unresolved. The editing lock has to agree: a
    // claim on its own is not evidence that money arrived, and letting the
    // cart be edited under an outstanding payment is the thing the lock
    // exists to prevent.
    await expect
      .poll(() => run.ok(loadBillCoverage(billId)))
      .toMatchObject({ claimedSum: 0, coverage: "underpaid" })
    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("open")
    await expect(
      run(
        addManualAmountToBill({
          billId,
          deviceId: null,
          name: NonEmptyString255("Extra"),
          currency: "CZK",
          totalAmount: NonNegativeInteger(500),
        })
      )
    ).resolves.toMatchObject({ ok: false, error: { type: "BillLocked" } })
  }, 15_000)

  test("rejects splitting into a new bill when the source bill is locked by a pending payment", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const sourceBillId = await createOpenBill(deps, { displayNumber: 1 })
    const accountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Cash register"),
        cashRegister: { currency: "CZK" },
      })
    )
    await addChargeableLine(deps, sourceBillId, 1_000)
    await run.orThrow(
      createPayment({
        deviceId: null,
        billId: sourceBillId,
        tableId: null,
        amount: NonNegativeInteger(1_000),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId },
      })
    )

    await expect(
      run(
        splitBillIntoNewBill({
          sourceBillId,
          targetBillId: createRandomBillId(),
          deviceId: null,
          tableId: null,
          currency: "CZK",
          items: [],
        })
      )
    ).resolves.toMatchObject({ ok: false, error: { type: "BillLocked" } })
  }, 15_000)

  test("rejects splitting into a new bill when the source bill is canceled or closed", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const canceledBillId = await createOpenBill(deps, { displayNumber: 1 })
    await run.orThrow(cancelBill(canceledBillId))
    const closedBillId = await createOpenBill(deps, { displayNumber: 2 })
    await closeBillWithCashPayment(deps, closedBillId, 1_000)

    for (const billId of [canceledBillId, closedBillId]) {
      await expect(
        run(
          splitBillIntoNewBill({
            sourceBillId: billId,
            targetBillId: createRandomBillId(),
            deviceId: null,
            tableId: null,
            currency: "CZK",
            items: [],
          })
        )
      ).resolves.toMatchObject({
        ok: false,
        error: { type: "BillStatusNotAllowed" },
      })
    }
  }, 15_000)

  test("rejects adding or removing lines on a canceled or closed bill", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const canceledBillId = await createOpenBill(deps, { displayNumber: 1 })
    await run.orThrow(cancelBill(canceledBillId))
    const closedBillId = await createOpenBill(deps, { displayNumber: 2 })
    await closeBillWithCashPayment(deps, closedBillId, 1_000)

    for (const billId of [canceledBillId, closedBillId]) {
      await expect(
        run(
          addManualAmountToBill({
            billId,
            deviceId: null,
            name: NonEmptyString255("Late addition"),
            currency: "CZK",
            totalAmount: NonNegativeInteger(500),
          })
        )
      ).resolves.toMatchObject({
        ok: false,
        error: { type: "BillStatusNotAllowed" },
      })
    }
  }, 15_000)

  test("rejects canceling a closed bill but allows re-canceling a canceled one", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const closedBillId = await createOpenBill(deps, { displayNumber: 1 })
    await closeBillWithCashPayment(deps, closedBillId, 1_000)

    // `allowedStatuses` is the part that carries the reason: a `canceled` bill
    // is cancelable (re-canceling is a no-op) and a `closed` one never is, so
    // "the status is not open" would have described both and explained
    // neither. The CLI prints this payload verbatim.
    await expect(run(cancelBill(closedBillId))).resolves.toMatchObject({
      ok: false,
      error: {
        type: "BillStatusNotAllowed",
        status: "closed",
        allowedStatuses: ["open", "canceled"],
      },
    })

    const canceledBillId = await createOpenBill(deps, { displayNumber: 2 })
    await run.orThrow(cancelBill(canceledBillId))
    await expect(run.orThrow(cancelBill(canceledBillId))).resolves.toBe(
      canceledBillId
    )
  }, 15_000)

  test("rejects closing a canceled bill but allows re-closing an already-closed one", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const canceledBillId = await createOpenBill(deps, { displayNumber: 1 })
    await run.orThrow(cancelBill(canceledBillId))

    // The other direction: `closeBill` refreshes an already-settled bill's
    // cache, so `closed` is allowed and only `canceled` is not.
    await expect(run(closeBill(canceledBillId))).resolves.toMatchObject({
      ok: false,
      error: {
        type: "BillStatusNotAllowed",
        status: "canceled",
        allowedStatuses: ["open", "closed"],
      },
    })

    // `closeBill` is a repair tool for the `closedAt` cache, not the normal
    // closing path — get the bill covered via a real claim first (which
    // already sets `closedAt` automatically), then null it out to simulate
    // the write never landing (the multi-device race `bill.ts`'s doc
    // comment describes), and verify `closeBill` can both repair it and be
    // called again afterward as an idempotent no-op.
    const closedBillId = await createOpenBill(deps, { displayNumber: 2 })
    await closeBillWithCashPayment(deps, closedBillId, 1_000)
    evolu.update("bill", { id: closedBillId, closedAt: null })
    await expect
      .poll(() => evolu.loadQuery(billByIdQuery(closedBillId)))
      .toMatchObject([{ id: closedBillId, closedAt: null }])

    // The central guarantee this whole cache exists to make safe: the
    // *derived* status never depended on `closedAt` in the first place, so
    // it already reads `closed` here even though the cache is stale/absent
    // — nothing money-correctness-related needed `closeBill` to run yet.
    // See docs/bill-payment-states.md's "`closedAt` is a cache, not a
    // status".
    await expect(run.orThrow(loadBillStatus(closedBillId))).resolves.toBe(
      "closed"
    )

    await run.orThrow(closeBill(closedBillId))
    await expect
      .poll(() => evolu.loadQuery(billByIdQuery(closedBillId)))
      .toSatisfy((rows) => rows[0]?.closedAt !== null)

    await expect(run.orThrow(closeBill(closedBillId))).resolves.toBe(
      closedBillId
    )
  }, 15_000)

  test("rejects manually closing an underpaid bill, but allows a fully covered one", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)

    const underpaidBillId = await createOpenBill(deps, { displayNumber: 1 })
    await run.orThrow(
      addManualAmountToBill({
        billId: underpaidBillId,
        deviceId: null,
        name: NonEmptyString255("Dinner"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(1_000),
      })
    )

    // No payment was ever claimed for this bill — `closeBill` must not be
    // able to produce a `closed`+`underpaid` bill; docs/bill-payment-states.md
    // states that combination can never occur.
    await expect(run(closeBill(underpaidBillId))).resolves.toMatchObject({
      ok: false,
      error: {
        type: "BillUnderpaid",
        id: underpaidBillId,
        billTotal: 1_000,
        claimedSum: 0,
      },
    })
    await expect(run.orThrow(loadBillStatus(underpaidBillId))).resolves.toBe(
      "open"
    )

    // An empty bill (billTotal 0, no payments) is trivially "paid" by
    // `deriveBillCoverage`'s own definition, but `closeBill` still requires
    // an actual claim — otherwise a brand-new, still-empty cart would read
    // as closeable the instant it's created. See `deriveBillStatus`'s doc
    // comment in bill-utils.ts.
    const emptyBillId = await createOpenBill(deps, { displayNumber: 2 })
    await expect(run(closeBill(emptyBillId))).resolves.toMatchObject({
      ok: false,
      error: { type: "BillUnderpaid", id: emptyBillId },
    })

    // A bill covered by an actual claim can be closed manually, including
    // repairing a `closedAt` cache that never got written.
    const coveredBillId = await createOpenBill(deps, { displayNumber: 3 })
    await closeBillWithCashPayment(deps, coveredBillId, 1_000)
    evolu.update("bill", { id: coveredBillId, closedAt: null })

    await expect(run.orThrow(closeBill(coveredBillId))).resolves.toBe(
      coveredBillId
    )
    await expect(
      run.ok(loadBillCoverage(coveredBillId))
    ).resolves.toMatchObject({
      billTotal: 1_000,
      claimedSum: 1_000,
      coverage: "paid",
    })
  }, 15_000)

  test("resolves a canceled+funded collision back to closed via confirmBillClosedDespiteCancellation", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const accountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Cash register"),
        cashRegister: { currency: "CZK" },
      })
    )

    const billId = await createOpenBill(deps, { displayNumber: 1 })
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Dinner"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(1_000),
      })
    )
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(1_000),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId },
      })
    )

    // Staff discards the cart while the payment is still pending (allowed —
    // `cancelBill` doesn't consult the editing lock) ...
    await run.orThrow(cancelBill(billId))
    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("canceled")

    // ... and the payment is confirmed anyway. The bill's derived status
    // stays `canceled` even though it's now fully covered — the collision.
    await run.orThrow(markPaymentPaidCash({ paymentId, accountId }))
    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("canceled")

    await expect(
      run.orThrow(confirmBillClosedDespiteCancellation(billId))
    ).resolves.toBe(billId)
    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")

    // `canceledAt` itself is never touched — only the derived status flips.
    await expect
      .poll(() => evolu.loadQuery(billByIdQuery(billId)))
      .toSatisfy((rows) => rows[0]?.canceledAt !== null)
  }, 15_000)

  test("resolves a canceled+overpaid collision too — the guard only rejects underpaid, not overpaid", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const accountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Cash register"),
        cashRegister: { currency: "CZK" },
      })
    )

    const billId = await createOpenBill(deps, { displayNumber: 1 })
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Dinner"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(1_000),
      })
    )
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(1_500),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId },
      })
    )

    await run.orThrow(cancelBill(billId))
    await run.orThrow(markPaymentPaidCash({ paymentId, accountId }))
    await expect(run.ok(loadBillCoverage(billId))).resolves.toMatchObject({
      billTotal: 1_000,
      claimedSum: 1_500,
      coverage: "overpaid",
    })
    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("canceled")

    await expect(
      run.orThrow(confirmBillClosedDespiteCancellation(billId))
    ).resolves.toBe(billId)
    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")
  }, 15_000)

  test("calling confirmBillClosedDespiteCancellation again on an already-resolved bill is an idempotent no-op", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const accountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Cash register"),
        cashRegister: { currency: "CZK" },
      })
    )

    const billId = await createOpenBill(deps, { displayNumber: 1 })
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Dinner"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(1_000),
      })
    )
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(1_000),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId },
      })
    )
    await run.orThrow(cancelBill(billId))
    await run.orThrow(markPaymentPaidCash({ paymentId, accountId }))
    await run.orThrow(confirmBillClosedDespiteCancellation(billId))
    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")

    await expect(
      run.orThrow(confirmBillClosedDespiteCancellation(billId))
    ).resolves.toBe(billId)
    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")
  }, 15_000)

  test("rejects confirmBillClosedDespiteCancellation on a bill that isn't canceled", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)

    const billId = await createOpenBill(deps, { displayNumber: 1 })
    await closeBillWithCashPayment(deps, billId, 1_000)

    await expect(
      run(confirmBillClosedDespiteCancellation(billId))
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "BillNotCanceled", id: billId },
    })
  }, 15_000)

  test("rejects confirmBillClosedDespiteCancellation on a canceled bill with no active claim", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)

    const billId = await createOpenBill(deps, { displayNumber: 1 })
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Dinner"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(1_000),
      })
    )
    await run.orThrow(cancelBill(billId))

    await expect(
      run(confirmBillClosedDespiteCancellation(billId))
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "BillUnderpaid", id: billId },
    })
  }, 15_000)
})

describe("closeZeroBill", () => {
  /** A catalog item priced at `unitAmount`, from an account that is not a VAT payer. */
  const createItem = async (
    deps: EvoluDep & EvoluOwnerDep,
    name: string,
    unitAmount: number
  ): Promise<CatalogItemId> => {
    await using run = testCreateRun(deps)
    return await run.orThrow(
      createCatalogItem({
        deviceId: null,
        categoryId: null,
        name: NonEmptyString255(name),
        description: null,
        currency: "CZK",
        unitAmount: NonNegativeInteger(unitAmount),
        sortOrder: NonNegativeInteger(0),
        scanCode: null,
      })
    )
  }

  const addItem = async (
    deps: EvoluDep & EvoluOwnerDep & DateDep,
    billId: BillId,
    catalogItemId: CatalogItemId
  ) => {
    await using run = testCreateRun(deps)
    const { summary } = await run.orThrow(
      addCatalogItemToBill({
        billId,
        deviceId: null,
        catalogItemId,
        quantity: PositiveNumber(1),
        expectedDiscount: null,
      })
    )
    return summary
  }

  test("closes a bill whose goods come to zero, final and off the floor view", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const water = await createItem(deps, "Tap water", 0)
    const billId = await createOpenBill(deps)
    await addItem(deps, billId, water)

    await expect(run(closeZeroBill(billId))).resolves.toEqual({
      ok: true,
      value: billId,
    })

    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")
    await expect
      .poll(() => evolu.loadQuery(billByIdQuery(billId)))
      .toMatchObject([
        {
          id: billId,
          closedAt: testFixedDate.getTime(),
          confirmedClosedAt: testFixedDate.getTime(),
          canceledAt: null,
        },
      ])
    await expect.poll(() => run.ok(listOpenBills())).toEqual([])
    // The cart is closed to edits and to payments.
    await expect(
      run(
        createPayment({
          deviceId: null,
          billId,
          tableId: null,
          amount: NonNegativeInteger(0),
          currency: "CZK",
          tipAmount: NonNegativeInteger(0),
          canceledAt: null,
          expiresAt: null,
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "BillStatusNotAllowed", status: "closed" },
    })
    await expect(
      run(
        addManualAmountToBill({
          billId,
          deviceId: null,
          name: NonEmptyString255("Extra"),
          currency: "CZK",
          totalAmount: NonNegativeInteger(500),
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "BillStatusNotAllowed", status: "closed" },
    })
  }, 15_000)

  test("refuses an empty bill, one whose total is not zero, one with a tip and one a payment locks", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const water = await createItem(deps, "Tap water", 0)
    const coffee = await createItem(deps, "Coffee", 5_900)

    const empty = await createOpenBill(deps, { displayNumber: 1 })
    await expect(run(closeZeroBill(empty))).resolves.toEqual({
      ok: false,
      error: {
        type: "BillNotZero",
        id: empty,
        reason: "noLines",
        billTotal: 0,
      },
    })

    // Lines that net to nothing are no lines: added, then removed.
    const emptied = await createOpenBill(deps, { displayNumber: 2 })
    const coffeeLine = await addItem(deps, emptied, coffee)
    await run.orThrow(
      appendRemoveBillLine({
        billId: emptied,
        deviceId: null,
        quantity: PositiveNumber(1),
        totalAmount: NonNegativeInteger(5_900),
        lineSummary: coffeeLine,
      })
    )
    await expect(run(closeZeroBill(emptied))).resolves.toMatchObject({
      ok: false,
      error: { type: "BillNotZero", reason: "noLines" },
    })

    const priced = await createOpenBill(deps, { displayNumber: 3 })
    await addItem(deps, priced, water)
    await addItem(deps, priced, coffee)
    await expect(run(closeZeroBill(priced))).resolves.toEqual({
      ok: false,
      error: {
        type: "BillNotZero",
        id: priced,
        reason: "totalNotZero",
        billTotal: 5_900,
      },
    })

    const tipped = await createOpenBill(deps, { displayNumber: 4 })
    await addItem(deps, tipped, water)
    await run.orThrow(
      addTipToBill({
        billId: tipped,
        deviceId: null,
        name: NonEmptyString255("Tip"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(1_000),
      })
    )
    await expect(run(closeZeroBill(tipped))).resolves.toMatchObject({
      ok: false,
      error: { type: "BillNotZero", reason: "tipLine" },
    })

    // A payment is out for the coffee; another device, that had not seen it
    // yet, took the coffee back off the bill.
    const locked = await createOpenBill(deps, { displayNumber: 5 })
    await addItem(deps, locked, water)
    const lockedCoffee = await addItem(deps, locked, coffee)
    const accountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Cash register"),
        cashRegister: { currency: "CZK" },
      })
    )
    await run.orThrow(
      createPayment({
        deviceId: null,
        billId: locked,
        tableId: null,
        amount: NonNegativeInteger(5_900),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId },
      })
    )
    await run.ok(
      appendBillLines([
        {
          billId: locked,
          deviceId: null,
          catalogItemId: coffee,
          itemId: lockedCoffee.itemId,
          type: "catalogItem",
          kind: "remove",
          quantity: PositiveNumber(1),
          totalAmount: NonNegativeInteger(5_900),
        },
      ])
    )
    await expect(run(closeZeroBill(locked))).resolves.toMatchObject({
      ok: false,
      error: { type: "BillLocked" },
    })

    for (const billId of [empty, emptied, priced, tipped, locked]) {
      await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("open")
    }
  }, 15_000)

  test("a bill finished at zero stays closed and reads underpaid when another device adds a line", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const water = await createItem(deps, "Tap water", 0)
    const billId = await createOpenBill(deps)
    await addItem(deps, billId, water)
    await run.orThrow(closeZeroBill(billId))

    // A device that had not yet seen the bill closed adds a coffee to it.
    const coffee = await run.ok(
      createOrReuseItemSnapshot(
        createStandaloneItemSnapshot({
          catalogItemId: null,
          name: NonEmptyString255("Coffee"),
          description: null,
          currency: "CZK",
          unitAmount: NonNegativeInteger(5_900),
          taxRateId: null,
        })
      )
    )
    await run.ok(
      appendBillLines([
        {
          billId,
          deviceId: null,
          catalogItemId: null,
          itemId: coffee.id,
          type: "manualAmount",
          kind: "add",
          quantity: PositiveNumber(1),
          totalAmount: NonNegativeInteger(5_900),
        },
      ])
    )

    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")
    await expect(run.ok(loadBillCoverage(billId))).resolves.toEqual({
      billTotal: 5_900,
      claimedSum: 0,
      coverage: "underpaid",
    })
    await expect.poll(() => run.ok(listOpenBills())).toEqual([])
  }, 15_000)
})

describe("cart writes on a partly paid bill", () => {
  /**
   * A bill of a 2 000 dinner and a 1 000 dessert, `paid` of it settled in
   * cash: open, partly paid, and editable again once the payment is in. Hands
   * back the dessert's line, the one the tests take off.
   */
  const createPartlyPaidBill = async (
    deps: EvoluDep & EvoluOwnerDep & DateDep,
    paid: number
  ) => {
    await using run = testCreateRun(deps)
    const billId = await createOpenBill(deps)
    await addChargeableLine(deps, billId, 2_000)
    const dessert = await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Dessert"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(1_000),
      })
    )
    const accountId = await run.ok(
      createAccount({
        deviceId: null,
        name: NonEmptyString255("Cash register"),
        cashRegister: { currency: "CZK" },
      })
    )
    const paymentId = await run.orThrow(
      createPayment({
        deviceId: null,
        billId,
        tableId: null,
        amount: NonNegativeInteger(paid),
        currency: "CZK",
        tipAmount: NonNegativeInteger(0),
        canceledAt: null,
        expiresAt: null,
        cashRegister: { accountId },
      })
    )
    await run.orThrow(markPaymentPaidCash({ paymentId, accountId }))
    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("open")

    return { billId, dessert }
  }

  test("taking off the line a partly paid bill was waiting on closes it and takes it off the floor view", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { billId, dessert } = await createPartlyPaidBill(deps, 2_000)

    await expect(
      run(
        appendRemoveBillLine({
          billId,
          deviceId: null,
          quantity: dessert.quantity,
          totalAmount: dessert.totalAmount,
          lineSummary: dessert,
        })
      )
    ).resolves.toEqual({ ok: true, value: null })

    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")
    await expect
      .poll(() => evolu.loadQuery(billByIdQuery(billId)))
      .toMatchObject([{ id: billId, closedAt: testFixedDate.getTime() }])
    await expect.poll(() => run.ok(listOpenBills())).toEqual([])
  }, 15_000)

  test("a cart-level append (undo, redo, clear) closes a bill it pays off the same way", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { billId, dessert } = await createPartlyPaidBill(deps, 2_000)

    await expect(
      run(
        appendGuardedBillLines(billId, [
          {
            billId,
            deviceId: null,
            catalogItemId: dessert.catalogItemId,
            itemId: dessert.itemId,
            type: dessert.type,
            kind: "remove",
            quantity: dessert.quantity,
            totalAmount: dessert.totalAmount,
          },
        ])
      )
    ).resolves.toMatchObject({ ok: true })

    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")
    await expect
      .poll(() => evolu.loadQuery(billByIdQuery(billId)))
      .toMatchObject([{ id: billId, closedAt: testFixedDate.getTime() }])
  }, 15_000)

  test("refuses a write that would take a partly paid bill below what was paid", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { billId, dessert } = await createPartlyPaidBill(deps, 2_500)
    const before = await run.ok(loadCalculatedBillLineSummaries(billId))

    const refused = {
      ok: false,
      error: {
        type: "BillTotalBelowPaid",
        id: billId,
        billTotalAfter: 2_000,
        claimedSum: 2_500,
      },
    }
    await expect(
      run(
        appendRemoveBillLine({
          billId,
          deviceId: null,
          quantity: dessert.quantity,
          totalAmount: dessert.totalAmount,
          lineSummary: dessert,
        })
      )
    ).resolves.toMatchObject(refused)
    // Clearing the cart takes every line off.
    await expect(
      run(
        appendGuardedBillLines(
          billId,
          before.map((summary) => ({
            billId,
            deviceId: null,
            catalogItemId: summary.catalogItemId,
            itemId: summary.itemId,
            type: summary.type,
            kind: "remove" as const,
            quantity: summary.quantity,
            totalAmount: summary.totalAmount,
          }))
        )
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "BillTotalBelowPaid", billTotalAfter: 0 },
    })

    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("open")
    await expect(
      run.ok(loadCalculatedBillLineSummaries(billId))
    ).resolves.toEqual(before)
    await expect
      .poll(() => evolu.loadQuery(billByIdQuery(billId)))
      .toMatchObject([{ id: billId, closedAt: null }])
  }, 15_000)

  test("refuses a split that would take a partly paid source below what was paid, and closes one it pays off", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const overpaid = await createPartlyPaidBill(deps, 2_500)
    const target = await createOpenBill(deps, { displayNumber: 2 })
    const newBillId = createRandomBillId()

    await expect(
      run(
        splitBill({
          sourceBillId: overpaid.billId,
          targetBillId: target,
          items: [overpaid.dessert],
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "BillTotalBelowPaid", id: overpaid.billId },
    })
    await expect(
      run(
        splitBillIntoNewBill({
          sourceBillId: overpaid.billId,
          targetBillId: newBillId,
          deviceId: null,
          tableId: null,
          currency: "CZK",
          items: [overpaid.dessert],
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "BillTotalBelowPaid", id: overpaid.billId },
    })
    // Nothing moved: the target is still empty and the new bill never written.
    await expect(
      run.ok(loadCalculatedBillLineSummaries(target))
    ).resolves.toEqual([])
    await expect(evolu.loadQuery(billByIdQuery(newBillId))).resolves.toEqual([])

    const paidOff = await createPartlyPaidBill(deps, 2_000)
    await expect(
      run(
        splitBillIntoNewBill({
          sourceBillId: paidOff.billId,
          targetBillId: newBillId,
          deviceId: null,
          tableId: null,
          currency: "CZK",
          items: [paidOff.dessert],
        })
      )
    ).resolves.toEqual({ ok: true, value: newBillId })

    await expect(run.orThrow(loadBillStatus(paidOff.billId))).resolves.toBe(
      "closed"
    )
    await expect(run.orThrow(loadBillStatus(newBillId))).resolves.toBe("open")
    await expect
      .poll(() => evolu.loadQuery(billByIdQuery(paidOff.billId)))
      .toMatchObject([
        { id: paidOff.billId, closedAt: testFixedDate.getTime() },
      ])
  }, 20_000)

  test("a discount that pays a partly paid bill off closes it; one below what was paid is refused", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const discount = await createDiscountItem(deps, -1_000)

    // 3 000 of goods, 2 000 paid: a 1 000 discount brings it to exactly that.
    const paidOff = await createPartlyPaidBill(deps, 2_000)
    await expect(
      run(
        addCatalogItemToBill({
          billId: paidOff.billId,
          deviceId: null,
          catalogItemId: discount,
          quantity: PositiveNumber(1),
          expectedDiscount: null,
        })
      )
    ).resolves.toMatchObject({
      ok: true,
      value: { line: { totalAmount: -1_000 } },
    })
    await expect(run.orThrow(loadBillStatus(paidOff.billId))).resolves.toBe(
      "closed"
    )
    await expect
      .poll(() => evolu.loadQuery(billByIdQuery(paidOff.billId)))
      .toMatchObject([
        { id: paidOff.billId, closedAt: testFixedDate.getTime() },
      ])

    // 2 500 paid: the same discount would leave 2 000, below it.
    const overpaid = await createPartlyPaidBill(deps, 2_500)
    await expect(
      run(
        addCatalogItemToBill({
          billId: overpaid.billId,
          deviceId: null,
          catalogItemId: discount,
          quantity: PositiveNumber(1),
          expectedDiscount: null,
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: {
        type: "BillTotalBelowPaid",
        billTotalAfter: 2_000,
        claimedSum: 2_500,
      },
    })
    await expect(run.orThrow(loadBillStatus(overpaid.billId))).resolves.toBe(
      "open"
    )
  }, 20_000)

  test("a bill nobody has paid for keeps behaving as before", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const billId = await createOpenBill(deps)
    const dinner = await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255("Dinner"),
        currency: "CZK",
        totalAmount: NonNegativeInteger(2_000),
      })
    )

    // Taking off its only line leaves an empty bill, open and on the floor.
    await expect(
      run(
        appendRemoveBillLine({
          billId,
          deviceId: null,
          quantity: dinner.quantity,
          totalAmount: dinner.totalAmount,
          lineSummary: dinner,
        })
      )
    ).resolves.toEqual({ ok: true, value: null })

    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("open")
    await expect
      .poll(() => evolu.loadQuery(billByIdQuery(billId)))
      .toMatchObject([{ id: billId, closedAt: null }])
    await expect
      .poll(() => run.ok(listOpenBills()))
      .toMatchObject([{ bill: { id: billId }, items: [] }])
  }, 15_000)
})

describe("bills with a discount", () => {
  /**
   * A bill of the goods given, one catalog item each, and a discount line of
   * `discount` x `discountQuantity`. Hands back every line by name.
   */
  const createDiscountedBill = async (
    deps: EvoluDep & EvoluOwnerDep & DateDep,
    {
      goods,
      discount,
      discountQuantity = 1,
      displayNumber = 1,
    }: {
      readonly goods: Readonly<Record<string, number>>
      readonly discount: number
      readonly discountQuantity?: number
      readonly displayNumber?: number
    }
  ) => {
    await using run = testCreateRun(deps)
    const billId = await createOpenBill(deps, { displayNumber })
    const lines = new Map<string, BillLineSummary>()
    for (const [name, unitAmount] of Object.entries(goods)) {
      const itemId = await run.orThrow(
        createCatalogItem({
          deviceId: null,
          categoryId: null,
          name: NonEmptyString255(name),
          description: null,
          currency: "CZK",
          unitAmount: Integer(unitAmount),
          sortOrder: NonNegativeInteger(10),
          scanCode: null,
        })
      )
      const { summary } = await run.orThrow(
        addCatalogItemToBill({
          billId,
          deviceId: null,
          catalogItemId: itemId,
          quantity: PositiveNumber(1),
          expectedDiscount: null,
        })
      )
      lines.set(name, summary)
    }
    const { summary: discountLine } = await run.orThrow(
      addCatalogItemToBill({
        billId,
        deviceId: null,
        catalogItemId: await createDiscountItem(deps, discount),
        quantity: PositiveNumber(discountQuantity),
        expectedDiscount: null,
      })
    )
    lines.set("discount", discountLine)

    const line = (name: string): BillLineSummary => {
      const summary = lines.get(name)
      if (summary === undefined) throw new Error(`No line ${name}.`)
      return summary
    }
    return { billId, line }
  }

  test("nets below zero, reads paid rather than overpaid, and is taken off and added again", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { billId, line } = await createDiscountedBill(deps, {
      goods: { Coffee: 1_000 },
      discount: -1_500,
    })
    const discount = line("discount")
    expect(discount).toMatchObject({ quantity: 1, totalAmount: -1_500 })

    // Below zero and nobody paid: owed nothing, so not overpaid, and open.
    await expect(run.ok(loadBillCoverage(billId))).resolves.toEqual({
      billTotal: -500,
      claimedSum: 0,
      coverage: "paid",
    })
    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("open")

    await run.orThrow(
      appendRemoveBillLine({
        billId,
        deviceId: null,
        quantity: discount.quantity,
        totalAmount: discount.totalAmount,
        lineSummary: discount,
      })
    )
    await expect(run.ok(loadBillCoverage(billId))).resolves.toMatchObject({
      billTotal: 1_000,
    })

    await run.orThrow(
      appendGuardedBillLines(billId, [
        {
          billId,
          deviceId: null,
          catalogItemId: discount.catalogItemId,
          itemId: discount.itemId,
          type: discount.type,
          kind: "add",
          quantity: discount.quantity,
          totalAmount: discount.totalAmount,
        },
      ])
    )
    await expect(
      run.ok(loadCalculatedBillLineSummaries(billId))
    ).resolves.toMatchObject([
      { name: "Coffee", totalAmount: 1_000 },
      { name: "Discount", quantity: 1, totalAmount: -1_500 },
    ])

    // It can only be discarded (payment/0015): not finished, but canceled.
    await expect(run(closeZeroBill(billId))).resolves.toMatchObject({
      ok: false,
      error: { type: "BillNotZero", reason: "totalNotZero", billTotal: -500 },
    })
    await run.orThrow(cancelBill(billId))
    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("canceled")
  }, 20_000)

  test("moves a discount with its goods, a part of a discount line included", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { billId, line } = await createDiscountedBill(deps, {
      goods: { Coffee: 1_000, Cake: 1_500 },
      discount: -200,
      discountQuantity: 2,
    })
    const target = await createOpenBill(deps, { displayNumber: 2 })

    // One of the two discount units moves with the cake: −200 is less than
    // the −400 the line holds, though it is the larger number.
    await expect(
      run(
        splitBill({
          sourceBillId: billId,
          targetBillId: target,
          items: [
            line("Cake"),
            {
              ...line("discount"),
              quantity: PositiveNumber(1),
              totalAmount: Integer(-200),
            },
          ],
        })
      )
    ).resolves.toMatchObject({
      ok: true,
      value: { sourceCanceled: false },
    })

    await expect(run.ok(loadBillCoverage(billId))).resolves.toMatchObject({
      billTotal: 800,
    })
    await expect(run.ok(loadBillCoverage(target))).resolves.toMatchObject({
      billTotal: 1_300,
    })
    // Both lines land in one batch, so their order is not fixed.
    const targetLines = await run.ok(loadCalculatedBillLineSummaries(target))
    expect(targetLines).toHaveLength(2)
    expect(targetLines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Cake", totalAmount: 1_500 }),
        expect.objectContaining({
          name: "Discount",
          quantity: 1,
          totalAmount: -200,
        }),
      ])
    )
  }, 20_000)

  test("refuses a split that leaves a bill with lines below zero, and lets one left at exactly zero through", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { billId, line } = await createDiscountedBill(deps, {
      goods: { Coffee: 1_000, Tea: 500 },
      discount: -500,
    })
    const target = await createOpenBill(deps, { displayNumber: 2 })
    const newBillId = createRandomBillId()

    // The goods leave, the discount stays behind: the source would be −500.
    const goodsOnly = [line("Coffee"), line("Tea")]
    const sourceRefused = {
      ok: false,
      error: {
        type: "BillSplitTotalNegative",
        id: billId,
        billTotalAfter: -500,
      },
    }
    await expect(
      run(
        splitBill({
          sourceBillId: billId,
          targetBillId: target,
          items: goodsOnly,
        })
      )
    ).resolves.toEqual(sourceRefused)
    await expect(
      run(
        splitBillIntoNewBill({
          sourceBillId: billId,
          targetBillId: newBillId,
          deviceId: null,
          tableId: null,
          currency: "CZK",
          items: goodsOnly,
        })
      )
    ).resolves.toEqual(sourceRefused)

    // The discount alone leaves: the bill it lands on would be −500.
    await expect(
      run(
        splitBill({
          sourceBillId: billId,
          targetBillId: target,
          items: [line("discount")],
        })
      )
    ).resolves.toEqual({
      ok: false,
      error: {
        type: "BillSplitTotalNegative",
        id: target,
        billTotalAfter: -500,
      },
    })
    await expect(
      run(
        splitBillIntoNewBill({
          sourceBillId: billId,
          targetBillId: newBillId,
          deviceId: null,
          tableId: null,
          currency: "CZK",
          items: [line("discount")],
        })
      )
    ).resolves.toEqual({
      ok: false,
      error: {
        type: "BillSplitTotalNegative",
        id: newBillId,
        billTotalAfter: -500,
      },
    })

    // Nothing moved and the new bill was never written.
    await expect(run.ok(loadBillCoverage(billId))).resolves.toMatchObject({
      billTotal: 1_000,
    })
    await expect(
      run.ok(loadCalculatedBillLineSummaries(target))
    ).resolves.toEqual([])
    await expect(evolu.loadQuery(billByIdQuery(newBillId))).resolves.toEqual([])

    // The coffee leaves, the tea and its discount stay at exactly zero: fine,
    // that bill can be finished.
    await expect(
      run(
        splitBillIntoNewBill({
          sourceBillId: billId,
          targetBillId: newBillId,
          deviceId: null,
          tableId: null,
          currency: "CZK",
          items: [line("Coffee")],
        })
      )
    ).resolves.toEqual({ ok: true, value: newBillId })
    await expect(run.ok(loadBillCoverage(billId))).resolves.toMatchObject({
      billTotal: 0,
    })
    await run.orThrow(closeZeroBill(billId))
    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")
  }, 20_000)

  test("moving every line, the discount with them, empties and cancels the source", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const { billId, line } = await createDiscountedBill(deps, {
      goods: { Coffee: 1_000 },
      discount: -300,
    })
    const target = await createOpenBill(deps, { displayNumber: 2 })

    await expect(
      run(
        splitBill({
          sourceBillId: billId,
          targetBillId: target,
          items: [line("Coffee"), line("discount")],
        })
      )
    ).resolves.toMatchObject({ ok: true, value: { sourceCanceled: true } })
    await expect(run.ok(loadBillCoverage(target))).resolves.toMatchObject({
      billTotal: 700,
    })
  }, 20_000)

  test("refuses adding an item whose price became a discount, or stopped being one, since the cart saw it (access/0012)", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)
    const billId = await createOpenBill(deps)
    const discountId = await createDiscountItem(deps, -500)
    const add = (
      catalogItemId: CatalogItemId,
      expectedDiscount: boolean | null
    ) =>
      run(
        addCatalogItemToBill({
          billId,
          deviceId: null,
          catalogItemId,
          quantity: PositiveNumber(1),
          expectedDiscount,
        })
      )

    // The cart saw a plain item, so it asked for no `discard`.
    await expect(add(discountId, false)).resolves.toEqual({
      ok: false,
      error: {
        type: "CatalogItemPriceSignStale",
        id: discountId,
        expectedDiscount: false,
      },
    })

    // A device that knows no sign rule turns the item positive meanwhile.
    evolu.update("catalogItem", { id: discountId, unitAmount: Integer(500) })
    await expect
      .poll(() => evolu.loadQuery(catalogItemByIdQuery(discountId)))
      .toMatchObject([{ unitAmount: 500 }])
    await expect(add(discountId, true)).resolves.toEqual({
      ok: false,
      error: {
        type: "CatalogItemPriceSignStale",
        id: discountId,
        expectedDiscount: true,
      },
    })
    await expect(
      run.ok(loadCalculatedBillLineSummaries(billId))
    ).resolves.toEqual([])

    // Seen as it is, or by a caller that checks no permission, it is added.
    await expect(add(discountId, false)).resolves.toMatchObject({ ok: true })
    await expect(add(discountId, null)).resolves.toMatchObject({ ok: true })
    await expect(
      run.ok(loadCalculatedBillLineSummaries(billId))
    ).resolves.toMatchObject([{ quantity: 2, totalAmount: 1_000 }])
  }, 20_000)
})
