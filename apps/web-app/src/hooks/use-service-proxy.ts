import { Capacitor } from "@capacitor/core"
import {
  isServiceProxyEnabled,
  serviceProxySettingQuery,
  setServiceProxyEnabled,
} from "@payky/core/evolu/device-account"
import { useAtomValue } from "jotai"
import { useCallback } from "react"
import { deviceEvoluAtom } from "@/atoms/device-evolu.ts"
import { useDeviceEvoluQuery } from "@/hooks/use-device-evolu-query.ts"

/** Whether this device allowed the proxy for services without CORS. */
export function useServiceProxyEnabled(): boolean {
  const { data } = useDeviceEvoluQuery(serviceProxySettingQuery)
  return isServiceProxyEnabled(data[0])
}

export function useSetServiceProxyEnabled() {
  const deviceEvolu = useAtomValue(deviceEvoluAtom)

  return useCallback(
    (enabled: boolean) => {
      setServiceProxyEnabled(deviceEvolu, enabled)
    },
    [deviceEvolu]
  )
}

/**
 * Whether this device can call the banks (Fio, MONETA): the native app
 * always can, a browser only through the service proxy it allowed — neither
 * bank answers a browser's CORS preflight.
 */
export function useCanReachBanks(): boolean {
  const serviceProxyEnabled = useServiceProxyEnabled()
  return Capacitor.isNativePlatform() || serviceProxyEnabled
}
