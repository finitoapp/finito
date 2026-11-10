import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs"
import { hostname, tmpdir, type } from "node:os"
import { join } from "node:path"
import { testCreateRun } from "@evolu/common"
import { renameDevice } from "@payky/core/modules/device/device-actions"
import { devicesQuery } from "@payky/core/modules/device/device-queries"
import { NonEmptyString255 } from "@payky/core/modules/shared/schema"
import { createEvoluTest } from "@payky/core/testing/evolu"
import { evoluTestDeps } from "@payky/core/testing/evolu-deps"
import { describe, expect, onTestFinished, test } from "vitest"
import { loadOrCreateCliDeviceId, registerCliDevice } from "./cli-device.ts"

const dataDirectory = () => {
  const directory = mkdtempSync(join(tmpdir(), "payky-cli-device-"))
  onTestFinished(() => rmSync(directory, { recursive: true, force: true }))
  return directory
}

describe("CLI device", () => {
  test("keeps one device id per data directory, in a file only its user reads", () => {
    const directory = dataDirectory()

    const first = loadOrCreateCliDeviceId(directory)
    const again = loadOrCreateCliDeviceId(directory)
    const other = loadOrCreateCliDeviceId(dataDirectory())

    expect(again).toBe(first)
    expect(other).not.toBe(first)
    expect(statSync(join(directory, "device-id")).mode & 0o777).toBe(0o600)
  })

  test("refuses a device id file that holds no device id", () => {
    const directory = dataDirectory()
    writeFileSync(join(directory, "device-id"), "not a device id")

    expect(() => loadOrCreateCliDeviceId(directory)).toThrow()
  })

  test("registers as a device named after the computer, holding no permissions, and keeps a name the owner gave it", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun(evoluTestDeps(evolu))
    const deviceId = loadOrCreateCliDeviceId(dataDirectory())

    await run.ok(registerCliDevice(deviceId))
    const registered = await evolu.loadQuery(devicesQuery)
    await run.ok(
      renameDevice({ id: deviceId, name: NonEmptyString255("Office Mac") })
    )
    await run.ok(registerCliDevice(deviceId))

    expect(registered).toMatchObject([
      {
        id: deviceId,
        name: `CLI on ${hostname()}`,
        deviceType: "cli",
        osName: type(),
        defaultPermissions: null,
      },
    ])
    expect(await evolu.loadQuery(devicesQuery)).toMatchObject([
      { id: deviceId, name: "Office Mac" },
    ])
  })
})
