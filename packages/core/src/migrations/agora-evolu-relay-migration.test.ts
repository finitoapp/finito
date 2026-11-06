import { sqliteFalse, sqliteTrue, testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"

import {
  appOwnerIdPlaceholder,
  deriveDeviceAccountId,
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
import { agoraEvoluRelayMigration } from "./agora-evolu-relay-migration.ts"
import { runMigrations } from "./migrations.ts"

const shopKey = MasterKey("000102030405060708090a0b0c0d0e0f")
const linkyRelay = "wss://evolu.linky.fit"
const liveRelay = `wss://live-relay.payky.me/${appOwnerIdPlaceholder}`
const agoraRelay = "wss://evolu.agora.gripe"

const insertAccount = (
  deviceEvolu: DeviceEvolu,
  {
    relays,
    demo = false,
  }: {
    readonly relays: ReadonlyArray<{
      readonly url: string
      readonly isActive: typeof sqliteFalse | typeof sqliteTrue
    }>
    readonly demo?: boolean
  }
): Promise<DeviceAccountId> =>
  runMutationWithCompletion((options) => {
    const id = deriveDeviceAccountId(shopKey)
    deviceEvolu.upsert(
      "account",
      {
        id,
        name: NonEmptyString255("Shop"),
        masterKey: shopKey,
        lastUseAt: TimestampMs(1),
        ...(demo ? { demo: "seeded" as const } : {}),
      },
      options
    )
    for (const { url, isActive } of relays) {
      upsertAccountEvoluWebsocketTransport(
        deviceEvolu,
        { accountId: id, isActive, url: WssUrl(url) },
        options
      )
    }
    return id
  })

const loadRelays = (deviceEvolu: DeviceEvolu, accountId: DeviceAccountId) =>
  deviceEvolu.loadQuery(
    createDeviceQuery((db) =>
      db
        .selectFrom("accountEvoluTransport")
        .innerJoin(
          "accountEvoluTransportWebsocket",
          "accountEvoluTransportWebsocket.id",
          "accountEvoluTransport.id"
        )
        .select([
          "accountEvoluTransportWebsocket.url",
          "accountEvoluTransport.isActive",
        ])
        .where("accountEvoluTransport.accountId", "=", accountId)
        .orderBy("accountEvoluTransportWebsocket.url")
    )
  )

const createMigrationRun = (deviceEvolu: DeviceEvolu) =>
  testCreateRun({ deviceEvolu, localStorage: createTestLocalStorage() })

const hasWork = async (deviceEvolu: DeviceEvolu) => {
  await using run = createMigrationRun(deviceEvolu)
  return await run.ok(agoraEvoluRelayMigration.hasWork)
}

const migrate = async (deviceEvolu: DeviceEvolu) => {
  await using run = createMigrationRun(deviceEvolu)
  return await run.ok(runMigrations([agoraEvoluRelayMigration]))
}

describe("agora evolu relay migration", () => {
  test("adds agora's relay, switched on, to an account on the default relays", async () => {
    await using testDevice = await createTestDeviceEvolu()
    const { deviceEvolu } = testDevice
    const accountId = await insertAccount(deviceEvolu, {
      relays: [
        { url: linkyRelay, isActive: sqliteTrue },
        { url: liveRelay, isActive: sqliteTrue },
      ],
    })
    expect(await hasWork(deviceEvolu)).toBe(true)

    await migrate(deviceEvolu)

    expect(await loadRelays(deviceEvolu, accountId)).toEqual([
      { url: agoraRelay, isActive: sqliteTrue },
      { url: linkyRelay, isActive: sqliteTrue },
      { url: liveRelay, isActive: sqliteTrue },
    ])
    expect(await hasWork(deviceEvolu)).toBe(false)
  })

  test("leaves an account on relays of its own choosing alone", async () => {
    await using testDevice = await createTestDeviceEvolu()
    const { deviceEvolu } = testDevice
    await insertAccount(deviceEvolu, {
      relays: [{ url: "wss://custom.example", isActive: sqliteTrue }],
    })

    expect(await hasWork(deviceEvolu)).toBe(false)
  })

  test("finishes when no account needs agora's relay", async () => {
    await using testDevice = await createTestDeviceEvolu()
    await using run = createMigrationRun(testDevice.deviceEvolu)

    expect(await run.ok(agoraEvoluRelayMigration.run)).toBe(0)
  })

  test("keeps agora's relay off once its owner switched it off", async () => {
    await using testDevice = await createTestDeviceEvolu()
    const { deviceEvolu } = testDevice
    await insertAccount(deviceEvolu, {
      relays: [
        { url: linkyRelay, isActive: sqliteTrue },
        { url: agoraRelay, isActive: sqliteFalse },
      ],
    })

    expect(await hasWork(deviceEvolu)).toBe(false)
  })

  test("adds it switched off to an account whose owner switched Linky's relay off", async () => {
    await using testDevice = await createTestDeviceEvolu()
    const { deviceEvolu } = testDevice
    const accountId = await insertAccount(deviceEvolu, {
      relays: [
        { url: linkyRelay, isActive: sqliteFalse },
        { url: liveRelay, isActive: sqliteTrue },
      ],
    })

    await migrate(deviceEvolu)

    expect(await loadRelays(deviceEvolu, accountId)).toContainEqual({
      url: agoraRelay,
      isActive: sqliteFalse,
    })
  })

  test("adds it switched off to a demo account, which never syncs", async () => {
    await using testDevice = await createTestDeviceEvolu()
    const { deviceEvolu } = testDevice
    const accountId = await insertAccount(deviceEvolu, {
      relays: [{ url: linkyRelay, isActive: sqliteFalse }],
      demo: true,
    })

    await migrate(deviceEvolu)

    expect(await loadRelays(deviceEvolu, accountId)).toContainEqual({
      url: agoraRelay,
      isActive: sqliteFalse,
    })
  })
})
