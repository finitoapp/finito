import {
  type ConsoleDep,
  createConsole,
  createRun,
  type LockManagerDep,
  type Task,
} from "@evolu/common"
import { installPolyfills } from "@evolu/common/polyfills"
import type { AiModelDep } from "@payky/core/ai/ai-model"
import { createAiModelDep } from "@payky/core/ai/ai-model"
import {
  type AppOwnerSyncDep,
  createDateDep,
  type DateDep,
  type EvoluOwnerDep,
  type FetchDep,
  type TableSelfPayRootDep,
} from "@payky/core/deps"
import { createNostrRelayClient } from "@payky/core/integrations/nostr/nostr-relay-client"
import {
  createYadioApiDep,
  type YadioApiDep,
} from "@payky/core/integrations/yadio/yadio-client"
import type { EvoluDep } from "@payky/core/modules/shared/evolu-deps"
import { createInProcessLockManager } from "@payky/core/runtime/in-process-lock-manager"
import {
  createSparkWalletDep,
  type SparkWalletDep,
} from "@payky/core/spark/spark-wallet"
import { type Command, createCommand } from "commander"
import { registerAccountTransfersCommand } from "./cli-account-transfers.ts"
import { registerAccountsCommand } from "./cli-accounts.ts"
import { registerAiCommand } from "./cli-ai.ts"
import { registerBackgroundJobsCommand } from "./cli-background-jobs.ts"
import { registerBillsCommand } from "./cli-bills.ts"
import { registerCatalogItemsCommand } from "./cli-catalog-items.ts"
import { cliEnv } from "./cli-env.ts"
import { type CliDataDirDep, createCliEvoluFromEnv } from "./cli-evolu.ts"
import { registerFioPluginsCommand } from "./cli-fio-plugins.ts"
import { registerMonetaPluginsCommand } from "./cli-moneta-plugins.ts"
import { registerPaymentNumberSeriesCommand } from "./cli-payment-number-series.ts"
import { registerPaymentsCommand } from "./cli-payments.ts"
import { registerTablesCommand } from "./cli-tables.ts"
import { createFetchDep } from "./fetch.ts"

declare const process: {
  readonly argv: ReadonlyArray<string>
}

const commands: ((
  program: Command
) => Task<
  void,
  never,
  EvoluDep &
    EvoluOwnerDep &
    AppOwnerSyncDep &
    ConsoleDep &
    DateDep &
    AiModelDep &
    FetchDep &
    SparkWalletDep &
    CliDataDirDep &
    Partial<TableSelfPayRootDep> &
    YadioApiDep &
    LockManagerDep
>)[] = [
  registerCatalogItemsCommand,
  registerBillsCommand,
  registerAccountsCommand,
  registerAccountTransfersCommand,
  registerPaymentsCommand,
  registerPaymentNumberSeriesCommand,
  registerTablesCommand,
  registerFioPluginsCommand,
  registerMonetaPluginsCommand,
  registerBackgroundJobsCommand,
  registerAiCommand,
]

const main = async () => {
  installPolyfills()

  // Bun ships a partial `navigator` that has no `locks`, so Evolu's own
  // polyfill sees a navigator and leaves it alone - then Evolu creation
  // dereferences `navigator.locks.request` and the CLI dies before parsing
  // a single argument. Web Locks in a single-process runtime is exactly
  // what `createInProcessLockManager` was written for.
  const navigatorWithLocks = globalThis.navigator as Navigator & {
    locks?: LockManager
  }
  navigatorWithLocks.locks ??= createInProcessLockManager()

  await using evoluCli = await createCliEvoluFromEnv()
  const { evolu, appOwnerSync, tableSelfPayRoot, dataDir } = evoluCli
  const evoluOwner = evolu.appOwner
  const console = createConsole({
    level: "debug",
  })

  await using run = createRun({
    evolu,
    evoluOwner,
    appOwnerSync,
    console,
    lockManager: navigatorWithLocks.locks,
    ...createDateDep(),
    ...createFetchDep(),
    ...createSparkWalletDep(),
    ...createYadioApiDep(),
    tableSelfPayRoot,
    selfPayDefaultRelays: cliEnv.PAYKY_SELF_PAY_RELAYS,
    nostrRelayClient: createNostrRelayClient(),
    dataDir,
    ...createAiModelDep({
      baseURL: cliEnv.PAYKY_AI_BASE_URL,
      ownerId: evoluOwner.id,
      model: cliEnv.PAYKY_AI_MODEL,
    }),
  })

  const program = createCommand()
  program
    .name("payky")
    .description("Manage Payky local data and background jobs.")
    .version("0.0.1")

  // Called with the root run, not started as a child Task: a child run is
  // disposed as soon as registration returns, so every action that runs a
  // Task after its first `await` would get a RunDisposedAbortReason.
  for (const command of commands) {
    command(program)(run)
  }

  await program.parseAsync(process.argv)
}

main()
