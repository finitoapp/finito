import { rmSync } from "node:fs"
import { resolve } from "node:path"
import {
  type CreateWebSocket,
  constVoid,
  createConsole,
  createConsoleStoreOutput,
  createMessagePort,
  createRun,
  createSharedWorker,
  createSqlite,
  createWebSocket,
  createWorker,
  type EvoluConfig,
  Name,
  ok,
  testCreateBroadcastChannel,
  testCreateLockManager,
  testCreateMessageChannel,
  testCreateWebSocket,
} from "@evolu/common"
import {
  createEvoluDeps,
  type DbWorkerInit,
  type DeleteDatabaseFiles,
  type DevicePersistence,
  initSharedWorker,
  type SharedWorkerInput,
  type SharedWorkerOutput,
  startDbWorker,
} from "@evolu/common/local-first"
import { createNodeJsSqliteDriver } from "@evolu/nodejs"
import { createAppOwnerSync } from "../evolu/app-owner-sync.ts"
import { createAppEvolu, createTestAppEvolu } from "../evolu/client.ts"
import {
  deriveTableSelfPayRoot,
  type MasterKey,
} from "../modules/shared/key-derivation.ts"

/**
 * Where a Node Evolu keeps its database: in memory, for tests, or in the file
 * `payky.db` in the working directory, the only place Evolu's Node driver
 * opens a file (the CLI moves there first).
 */
export type NodeEvoluMode = "memory" | "file"

const databaseName = Name.orThrow("payky")

/**
 * Deletes the files of a closed database, as the DbWorker asks: the file and
 * its journal or log, those that exist.
 */
const deleteDatabaseFiles: DeleteDatabaseFiles = (name) => () => {
  const file = resolve(`${name}.db`)
  for (const path of [file, `${file}-journal`, `${file}-wal`, `${file}-shm`])
    rmSync(path, { force: true })
  return ok()
}

export const setupRunWithEvoluDeps = async (
  mode: NodeEvoluMode,
  createWebSocket: CreateWebSocket = testCreateWebSocket({
    throwOnCreate: true,
  })
) => {
  await using disposer = new AsyncDisposableStack()

  const consoleStoreOutput = createConsoleStoreOutput()
  const console = createConsole({ level: "warn" })
  // One for both sides, like `navigator.locks` in a browser: a DbWorker stops
  // once it can take the lock its shared worker holds, so on a lock manager
  // of its own it would stop at once.
  const lockManager = testCreateLockManager()

  const run = disposer.use(
    createRun({
      console,
      consoleStoreOutputEntry: consoleStoreOutput.entry,
      createBroadcastChannel: testCreateBroadcastChannel,
      createMessageChannel: testCreateMessageChannel,
      createMessagePort: createMessagePort,
      createWebSocket,
      lockManager,
      // What the shared worker may promise about stored databases: a file
      // persists, memory does not.
      getDevicePersistence: () =>
        Promise.resolve<DevicePersistence>(
          mode === "memory" ? "NotPersisted" : "Persisted"
        ),
    })
  )

  // One connection, which the DbWorker and `sqlite` below share: a second
  // memory database would be another one, and Evolu's driver lets one
  // connection of a process hold a file at a time.
  const driver = await run.ok(
    createNodeJsSqliteDriver(
      databaseName,
      mode === "memory" ? { mode: "memory" } : undefined
    )
  )

  const workerRun = disposer.use(
    createRun({
      console,
      consoleStoreOutputEntry: consoleStoreOutput.entry,
      createBroadcastChannel: testCreateBroadcastChannel,
      createMessagePort,
      lockManager,
      createSqliteDriver: () => () => ok(driver),
      deleteDatabaseFiles,
    })
  )

  const createDbWorker = () =>
    createWorker<DbWorkerInit>((self) => {
      workerRun(startDbWorker(self))
    })

  // Keep the SharedWorker's resources, so they are disposed before `run`
  // and `workerRun`. Left to run disposal, its tenants would be torn down
  // after their own runs were already disposed.
  const sharedWorkerInit = Promise.withResolvers<AsyncDisposableStack>()
  const sharedWorker = createSharedWorker<
    SharedWorkerInput,
    SharedWorkerOutput
  >((self) => {
    sharedWorkerInit.resolve(run.ok(initSharedWorker(self)))
  })
  disposer.use(await sharedWorkerInit.promise)

  const sqlite = disposer.use(await workerRun.ok(createSqlite(databaseName)))
  // createEvoluDeps owns the shared worker and speaks its tab protocol
  // (Waiting/Connected/DbWorkerInit, tab leader election).
  const evoluDeps = disposer.use(
    createEvoluDeps({
      ...run.deps,
      createDbWorker,
      reloadApp: constVoid,
      sharedWorker,
    })
  )
  const runWithEvoluDeps = disposer.use(run.create(evoluDeps))
  const disposables = disposer.move()

  return {
    run: runWithEvoluDeps,
    sqlite,
    [Symbol.asyncDispose]: () => disposables.disposeAsync(),
  } as const
}

export interface NodeEvoluAccount {
  readonly masterKey: MasterKey
  readonly transports: NonNullable<EvoluConfig["transports"]>
}

/** App Evolu on Node, in memory for tests or in `payky.db` for the CLI. */
export const createNodeEvolu = async (
  mode: NodeEvoluMode,
  account?: NodeEvoluAccount
) => {
  await using disposer = new AsyncDisposableStack()

  const { run } = disposer.use(
    account === undefined
      ? await setupRunWithEvoluDeps(mode)
      : await setupRunWithEvoluDeps(mode, createWebSocket)
  )

  // Without an account, the database is owned by the shared Evolu test
  // owner.
  const evolu = disposer.use(
    await run.ok(
      account === undefined ? createTestAppEvolu() : createAppEvolu(account)
    )
  )

  const disposables = disposer.move()

  return {
    evolu,
    appOwnerSync: createAppOwnerSync(run.deps.syncState, evolu),
    tableSelfPayRoot:
      account === undefined
        ? undefined
        : deriveTableSelfPayRoot(account.masterKey),
    [Symbol.asyncDispose]: () => disposables.disposeAsync(),
  } as const
}
