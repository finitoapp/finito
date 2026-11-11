import { ok, type Task } from "@evolu/common"
import type { DateDep, EvoluOwnerDep } from "@payky/core/deps"
import {
  addCatalogItemToBill,
  addManualAmountToBill,
  addTipToBill,
  appendRemoveBillLine,
  assignBillToTable,
  cancelBill,
  closeBill,
  closeZeroBill,
  createBill,
  listOpenBills,
  removeTableFromBill,
  splitBill,
} from "@payky/core/modules/bill/bill-actions"
import { loadBill } from "@payky/core/modules/bill/bill-guards"
import { BillId } from "@payky/core/modules/bill/bill-types"
import { loadCalculatedBillLineSummaries } from "@payky/core/modules/bill-line/bill-line-actions"
import type { BillLineSummary } from "@payky/core/modules/bill-line/bill-line-summary"
import type { BillLineSummaryId } from "@payky/core/modules/bill-line/bill-line-types"
import { CatalogItemId } from "@payky/core/modules/catalog-item/catalog-item-types"
import { DeviceId } from "@payky/core/modules/device/device-types"
import type { EvoluDep } from "@payky/core/modules/shared/evolu-deps"
import {
  FiatCurrencySchema,
  IntegerFromStringSchema,
  NonEmptyString255Schema,
  NonNegativeIntegerFromStringSchema,
  PositiveIntegerFromStringSchema,
  PositiveNumberFromStringSchema,
} from "@payky/core/modules/shared/schema"
import { TableId } from "@payky/core/modules/table/table-types"
import { type Command, createCommand } from "commander"
import { z } from "zod"
import { zodCommand } from "zod-commander/zod4"
import { printCliError } from "./cli-errors.ts"

const LineSummaryIdsFromStringSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value, ctx): ReadonlyArray<BillLineSummary["id"]> => {
    const ids: Array<BillLineSummary["id"]> = []

    for (const rawId of value.split(",")) {
      const id = rawId.trim()
      if (id.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "Line summary id cannot be empty",
        })
        return z.NEVER
      }
      ids.push(id as BillLineSummaryId)
    }

    return ids
  })

const findLineSummary = (
  summaries: ReadonlyArray<BillLineSummary>,
  id: BillLineSummary["id"]
): BillLineSummary | null =>
  summaries.find((summary) => summary.id === id) ?? null

