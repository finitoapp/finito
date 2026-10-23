import { createIdFromString } from "@evolu/common"
import { describe, expect, test } from "vitest"

import {
  NonEmptyStringSchema,
  NonNegativeInteger,
  PositiveNumber,
  TimestampMs,
} from "../shared/schema.ts"
import {
  deriveSelfPayLineKey,
  findOfferedSelfPayReferences,
  projectSelfPayConfirmations,
  projectSelfPayViewLine,
  sumSelfPayAllocationsByLineKey,
} from "./table-self-pay-projection-utils.ts"
import type { TableSelfPayConfirmationRow } from "./table-self-pay-queries.ts"
import {
  deriveBillSelfPayReference,
  deriveSelfPayPointerHash,
  SelfPayPointerSchema,
} from "./table-self-pay-reference-utils.ts"
import { remainingOnLine } from "./table-self-pay-share-utils.ts"

const version = 1_790_000_000
const pointer = SelfPayPointerSchema.decode("K7QF2MX4TB3QAWZR5HLCE6DN3PJ4YV2G")

const confirmation = (
  overrides: Partial<TableSelfPayConfirmationRow>
): TableSelfPayConfirmationRow =>
  ({
    billId: "bill-a",
    pointer,
    amount: 2020,
    currency: "CZK",
    claimedAt: version * 1000,
    closedAt: null,
    canceledAt: null,
    ...overrides,
  }) as TableSelfPayConfirmationRow

describe("projectSelfPayConfirmations", () => {
  test("shows an amount and a time, and only the pointer's hash", () => {
    expect(projectSelfPayConfirmations([confirmation({})])).toEqual([
      {
        pointerHash: deriveSelfPayPointerHash(pointer),
        amount: 2020,
        currency: "CZK",
        at: version,
      },
    ])
  })

  test("lists at most the newest twenty of a bill", () => {
    const rows = Array.from({ length: 25 }, () => confirmation({}))

    expect(projectSelfPayConfirmations(rows)).toHaveLength(20)
  })

  test("30 payments on bill B keep bill A's confirmation", () => {
    const billA = confirmation({
      amount: NonNegativeInteger(1000),
      claimedAt: TimestampMs((version - 60) * 1000),
    })
    const billB = Array.from({ length: 30 }, (_, index) =>
      confirmation({
        billId: "bill-b" as TableSelfPayConfirmationRow["billId"],
        claimedAt: TimestampMs((version - index) * 1000),
      })
    )

    const projected = projectSelfPayConfirmations([...billB, billA])

    expect(projected).toHaveLength(21)
    expect(projected.at(-1)?.amount).toBe(1000)
  })
})

describe("findOfferedSelfPayReferences", () => {
  test("offers every open bill whose reference is its own", () => {
    const bills = [
      { id: "bill-1", createdAt: "2026-06-05T10:00:00.000Z" },
      { id: "bill-2", createdAt: "2026-06-05T11:00:00.000Z" },
    ] as const

    const offered = findOfferedSelfPayReferences(
      bills as unknown as Parameters<typeof findOfferedSelfPayReferences>[0]
    )

    expect([...offered.entries()]).toEqual([
      ["bill-1", deriveBillSelfPayReference("bill-1")],
      ["bill-2", deriveBillSelfPayReference("bill-2")],
    ])
  })
})

describe("sumSelfPayAllocationsByLineKey", () => {
  test("adds up what guests paid of each line, a fifth of a pizza included", () => {
    const pizza = deriveSelfPayLineKey(
      "pizza" as Parameters<typeof deriveSelfPayLineKey>[0]
    )
    const beer = deriveSelfPayLineKey(
      "beer" as Parameters<typeof deriveSelfPayLineKey>[0]
    )

    const allocated = sumSelfPayAllocationsByLineKey([
      { lineKey: pizza, amount: 2020 },
      { lineKey: beer, amount: 4500 },
      { lineKey: pizza, amount: 2020 },
    ])

    expect(allocated.get(pizza)).toBe(4040)
    expect(allocated.get(beer)).toBe(4500)
    expect(pizza).toMatch(/^[A-Z2-7]{8}$/u)
  })
})

describe("projectSelfPayViewLine", () => {
  const pizzaId = createIdFromString<"BillLineSummary">("pizza")
  const line = (totalAmount: number) => ({
    id: pizzaId,
    name: NonEmptyStringSchema.decode("Pizza"),
    quantity: PositiveNumber(1),
    totalAmount: NonNegativeInteger(totalAmount),
  })
  const pizza = deriveSelfPayLineKey(pizzaId)
  const paidOf = (
    totalAmount: number,
    amounts: ReadonlyArray<number>
  ): { readonly paid: number; readonly remaining: number } => {
    const projected = projectSelfPayViewLine(
      line(totalAmount),
      sumSelfPayAllocationsByLineKey(
        amounts.map((amount) => ({ lineKey: pizza, amount }))
      )
    )
    return {
      paid: projected.allocatedAmount,
      remaining: remainingOnLine(projected),
    }
  }

  test("shows a line nobody paid as all remaining", () => {
    expect(paidOf(10_100, [])).toEqual({ paid: 0, remaining: 10_100 })
  })

  test("shows a fifth paid by a guest and the rest remaining", () => {
    expect(paidOf(10_100, [2020])).toEqual({ paid: 2020, remaining: 8080 })
  })

  test("shows a line split between two guests as paid in full", () => {
    expect(paidOf(4500, [2250, 2250])).toEqual({ paid: 4500, remaining: 0 })
  })

  test("caps the paid part at the line total when guests paid more", () => {
    expect(paidOf(4500, [3000, 3000])).toEqual({ paid: 4500, remaining: 0 })
  })
})
