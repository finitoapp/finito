import {
  createRun,
  evoluJsonArrayFrom,
  ok,
  type SqliteBoolean,
  sqliteFalse,
  sqliteTrue,
  type Task,
} from "@evolu/common"
import { createDateDep, type EvoluOwnerDep } from "@payky/core/deps"
import { createQuery } from "@payky/core/evolu/schema"
import {
  createFioApiDep,
  setFioLastDate,
} from "@payky/core/integrations/fio/fio-client"
import { AccountId } from "@payky/core/modules/account/account-types"
import {
  addFioPluginToken,
  deleteFioPlugin,
  loadFioPlugin,
  saveFioPlugin,
} from "@payky/core/modules/fio-plugin/fio-plugin-actions"
import { fioPluginTokensByPluginIdQuery } from "@payky/core/modules/fio-plugin/fio-plugin-queries"
import { FioPluginId } from "@payky/core/modules/fio-plugin/fio-plugin-types"
import type { EvoluDep } from "@payky/core/modules/shared/evolu-deps"
import {
  DateStringSchema,
  NonEmptyString255Schema,
  PositiveIntegerFromStringSchema,
} from "@payky/core/modules/shared/schema"
import { type Command, createCommand } from "commander"
import { z } from "zod"
import { zodCommand } from "zod-commander/zod4"
import { printCliError } from "./cli-errors.ts"
import { createFetchDep } from "./fetch.ts"

const SqliteBooleanFromStringSchema = z
  .enum(["true", "false", "1", "0"])
  .transform(
    (value): SqliteBoolean =>
      value === "true" || value === "1" ? sqliteTrue : sqliteFalse
  )

const fioPluginsWithTokensQuery = createQuery((db) =>
  db
    .selectFrom("fioPlugin")
    .select((eb) => [
      "fioPlugin.id",
      "fioPlugin.accountId",
      "fioPlugin.numberOfSecondsBetweenChecks",
      "fioPlugin.isActive",
      evoluJsonArrayFrom(
        eb
          .selectFrom("fioPluginToken")
          .select(["fioPluginToken.id", "fioPluginToken.token"])
          .whereRef("fioPluginToken.fioPluginId", "=", "fioPlugin.id")
          .where("fioPluginToken.token", "is not", null)
          .where("fioPluginToken.isDeleted", "is", null)
          .orderBy("fioPluginToken.createdAt")
      ).as("tokens"),
    ])
    .where("fioPlugin.accountId", "is not", null)
    .where("fioPlugin.numberOfSecondsBetweenChecks", "is not", null)
    .where("fioPlugin.isActive", "is not", null)
    .where("fioPlugin.isDeleted", "is", null)
    .orderBy("fioPlugin.createdAt", "desc")
)

const fioPluginWithTokensByIdQuery = (id: FioPluginId) =>
  createQuery((db) =>
    db
      .selectFrom("fioPlugin")
      .select((eb) => [
        "fioPlugin.id",
        "fioPlugin.accountId",
        "fioPlugin.numberOfSecondsBetweenChecks",
        "fioPlugin.isActive",
        "fioPlugin.isDeleted",
        evoluJsonArrayFrom(
          eb
            .selectFrom("fioPluginToken")
            .select([
              "fioPluginToken.id",
              "fioPluginToken.token",
              "fioPluginToken.isDeleted",
            ])
            .whereRef("fioPluginToken.fioPluginId", "=", "fioPlugin.id")
            .orderBy("fioPluginToken.createdAt")
        ).as("tokens"),
      ])
      .where("fioPlugin.id", "=", id)
  )

