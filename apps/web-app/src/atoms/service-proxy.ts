import {
  isServiceProxyEnabled,
  serviceProxySettingQuery,
} from "@payky/core/evolu/device-account"
import { atom } from "jotai"
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
 */
export const serviceProxyConsentAtom = atom(async (get) => {
  const deviceEvolu = await get(deviceEvoluAtom)
  deviceEvolu.subscribeQuery(serviceProxySettingQuery)(() => {})
  await deviceEvolu.loadQuery(serviceProxySettingQuery)

  return (): boolean =>
    isServiceProxyEnabled(deviceEvolu.getQueryRows(serviceProxySettingQuery)[0])
})
