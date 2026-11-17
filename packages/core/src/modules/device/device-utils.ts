import type { DeviceLanguage } from "../../evolu/device-client.ts"

export function getPreferredDeviceLanguage(
  navigatorLanguage: string
): DeviceLanguage {
  if (navigatorLanguage.startsWith("cs")) {
    return "cs"
  }

  if (navigatorLanguage.startsWith("sk")) {
    return "sk"
  }

  return "en"
}

const firstLetterUpper = (value: string) =>
  value.slice(0, 1).toUpperCase() + value.slice(1)

/**
 * The name a new device starts with (access/0013): its maker and model when
 * known ("Samsung SM-A546B"), else its browser and system ("Chrome · macOS"),
 * else `null`, for the caller's random name. Language-neutral, since the name
 * syncs to devices set to other languages.
 */
export const defaultDeviceName = (device: {
  readonly vendor: string | null | undefined
  readonly model: string | null | undefined
  readonly browserName: string | null | undefined
  readonly osName: string | null | undefined
}): string | null => {
  const vendor = device.vendor?.trim() ?? ""
  const model = device.model?.trim() ?? ""
  const browser = device.browserName?.trim() ?? ""
  const os = device.osName?.trim() ?? ""
  const name =
    model !== ""
      ? vendor === "" || model.toLowerCase().startsWith(vendor.toLowerCase())
        ? model
        : `${firstLetterUpper(vendor)} ${model}`
      : browser !== "" && os !== ""
        ? `${browser} · ${os}`
        : vendor !== "" && os !== ""
          ? `${firstLetterUpper(vendor)} · ${os}`
          : ""
  return name === "" ? null : name.slice(0, 255)
}
