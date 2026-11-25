import {
  createIdFromString,
  sqliteFalse,
  sqliteTrue,
  testCreateWebSocket,
  WebSocketUrlFromString,
} from "@evolu/common"
import { describe, expect, test, vi } from "vitest"
import { registerDevice } from "../modules/device/device-actions.ts"
import { devicesQuery } from "../modules/device/device-queries.ts"
import type { DeviceId } from "../modules/device/device-types.ts"
import { runMutationWithCompletion } from "../modules/shared/evolu-utils.ts"
import {
  createMasterKey,
  type MasterKey,
} from "../modules/shared/key-derivation.ts"
import { NonEmptyString255 } from "../modules/shared/schema.ts"
import { setupRunWithEvoluDeps } from "../runtime/node-evolu.ts"
import {
  deleteAccountLocalData,
  deleteRemovedAccountsLocalData,
  loadRemovedHere,
  removeAccountFromDevice,
  startAppOwnerSync,
  startAppOwnerSyncUnlessRemoved,
} from "./account-wipe.ts"
import { createAppEvolu } from "./client.ts"
import {
  createDefaultEvoluTransportUrls,
  createOrSelectAccount,
  markDeviceRegistered,
  removeDeviceAccount,
} from "./device-account.ts"
import {
  CashuCounterId,
  createDeviceEvolu,
  createDeviceQuery,
  type DeviceEvolu,
} from "./device-client.ts"

const defaultTransports = createDefaultEvoluTransportUrls("relay.example")
const deviceId: DeviceId = createIdFromString("wiped-device")

/** A device database and the Evolu deps a second client needs, in memory. */
const setupDevice = async (
  options?: Parameters<typeof setupRunWithEvoluDeps>[1]
) => {
  await using stack = new AsyncDisposableStack()
  const env = stack.use(await setupRunWithEvoluDeps("memory", options))
  const deviceEvolu = stack.use(await env.run.ok(createDeviceEvolu))
  const run = stack.use(env.run.create({ ...env.run.deps, deviceEvolu }))
  const disposables = stack.move()

  /** An account on the device, a client of its app database and one row in it. */
  const addAccount = async (masterKey: MasterKey = createMasterKey()) => {
    const { accountId } = await createOrSelectAccount(deviceEvolu, masterKey, {
      defaultTransports,
      deleteLocalData: (key) => run(deleteAccountLocalData(key)),
    })
    const evolu = await openAppEvolu(masterKey)
    await registerHere(evolu)
    return { accountId, masterKey, evolu }
  }

  const openAppEvolu = (masterKey: MasterKey) =>
    env.run.ok(createAppEvolu({ masterKey, transports: [] }))

  const registerHere = async (
    evolu: Awaited<ReturnType<typeof openAppEvolu>>
  ) => {
    await using appRun = env.run.create({
      evolu,
      evoluOwner: evolu.appOwner,
    })
    await appRun.ok(
      registerDevice({
        id: deviceId,
        name: NonEmptyString255("Till"),
        deviceType: null,
        browserName: null,
        osName: null,
        joining: true,
      })
    )
  }

  /** Rows of the account's app database, as a client opened anew sees them. */
  const loadAppRows = async (masterKey: MasterKey) => {
    await using evolu = await openAppEvolu(masterKey)
    return await evolu.loadQuery(devicesQuery)
  }

  return {
    run,
    deviceEvolu,
    addAccount,
    openAppEvolu,
    loadAppRows,
    [Symbol.asyncDispose]: () => disposables.disposeAsync(),
  } as const
}

const accountRowsQuery = createDeviceQuery((db) =>
  db
    .selectFrom("account")
    .select(["id", "isDeleted", "localDataDeletedAt"])
    .orderBy("createdAt")
)

const loadAccountRows = (deviceEvolu: DeviceEvolu) =>
  deviceEvolu.loadQuery(accountRowsQuery)

describe("deleteAccountLocalData", () => {
  test("deletes the app database, so a client opened anew finds it empty", async () => {
    await using device = await setupDevice()
    const { masterKey, evolu } = await device.addAccount()
    expect(await evolu.loadQuery(devicesQuery)).toHaveLength(1)

    const deleted = await device.run(deleteAccountLocalData(masterKey))

    expect(deleted).toEqual({ ok: true, value: undefined })
    expect(await device.loadAppRows(masterKey)).toEqual([])
  })
})

