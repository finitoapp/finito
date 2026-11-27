import { setDeviceAnimations } from "@payky/core/evolu/device-account"
import type { DeviceAnimations } from "@payky/core/evolu/device-client"
import { useAtomValue } from "jotai"
import { useCallback } from "react"
import { deviceEvoluAtom, deviceSettingsQuery } from "../atoms/device-evolu.ts"
import { useDeviceEvoluQuery } from "./use-evolu-query.ts"

/** Whether this device animates (settings/0007, unsynced); `system` until chosen. */
export function useAnimationsPreference(): DeviceAnimations {
  return (
    useDeviceEvoluQuery(deviceSettingsQuery).data[0]?.animations ?? "system"
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
