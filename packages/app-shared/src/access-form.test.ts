import { accessPresets } from "@payky/core/modules/access/access-types"
import type { DeviceId } from "@payky/core/modules/device/device-types"
import { describe, expect, it } from "vitest"
import {
  accessPresetOrder,
  checkNewPin,
  presetOf,
  sanitizePinInput,
  sortDevicesByPermissions,
  withPermission,
  wizardDeviceDefaults,
} from "./access-form.ts"

const deviceId = (value: string) => value as DeviceId

describe("presetOf", () => {
  it("names every preset by its permissions, in any order", () => {
    for (const preset of accessPresetOrder) {
      expect(presetOf(new Set([...accessPresets[preset]].reverse()))).toBe(
        preset
      )
    }
  })

  it("is null for a hand-edited set", () => {
    expect(presetOf(new Set(["sell"]))).toBeNull()
    expect(presetOf(new Set([...accessPresets.basic, "admin"]))).toBeNull()
  })
})

describe("withPermission", () => {
  it("returns a new set and leaves the old one alone", () => {
    const before = new Set<"sell">(["sell"])
    const after = withPermission(before, "admin", true)
    expect([...before]).toEqual(["sell"])
    expect([...after].sort()).toEqual(["admin", "sell"])
    expect([...withPermission(after, "sell", false)]).toEqual(["admin"])
  })
})

describe("sanitizePinInput", () => {
  it("keeps digits only, at most 8", () => {
    expect(sanitizePinInput("12 a34-5678 9")).toBe("12345678")
  })
})

describe("checkNewPin", () => {
  it("accepts a 4-8 digit PIN that is repeated", () => {
    expect(checkNewPin("1234", "1234")).toEqual({
      pin: "1234",
      invalid: false,
      mismatch: false,
    })
  })

  it("gives no PIN until the repeat agrees", () => {
    expect(checkNewPin("1234", "")).toMatchObject({
      pin: null,
      mismatch: false,
    })
    expect(checkNewPin("1234", "123")).toMatchObject({
      pin: null,
      mismatch: true,
    })
  })

  it("rejects a PIN that is too short, with no repeat error while empty", () => {
    expect(checkNewPin("123", "123")).toEqual({
      pin: null,
      invalid: true,
      mismatch: false,
    })
    expect(checkNewPin("", "")).toEqual({
      pin: null,
      invalid: false,
      mismatch: false,
    })
  })
})

describe("wizardDeviceDefaults", () => {
  it("presets every listed device to Basic unless the owner chose", () => {
    const a = deviceId("a")
    const b = deviceId("b")
    expect(
      wizardDeviceDefaults([{ id: a }, { id: b }], { [b]: "owner" })
    ).toEqual([
      { id: a, permissions: accessPresets.basic },
      { id: b, permissions: accessPresets.owner },
    ])
  })
})

describe("sortDevicesByPermissions", () => {
  it("lists admins first, then by how much a device may do, then by name", () => {
    const device = (
      name: string,
      permissions: ReadonlyArray<string> | null
    ) => ({
      name,
      defaultPermissions:
        permissions === null ? null : JSON.stringify(permissions),
    })
    const sorted = sortDevicesByPermissions([
      device("Kiosk", null),
      device("Bar", ["sell"]),
      device("Owner phone", ["admin"]),
      device("Back office", ["sell", "stats", "catalog"]),
      device("Anna's phone", ["sell"]),
      device("Manager", ["admin", "sell"]),
    ])
    expect(sorted.map(({ name }) => name)).toEqual([
      "Manager",
      "Owner phone",
      "Back office",
      "Anna's phone",
      "Bar",
      "Kiosk",
    ])
  })
})
