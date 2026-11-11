import { testCreateRun } from "@evolu/common"
import { catalogItemsQuery } from "@payky/core/modules/catalog-item/catalog-item-queries"
import { setLegalEntity } from "@payky/core/modules/legal-entity/legal-entity-actions"
import { createEvoluTest } from "@payky/core/testing/evolu"
import { evoluTestDeps } from "@payky/core/testing/evolu-deps"
import { Command } from "commander"
import { describe, expect, test } from "vitest"
import { registerCatalogItemsCommand } from "./cli-catalog-items.ts"

const setUp = async () => {
  const testEvolu = await createEvoluTest()
  const run = testCreateRun(evoluTestDeps(testEvolu.evolu))
  await run.ok(setLegalEntity({ country: "CZ", vatPayer: false }))
  const program = new Command().exitOverride()
  // Called with the root run, as `cli.ts` does: a child run would be
  // disposed before the command's action runs.
  registerCatalogItemsCommand(program)(run)
  const cli = (...args: ReadonlyArray<string>) =>
    program.parseAsync(["catalog-items", ...args], { from: "user" })
  return { testEvolu, run, cli }
}

describe("catalog-items create", () => {
  // catalog/0002: the CLI has no Discount switch; the sign is the amount's.
  test.each([
    ["as the option's next argument", ["--unitAmount", "-500"]],
    ["attached to the option", ["--unitAmount=-500"]],
    ["after the short flag", ["-a", "-500"]],
  ])(
    "a negative unit amount %s creates a discount",
    async (_label, amount) => {
      const { testEvolu, run, cli } = await setUp()
      await using _evolu = testEvolu
      await using _run = run

      await cli(
        "create",
        "--name",
        "Loyalty discount",
        "--currency",
        "CZK",
        ...amount,
        "--sortOrder",
        "0"
      )

      await expect
        .poll(() => testEvolu.evolu.loadQuery(catalogItemsQuery))
        .toMatchObject([
          { name: "Loyalty discount", unitAmount: -500, taxRateId: null },
        ])
    },
    15_000
  )
})

describe("catalog-items update", () => {
  test("keeps the sign of a discount's amount, as the core does", async () => {
    const { testEvolu, run, cli } = await setUp()
    await using _evolu = testEvolu
    await using _run = run
    await cli(
      "create",
      "--name",
      "Loyalty discount",
      "--currency",
      "CZK",
      "--unitAmount",
      "-500",
      "--sortOrder",
      "0"
    )
    const [discount] = await testEvolu.evolu.loadQuery(catalogItemsQuery)
    if (discount === undefined) throw new Error("The discount was not created")

    await cli("update", "--id", discount.id, "--unitAmount", "-800")
    await expect
      .poll(() => testEvolu.evolu.loadQuery(catalogItemsQuery))
      .toMatchObject([{ id: discount.id, unitAmount: -800 }])

    await expect(
      cli("update", "--id", discount.id, "--unitAmount", "800")
    ).rejects.toMatchObject({ cause: { type: "CatalogItemPriceSignChange" } })
    expect(await testEvolu.evolu.loadQuery(catalogItemsQuery)).toMatchObject([
      { id: discount.id, unitAmount: -800 },
    ])
  }, 15_000)
})
