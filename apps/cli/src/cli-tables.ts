import { ok, type Task } from "@evolu/common"
import type { EvoluOwnerDep } from "@payky/core/deps"
import { DeviceId } from "@payky/core/modules/device/device-types"
import type { EvoluDep } from "@payky/core/modules/shared/evolu-deps"
import { removeUndefinedValues } from "@payky/core/modules/shared/evolu-utils"
import {
  NonEmptyString255Schema,
  NonNegativeIntegerFromStringSchema,
  PositiveIntegerFromStringSchema,
} from "@payky/core/modules/shared/schema"
import {
  createTable,
  deleteTable,
  updateTable,
} from "@payky/core/modules/table/table-actions"
import {
  tableByIdQuery,
  tablesQuery,
} from "@payky/core/modules/table/table-queries"
import { TableId } from "@payky/core/modules/table/table-types"
import { generateTableCode } from "@payky/core/modules/table/table-utils"
import { type Command, createCommand } from "commander"
import { z } from "zod"
import { zodCommand } from "zod-commander/zod4"

/** A seat count, or 'null' for a table without one (catalog/0008). */
const SeatCountOptionSchema = z.string().transform((value, ctx) => {
  const trimmed = value.trim()
  if (trimmed === "null") return null

  const parsed = PositiveIntegerFromStringSchema.safeParse(trimmed)
  if (!parsed.success) {
    ctx.addIssue({
      code: "custom",
      message: "Expected a whole number above zero or 'null'.",
    })
    return z.NEVER
  }

  return parsed.data
})

export const registerTablesCommand =
  (program: Command): Task<void, never, EvoluDep & EvoluOwnerDep> =>
  (run) => {
    const { evolu } = run.deps

    const tablesCommand = createCommand("tables").description(
      "Manage restaurant tables."
    )

    tablesCommand

      .addCommand(
        zodCommand({
          name: "list",
          description: "List active tables.",
          args: {},
          opts: {},
          async action() {
            console.table(await evolu.loadQuery(tablesQuery))
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "get",
          description: "Show one table by id.",
          args: {},
          opts: {
            id: TableId.describe("Table id"),
          },
          async action(_, options) {
            console.table(await evolu.loadQuery(tableByIdQuery(options.id)))
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "create",
          description: "Create a table.",
          args: {},
          opts: {
            name: NonEmptyString255Schema.describe("n;Table name"),
            seatCount: PositiveIntegerFromStringSchema.optional().describe(
              "p;Seat count (none if omitted)"
            ),
            sortOrder:
              NonNegativeIntegerFromStringSchema.describe("s;Sort order"),
            code: NonEmptyString255Schema.optional().describe(
              "Table code (generated if omitted); reserved for a future QR code, not used yet"
            ),
            deviceId: DeviceId.optional().describe(
              "Device id that created the table"
            ),
          },
          async action(_, options) {
            const data = {
              deviceId: options.deviceId ?? null,
              name: options.name,
              seatCount: options.seatCount ?? null,
              code: options.code ?? generateTableCode(),
              sortOrder: options.sortOrder,
            }

            const id = await run.ok(createTable(data))
            run.deps.console.log(
              `Inserted table ${id}: ${JSON.stringify({ id, ...data })}`
            )
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "update",
          description:
            "Update a table. Use --seat-count null to clear the seat count.",
          args: {},
          opts: {
            id: TableId.describe("Table id"),
            name: NonEmptyString255Schema.optional().describe("n;Table name"),
            seatCount: SeatCountOptionSchema.optional().describe(
              "p;Seat count, or 'null' to clear it"
            ),
            sortOrder:
              NonNegativeIntegerFromStringSchema.optional().describe(
                "s;Sort order"
              ),
            deviceId: DeviceId.optional().describe(
              "Device id that updated the table"
            ),
          },
          async action(_, options) {
            await run.ok(updateTable(removeUndefinedValues(options)))
            run.deps.console.log(`Updated table ${options.id}`)
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "delete",
          description: "Soft delete a table.",
          args: {},
          opts: {
            id: TableId.describe("Table id"),
          },
          async action(_, options) {
            await run.orThrow(deleteTable(options.id))
            run.deps.console.log(`Deleted table ${options.id}`)
          },
        })
      )

    program.addCommand(tablesCommand)
    return ok(undefined)
  }
