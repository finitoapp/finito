import { testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"

import type { EvoluOwnerDep } from "../../deps.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import { createBillAtEnd } from "../bill/bill-actions.ts"
import { latestBillsQuery } from "../bill/bill-queries.ts"
import { type BillId, createRandomBillId } from "../bill/bill-types.ts"
import type { BillLineRow } from "../bill-line/bill-line.ts"
import { appendBillLines } from "../bill-line/bill-line-actions.ts"
import type { PaymentId } from "../payment/payment-types.ts"
import { insertPaymentLineRows } from "../payment-line/payment-line-actions.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import { runMutationWithCompletion } from "../shared/evolu-utils.ts"
import type { ItemRow } from "./item.ts"
import { createOrReuseItemSnapshot } from "./item-actions.ts"
import { itemsByBillIdQuery, itemsByPaymentIdQuery } from "./item-queries.ts"
import { createStandaloneItemSnapshot } from "./item-utils.ts"

const snapshot = (name: string, unitAmount: number): ItemRow =>
  createStandaloneItemSnapshot({
    catalogItemId: null,
    name,
    description: null,
    currency: "CZK",
    unitAmount,
  } as Omit<ItemRow, "id">)

const line = (
  billId: BillId,
  item: ItemRow,
  totalAmount: number
): Omit<BillLineRow, "id"> =>
  ({
    billId,
    deviceId: null,
    catalogItemId: null,
    itemId: item.id,
    type: "catalogItem",
    kind: "add",
    quantity: 1,
    totalAmount,
  }) as Omit<BillLineRow, "id">

describe("scoped item queries", () => {
  test("itemsByBillIdQuery returns only the bill's own items", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)

    const billId = "bill-1" as BillId
    const otherBillId = "bill-2" as BillId
    const coffee = snapshot("Coffee", 5900)
    const tea = snapshot("Tea", 4200)
    await run.ok(createOrReuseItemSnapshot(coffee))
    await run.ok(createOrReuseItemSnapshot(tea))
    await run.ok(
      appendBillLines([
        line(billId, coffee, 5900),
        line(otherBillId, tea, 4200),
      ])
    )

    // `tea`'s snapshot exists and is on another bill: the point of the scope
    // is that it does not come back here.
    await expect(evolu.loadQuery(itemsByBillIdQuery(billId))).resolves.toEqual([
      expect.objectContaining({ id: coffee.id, name: "Coffee" }),
    ])
  }, 15_000)

  test("itemsByBillIdQuery returns a shared snapshot once, not once per line", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)

    const billId = "bill-1" as BillId
    const coffee = snapshot("Coffee", 5900)
    await run.ok(createOrReuseItemSnapshot(coffee))
    await run.ok(
      appendBillLines([
        line(billId, coffee, 5900),
        line(billId, coffee, 5900),
        line(billId, coffee, 5900),
      ])
    )

    await expect(
      evolu.loadQuery(itemsByBillIdQuery(billId))
    ).resolves.toHaveLength(1)
  }, 15_000)

  test("itemsByPaymentIdQuery resolves an item the bill no longer carries", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)

    const billId = "bill-1" as BillId
    const paymentId = "payment-1" as PaymentId
    const removed = snapshot("Removed cake", 7500)
    await run.ok(createOrReuseItemSnapshot(removed))

    // The payment froze a line for `removed`, but the bill never carries a
    // `billLine` for it — the line was taken off after the payment was made.
    // A bill-scoped item load would drop this row, and the diff would report
    // nothing instead of reporting the removal.
    await runMutationWithCompletion((options) =>
      insertPaymentLineRows(
        evolu,
        [
          {
            paymentId,
            billId,
            catalogItemId: null,
            itemId: removed.id,
            type: "catalogItem",
            quantity: 1,
            totalAmount: 7500,
            discountShare: null,
          } as Omit<Parameters<typeof insertPaymentLineRows>[1][number], never>,
        ],
        { ...options, owner: evolu.appOwner }
      )
    )

    await expect(evolu.loadQuery(itemsByBillIdQuery(billId))).resolves.toEqual(
      []
    )
    await expect(
      evolu.loadQuery(itemsByPaymentIdQuery(paymentId))
    ).resolves.toEqual([
      expect.objectContaining({ id: removed.id, name: "Removed cake" }),
    ])
  }, 15_000)

  test("latestBillsQuery embeds each bill's own item snapshots", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)

    const billId = createRandomBillId()
    const coffee = snapshot("Coffee", 5900)
    const tea = snapshot("Tea", 4200)
    await run.ok(createOrReuseItemSnapshot(coffee))
    await run.ok(createOrReuseItemSnapshot(tea))
    await run.ok(
      appendBillLines([line(billId, coffee, 5900), line(billId, tea, 4200)])
    )
    await run.ok(
      createBillAtEnd({
        id: billId,
        deviceId: null,
        label: null,
        tableId: null,
        currency: "CZK",
      })
    )

    const [billRow] = await evolu.loadQuery(latestBillsQuery(10))
    expect(billRow?.items.map((item) => item.name).sort()).toEqual([
      "Coffee",
      "Tea",
    ])
  }, 15_000)
})
