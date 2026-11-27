import type { DeviceAnimations } from "@payky/core/evolu/device-client"
import { AccessibilityInfo } from "react-native"
import { resolveReduceMotion } from "../core/animations-preference.ts"

/**
 * Whether the app draws without animations: the device's choice in
 * settings (settings/0007), which by default follows the system's
 * reduce-motion setting (Android's "Remove animations", what web reads as
 * `prefers-reduced-motion`). Both are kept in module variables, so effects
 * and layout effects read it synchronously; the system's is `false` until
 * its first answer arrives.
 */
let systemReduceMotion = false
let preference: DeviceAnimations = "system"
const listeners = new Set<() => void>()

const setSystemReduceMotion = (reduced: boolean) => {
  systemReduceMotion = reduced
  for (const listener of listeners) listener()
}
void AccessibilityInfo.isReduceMotionEnabled().then(setSystemReduceMotion)
AccessibilityInfo.addEventListener("reduceMotionChanged", setSystemReduceMotion)

export const isReduceMotionEnabled = () =>
  resolveReduceMotion(preference, systemReduceMotion)

/** The device's choice, which the root layout passes on as it reads it. */
export const setAnimationsPreference = (value: DeviceAnimations) => {
  preference = value
}

/** The system's setting alone, for `useSyncExternalStore`. */
export const isSystemReduceMotionEnabled = () => systemReduceMotion

export const subscribeSystemReduceMotion = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