describe("removeAccountFromDevice", () => {
  test("forgets the account and deletes its data, other accounts left", async () => {
    await using device = await setupDevice()
    const kept = await device.addAccount()
    const removed = await device.addAccount()
    const accountId = removed.accountId
    // Rows the device keeps for the account: a PIN attempt goes, the Cashu
    // counter stays (cashu.md §3).
    await runMutationWithCompletion((options) => {
      device.deviceEvolu.insert(
        "pinAttempt",
        {
          accountId,
          attemptedAt: 1 as never,
          target: NonEmptyString255("/settings"),
        },
        options
      )
      device.deviceEvolu.upsert(
        "cashuCounter",
        {
          id: CashuCounterId.parse(createIdFromString("counter")),
          accountId,
          scope: "mint|sat|keyset",
          next: 7 as never,
        },
        options
      )
    })
    const leaveAccount = vi.fn()
    const closeApp = vi.fn()

    const result = await device.run(
      removeAccountFromDevice({ accountId, leaveAccount, closeApp })
    )

    expect(result).toEqual({ ok: true, value: "accountsLeft" })
    expect(leaveAccount).toHaveBeenCalledOnce()
    expect(closeApp).not.toHaveBeenCalled()
    expect(await device.loadAppRows(removed.masterKey)).toEqual([])
    expect(await device.loadAppRows(kept.masterKey)).toHaveLength(1)
    const accounts = await loadAccountRows(device.deviceEvolu)
    expect(accounts.find((row) => row.id === accountId)).toMatchObject({
      isDeleted: sqliteTrue,
      localDataDeletedAt: expect.any(Number),
    })
    expect(accounts.find((row) => row.id === kept.accountId)).toMatchObject({
      isDeleted: sqliteFalse,
    })
    const deletedFlags = async (
      table: "pinAttempt" | "cashuCounter" | "accountEvoluTransport"
    ) =>
      (
        await device.deviceEvolu.loadQuery(
          createDeviceQuery((db) =>
            db
              .selectFrom(table)
              .select("isDeleted")
              .where("accountId", "=", accountId)
          )
        )
      ).map((row) => row.isDeleted)
    expect(await deletedFlags("pinAttempt")).toEqual([sqliteTrue])
    expect(await deletedFlags("accountEvoluTransport")).toEqual([
      sqliteTrue,
      sqliteTrue,
    ])
    expect(await deletedFlags("cashuCounter")).toEqual([null])
  })

  test("deletes the device database too when no account is left", async () => {
    await using device = await setupDevice()
    const { accountId, masterKey } = await device.addAccount()
    const leaveAccount = vi.fn()
    const closeApp = vi.fn()

    const result = await device.run(
      removeAccountFromDevice({ accountId, leaveAccount, closeApp })
    )

    expect(result).toEqual({ ok: true, value: "deviceDeleted" })
    // The app stops rendering, and the device database's deletion reloads it.
    expect(closeApp).toHaveBeenCalledOnce()
    expect(leaveAccount).not.toHaveBeenCalled()
    expect(await device.loadAppRows(masterKey)).toEqual([])
    await using deviceEvolu = await device.run.ok(createDeviceEvolu)
    expect(await loadAccountRows(deviceEvolu)).toEqual([])
  })
})

describe("deleteRemovedAccountsLocalData", () => {
  test("deletes what a removal left behind, once, and leaves revived accounts alone", async () => {
    await using device = await setupDevice()
    const live = await device.addAccount()
    // Removed by an app that died before deleting, or by a version before
    // deleting existed: only the device row says so.
    const leftBehind = await device.addAccount()
    await runMutationWithCompletion((options) =>
      removeDeviceAccount(device.deviceEvolu, leftBehind.accountId, options)
    )
    await leftBehind.evolu[Symbol.asyncDispose]()

    expect(await device.run.ok(deleteRemovedAccountsLocalData)).toBe(1)
    // Tried again at the next start, it finds nothing left to do.
    expect(await device.run.ok(deleteRemovedAccountsLocalData)).toBe(0)

    expect(await device.loadAppRows(leftBehind.masterKey)).toEqual([])
    expect(await device.loadAppRows(live.masterKey)).toHaveLength(1)
    expect(
      (await loadAccountRows(device.deviceEvolu)).find(
        (row) => row.id === leftBehind.accountId
      )
    ).toMatchObject({ localDataDeletedAt: expect.any(Number) })
  })

  test("a revived account is no longer swept, nor deleted at its next start", async () => {
    await using device = await setupDevice()
    await device.addAccount()
    const { accountId, masterKey, evolu } = await device.addAccount()
    await evolu[Symbol.asyncDispose]()
    await device.run(
      removeAccountFromDevice({
        accountId,
        leaveAccount: () => {},
        closeApp: () => {},
      })
    )

    const revived = await device.addAccount(masterKey)

    expect(revived.accountId).toBe(accountId)
    expect(
      (await loadAccountRows(device.deviceEvolu)).find(
        (row) => row.id === accountId
      )
    ).toMatchObject({ isDeleted: sqliteFalse, localDataDeletedAt: null })
    expect(await device.run.ok(deleteRemovedAccountsLocalData)).toBe(0)
    expect(await device.loadAppRows(masterKey)).toHaveLength(1)
  })
})

