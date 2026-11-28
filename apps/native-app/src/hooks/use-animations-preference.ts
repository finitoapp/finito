import { setDeviceAnimations } from "@payky/core/evolu/device-account"
import type { DeviceAnimations } from "@payky/core/evolu/device-client"
import { useAtomValue } from "jotai"
import { useCallback } from "react"
import { Platform } from "react-native"
import { deviceEvoluAtom, deviceSettingsQuery } from "../atoms/device-evolu.ts"
import { defaultAnimations } from "../core/animations-preference.ts"
import { useDeviceEvoluQuery } from "./use-evolu-query.ts"

/** Until the device chooses: Off on a card terminal, else Auto (settings/0008). */
const unchosenAnimations = defaultAnimations(
  Platform.OS === "android" ? Platform.constants.Manufacturer : ""
)

/** Whether this device animates (settings/0007, unsynced). */
export function useAnimationsPreference(): DeviceAnimations {
  return (
    useDeviceEvoluQuery(deviceSettingsQuery).data[0]?.animations ??
    unchosenAnimations
  )
}

/** Writes whether this device animates. */
export function useSetAnimationsPreference() {
  const deviceEvolu = useAtomValue(deviceEvoluAtom)

  return useCallback(
    (animations: DeviceAnimations) =>
      setDeviceAnimations(deviceEvolu, animations),
    [deviceEvolu]
  )
}
