import { sqliteFalse, sqliteTrue } from "@evolu/common"
import { describe, expect, test } from "vitest"
import { MasterKey } from "../modules/shared/key-derivation.ts"
import { NonEmptyString255, WssUrl } from "../modules/shared/schema.ts"
import { createTestDeviceEvolu } from "../testing/device-evolu.ts"
import {
  activeAccountQuery,
  appOwnerIdPlaceholder,
  createDefaultEvoluTransportUrls,
  createOrSelectAccount,
  deriveDeviceAccountId,
  insertDemoAccount,
  markDemoAccountSeeded,
  removeDeviceAccount,
  resolveTransportUrl,
  storableNostrPicture,
  updateDeviceSettings,
} from "./device-account.ts"
import {
  createDeviceQuery,
  type DeviceAccountId,
  type DeviceEvolu,
  deviceSettingsId,
} from "./device-client.ts"

// Shaped like a real one: 22 Base64Url characters.
const appOwnerId = "Vu6kLCCtCCwfgw5M7Kq6Fg"

describe("resolveTransportUrl", () => {
  test("substitutes the placeholder with the app owner id", () => {
    expect(
      resolveTransportUrl(
        `wss://live-relay.payky.me/${appOwnerIdPlaceholder}`,
        appOwnerId
      )
    ).toBe(`wss://live-relay.payky.me/${appOwnerId}`)
  })

  test("substitutes it percent-encoded too, so a room is never shared", () => {
    expect(
      resolveTransportUrl(
        "wss://live-relay.payky.me/$%7BappOwnerId%7D",
        appOwnerId
      )
    ).toBe(`wss://live-relay.payky.me/${appOwnerId}`)
  })

  test("writes a URL in the canonical spelling Evolu dials", () => {
    expect(resolveTransportUrl("wss://Evolu.Linky.fit", appOwnerId)).toBe(
      "wss://evolu.linky.fit/"
    )
  })

  test("resolves a URL Evolu cannot dial to null", () => {
    expect(resolveTransportUrl("wss://relay.example/#room", appOwnerId)).toBe(
      null
    )
  })
})

const defaultTransports = createDefaultEvoluTransportUrls("live-relay.payky.me")

describe("createDefaultEvoluTransportUrls", () => {
  test("stores the live relay's room as a placeholder, not as an id", () => {
    const [plainRelay, liveRelay] = defaultTransports

    expect(plainRelay).toBe("wss://evolu.linky.fit")
    expect(liveRelay).toBe(`wss://live-relay.payky.me/${appOwnerIdPlaceholder}`)
    expect(liveRelay).not.toContain(appOwnerId)
  })

  test("puts the live relay under the host the app names", () => {
    expect(createDefaultEvoluTransportUrls("live-relay.finito.fit")[1]).toBe(
      `wss://live-relay.finito.fit/${appOwnerIdPlaceholder}`
    )
  })

  test("resolve to a room id a relay accepts", () => {
    const [, liveRelay] = defaultTransports
    const resolved = resolveTransportUrl(liveRelay, appOwnerId)

    expect(resolved?.slice("wss://live-relay.payky.me/".length)).toMatch(
      /^[A-Za-z0-9_-]+$/u
    )
  })
})

/** Every account row, removed ones included. */
const loadAccountRows = (deviceEvolu: DeviceEvolu) =>
  deviceEvolu.loadQuery(
    createDeviceQuery((db) =>
      db.selectFrom("account").select(["id", "name", "masterKey", "isDeleted"])
    )
  )