export const registerFioPluginsCommand =
  (program: Command): Task<void, never, EvoluDep & EvoluOwnerDep> =>
  (run) => {
    const { evolu } = run.deps

    const fioPluginsCommand = createCommand("fio-plugins").description(
      "Manage FIO API plugin settings."
    )

    fioPluginsCommand

      .addCommand(
        zodCommand({
          name: "list",
          description: "List active FIO plugin configurations.",
          args: {},
          opts: {},
          async action() {
            run.deps.console.log(
              JSON.stringify(
                await evolu.loadQuery(fioPluginsWithTokensQuery),
                null,
                2
              )
            )
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "get",
          description: "Show one FIO plugin configuration by id.",
          args: {},
          opts: {
            id: FioPluginId.describe("FIO plugin id"),
          },
          async action(_, options) {
            run.deps.console.log(
              JSON.stringify(
                await evolu.loadQuery(fioPluginWithTokensByIdQuery(options.id)),
                null,
                2
              )
            )
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "create",
          description: "Create a FIO plugin configuration.",
          args: {},
          opts: {
            accountId: AccountId.describe("a;IBAN account id"),
            numberOfSecondsBetweenChecks:
              PositiveIntegerFromStringSchema.describe(
                "i;Seconds between uses of one token; the plugin checks this often divided by its token count"
              ),
            isActive: SqliteBooleanFromStringSchema.describe(
              "x;Whether background sync is active"
            ),
          },
          async action(_, options) {
            const fioPluginId = await run.ok(
              saveFioPlugin({
                accountId: options.accountId,
                numberOfSecondsBetweenChecks:
                  options.numberOfSecondsBetweenChecks,
                isActive: options.isActive,
              })
            )

            run.deps.console.log(
              `Inserted FIO plugin ${fioPluginId}. Add a token with \`add-token\` before it will sync.`
            )
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "add-token",
          description:
            "Add a FIO API token to a plugin's rotation set. Re-adding the same token changes nothing.",
          args: {},
          opts: {
            id: FioPluginId.describe("FIO plugin id"),
            token: NonEmptyString255Schema.describe("t;FIO API token"),
          },
          async action(_, options) {
            await run.orThrow(loadFioPlugin(options.id))

            const tokenId = await run.ok(
              addFioPluginToken({
                fioPluginId: options.id,
                token: options.token,
              })
            )

            run.deps.console.log(`Added FIO plugin token ${tokenId}`)
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "save",
          description:
            "Create or update the Fio plugin configuration. There is one plugin, at a fixed id, and no row means it is off.",
          args: {},
          opts: {
            accountId: AccountId.describe("a;IBAN account id"),
            numberOfSecondsBetweenChecks:
              PositiveIntegerFromStringSchema.describe(
                "i;Seconds between uses of one token; the plugin checks this often divided by its token count"
              ),
            syncLookbackDays:
              PositiveIntegerFromStringSchema.optional().describe(
                "l;Days of history to re-check each sync"
              ),
            isActive: SqliteBooleanFromStringSchema.describe(
              "x;Whether background sync is active"
            ),
          },
          async action(_, options) {
            const savedId = await run.ok(
              saveFioPlugin({
                accountId: options.accountId,
                numberOfSecondsBetweenChecks:
                  options.numberOfSecondsBetweenChecks,
                syncLookbackDays: options.syncLookbackDays,
                isActive: options.isActive,
              })
            )

            run.deps.console.log(`Saved FIO plugin ${savedId}`)
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "set-cursor",
          description: "Set the FIO API last transaction cursor date.",
          args: {},
          opts: {
            id: FioPluginId.describe("FIO plugin id"),
            date: DateStringSchema.describe("Cursor date in YYYY-MM-DD format"),
          },
          async action(_, options) {
            await run.orThrow(loadFioPlugin(options.id))
            const tokens = await evolu.loadQuery(
              fioPluginTokensByPluginIdQuery(options.id)
            )
            const firstToken = tokens[0]
            if (firstToken === undefined) {
              printCliError(
                run.deps.console,
                `FIO plugin ${options.id} has no active token.`
              )
              return
            }

            // Its own run: the FIO dep carries this plugin's tokens, which
            // the root run cannot know when it is built.
            await using fioRun = createRun({
              console: run.deps.console,
              ...createFetchDep(),
              ...createDateDep(),
              ...createFioApiDep({
                tokens: [
                  firstToken.token,
                  ...tokens.slice(1).map((row) => row.token),
                ],
              }),
            })
            await fioRun.orThrow(setFioLastDate({ date: options.date }))

            run.deps.console.log(
              `Set FIO cursor for plugin ${options.id} to ${options.date}`
            )
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "delete",
          description: "Soft delete a FIO plugin configuration.",
          args: {},
          opts: {
            id: FioPluginId.describe("FIO plugin id"),
          },
          async action(_, options) {
            const fioPluginId = await run.ok(deleteFioPlugin(options.id))

            run.deps.console.log(`Deleted FIO plugin ${fioPluginId}`)
          },
        })
      )

    program.addCommand(fioPluginsCommand)
    return ok(undefined)
  }
