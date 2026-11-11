import {
  isServiceProxyEnabled,
  serviceProxySettingQuery,
} from "@payky/core/evolu/device-account"
import { atom } from "jotai"
import { consoleAtom } from "@/atoms/console.ts"
import { deviceEvoluAtom } from "@/atoms/device-evolu.ts"

/**
 * A reader of the device's consent to the service proxy, for the browser's
 * fetch (`createFetchDep`) to ask at each request. The function itself never
 * changes, so nothing that holds it — a run's deps, the background jobs' —
 * is recreated when the consent is turned on or off; it reads the setting's
 * row from device Evolu's cache at the moment of the call.
 *
 * Evolu keeps refreshing only the rows of a subscribed query, so the query
 * stays subscribed for as long as the device client lives — the whole app
 * session — and the atom resolves once its first rows are loaded, so the
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
  deviceEvolu.subscribeQuery(serviceProxySettingQuery)(() => {})
  try {
    await deviceEvolu.loadQuery(serviceProxySettingQuery)
  } catch (error) {
    console.error("Loading the service proxy consent failed.", error)
  }

  return (): boolean =>
    isServiceProxyEnabled(deviceEvolu.getQueryRows(serviceProxySettingQuery)[0])
})