const loadTransportUrls = (
  deviceEvolu: DeviceEvolu,
  accountId: DeviceAccountId
) =>
  deviceEvolu
    .loadQuery(
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
    .then((rows) => rows.map(({ url }) => url))

const masterKey = MasterKey("000102030405060708090a0b0c0d0e0f")

describe("deriveDeviceAccountId", () => {
  test("is the same for a master key every time, and differs between keys", () => {
    expect(deriveDeviceAccountId(masterKey)).toMatchInlineSnapshot(
      `"6BTqCU03OKZ5KYiV0QDioQ"`
    )
    expect(deriveDeviceAccountId(masterKey)).toBe(
      deriveDeviceAccountId(masterKey)
    )
    expect(
      deriveDeviceAccountId(MasterKey("0f0e0d0c0b0a09080706050403020100"))
    ).not.toBe(deriveDeviceAccountId(masterKey))
  })
})

describe("createOrSelectAccount", () => {
  test("creates a transferred account with its name and stored transports", async () => {
    await using test = await createTestDeviceEvolu()
    const { deviceEvolu } = test
    const transports = [
      WssUrl("wss://custom.example"),
      WssUrl(`wss://room.example/${appOwnerIdPlaceholder}`),
    ]

    const result = await createOrSelectAccount(deviceEvolu, masterKey, {
      defaultTransports,
      name: NonEmptyString255("Shop"),
      transports,
    })

    expect(result).toEqual({
      accountId: deriveDeviceAccountId(masterKey),
      created: true,
    })
    await expect
      .poll(() => loadAccountRows(deviceEvolu))
      .toMatchObject([{ id: result.accountId, name: "Shop", masterKey }])
    expect(await loadTransportUrls(deviceEvolu, result.accountId)).toEqual(
      expect.arrayContaining(transports)
    )
  })

  test("selecting an existing account leaves its name and transports alone", async () => {
    await using test = await createTestDeviceEvolu()
    const { deviceEvolu } = test
    const first = await createOrSelectAccount(deviceEvolu, masterKey, {
      defaultTransports,
      name: NonEmptyString255("Old"),
    })
    await expect.poll(() => loadAccountRows(deviceEvolu)).toHaveLength(1)

    const second = await createOrSelectAccount(deviceEvolu, masterKey, {
      defaultTransports,
      name: NonEmptyString255("Shop"),
      transports: [WssUrl("wss://custom.example")],
    })

    expect(second).toEqual({ accountId: first.accountId, created: false })
    await expect
      .poll(() => loadAccountRows(deviceEvolu))
      .toMatchObject([{ id: first.accountId, name: "Old" }])
    expect(await loadTransportUrls(deviceEvolu, first.accountId)).not.toContain(
      "wss://custom.example"
    )
  })

  test("adding the same account twice at once writes one row", async () => {
    await using test = await createTestDeviceEvolu()
    const { deviceEvolu } = test

    await Promise.all([
      createOrSelectAccount(deviceEvolu, masterKey, { defaultTransports }),
      createOrSelectAccount(deviceEvolu, masterKey, { defaultTransports }),
    ])

    await expect.poll(() => loadAccountRows(deviceEvolu)).toHaveLength(1)
  })

  test("re-adding a removed account revives its row, name and transports", async () => {
    await using test = await createTestDeviceEvolu()
    const { deviceEvolu } = test
    const { accountId } = await createOrSelectAccount(deviceEvolu, masterKey, {
      defaultTransports,
      name: NonEmptyString255("Shop"),
      transports: [WssUrl("wss://custom.example")],
    })
    removeDeviceAccount(deviceEvolu, accountId)
    await expect
      .poll(() => loadAccountRows(deviceEvolu))
      .toMatchObject([{ id: accountId, isDeleted: sqliteTrue }])

    const readded = await createOrSelectAccount(deviceEvolu, masterKey, {
      defaultTransports,
      name: NonEmptyString255("Other"),
    })

    expect(readded).toEqual({ accountId, created: true })
    await expect
      .poll(() => loadAccountRows(deviceEvolu))
      .toMatchObject([{ id: accountId, name: "Shop", isDeleted: sqliteFalse }])
    expect(await loadTransportUrls(deviceEvolu, accountId)).toEqual([
      "wss://custom.example",
    ])
  })
})

describe("storableNostrPicture", () => {
  test("keeps an https picture and drops data, http and overlong ones", () => {
    const picture = "https://image.example/a.png"

    expect(storableNostrPicture(picture)).toBe(picture)
    expect(storableNostrPicture("data:image/png;base64,AAAA")).toBeNull()
    expect(storableNostrPicture("http://image.example/a.png")).toBeNull()
    expect(
      storableNostrPicture(`https://image.example/${"a".repeat(2048)}`)
    ).toBeNull()
    expect(storableNostrPicture(null)).toBeNull()
  })
})

describe("insertDemoAccount", () => {
  test("adds an active demo account whose relays are all switched off", async () => {
    await using test = await createTestDeviceEvolu()
    const { deviceEvolu } = test
    await createOrSelectAccount(deviceEvolu, masterKey, { defaultTransports })

    const accountId = insertDemoAccount(
      deviceEvolu,
      NonEmptyString255("Demo"),
      defaultTransports
    )

    await expect
      .poll(() => deviceEvolu.loadQuery(activeAccountQuery))
      .toMatchObject([
        {
          id: accountId,
          name: "Demo",
          demo: "pending",
          transports: [],
        },
      ])
    const transports = await deviceEvolu.loadQuery(
      createDeviceQuery((db) =>
        db
          .selectFrom("accountEvoluTransport")
          .select("isActive")
          .where("accountId", "=", accountId)
      )
    )
    expect(transports).toEqual(
      defaultTransports.map(() => ({ isActive: sqliteFalse }))
    )

    markDemoAccountSeeded(deviceEvolu, accountId)
    await expect
      .poll(() => deviceEvolu.loadQuery(activeAccountQuery))
      .toMatchObject([{ id: accountId, demo: "seeded" }])
  })
})

describe("updateDeviceSettings", () => {
  test("changes only the given columns of the one settings row", async () => {
    await using test = await createTestDeviceEvolu()
    const { deviceEvolu } = test
    const loadRow = () =>
      deviceEvolu.loadQuery(
        createDeviceQuery((db) =>
          db
            .selectFrom("deviceSettings")
            .select(["id", "language", "theme"])
            .where("id", "=", deviceSettingsId)
        )
      )

    updateDeviceSettings(deviceEvolu, { language: "cs" })
    updateDeviceSettings(deviceEvolu, { theme: "dark" })

    await expect
      .poll(loadRow)
      .toEqual([{ id: deviceSettingsId, language: "cs", theme: "dark" }])
  })
})
