import {
  isServiceProxyEnabled,
  serviceProxySettingQuery,
} from "@payky/core/evolu/device-account"
import type { DeviceEvolu } from "@payky/core/evolu/device-client"
import { atom } from "jotai"
import { consoleAtom } from "@/atoms/console.ts"
import { deviceEvoluAtom } from "@/atoms/device-evolu.ts"

const serviceProxyConsentReaders = new WeakMap<DeviceEvolu, () => boolean>()

/**
 * The consent reader of one device client, made once: the subscription that
 * keeps its rows current is never released, so caching the reader per client
 * keeps it to one subscription however often the atom is evaluated again.
 */
const serviceProxyConsentReader = (
  deviceEvolu: DeviceEvolu
): (() => boolean) => {
  const known = serviceProxyConsentReaders.get(deviceEvolu)
  if (known !== undefined) return known

  deviceEvolu.subscribeQuery(serviceProxySettingQuery)(() => {})
  const isEnabled = (): boolean =>
    isServiceProxyEnabled(deviceEvolu.getQueryRows(serviceProxySettingQuery)[0])
  serviceProxyConsentReaders.set(deviceEvolu, isEnabled)
  return isEnabled
}

/**
 * A reader of the device's consent to the service proxy, for the browser's
 * fetch (`createFetchDep`) to ask at each request. The function itself never
 * changes, so nothing that holds it — a run's deps, the background jobs' —
 * is recreated when the consent is turned on or off; it reads the setting's
 * row from device Evolu's cache at the moment of the call.
 *
 * Evolu keeps refreshing only the rows of a subscribed query, so the query
 * stays subscribed for as long as the device client lives — the whole app
 * session, once per client (`serviceProxyConsentReader`) — and the atom resolves once its first rows are loaded, so the
 * first request already reads the stored consent rather than a default.
 *
 * Never rejects: `useAppRun` and the bank jobs read it, so a rejection would
 * take every screen that makes a run into its error boundary. A first load
 * that fails is logged, and the reader reads the proxy as off until the
 * subscription delivers the setting's rows, as Finito's
 * `serviceProxyConsent` does.
 */
export const serviceProxyConsentAtom = atom(async (get) => {
  const deviceEvolu = await get(deviceEvoluAtom)
  const console = get(consoleAtom)
  const isEnabled = serviceProxyConsentReader(deviceEvolu)
  try {
    await deviceEvolu.loadQuery(serviceProxySettingQuery)
  } catch (error) {
    console.error("Loading the service proxy consent failed.", error)
  }

  return isEnabled
})
