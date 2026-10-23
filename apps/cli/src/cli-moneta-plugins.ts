import {
  type ConsoleDep,
  createRun,
  type LockManagerDep,
  ok,
  sqliteFalse,
  sqliteTrue,
  type Task,
} from "@evolu/common"
import type { DateDep, EvoluOwnerDep, FetchDep } from "@payky/core/deps"
import {
  createMonetaApiDep,
  fetchMonetaAccounts,
  fetchMonetaTransactions,
} from "@payky/core/integrations/moneta/moneta-client"
import { fiatBankAccountQuery } from "@payky/core/modules/account/account-queries"
import {
  connectMonetaPlugin,
  disconnectMonetaPlugin,
  saveMonetaPlugin,
  syncMonetaTransactions,
  updateMonetaPluginSyncPointer,
} from "@payky/core/modules/moneta-plugin/moneta-plugin-actions"
import {
  fiatBankAccountMonetaPluginQuery,
  monetaPluginSyncPointerByPluginIdQuery,
} from "@payky/core/modules/moneta-plugin/moneta-plugin-queries"
import {
  maskMonetaToken,
  minMonetaPluginCheckIntervalSeconds,
  monetaBankDay,
  monetaPluginId,
} from "@payky/core/modules/moneta-plugin/moneta-plugin-utils"
import type { EvoluDep } from "@payky/core/modules/shared/evolu-deps"
import {
  DateStringSchema,
  NonEmptyStringSchema,
  PositiveIntegerFromStringSchema,
} from "@payky/core/modules/shared/schema"
import { type Command, createCommand } from "commander"
import { subDays } from "date-fns"
import { z } from "zod"
import { zodCommand } from "zod-commander/zod4"
import { printCliError } from "./cli-errors.ts"
import { createFetchDep } from "./fetch.ts"

/** A date-time or a date (local midnight) from the command line. */
const DateFromStringSchema = z.string().transform((value, ctx) => {
  const date = new Date(
    DateStringSchema.safeParse(value).success ? `${value}T00:00:00` : value
  )
  if (Number.isNaN(date.getTime())) {
    ctx.issues.push({ code: "custom", message: "Invalid date.", input: value })
    return z.NEVER
  }
  return date
})

