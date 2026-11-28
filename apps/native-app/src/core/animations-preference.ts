import type { DeviceAnimations } from "@payky/core/evolu/device-client"

/** Whether to draw without animations: `system` follows the OS (settings/0007). */
export const resolveReduceMotion = (
  preference: DeviceAnimations,
  systemReduceMotion: boolean
): boolean =>
  preference === "system" ? systemReduceMotion : preference === "off"

/** Makers of the card terminals Finito runs on, lowercased (settings/0008). */
const cardTerminalMakers: ReadonlySet<string> = new Set(["pax", "nexgo"])

/**
 * What a device that has not chosen yet gets, from its Android
 * manufacturer: Off on a card terminal, Auto anywhere else (settings/0008).
 */
export const defaultAnimations = (manufacturer: string): DeviceAnimations =>
  cardTerminalMakers.has(manufacturer.toLowerCase()) ? "off" : "system"
