import type { DeviceAnimations } from "@payky/core/evolu/device-client"

/** Whether to draw without animations: `system` follows the OS (settings/0007). */
export const resolveReduceMotion = (
  preference: DeviceAnimations,
  systemReduceMotion: boolean
): boolean =>
  preference === "system" ? systemReduceMotion : preference === "off"
