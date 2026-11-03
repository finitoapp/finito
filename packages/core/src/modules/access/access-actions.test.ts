import { createIdFromString, testCreateRun } from "@evolu/common"
import { describe, expect, test } from "vitest"
import type { DeviceAccountId } from "../../evolu/device-client.ts"
import { loadPinAttemptLog } from "../../evolu/device-pin-attempts.ts"
import type { Evolu } from "../../evolu/schema.ts"
import { createInProcessLockManager } from "../../runtime/in-process-lock-manager.ts"
import { createTestDateDep } from "../../testing/date-dep.ts"
import { createTestDeviceEvolu } from "../../testing/device-evolu.ts"
import { createEvoluTest } from "../../testing/evolu.ts"
import { evoluTestDeps } from "../../testing/evolu-deps.ts"
import { registerDevice, unblockDevice } from "../device/device-actions.ts"
import { deviceByIdQuery } from "../device/device-queries.ts"
import type { DeviceId } from "../device/device-types.ts"
import {
  createMasterKey,
  masterKeyToMnemonic,
} from "../shared/key-derivation.ts"
import { NonEmptyString255 } from "../shared/schema.ts"
import {
  applyPinUnblock,
  changePin,
  clearPinAttemptLog,
  disableAccessControl,
  enableAccessControl,
  enterPin,
  enterRecoveryPhrase,
} from "./access-actions.ts"
import { accessControlQuery } from "./access-queries.ts"
import { decodePermissions, PinSchema } from "./access-utils.ts"

const accountId: DeviceAccountId = createIdFromString("test-account")
const deviceId: DeviceId = createIdFromString("test-device")
const otherDeviceId: DeviceId = createIdFromString("test-other-device")
const ownerPin = PinSchema.parse("4821")

const setUp = async () => {
  const disposer = new AsyncDisposableStack()
  const { evolu } = disposer.use(await createEvoluTest())
  const { deviceEvolu } = disposer.use(await createTestDeviceEvolu())
  const masterKey = createMasterKey()
  const deps = {
    ...evoluTestDeps(evolu),
    deviceEvolu,
    masterKey,
    lockManager: createInProcessLockManager(),
    ...createTestDateDep(),
  }
  const run = disposer.use(testCreateRun(deps))
  for (const id of [deviceId, otherDeviceId]) {
    await run.ok(
      registerDevice({
        id,
        name: NonEmptyString255(id),
        deviceType: null,
        browserName: null,
        osName: null,
      })
    )
  }
  await run.orThrow(
    enableAccessControl({
      pin: ownerPin,
      devices: [{ id: deviceId, permissions: ["sell", "activity"] }],
    })
  )
  return {
    run,
    evolu,
    deviceEvolu,
    masterKey,
    deps,
    [Symbol.asyncDispose]: () => disposer.disposeAsync(),
  }
}

const tryPin = (pin: string, target = "/catalog/items") =>
  enterPin({ pin, accountId, deviceId, target })

describe("enableAccessControl", () => {
  test("turns access control on with the PIN and the wizard's defaults in one go", async () => {
    await using env = await setUp()

    const [control] = await env.evolu.loadQuery(accessControlQuery)
    expect(control?.enabled).toBe(1)
    const [device] = await env.evolu.loadQuery(deviceByIdQuery(deviceId))
    expect(decodePermissions(device?.defaultPermissions ?? null)).toEqual(
      new Set(["sell", "activity"])
    )
    const [other] = await env.evolu.loadQuery(deviceByIdQuery(otherDeviceId))
    expect(other?.defaultPermissions).toBeNull()
  })

  test("turning it off keeps the PIN, and on again can reuse it", async () => {
    await using env = await setUp()

    await env.run.ok(disableAccessControl())
    await expect(
      env.run(enableAccessControl({ pin: null, devices: [] }))
    ).resolves.toEqual({ ok: true, value: undefined })
    await expect(env.run(tryPin("4821"))).resolves.toMatchObject({ ok: true })
  })

  test("refuses while access control is already on and keeps the stored PIN", async () => {
    await using env = await setUp()
    const [before] = await env.evolu.loadQuery(accessControlQuery)

    await expect(
      env.run(
        enableAccessControl({ pin: PinSchema.parse("9999"), devices: [] })
      )
    ).resolves.toEqual({ ok: false, error: { type: "AccessAlreadyEnabled" } })

    const [after] = await env.evolu.loadQuery(accessControlQuery)
    expect(after?.pin).toBe(before?.pin)
    await expect(env.run(tryPin("4821"))).resolves.toMatchObject({ ok: true })
  })

  test("cannot reuse a PIN that was never set", async () => {
    await using testEvolu = await createEvoluTest()
    const { evolu } = testEvolu
    await using run = testCreateRun({
      ...evoluTestDeps(evolu),
    })

    await expect(
      run(enableAccessControl({ pin: null, devices: [] }))
    ).resolves.toEqual({ ok: false, error: { type: "NoPin" } })
  })
})

