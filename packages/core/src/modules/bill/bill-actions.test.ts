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
import { createCatalogItem } from "../catalog-item/catalog-item-actions.ts"
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
  confirmBillClosedDespiteCancellation,
  createBill,
  createBillAtEnd,
  listOpenBills,
  removeTableFromBill,
  splitBill,
  splitBillIntoNewBill,
} from "./bill-actions.ts"
import { loadBill, loadBillCoverage, loadBillStatus } from "./bill-guards.ts"
import { billByIdQuery, openBillsQuery } from "./bill-queries.ts"
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
    const catalogItemId = await run.ok(
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

    const summary = await run.orThrow(
      addCatalogItemToBill({
        billId,
        deviceId: null,
        catalogItemId,
        quantity: PositiveNumber(0.7),
      })
    )

    expect(summary).toMatchObject({ quantity: 0.7, totalAmount: 1_399 })
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
    const catalogItemId = await run.ok(
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

    const catalogLineSummary = await run.orThrow(
      addCatalogItemToBill({
        billId,
        deviceId: null,
        catalogItemId,
        quantity: PositiveNumber(2),
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
    const catalogItemId = await run.ok(
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
    const lineSummary = await run.orThrow(
      addCatalogItemToBill({
        billId: sourceBillId,
        deviceId: null,
        catalogItemId,
        quantity: PositiveNumber(5),
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
    const overLine = await run.orThrow(
      addCatalogItemToBill({
        billId: overSourceBillId,
        deviceId: null,
        catalogItemId,
        quantity: PositiveNumber(4),
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

const openBillPaidInPart = async (deps: EvoluDep & EvoluOwnerDep & DateDep) => {
  await using run = testCreateRun(deps)
  const billId = await createOpenBill(deps)
  const accountId = await run.ok(
    createAccount({
      deviceId: null,
      name: NonEmptyString255("Cash register"),
      cashRegister: { currency: "CZK" },
    })
  )
  for (const [name, amount] of [
    ["Dinner", 1_000],
    ["Wine", 600],
  ] as const) {
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255(name),
        currency: "CZK",
        totalAmount: NonNegativeInteger(amount),
      })
    )
  }
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
  await run.orThrow(markPaymentPaidCash({ paymentId, accountId }))
  const summaries = await run.ok(loadCalculatedBillLineSummaries(billId))
  const wine = summaries.find(({ name }) => name === "Wine")
  if (wine === undefined) throw new Error("Expected the wine line.")
  return { billId, wine }
}

describe("a bill paid in part, once its unpaid line leaves", () => {
  test.each([
    {
      how: "removing it",
      leave: async (
        deps: EvoluDep & EvoluOwnerDep & DateDep,
        billId: BillId,
        wine: Awaited<ReturnType<typeof openBillPaidInPart>>["wine"]
      ) => {
        await using run = testCreateRun(deps)
        await run.orThrow(
          appendRemoveBillLine({
            billId,
            deviceId: null,
            lineSummary: wine,
            quantity: wine.quantity,
            totalAmount: wine.totalAmount,
          })
        )
      },
    },
    {
      how: "undoing it",
      leave: async (
        deps: EvoluDep & EvoluOwnerDep & DateDep,
        billId: BillId,
        wine: Awaited<ReturnType<typeof openBillPaidInPart>>["wine"]
      ) => {
        await using run = testCreateRun(deps)
        await run.orThrow(
          appendGuardedBillLines(billId, [
            {
              billId,
              deviceId: null,
              catalogItemId: wine.catalogItemId,
              itemId: wine.itemId,
              type: wine.type,
              kind: "remove",
              quantity: wine.quantity,
              totalAmount: wine.totalAmount,
            },
          ])
        )
      },
    },
    {
      how: "moving it to another bill",
      leave: async (
        deps: EvoluDep & EvoluOwnerDep & DateDep,
        billId: BillId,
        wine: Awaited<ReturnType<typeof openBillPaidInPart>>["wine"]
      ) => {
        const targetBillId = await createOpenBill(deps, { displayNumber: 2 })
        await using run = testCreateRun(deps)
        await run.orThrow(
          splitBill({ sourceBillId: billId, targetBillId, items: [wine] })
        )
      },
    },
    {
      how: "splitting it off",
      leave: async (
        deps: EvoluDep & EvoluOwnerDep & DateDep,
        billId: BillId,
        wine: Awaited<ReturnType<typeof openBillPaidInPart>>["wine"]
      ) => {
        await using run = testCreateRun(deps)
        await run.orThrow(
          splitBillIntoNewBill({
            deviceId: null,
            tableId: null,
            currency: "CZK",
            sourceBillId: billId,
            targetBillId: createRandomBillId(),
            items: [wine],
          })
        )
      },
    },
  ])(
    "closes on the floor view too after $how",
    async ({ leave }) => {
      await using testEvolu = await createEvoluTest()
      const { evolu } = testEvolu
      const deps = {
        ...evoluTestDeps(evolu),
        ...createTestDateDep(),
      } satisfies EvoluDep & EvoluOwnerDep & DateDep
      const { billId, wine } = await openBillPaidInPart(deps)

      await leave(deps, billId, wine)

      await using run = testCreateRun(deps)
      await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")
      await expect(
        evolu.loadQuery(billByIdQuery(billId))
      ).resolves.toMatchObject([{ closedAt: testFixedDate.getTime() }])
      expect(
        (await evolu.loadQuery(openBillsQuery)).map(({ id }) => id)
      ).not.toContain(billId)
    },
    15_000
  )
})

const openBillWithClaimedShare = async (
  deps: EvoluDep & EvoluOwnerDep & DateDep,
  lines: ReadonlyArray<readonly [string, number]>,
  claimed: number
) => {
  await using run = testCreateRun(deps)
  const billId = await createOpenBill(deps)
  const accountId = await run.ok(
    createAccount({
      deviceId: null,
      name: NonEmptyString255("Cash register"),
      cashRegister: { currency: "CZK" },
    })
  )
  for (const [name, amount] of lines) {
    await run.orThrow(
      addManualAmountToBill({
        billId,
        deviceId: null,
        name: NonEmptyString255(name),
        currency: "CZK",
        totalAmount: NonNegativeInteger(amount),
      })
    )
  }
  const paymentId = await run.orThrow(
    createPayment({
      deviceId: null,
      billId,
      tableId: null,
      amount: NonNegativeInteger(claimed),
      currency: "CZK",
      tipAmount: NonNegativeInteger(0),
      canceledAt: null,
      expiresAt: null,
      cashRegister: { accountId },
    })
  )
  await run.orThrow(markPaymentPaidCash({ paymentId, accountId }))
  return {
    billId,
    summaries: await run.ok(loadCalculatedBillLineSummaries(billId)),
  }
}

const createClaimedShareContext = async () => {
  const testEvolu = await createEvoluTest()
  return {
    evolu: testEvolu.evolu,
    deps: {
      ...evoluTestDeps(testEvolu.evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep,
    [Symbol.asyncDispose]: () => testEvolu[Symbol.asyncDispose](),
  }
}

describe("An edit that closes a bill writes its close", () => {
  test("Removal that leaves the bill paid exactly", async () => {
    await using context = await createClaimedShareContext()
    const { deps } = context
    const { billId, summaries } = await openBillWithClaimedShare(
      deps,
      [
        ["Soup", 5_000],
        ["Steak", 5_000],
      ],
      5_000
    )
    const steak = summaries.find(({ name }) => name === "Steak")
    if (steak === undefined) throw new Error("Expected the steak line.")
    await using run = testCreateRun(deps)

    await run.orThrow(
      appendRemoveBillLine({
        billId,
        deviceId: null,
        lineSummary: steak,
        quantity: steak.quantity,
        totalAmount: steak.totalAmount,
      })
    )

    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("closed")
    await expect(
      context.evolu.loadQuery(billByIdQuery(billId))
    ).resolves.toMatchObject([{ closedAt: testFixedDate.getTime() }])
  })
})

describe("A split keeps money with its lines", () => {
  test("Every line split off a paid share", async () => {
    await using context = await createClaimedShareContext()
    const { deps } = context
    const { billId, summaries } = await openBillWithClaimedShare(
      deps,
      [
        ["Soup", 250],
        ["Tea", 250],
      ],
      250
    )
    const otherBillId = await createOpenBill(deps, { displayNumber: 2 })
    const newBillId = createRandomBillId()
    await using run = testCreateRun(deps)

    await expect(
      run(
        splitBillIntoNewBill({
          deviceId: null,
          tableId: null,
          currency: "CZK",
          sourceBillId: billId,
          targetBillId: newBillId,
          items: summaries,
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: {
        type: "BillSplitLeavesOverpayment",
        claimedSum: 250,
        totalAfterSplit: 0,
      },
    })
    await expect(
      run(
        splitBill({
          sourceBillId: billId,
          targetBillId: otherBillId,
          items: summaries,
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: { type: "BillSplitLeavesOverpayment" },
    })
    await expect(
      run.ok(loadCalculatedBillLineSummaries(billId))
    ).resolves.toEqual(summaries)
    await expect(run.orThrow(loadBillStatus(billId))).resolves.toBe("open")
    await expect(
      context.evolu.loadQuery(billByIdQuery(newBillId))
    ).resolves.toEqual([])
    await expect(
      run.ok(loadCalculatedBillLineSummaries(otherBillId))
    ).resolves.toEqual([])
  })

  test("refuses a split that leaves more money than the lines that stay", async () => {
    await using context = await createClaimedShareContext()
    const { deps } = context
    const { billId, summaries } = await openBillWithClaimedShare(
      deps,
      [
        ["Dinner", 1_000],
        ["Wine", 600],
      ],
      1_000
    )
    const dinner = summaries.filter(({ name }) => name === "Dinner")
    await using run = testCreateRun(deps)

    await expect(
      run(
        splitBillIntoNewBill({
          deviceId: null,
          tableId: null,
          currency: "CZK",
          sourceBillId: billId,
          targetBillId: createRandomBillId(),
          items: dinner,
        })
      )
    ).resolves.toMatchObject({
      ok: false,
      error: {
        type: "BillSplitLeavesOverpayment",
        claimedSum: 1_000,
        totalAfterSplit: 600,
      },
    })
  })
})
