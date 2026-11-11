import { ok, sqliteTrue, type Task } from "@evolu/common"
import type { EvoluOwnerDep } from "@payky/core/deps"
import {
  createCatalogItem,
  updateCatalogItem,
} from "@payky/core/modules/catalog-item/catalog-item-actions"
import {
  catalogItemByIdQuery,
  catalogItemsQuery,
} from "@payky/core/modules/catalog-item/catalog-item-queries"
import { CatalogItemId } from "@payky/core/modules/catalog-item/catalog-item-types"
import type { EvoluDep } from "@payky/core/modules/shared/evolu-deps"
import { removeUndefinedValues } from "@payky/core/modules/shared/evolu-utils"
import {
  FiatCurrencySchema,
  IntegerFromStringSchema,
  NonEmptyString255Schema,
  NonNegativeIntegerFromStringSchema,
} from "@payky/core/modules/shared/schema"
import { type Command, createCommand } from "commander"
import { zodCommand } from "zod-commander/zod4"

export const registerCatalogItemsCommand =
  (program: Command): Task<void, never, EvoluDep & EvoluOwnerDep> =>
  (run) => {
    const { evolu } = run.deps

    const catalogItemsCommand = createCommand("catalog-items").description(
      "Manage reusable catalog items for bills."
    )

    catalogItemsCommand

      .addCommand(
        zodCommand({
          name: "list",
          description: "List active catalog items.",
          args: {},
          opts: {},
          async action() {
            const results = await evolu.loadQuery(catalogItemsQuery)
            console.table(results)
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "create",
          description:
            "Create a catalog item. A negative unit amount creates a discount, which takes no tax rate; whether an item is a discount cannot be changed later (catalog/0002).",
          args: {},
          opts: {
            name: NonEmptyString255Schema.describe("n;Item name"),
            currency: FiatCurrencySchema.describe("c;Item currency"),
            unitAmount: IntegerFromStringSchema.describe(
              "a;Unit amount in minor units; negative for a discount"
            ),
            sortOrder: NonNegativeIntegerFromStringSchema.describe(
              "s;Sort order for menu display"
            ),
            description: NonEmptyString255Schema.optional().describe(
              "Optional item description"
            ),
            internalName: NonEmptyString255Schema.optional().describe(
              "Optional staff-only name, shown instead of the public name"
            ),
            internalDescription: NonEmptyString255Schema.optional().describe(
              "Optional staff-only description"
            ),
            sku: NonEmptyString255Schema.optional().describe(
              "Optional SKU / internal code"
            ),
          },
          async action(_, options) {
            const data = {
              name: options.name,
              ...(options.description
                ? { description: options.description }
                : {}),
              ...(options.internalName
                ? { internalName: options.internalName }
                : {}),
              ...(options.internalDescription
                ? { internalDescription: options.internalDescription }
                : {}),
              ...(options.sku ? { sku: options.sku } : {}),
              currency: options.currency,
              unitAmount: options.unitAmount,
              sortOrder: options.sortOrder,
            }

            const id = await run.orThrow(createCatalogItem(data))
            run.deps.console.log(
              `Inserted catalogItem ${id}: ${JSON.stringify({
                id: id,
                ...data,
              })}`
            )
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "get",
          description: "Show one catalog item by id.",
          args: {},
          opts: {
            id: CatalogItemId.describe("Catalog item id"),
          },
          async action(_, options) {
            const results = await evolu.loadQuery(
              catalogItemByIdQuery(options.id)
            )
            console.table(results)
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "update",
          description:
            "Update a catalog item. A new unit amount must keep the sign of the old one: a discount stays a discount (catalog/0002).",
          args: {},
          opts: {
            id: CatalogItemId.describe("Catalog item id"),
            name: NonEmptyString255Schema.optional().describe("n;Item name"),
            currency: FiatCurrencySchema.optional().describe("c;Item currency"),
            unitAmount: IntegerFromStringSchema.optional().describe(
              "a;Unit amount in minor units; negative for a discount"
            ),
            sortOrder: NonNegativeIntegerFromStringSchema.optional().describe(
              "s;Sort order for menu display"
            ),
            description: NonEmptyString255Schema.optional().describe(
              "Optional item description"
            ),
            internalName: NonEmptyString255Schema.optional().describe(
              "Optional staff-only name, shown instead of the public name"
            ),
            internalDescription: NonEmptyString255Schema.optional().describe(
              "Optional staff-only description"
            ),
            sku: NonEmptyString255Schema.optional().describe(
              "Optional SKU / internal code"
            ),
          },
          async action(_, options) {
            run.deps.console.log("Updating catalogItem", options.id)
            await run.orThrow(updateCatalogItem(removeUndefinedValues(options)))
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "delete",
          description: "Soft delete a catalog item.",
          args: {},
          opts: {
            id: CatalogItemId.describe("Catalog item id"),
          },
          async action(_, options) {
            run.deps.console.log("Deleting catalogItem", options.id)
            await run.orThrow(
              updateCatalogItem({
                id: options.id,
                isDeleted: sqliteTrue,
              })
            )
          },
        })
      )

    program.addCommand(catalogItemsCommand)
    return ok(undefined)
  }