describe("enterPin", () => {
  test("logs the attempt and awaits the write before verifying", async () => {
    await using env = await setUp()
    const logLengthsAtVerification: number[] = []
    const observedEvolu = new Proxy(env.evolu, {
      get(target, property, receiver) {
        if (property !== "loadQuery") {
          return Reflect.get(target, property, receiver)
        }
        return async (query: Parameters<Evolu["loadQuery"]>[0]) => {
          if (query === accessControlQuery) {
            const log = await loadPinAttemptLog(env.deviceEvolu, accountId)
            logLengthsAtVerification.push(log.attempts.length)
          }
          return target.loadQuery(query)
        }
      },
    })
    await using run = testCreateRun({ ...env.deps, evolu: observedEvolu })

    await run(tryPin("0000"))
    await run(tryPin("0001"))

    expect(logLengthsAtVerification).toEqual([1, 2])
  })

  test("says how many attempts are left", async () => {
    await using env = await setUp()

    await expect(env.run(tryPin("0000"))).resolves.toEqual({
      ok: false,
      error: { type: "WrongPin", attemptsLeft: 4 },
    })
  })

  test("blocks after five wrong PINs in a row and never verifies again", async () => {
    await using env = await setUp()
    for (const pin of ["0000", "0001", "0002", "0003"]) {
      await env.run(tryPin(pin))
    }

    await expect(env.run(tryPin("0004"))).resolves.toEqual({
      ok: false,
      error: { type: "PinBlocked" },
    })
    // Even the correct PIN is not checked now, and not logged either.
    await expect(env.run(tryPin("4821"))).resolves.toEqual({
      ok: false,
      error: { type: "PinBlocked" },
    })
    expect(
      (await loadPinAttemptLog(env.deviceEvolu, accountId)).attempts
    ).toHaveLength(5)
    const [device] = await env.evolu.loadQuery(deviceByIdQuery(deviceId))
    expect(device?.pinBlockedAt).not.toBeNull()
  })

  test("blocks per account: the device's other accounts keep their PIN entry", async () => {
    await using env = await setUp()
    for (const pin of ["0000", "0001", "0002", "0003", "0004"]) {
      await env.run(tryPin(pin))
    }

    const otherAccount: DeviceAccountId =
      createIdFromString("test-other-account")
    await expect(
      env.run(
        enterPin({
          pin: "4821",
          accountId: otherAccount,
          deviceId,
          target: "/",
        })
      )
    ).resolves.toMatchObject({ ok: true })
  })

  test("a correct PIN returns the failed attempts and only the owner's clear removes them", async () => {
    await using env = await setUp()
    await env.run(tryPin("0000", "/settings/eet"))
    env.deps.advance(1000)
    await env.run(tryPin("0001", "refund"))

    const result = await env.run(tryPin("4821"))

    expect(result).toMatchObject({
      ok: true,
      value: [{ target: "/settings/eet" }, { target: "refund" }],
    })
    // The correct attempt itself is not in the log; the failed ones stay
    // until the owner has seen them.
    expect(
      (await loadPinAttemptLog(env.deviceEvolu, accountId)).attempts
    ).toHaveLength(2)

    await env.run.ok(clearPinAttemptLog({ accountId, deviceId }))

    expect(await loadPinAttemptLog(env.deviceEvolu, accountId)).toMatchObject({
      attempts: [],
      failedInARow: 0,
    })
  })

  test("a changed PIN replaces the old one", async () => {
    await using env = await setUp()

    await env.run.ok(changePin(PinSchema.parse("99887766")))

    await expect(env.run(tryPin("4821"))).resolves.toMatchObject({ ok: false })
    await expect(env.run(tryPin("99887766"))).resolves.toMatchObject({
      ok: true,
    })
  })
})

describe("unblocking", () => {
  const block = async (env: Awaited<ReturnType<typeof setUp>>) => {
    for (const pin of ["0000", "0001", "0002", "0003", "0004"]) {
      await env.run(tryPin(pin))
    }
  }

  test("an unblock token makes earlier attempts stop counting, but keeps them in the log", async () => {
    await using env = await setUp()
    await block(env)

    await env.run.ok(unblockDevice(deviceId))
    const [row] = await env.evolu.loadQuery(deviceByIdQuery(deviceId))
    const token = row?.pinUnblockToken ?? ""
    await env.run.ok(applyPinUnblock({ accountId, deviceId, token }))

    expect(await loadPinAttemptLog(env.deviceEvolu, accountId)).toMatchObject({
      failedInARow: 0,
      unblockToken: token,
    })
    expect(
      (await loadPinAttemptLog(env.deviceEvolu, accountId)).attempts
    ).toHaveLength(5)
    const [unblocked] = await env.evolu.loadQuery(deviceByIdQuery(deviceId))
    expect(unblocked?.pinBlockedAt).toBeNull()
    await expect(env.run(tryPin("0005"))).resolves.toEqual({
      ok: false,
      error: { type: "WrongPin", attemptsLeft: 4 },
    })
  })

  test("a token is applied once, so a stale one does not unblock again", async () => {
    await using env = await setUp()
    await env.run.ok(unblockDevice(deviceId))
    const [row] = await env.evolu.loadQuery(deviceByIdQuery(deviceId))
    const token = row?.pinUnblockToken ?? ""
    await env.run.ok(applyPinUnblock({ accountId, deviceId, token }))
    await block(env)

    await env.run.ok(applyPinUnblock({ accountId, deviceId, token }))

    await expect(env.run(tryPin("4821"))).resolves.toEqual({
      ok: false,
      error: { type: "PinBlocked" },
    })
  })

  test("the recovery phrase works on a blocked device and a wrong one is not an attempt", async () => {
    await using env = await setUp()
    await block(env)

    await expect(
      env.run(
        enterRecoveryPhrase({
          phrase: await masterKeyToMnemonic(createMasterKey()),
          accountId,
        })
      )
    ).resolves.toEqual({ ok: false, error: { type: "WrongRecoveryPhrase" } })

    const result = await env.run(
      enterRecoveryPhrase({
        phrase: await masterKeyToMnemonic(env.masterKey),
        accountId,
      })
    )
    expect(result.ok && result.value).toHaveLength(5)

    await env.run.ok(clearPinAttemptLog({ accountId, deviceId }))
    await expect(env.run(tryPin("4821"))).resolves.toMatchObject({ ok: true })
  })
})
