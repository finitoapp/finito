import { createIdFromString, ok, testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"
import { removeAccountFromDevice } from "../../evolu/account-wipe.ts"
import { createAppEvolu } from "../../evolu/client.ts"
import {
  createDefaultEvoluTransportUrls,
  createOrSelectAccount,
} from "../../evolu/device-account.ts"
import { createDeviceEvolu } from "../../evolu/device-client.ts"
import { setupRunWithEvoluDeps } from "../../runtime/node-evolu.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import { createMasterKey } from "../shared/key-derivation.ts"
import { NonEmptyString255 } from "../shared/schema.ts"
import {
  registerDevice,
  removeDevice,
  renameDevice,
  setDeviceDefaultPermissions,
} from "./device-actions.ts"
import { deviceByIdQuery, devicesQuery } from "./device-queries.ts"
import type { DeviceId } from "./device-types.ts"

const deviceId: DeviceId = createIdFromString("test-device")

const register = (name: string, joining = false) =>
  registerDevice({
    id: deviceId,
    name: NonEmptyString255(name),
    deviceType: NonEmptyString255("tablet"),
    browserName: null,
    osName: NonEmptyString255("Android"),
    joining,
  })

describe("device rows", () => {
  test("registering again keeps the name and permissions the owner set", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))

    await run.ok(register("Random Otter"))
    await run.ok(
      renameDevice({ id: deviceId, name: NonEmptyString255("Front till") })
    )
    await run.ok(
      setDeviceDefaultPermissions({ id: deviceId, permissions: ["sell"] })
    )
    await run.ok(register("Another Random Name"))

    expect(await evolu.loadQuery(devicesQuery)).toMatchObject([
      {
        id: deviceId,
        name: "Front till",
        osName: "Android",
        defaultPermissions: '["sell"]',
      },
    ])
  })

  test("a device removed from another one is told so and does not come back", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))
    await run.ok(register("Till", true))
    await run.ok(
      setDeviceDefaultPermissions({
        id: deviceId,
        permissions: ["sell", "admin"],
      })
    )

    await run.ok(removeDevice(deviceId))

    expect(await run.ok(register("Till"))).toBe("removed")
    expect(await evolu.loadQuery(devicesQuery)).toEqual([])
    expect(await evolu.loadQuery(deviceByIdQuery(deviceId))).toMatchObject([
      { isDeleted: 1, defaultPermissions: null },
    ])
  })

  test("a device joining the account again rejoins over its old removal, with no permissions", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))
    await run.ok(register("Till", true))
    await run.ok(
      setDeviceDefaultPermissions({ id: deviceId, permissions: ["admin"] })
    )
    await run.ok(removeDevice(deviceId))

    expect(await run.ok(register("Till", true))).toBe("registered")
    expect(await evolu.loadQuery(deviceByIdQuery(deviceId))).toMatchObject([
      { isDeleted: 0, name: "Till", defaultPermissions: null },
    ])
  })

  test("permissions set before a device first registers stay, and the device names its row", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))
    await run.ok(
      setDeviceDefaultPermissions({ id: deviceId, permissions: ["sell"] })
    )
    expect(await evolu.loadQuery(devicesQuery)).toEqual([])

    await run.ok(register("Samsung SM-A546B", true))

    expect(await evolu.loadQuery(devicesQuery)).toMatchObject([
      {
        id: deviceId,
        name: "Samsung SM-A546B",
        defaultPermissions: '["sell"]',
      },
    ])
  })
})

describe("a removed device signing out", () => {
  test("keeps no data of the account once it has signed out", async () => {
    await using env = await setupRunWithEvoluDeps("memory")
    await using deviceEvolu = await env.run.ok(createDeviceEvolu)
    const masterKey = createMasterKey()
    const openAppEvolu = () =>
      env.run.ok(createAppEvolu({ masterKey, transports: [] }))
    const { accountId } = await createOrSelectAccount(deviceEvolu, masterKey, {
      defaultTransports: createDefaultEvoluTransportUrls("relay.example"),
      deleteLocalData: () => Promise.resolve(ok()),
    })
    await using evolu = await openAppEvolu()
    await using run = testCreateRun(evoluTestDeps(evolu))
    await run.ok(register("Till", true))
    // Another device's removal, as it syncs in.
    await run.ok(removeDevice(deviceId))
    expect(await run.ok(register("Till"))).toBe("removed")

    // What `DeviceRegistration` signs out with (access/0014).
    await using signOutRun = env.run.create({ ...env.run.deps, deviceEvolu })
    const signedOut = await signOutRun(
      removeAccountFromDevice({
        accountId,
        leaveAccount: () => {},
        closeApp: () => {},
      })
    )

    expect(signedOut).toEqual({ ok: true, value: "deviceDeleted" })
    await using reopened = await openAppEvolu()
    expect(await reopened.loadQuery(deviceByIdQuery(deviceId))).toEqual([])
  })
})