export const registerBillsCommand =
  (program: Command): Task<void, never, EvoluDep & EvoluOwnerDep & DateDep> =>
  (run) => {
    const billsCommand = createCommand("bills").description(
      "Manage bills and bill lines."
    )

    billsCommand

      .addCommand(
        zodCommand({
          name: "list-open",
          description: "List open bills with item counts and totals.",
          args: {},
          opts: {},
          async action() {
            const results = await run.ok(listOpenBills())

            console.table(
              results.map(({ bill, items }) => ({
                ...bill,
                itemCount: items.length,
                totalAmount: items.reduce(
                  (sum, item) => sum + item.totalAmount,
                  0
                ),
              }))
            )
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "get",
          description: "Show a bill and its calculated items.",
          args: {},
          opts: {
            id: BillId.describe("Bill id"),
          },
          async action(_, options) {
            const bill = await run.orThrow(loadBill(options.id))

            console.table([bill])
            console.table(
              await run.ok(loadCalculatedBillLineSummaries(options.id))
            )
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "create",
          description: "Create a bill.",
          args: {},
          opts: {
            displayNumber: PositiveIntegerFromStringSchema.describe(
              "n;Displayed bill number"
            ),
            currency: FiatCurrencySchema.describe("c;Bill currency"),
            deviceId: DeviceId.optional().describe(
              "Device id that created the bill"
            ),
            label: NonEmptyString255Schema.optional().describe("l;Bill label"),
            tableId: TableId.optional().describe("t;Table id"),
          },
          async action(_, options) {
            const data = {
              deviceId: options.deviceId ?? null,
              displayNumber: options.displayNumber,
              label: options.label ?? null,
              tableId: options.tableId ?? null,
              currency: options.currency,
            }

            const id = await run.ok(createBill(data))

            run.deps.console.log(
              `Inserted bill ${id}: ${JSON.stringify({ id, ...data })}`
            )
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "assign-table",
          description: "Assign a bill to a table.",
          args: {},
          opts: {
            id: BillId.describe("Bill id"),
            tableId: TableId.describe("t;Table id"),
          },
          async action(_, options) {
            await run.ok(assignBillToTable(options))
            run.deps.console.log(
              `Assigned bill ${options.id} to table ${options.tableId}`
            )
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "remove-table",
          description: "Remove the assigned table from a bill.",
          args: {},
          opts: {
            id: BillId.describe("Bill id"),
          },
          async action(_, options) {
            await run.ok(removeTableFromBill(options.id))
            run.deps.console.log(`Removed table from bill ${options.id}`)
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "add-catalog-item",
          description: "Add a catalog item to a bill.",
          args: {},
          opts: {
            billId: BillId.describe("Bill id"),
            catalogItemId: CatalogItemId.describe("Catalog item id"),
            quantity:
              PositiveNumberFromStringSchema.describe("q;Item quantity"),
            deviceId: DeviceId.optional().describe(
              "Device id that added the item"
            ),
          },
          async action(_, options) {
            const { summary } = await run.orThrow(
              addCatalogItemToBill({
                ...options,
                deviceId: options.deviceId ?? null,
                // The CLI checks no permission, so it expects no sign.
                expectedDiscount: null,
              })
            )

            console.table([summary])
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "add-manual-amount",
          description: "Add a manual amount line to a bill.",
          args: {},
          opts: {
            billId: BillId.describe("Bill id"),
            name: NonEmptyString255Schema.describe("n;Line item name"),
            currency: FiatCurrencySchema.describe("c;Line item currency"),
            totalAmount: NonNegativeIntegerFromStringSchema.describe(
              "a;Line total amount"
            ),
            deviceId: DeviceId.optional().describe(
              "Device id that added the line"
            ),
          },
          async action(_, options) {
            const lineSummary = await run.orThrow(
              addManualAmountToBill({
                ...options,
                deviceId: options.deviceId ?? null,
              })
            )

            console.table([lineSummary])
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "add-tip",
          description: "Add a tip line to a bill.",
          args: {},
          opts: {
            billId: BillId.describe("Bill id"),
            name: NonEmptyString255Schema.describe("n;Tip line name"),
            currency: FiatCurrencySchema.describe("c;Tip currency"),
            totalAmount:
              NonNegativeIntegerFromStringSchema.describe("a;Tip total amount"),
            deviceId: DeviceId.optional().describe(
              "Device id that added the tip"
            ),
          },
          async action(_, options) {
            const lineSummary = await run.orThrow(
              addTipToBill({
                ...options,
                deviceId: options.deviceId ?? null,
              })
            )

            console.table([lineSummary])
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "remove-item",
          description: "Append a removal line for a bill line summary.",
          args: {},
          opts: {
            billId: BillId.describe("Bill id"),
            lineSummaryId: z
              .string()
              .trim()
              .min(1)
              .transform((value) => value as BillLineSummaryId)
              .describe("Line summary id"),
            quantity: PositiveNumberFromStringSchema.describe(
              "q;Quantity to remove"
            ),
            // The line's own sign: a discount line is removed at a negative
            // amount.
            totalAmount: IntegerFromStringSchema.describe("a;Amount to remove"),
            deviceId: DeviceId.optional().describe(
              "Device id that removed the item"
            ),
          },
          async action(_, options) {
            const lineSummary = findLineSummary(
              await run.ok(loadCalculatedBillLineSummaries(options.billId)),
              options.lineSummaryId
            )
            if (lineSummary === null) {
              printCliError(
                run.deps.console,
                `Line summary not found: ${options.lineSummaryId}`
              )
              return
            }

            const updatedLineSummary = await run.orThrow(
              appendRemoveBillLine({
                billId: options.billId,
                deviceId: options.deviceId ?? null,
                lineSummary,
                quantity: options.quantity,
                totalAmount: options.totalAmount,
              })
            )

            console.table(
              updatedLineSummary === null ? [] : [updatedLineSummary]
            )
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "split",
          description:
            "Move selected bill line summaries from one bill to another.",
          args: {},
          opts: {
            sourceBillId: BillId.describe("Source bill id"),
            targetBillId: BillId.describe("Target bill id"),
            lineSummaryIds: LineSummaryIdsFromStringSchema.describe(
              "Comma-separated line summary ids"
            ),
          },
          async action(_, options) {
            const sourceItems = await run.ok(
              loadCalculatedBillLineSummaries(options.sourceBillId)
            )
            const selectedItems: BillLineSummary[] = []

            for (const id of options.lineSummaryIds) {
              const lineSummary = findLineSummary(sourceItems, id)
              if (lineSummary === null) {
                printCliError(run.deps.console, `Line summary not found: ${id}`)
                return
              }
              selectedItems.push(lineSummary)
            }

            const result = await run.orThrow(
              splitBill({
                sourceBillId: options.sourceBillId,
                targetBillId: options.targetBillId,
                items: selectedItems,
              })
            )

            console.table([result.bill])
            console.table(result.items)
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "cancel",
          description: "Cancel a bill.",
          args: {},
          opts: {
            id: BillId.describe("Bill id"),
          },
          async action(_, options) {
            await run.orThrow(cancelBill(options.id))
            run.deps.console.log(`Canceled bill ${options.id}`)
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "close",
          description:
            "Repair a paid bill's closedAt cache. Refuses a bill no payment covers; finish a zero bill with close-zero.",
          args: {},
          opts: {
            id: BillId.describe("Bill id"),
          },
          async action(_, options) {
            await run.orThrow(closeBill(options.id))
            run.deps.console.log(`Closed bill ${options.id}`)
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "close-zero",
          description:
            "Finish a bill whose goods come to exactly zero, without a payment (payment/0013).",
          args: {},
          opts: {
            id: BillId.describe("Bill id"),
          },
          async action(_, options) {
            await run.orThrow(closeZeroBill(options.id))
            run.deps.console.log(`Finished bill ${options.id}`)
          },
        })
      )

    program.addCommand(billsCommand)
    return ok(undefined)
  }
