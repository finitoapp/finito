import { sqliteTrue, testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"

import type { DateDep, EvoluOwnerDep } from "../../deps.ts"
import { createQuery } from "../../evolu/schema.ts"
import { createTestDateDep } from "../../testing/date-dep.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import { cancelBill, createBillAtEnd } from "../bill/bill-actions.ts"
import { createRandomBillId } from "../bill/bill-types.ts"
import type { EvoluDep } from "../shared/evolu-deps.ts"
import {
  NonEmptyString255,
  NonNegativeInteger,
  PositiveInteger,
} from "../shared/schema.ts"
import {
  createTable,
  createTableAtEnd,
  deleteTable,
  listTables,
  regenerateTableSelfPayQr,
  updateTable,
} from "./table-actions.ts"
import { tableByIdQuery } from "./table-queries.ts"
import type { TableId } from "./table-types.ts"

const tableRecordByIdQuery = (id: TableId) =>
  createQuery((db) =>
    db
      .selectFrom("table")
      .select(["id", "deviceId", "name", "sortOrder", "isDeleted"])
      .where("id", "=", id)
  )

describe("table actions", () => {
  test("creates, updates, and soft deletes a table through real Evolu", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)

    const id = await run.ok(
      createTable({
        deviceId: null,
        name: NonEmptyString255("Main room"),
        seatCount: PositiveInteger(4),
        code: NonEmptyString255("ABCD1234"),
        sortOrder: NonNegativeInteger(10),
      })
    )

    await expect
      .poll(() => evolu.loadQuery(tableRecordByIdQuery(id)))
      .toMatchObject([
        {
          id,
          deviceId: null,
          name: "Main room",
          sortOrder: 10,
          isDeleted: null,
        },
      ])

    expect(
      await run.ok(
        updateTable({
          id,
          name: NonEmptyString255("Patio"),
          sortOrder: NonNegativeInteger(20),
        })
      )
    ).toBe(id)

    await expect
      .poll(() => evolu.loadQuery(tableRecordByIdQuery(id)))
      .toMatchObject([
        {
          id,
          name: "Patio",
          sortOrder: 20,
          isDeleted: null,
        },
      ])

    expect(
      await run.ok(
        updateTable({
          id,
          name: undefined,
          sortOrder: undefined,
        })
      )
    ).toBe(id)

    await expect
      .poll(() => evolu.loadQuery(tableRecordByIdQuery(id)))
      .toMatchObject([
        {
          id,
          name: "Patio",
          sortOrder: 20,
          isDeleted: null,
        },
      ])

    expect(await run.orThrow(deleteTable(id))).toBe(id)

    await expect
      .poll(() => evolu.loadQuery(tableRecordByIdQuery(id)))
      .toMatchObject([
        {
          id,
          name: "Patio",
          sortOrder: 20,
          isDeleted: sqliteTrue,
        },
      ])
  }, 15_000)

  test("refuses to delete a table while an open bill sits on it", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
      ...createTestDateDep(),
    } satisfies EvoluDep & EvoluOwnerDep & DateDep
    await using run = testCreateRun(deps)

    const tableId = await run.ok(
      createTable({
        deviceId: null,
        name: NonEmptyString255("Terrace"),
        seatCount: PositiveInteger(2),
        code: NonEmptyString255("TERRACE1"),
        sortOrder: NonNegativeInteger(10),
      })
    )
    const billId = await run.ok(
      createBillAtEnd({
        id: createRandomBillId(),
        deviceId: null,
        label: null,
        tableId,
        currency: "CZK",
      })
    )

    // The POS floor view renders non-deleted tables plus the bills with no
    // table at all, so deleting an occupied table would leave this bill with
    // no tile to reach it from.
    await expect(run(deleteTable(tableId))).resolves.toEqual({
      ok: false,
      error: { type: "TableHasOpenBills", id: tableId, openBillCount: 1 },
    })

    await run.orThrow(cancelBill(billId))

    await expect(run(deleteTable(tableId))).resolves.toEqual({
      ok: true,
      value: tableId,
    })
  }, 15_000)

  test("lists only active complete tables ordered by sort order", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)

    const secondId = await run.ok(
      createTable({
        deviceId: null,
        name: NonEmptyString255("Second"),
        seatCount: PositiveInteger(2),
        code: NonEmptyString255("SECOND01"),
        sortOrder: NonNegativeInteger(20),
      })
    )
    const firstId = await run.ok(
      createTable({
        deviceId: null,
        name: NonEmptyString255("First"),
        seatCount: PositiveInteger(2),
        code: NonEmptyString255("FIRST001"),
        sortOrder: NonNegativeInteger(10),
      })
    )
    const deletedId = await run.ok(
      createTable({
        deviceId: null,
        name: NonEmptyString255("Deleted"),
        seatCount: PositiveInteger(2),
        code: NonEmptyString255("DELETED1"),
        sortOrder: NonNegativeInteger(5),
      })
    )
    await run.orThrow(deleteTable(deletedId))

    await expect
      .poll(() => run.ok(listTables()))
      .toMatchObject([
        {
          id: firstId,
          name: "First",
          sortOrder: 10,
          isDeleted: null,
        },
        {
          id: secondId,
          name: "Second",
          sortOrder: 20,
          isDeleted: null,
        },
      ])
  }, 15_000)

  test("appends tables with an increasing sortOrder and a generated code", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    const deps = {
      ...evoluTestDeps(evolu),
    } satisfies EvoluDep & EvoluOwnerDep
    await using run = testCreateRun(deps)

    const firstId = await run.ok(
      createTableAtEnd({
        deviceId: null,
        name: NonEmptyString255("First"),
        seatCount: PositiveInteger(2),
      })
    )
    const secondId = await run.ok(
      createTableAtEnd({
        deviceId: null,
        name: NonEmptyString255("Second"),
        seatCount: PositiveInteger(4),
      })
    )

    await expect
      .poll(() => run.ok(listTables()))
      .toMatchObject([
        { id: firstId, sortOrder: 0 },
        { id: secondId, sortOrder: 1 },
      ])

    const [first, second] = await run.ok(listTables())
    expect(first?.code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/)
    expect(second?.code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/)
    expect(first?.code).not.toBe(second?.code)
  }, 15_000)

  test("moves a table's self-pay QR to the next epoch on every regeneration", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun({ evolu, evoluOwner: evolu.appOwner })
    const id = await run.ok(
      createTableAtEnd({
        deviceId: null,
        name: NonEmptyString255("Terrace"),
        seatCount: PositiveInteger(2),
        selfPayEnabled: 1,
      })
    )

    await run.ok(regenerateTableSelfPayQr({ id, selfPayEpoch: null }))
    await expect
      .poll(
        async () => (await evolu.loadQuery(tableByIdQuery(id)))[0]?.selfPayEpoch
      )
      .toBe(1)
    await run.ok(
      regenerateTableSelfPayQr({ id, selfPayEpoch: NonNegativeInteger(1) })
    )

    await expect
      .poll(
        async () => (await evolu.loadQuery(tableByIdQuery(id)))[0]?.selfPayEpoch
      )
      .toBe(2)
  })
})