describe("createOrSelectAccount reviving a removed account", () => {
  test("deletes the database a removal did not get to delete first", async () => {
    await using device = await setupDevice()
    await device.addAccount()
    const { accountId, masterKey, evolu } = await device.addAccount()
    await evolu[Symbol.asyncDispose]()
    removeDeviceAccount(device.deviceEvolu, accountId)
    const deleteLocalData = vi.fn((key: MasterKey) =>
      device.run(deleteAccountLocalData(key))
    )

    await createOrSelectAccount(device.deviceEvolu, masterKey, {
      defaultTransports,
      deleteLocalData,
    })

    expect(deleteLocalData).toHaveBeenCalledWith(masterKey)
    expect(await device.loadAppRows(masterKey)).toEqual([])
  })

  test("gets its transports back when the removal deleted them", async () => {
    await using device = await setupDevice()
    await device.addAccount()
    const { accountId, masterKey, evolu } = await device.addAccount()
    await evolu[Symbol.asyncDispose]()
    await device.run(
      removeAccountFromDevice({
        accountId,
        leaveAccount: () => {},
        closeApp: () => {},
      })
    )
    const deleteLocalData = vi.fn((key: MasterKey) =>
      device.run(deleteAccountLocalData(key))
    )

    await createOrSelectAccount(device.deviceEvolu, masterKey, {
      defaultTransports,
      deleteLocalData,
    })

    expect(deleteLocalData).not.toHaveBeenCalled()
    const transports = await device.deviceEvolu.loadQuery(
      createDeviceQuery((db) =>
        db
          .selectFrom("accountEvoluTransport")
          .select("id")
          .where("accountId", "=", accountId)
          .where("isDeleted", "is not", sqliteTrue)
      )
    )
    expect(transports).toHaveLength(defaultTransports.length)
  })
})

describe("startAppOwnerSync", () => {
  test("a change written after the sync stops reaches no relay", async () => {
    const sockets = testCreateWebSocket()
    await using device = await setupDevice({ createWebSocket: sockets })
    await using evolu = await device.openAppEvolu(createMasterKey())
    const url = WebSocketUrlFromString.orThrow("wss://relay.example/")
    const stopSync = startAppOwnerSync(evolu, [{ type: "WebSocket", url }])
    const sent = () => sockets.sentMessages.length

    await runMutationWithCompletion((options) =>
      evolu.insert(
        "device",
        { name: NonEmptyString255("Synced") },
        { ...options, owner: evolu.appOwner }
      )
    )
    await expect.poll(sent).toBeGreaterThan(1)
    const sentBeforeStop = sent()

    stopSync()
    stopSync()
    await runMutationWithCompletion((options) =>
      evolu.insert(
        "device",
        { name: NonEmptyString255("Not sent") },
        { ...options, owner: evolu.appOwner }
      )
    )
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(sent()).toBe(sentBeforeStop)
  })
})

describe("loadRemovedHere", () => {
  test("is true once the local copy holds this registered device's removal", async () => {
    await using device = await setupDevice()
    const { accountId, evolu } = await device.addAccount()
    const removedHere = () =>
      loadRemovedHere({
        evolu,
        deviceEvolu: device.deviceEvolu,
        accountId,
        deviceId,
      })
    await runMutationWithCompletion((options) =>
      evolu.update(
        "device",
        { id: deviceId, isDeleted: sqliteTrue },
        { ...options, owner: evolu.appOwner }
      )
    )

    // Not registered since it was added: an old removal it rejoins over.
    expect(await removedHere()).toBe(false)
    await runMutationWithCompletion((options) =>
      markDeviceRegistered(device.deviceEvolu, accountId, options)
    )
    expect(await removedHere()).toBe(true)
  })
})

describe("startAppOwnerSyncUnlessRemoved", () => {
  test("leaves the owner off the network once the local copy holds this device's removal", async () => {
    const sockets = testCreateWebSocket()
    await using device = await setupDevice({ createWebSocket: sockets })
    const { accountId, evolu } = await device.addAccount()
    const url = WebSocketUrlFromString.orThrow("wss://relay.example/")
    await runMutationWithCompletion((options) => {
      evolu.update(
        "device",
        { id: deviceId, isDeleted: sqliteTrue },
        { ...options, owner: evolu.appOwner }
      )
      markDeviceRegistered(device.deviceEvolu, accountId)
    })
    const start = () =>
      startAppOwnerSyncUnlessRemoved({
        evolu,
        deviceEvolu: device.deviceEvolu,
        accountId,
        deviceId,
        transports: [{ type: "WebSocket", url }],
      })

    const stopSync = start()
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(sockets.createdUrls).toEqual([])
    stopSync()

    // The same account without the removal syncs.
    await runMutationWithCompletion((options) =>
      evolu.update(
        "device",
        { id: deviceId, isDeleted: sqliteFalse },
        { ...options, owner: evolu.appOwner }
      )
    )
    const stopAgain = start()
    await expect.poll(() => sockets.createdUrls).toEqual([url])
    stopAgain()
  })
})
