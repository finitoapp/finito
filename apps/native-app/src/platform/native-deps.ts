import type { ConnectivityDep, FetchDep } from "@payky/core/deps"
import {
  isServiceProxyEnabled,
  serviceProxySettingQuery,
} from "@payky/core/evolu/device-account"
import type { DeviceEvolu } from "@payky/core/evolu/device-client"
import { createServiceProxyFetch } from "@payky/core/integrations/service-proxy/service-proxy-fetch"
import { addNetworkStateListener } from "expo-network"
import { Platform } from "react-native"
import { nativeEnv } from "../core/native-env.ts"
import { e2eFetchInput } from "../e2e/e2e-fetch.ts"

// React Native has no CORS, so the plain global fetch is the whole dep, except
// that its aborted-request error is a generic Error. Core recognizes an abort by
// the signal's reason (Evolu's AbortError), so rethrow that instead.
const nativeFetch: typeof globalThis.fetch = async (input, init) => {
  try {
    return await globalThis.fetch(e2eFetchInput(input), init)
  } catch (error) {
    if (init?.signal?.aborted) throw init.signal.reason
    throw error
  }
}

const serviceProxyConsents = new WeakMap<DeviceEvolu, () => boolean>()

/**
 * The device's consent to the service proxy, read when it is asked, never
 * captured: Evolu's rows of `serviceProxySettingQuery`, kept current by one
 * subscription per device database that lives as long as it does. So
 * turning the consent on or off reaches every fetch already handed out, and
 * nothing that holds one, the background jobs' runs included, is recreated.
 * Until the first load answers it reads as off; whatever calls a bank first
 * waits on that load through `useCanReachBanks`.
 */
export const serviceProxyConsent = (
  deviceEvolu: DeviceEvolu
): (() => boolean) => {
  const known = serviceProxyConsents.get(deviceEvolu)
  if (known !== undefined) return known

  deviceEvolu.subscribeQuery(serviceProxySettingQuery)(() => {})
  // A device database that fails to load leaves the proxy off; the screens
  // reading it show that failure.
  deviceEvolu.loadQuery(serviceProxySettingQuery).catch(() => undefined)
  const isEnabled = () =>
    isServiceProxyEnabled(deviceEvolu.getQueryRows(serviceProxySettingQuery)[0])
  serviceProxyConsents.set(deviceEvolu, isEnabled)
  return isEnabled
}

/**
 * Where the PWA finds the service proxy. The proxy answers only its own
 * origin (service-proxy/0001), and a deployed PWA is always served by the
 * Vercel project whose `/api` holds it, so a deployed build calls the page's
 * own origin: `app.finito.fit`, `edge.app.finito.fit` and every `*.vercel.app`
 * alias of either alike. `EXPO_PUBLIC_PAYKY_API_BASE_URL` cannot decide this,
 * as web's `VITE_PAYKY_API_BASE_URL` does for Payky: it defaults to the
 * brand's API, so unset and set look the same, and the edge project sets it,
 * which would send its aliases to `edge.app.finito.fit` and its 421. Only a
 * build served without `/api` calls the configured API instead: Expo's dev
 * server (`__DEV__`, `localhost:8081`, which an edge deployment allows through
 * `PAYKY_SERVICE_PROXY_ALLOWED_ORIGINS`) and the e2e builds, whose API is the
 * mock server.
 */
const serviceProxyBaseUrl = (): string =>
  __DEV__ || nativeEnv.EXPO_PUBLIC_PAYKY_E2E
    ? nativeEnv.EXPO_PUBLIC_PAYKY_API_BASE_URL
    : window.location.origin

/**
 * The app's fetch. Given the device database, the web build (the PWA) sends
 * the calls to services that answer no CORS preflight (Fio, MONETA) through
 * the service proxy (`serviceProxyBaseUrl`) once the device allowed it
 * (service-proxy/0001); the APK has no CORS limit and always calls them
 * directly. A dep made without it (Cashu's, the previews') never reaches
 * those services.
 */
export const createFetchDep = ({
  deviceEvolu,
}: {
  readonly deviceEvolu?: DeviceEvolu
} = {}): FetchDep => ({
  fetch:
    Platform.OS === "web" && deviceEvolu !== undefined
      ? createServiceProxyFetch({
          fetch: nativeFetch,
          apiBaseUrl: serviceProxyBaseUrl(),
          isEnabled: serviceProxyConsent(deviceEvolu),
        })
      : nativeFetch,
})

/** Fires on a transition to connected and internet-reachable, as the web `online` event; the first reported state is not a transition. */
export const createConnectivityDep = (): ConnectivityDep => ({
  connectivity: {
    onOnline: (listener) => {
      let online: boolean | undefined
      const subscription = addNetworkStateListener((state) => {
        const next =
          state.isConnected === true && state.isInternetReachable === true
        const wasOnline = online
        online = next
        if (next && wasOnline === false) listener()
      })
      return () => subscription.remove()
    },
  },
})
