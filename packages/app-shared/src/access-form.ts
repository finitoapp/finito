import {
  type AccessPreset,
  accessPresets,
  type Permission,
} from "@payky/core/modules/access/access-types"
import {
  decodePermissions,
  type Pin,
  PinSchema,
} from "@payky/core/modules/access/access-utils"
import type { DeviceId } from "@payky/core/modules/device/device-types"

/** The order presets are offered in. */
export const accessPresetOrder: ReadonlyArray<AccessPreset> = [
  "none",
  "basic",
  "staff",
  "shiftLead",
  "manager",
  "owner",
]

/** The preset a set of permissions equals, if any. */
export const presetOf = (
  granted: ReadonlySet<Permission>
): AccessPreset | null =>
  accessPresetOrder.find((preset) => {
    const presetPermissions = accessPresets[preset]
    return (
      presetPermissions.length === granted.size &&
      presetPermissions.every((permission) => granted.has(permission))
    )
  }) ?? null

/** A copy of `current` with one permission granted or taken away. */
export const withPermission = (
  current: ReadonlySet<Permission>,
  permission: Permission,
  granted: boolean
): ReadonlySet<Permission> => {
  const next = new Set(current)
  if (granted) next.add(permission)
  else next.delete(permission)
  return next
}

/** A PIN field takes digits only, at most the 8 a PIN can have. */
export const sanitizePinInput = (text: string): string =>
  text.replaceAll(/\D/gu, "").slice(0, 8)

export interface NewPinCheck {
  /** The PIN once both fields agree and it is 4-8 digits, else `null`. */
  readonly pin: Pin | null
  /** The first field holds something that is not a valid PIN (yet). */
  readonly invalid: boolean
  /** The repeat differs from the first field. */
  readonly mismatch: boolean
}

/** Validates a new PIN typed twice (access/0001: 4-8 digits). */
export const checkNewPin = (pin: string, repeat: string): NewPinCheck => {
  const parsed = PinSchema.safeParse(pin)
  return {
    pin: parsed.success && pin === repeat ? parsed.data : null,
    invalid: pin !== "" && !parsed.success,
    mismatch: repeat !== "" && repeat !== pin,
  }
}

/**
 * What the turn-on wizard saves for each listed device (access/0004): the
 * chosen preset, Basic for a device the owner left alone.
 */
export const wizardDeviceDefaults = (
  devices: ReadonlyArray<{ readonly id: DeviceId }>,
  presets: Readonly<Record<DeviceId, AccessPreset>>
): ReadonlyArray<{
  readonly id: DeviceId
  readonly permissions: ReadonlyArray<Permission>
}> =>
  devices.map((device) => ({
    id: device.id,
    permissions: accessPresets[presets[device.id] ?? "basic"],
  }))

/**
 * The device list in order of what each device may do (access/0013): those
 * with `admin` first, then by how many permissions they hold, then by name.
 */
export const sortDevicesByPermissions = <
  Device extends {
    readonly name: string
    readonly defaultPermissions: string | null
  },
>(
  devices: ReadonlyArray<Device>
): ReadonlyArray<Device> => {
  const rank = (device: Device) => {
    const granted = decodePermissions(device.defaultPermissions)
    return { admin: granted.has("admin") ? 1 : 0, count: granted.size }
  }
  return devices
    .map((device) => ({ device, ...rank(device) }))
    .sort(
      (a, b) =>
        b.admin - a.admin ||
        b.count - a.count ||
        a.device.name.localeCompare(b.device.name)
    )
    .map(({ device }) => device)
}