export const registerMonetaPluginsCommand =
  (
    program: Command
  ): Task<
    void,
    never,
    EvoluDep & EvoluOwnerDep & ConsoleDep & DateDep & FetchDep & LockManagerDep
  > =>
  (run) => {
    const { evolu } = run.deps

    /** A run that talks to the bank with `token` alone, outside any plugin. */
    const createBankRun = (token: string) =>
      createRun({
        console: run.deps.console,
        ...createFetchDep(),
        ...createMonetaApiDep({ token }),
      })

    const monetaPluginsCommand = createCommand("moneta-plugins").description(
      "Manage the MONETA Money Bank VIP API plugin. There is one plugin, for the fiat bank account."
    )

    monetaPluginsCommand
      .addCommand(
        zodCommand({
          name: "connect",
          description:
            "Check a VIP API token against the bank and connect it to the fiat bank account.",
          args: {},
          opts: {
            token: NonEmptyStringSchema.describe("t;MONETA VIP API token"),
          },
          async action(_, options) {
            const [account] = await evolu.loadQuery(fiatBankAccountQuery)
            if (account === undefined || account.isDeleted === sqliteTrue) {
              printCliError(run.deps.console, "No fiat bank account is set.")
              return
            }

            const result = await run(
              connectMonetaPlugin({
                accountId: account.id,
                iban: account.iban,
                token: options.token,
              })
            )
            if (!result.ok) {
              printCliError(
                run.deps.console,
                `Could not connect the MONETA token: ${JSON.stringify(result.error)}`
              )
              return
            }

            run.deps.console.log(
              `Connected MONETA plugin ${result.value} to ${account.iban}.`
            )
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "show",
          description: "Show the MONETA plugin and its sync pointer.",
          args: {},
          opts: {},
          async action() {
            const [plugin] = await evolu.loadQuery(
              fiatBankAccountMonetaPluginQuery
            )
            const [pointer] = await evolu.loadQuery(
              monetaPluginSyncPointerByPluginIdQuery(monetaPluginId)
            )
            run.deps.console.log(
              JSON.stringify(
                {
                  plugin:
                    plugin === undefined
                      ? null
                      : { ...plugin, token: maskMonetaToken(plugin.token) },
                  lastSyncedDate: pointer?.lastSyncedDate ?? null,
                },
                null,
                2
              )
            )
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "save",
          description: "Change how the connected plugin syncs.",
          args: {},
          opts: {
            numberOfSecondsBetweenChecks:
              PositiveIntegerFromStringSchema.refine(
                (seconds) => seconds >= minMonetaPluginCheckIntervalSeconds,
                `At least ${minMonetaPluginCheckIntervalSeconds} seconds.`
              )
                .optional()
                .describe("i;Background sync interval in seconds"),
            isActive: z
              .enum(["true", "false"])
              .optional()
              .describe("x;Whether background sync is active"),
          },
          async action(_, options) {
            await run.ok(
              saveMonetaPlugin({
                numberOfSecondsBetweenChecks:
                  options.numberOfSecondsBetweenChecks,
                isActive:
                  options.isActive === undefined
                    ? undefined
                    : options.isActive === "true"
                      ? sqliteTrue
                      : sqliteFalse,
              })
            )
            run.deps.console.log("Saved the MONETA plugin.")
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "accounts",
          description:
            "List the accounts a token sees, to check a token before connecting it.",
          args: {},
          opts: {
            token: NonEmptyStringSchema.describe("t;MONETA VIP API token"),
            raw: z
              .boolean()
              .optional()
              .describe(
                "r;Print every account entry exactly as the bank sent it"
              ),
          },
          async action(_, options) {
            await using bankRun = createBankRun(options.token)
            const result = await bankRun(fetchMonetaAccounts())
            run.deps.console.log(
              JSON.stringify(
                result.ok
                  ? options.raw === true
                    ? result.value.entries
                    : result.value.accounts
                  : result,
                null,
                2
              )
            )
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "transactions",
          description:
            "List the connected account's transactions as the client reads them, to check the schema.",
          args: {},
          opts: {
            from: DateFromStringSchema.optional().describe(
              "f;First booking day, a date or ISO date-time; the bank reads whole days (default: yesterday)"
            ),
            to: DateFromStringSchema.optional().describe(
              "u;Last booking day, a date or ISO date-time; the bank reads whole days (default: today)"
            ),
            raw: z
              .boolean()
              .optional()
              .describe(
                "r;Print every entry exactly as the bank sent it, the ones the client cannot read included"
              ),
          },
          async action(_, options) {
            const [plugin] = await evolu.loadQuery(
              fiatBankAccountMonetaPluginQuery
            )
            if (plugin === undefined) {
              printCliError(run.deps.console, "No MONETA plugin is connected.")
              return
            }

            const now = run.deps.date.now()
            await using bankRun = createBankRun(plugin.token)
            const result = await bankRun(
              fetchMonetaTransactions({
                monetaAccountId: plugin.monetaAccountId,
                fromDate: monetaBankDay(options.from ?? subDays(now, 1)),
                toDate: monetaBankDay(options.to ?? now),
              })
            )
            if (!result.ok) {
              run.deps.console.log(JSON.stringify(result, null, 2))
              return
            }
            const { transactions, skipped, isTruncated, callCount } =
              result.value
            run.deps.console.log(
              JSON.stringify(
                options.raw === true
                  ? {
                      transactions: transactions.map(({ raw }) => raw),
                      skipped,
                      isTruncated,
                      callCount,
                    }
                  : {
                      transactions: transactions.map(
                        ({ raw: _raw, ...transaction }) => transaction
                      ),
                      skippedCount: skipped.length,
                      isTruncated,
                      callCount,
                    },
                null,
                2
              )
            )
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "sync",
          description:
            "Sync the connected account once: record new incoming transfers and pay the payments they match.",
          args: {},
          opts: {
            from: DateFromStringSchema.optional().describe(
              "f;First booking day, a date or ISO date-time; the bank reads whole days (default: yesterday)"
            ),
            to: DateFromStringSchema.optional().describe(
              "u;Last booking day, a date or ISO date-time; the bank reads whole days (default: today)"
            ),
          },
          async action(_, options) {
            const now = run.deps.date.now()
            const result = await run(
              syncMonetaTransactions({
                fromDate: monetaBankDay(options.from ?? subDays(now, 1)),
                toDate: monetaBankDay(options.to ?? now),
              })
            )
            if (!result.ok) {
              printCliError(
                run.deps.console,
                `MONETA sync failed: ${JSON.stringify(result.error)}`
              )
              return
            }
            run.deps.console.log(JSON.stringify(result.value, null, 2))
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "set-sync-pointer",
          description:
            "Set the date the background job last synced up to; the next sync reads from that day.",
          args: {
            date: DateStringSchema.describe("Date in YYYY-MM-DD format"),
          },
          opts: {},
          async action({ date }) {
            await run.ok(
              updateMonetaPluginSyncPointer({ lastSyncedDate: date })
            )
            run.deps.console.log(`Set the MONETA sync pointer to ${date}.`)
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "reset-sync-pointer",
          description:
            "Clear the sync pointer, so the next background sync reads the first-sync window again.",
          args: {},
          opts: {},
          async action() {
            await run.ok(
              updateMonetaPluginSyncPointer({ lastSyncedDate: null })
            )
            run.deps.console.log("Cleared the MONETA sync pointer.")
          },
        })
      )

      .addCommand(
        zodCommand({
          name: "disconnect",
          description:
            "Disconnect the MONETA plugin and clear its token and sync pointer. Revoke the token in MONETA Internet Banka too: Evolu keeps its earlier value in the sync history.",
          args: {},
          opts: {},
          async action() {
            await run.ok(disconnectMonetaPlugin())
            run.deps.console.log("Disconnected the MONETA plugin.")
          },
        })
      )

    program.addCommand(monetaPluginsCommand)
    return ok(undefined)
  }
