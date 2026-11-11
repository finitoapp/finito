import {
  isServiceProxyEnabled,
  serviceProxySettingQuery,
  setServiceProxyEnabled,
} from "@payky/core/evolu/device-account"
import { useAtomValue } from "jotai"
import { useCallback } from "react"
import { Platform } from "react-native"
import { deviceEvoluAtom } from "../atoms/device-evolu.ts"
import { useDeviceEvoluQuery } from "./use-evolu-query.ts"

/**
 * Whether this device allowed the service proxy (service-proxy/0001), as
 * web's hook: `null`, the state every device starts in, reads as off.
 */
export function useServiceProxyEnabled(): boolean {
  return isServiceProxyEnabled(
    useDeviceEvoluQuery(serviceProxySettingQuery).data[0]
  )
}

/** Turns the device's consent to the service proxy on or off. */
export function useSetServiceProxyEnabled() {
  const deviceEvolu = useAtomValue(deviceEvoluAtom)
  return useCallback(
    (enabled: boolean) => setServiceProxyEnabled(deviceEvolu, enabled),
    [deviceEvolu]
  )
}

/**
 * Whether this device can reach Fio and MONETA: the APK calls them directly,
 * which has no CORS limit, while the app's web build (the PWA) reaches them
 * only through the service proxy, once the device allowed it.
 */
export function useCanReachBanks(): boolean {
  const proxyEnabled = useServiceProxyEnabled()
  return Platform.OS !== "web" || proxyEnabled
}
