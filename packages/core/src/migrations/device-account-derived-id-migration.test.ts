import { sqliteTrue, testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"

import {
  createDefaultEvoluTransportUrls,
  createOrSelectAccount,
  deriveDeviceAccountId,
  loadActiveAccountRow,
  upsertAccountEvoluWebsocketTransport,
} from "../evolu/device-account.ts"
import {
  createDeviceQuery,
  type DeviceAccountId,
  type DeviceEvolu,
} from "../evolu/device-client.ts"
import { runMutationWithCompletion } from "../modules/shared/evolu-utils.ts"
import { MasterKey } from "../modules/shared/key-derivation.ts"
import {
  NonEmptyString255,
  TimestampMs,
  WssUrl,
} from "../modules/shared/schema.ts"
import { createTestDeviceEvolu } from "../testing/device-evolu.ts"
import { createTestLocalStorage } from "../testing/local-storage.ts"
import { deviceAccountDerivedIdMigration } from "./device-account-derived-id-migration.ts"
import {
  deviceMigrations,
  loadPendingMigrations,
  runMigrations,
} from "./migrations.ts"

const shopKey = MasterKey("000102030405060708090a0b0c0d0e0f")
const cafeKey = MasterKey("0f0e0d0c0b0a09080706050403020100")
const defaultTransports = createDefaultEvoluTransportUrls("live-relay.example")

/** An account row as code before derived ids wrote it: at a random id. */
const insertLegacyAccount = async (
  deviceEvolu: DeviceEvolu,
  {
    masterKey,
    name,
    lastUseAt,
    transports = [],
    removed = false,
  }: {
    readonly masterKey: MasterKey
    readonly name: string
    readonly lastUseAt: number
    readonly transports?: ReadonlyArray<string>
    readonly removed?: boolean
  }
): Promise<DeviceAccountId> =>
  runMutationWithCompletion((options) => {
    const { id } = deviceEvolu.insert(
      "account",
      {
        name: NonEmptyString255(name),
        masterKey,
        lastUseAt: TimestampMs(lastUseAt),
      },
      options
    )
    for (const url of transports) {
      upsertAccountEvoluWebsocketTransport(
        deviceEvolu,
        { accountId: id, isActive: sqliteTrue, url: WssUrl(url) },
        options
      )
    }
    if (removed) {
      deviceEvolu.update("account", { id, isDeleted: sqliteTrue }, options)
    }
    return id
  })

const loadAccountRows = (deviceEvolu: DeviceEvolu) =>
  deviceEvolu.loadQuery(
    createDeviceQuery((db) =>
      db
        .selectFrom("account")
        .select(["id", "name", "masterKey", "isDeleted"])
        .orderBy("createdAt")
    )
  )

const loadLiveAccountRows = async (deviceEvolu: DeviceEvolu) =>
  (await loadAccountRows(deviceEvolu)).filter(
    ({ isDeleted }) => isDeleted !== sqliteTrue
  )

const loadTransportUrls = async (
  deviceEvolu: DeviceEvolu,
  accountId: DeviceAccountId
) =>
  (
    await deviceEvolu.loadQuery(
      createDeviceQuery((db) =>
        db
          .selectFrom("accountEvoluTransport")
          .innerJoin(
            "accountEvoluTransportWebsocket",
            "accountEvoluTransportWebsocket.id",
            "accountEvoluTransport.id"
          )
          .select("accountEvoluTransportWebsocket.url")
          .where("accountEvoluTransport.accountId", "=", accountId)
      )
    )
  ).map(({ url }) => url)

const migrate = async (deviceEvolu: DeviceEvolu) => {
  await using run = testCreateRun({
    deviceEvolu,
    localStorage: createTestLocalStorage(),
  })
  return await run.ok(runMigrations([deviceAccountDerivedIdMigration]))
}

const hasWork = async (deviceEvolu: DeviceEvolu) => {
  await using run = testCreateRun({
    deviceEvolu,
    localStorage: createTestLocalStorage(),
  })
  return await run.ok(deviceAccountDerivedIdMigration.hasWork)
}

describe("device account derived id migration", () => {
  test("moves an account onto its derived id with its name, transports and last use", async () => {
    await using testDevice = await createTestDeviceEvolu()
    const { deviceEvolu } = testDevice
    const legacyId = await insertLegacyAccount(deviceEvolu, {
      masterKey: shopKey,
      name: "Shop",
      lastUseAt: 2,
      transports: ["wss://custom.example"],
    })
    await insertLegacyAccount(deviceEvolu, {
      masterKey: cafeKey,
      name: "Cafe",
      lastUseAt: 1,
    })
    expect(await hasWork(deviceEvolu)).toBe(true)

    await migrate(deviceEvolu)

    expect(await loadLiveAccountRows(deviceEvolu)).toMatchObject([
      { id: deriveDeviceAccountId(shopKey), name: "Shop" },
      { id: deriveDeviceAccountId(cafeKey), name: "Cafe" },
    ])
    expect(
      await loadTransportUrls(deviceEvolu, deriveDeviceAccountId(shopKey))
    ).toEqual(["wss://custom.example"])
    expect(
      (await loadAccountRows(deviceEvolu)).find(({ id }) => id === legacyId)
    ).toMatchObject({ isDeleted: sqliteTrue })
    // The most recently used account is still the active one.
    expect(await loadActiveAccountRow(deviceEvolu)).toMatchObject({
      id: deriveDeviceAccountId(shopKey),
      masterKey: shopKey,
    })
    expect(await hasWork(deviceEvolu)).toBe(false)
  })

  test("collapses duplicates of one account into one, named after the most recently used", async () => {
    await using testDevice = await createTestDeviceEvolu()
    const { deviceEvolu } = testDevice
    await insertLegacyAccount(deviceEvolu, {
      masterKey: shopKey,
      name: "Old",
      lastUseAt: 1,
    })
    await insertLegacyAccount(deviceEvolu, {
      masterKey: shopKey,
      name: "Shop",
      lastUseAt: 2,
    })

    await migrate(deviceEvolu)

    expect(await loadLiveAccountRows(deviceEvolu)).toMatchObject([
      { id: deriveDeviceAccountId(shopKey), name: "Shop" },
    ])
    expect(await hasWork(deviceEvolu)).toBe(false)
  })

  test("a removed account moves as a removed row, and re-adding it revives its name", async () => {
    await using testDevice = await createTestDeviceEvolu()
    const { deviceEvolu } = testDevice
    await insertLegacyAccount(deviceEvolu, {
      masterKey: shopKey,
      name: "Shop",
      lastUseAt: 1,
      removed: true,
    })

    await migrate(deviceEvolu)
    expect(await loadLiveAccountRows(deviceEvolu)).toEqual([])
    expect(await hasWork(deviceEvolu)).toBe(false)

    const readded = await createOrSelectAccount(deviceEvolu, shopKey, {
      defaultTransports,
    })
    expect(readded).toEqual({
      accountId: deriveDeviceAccountId(shopKey),
      created: true,
    })
    await expect
      .poll(() => loadLiveAccountRows(deviceEvolu))
      .toMatchObject([{ id: deriveDeviceAccountId(shopKey), name: "Shop" }])
  })

  test("has no work for accounts already at their derived ids", async () => {
    await using testDevice = await createTestDeviceEvolu()
    const { deviceEvolu } = testDevice
    await createOrSelectAccount(deviceEvolu, shopKey, { defaultTransports })
    await expect.poll(() => loadLiveAccountRows(deviceEvolu)).toHaveLength(1)

    expect(await hasWork(deviceEvolu)).toBe(false)
  })

  test("is reached through the device registry", async () => {
    await using testDevice = await createTestDeviceEvolu()
    const { deviceEvolu } = testDevice
    await insertLegacyAccount(deviceEvolu, {
      masterKey: shopKey,
      name: "Shop",
      lastUseAt: 1,
    })
    await using run = testCreateRun({
      deviceEvolu,
      localStorage: createTestLocalStorage(),
    })

    const pending = await run.ok(loadPendingMigrations(deviceMigrations))
    expect(pending).toContain(deviceAccountDerivedIdMigration)
    await run.ok(runMigrations(pending))

    expect(await run.ok(loadPendingMigrations(deviceMigrations))).toEqual([])
  })
})
