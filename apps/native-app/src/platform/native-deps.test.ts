import { sqliteFalse, sqliteTrue } from "@evolu/common"
import { serviceProxySettingQuery } from "@payky/core/evolu/device-account"
import type { DeviceEvolu } from "@payky/core/evolu/device-client"
import {
  SERVICE_PROXY_RELAYED,
  SERVICE_PROXY_RELAYED_HEADER,
} from "@payky/core/integrations/service-proxy/service-proxy-services"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const network = vi.hoisted(() => ({
  emit: (_state: { isConnected: boolean; isInternetReachable: boolean }) => {},
  removed: 0,
}))
const platform = vi.hoisted(() => ({ OS: "web" as "web" | "android" }))
const e2eBuild = vi.hoisted(() => ({ enabled: false }))

vi.mock("expo-network", () => ({
  addNetworkStateListener: (cb: typeof network.emit) => {
    network.emit = cb
    return { remove: () => network.removed++ }
  },
}))
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return platform.OS
    },
  },
}))
vi.mock("../core/native-env.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../core/native-env.ts")>()
  return {
    ...actual,
    nativeEnv: new Proxy(actual.nativeEnv, {
      get: (target, key) =>
        key === "EXPO_PUBLIC_PAYKY_E2E"
          ? e2eBuild.enabled
          : Reflect.get(target, key),
    }),
  }
})

import { nativeEnv } from "../core/native-env.ts"
import {
  createConnectivityDep,
  createFetchDep,
  serviceProxyConsent,
} from "./native-deps.ts"

test("fires on offline to online only, not for the first state, and unsubscribe removes the listener", () => {
  const listener = vi.fn()
  const off = createConnectivityDep().connectivity.onOnline(listener)
  const up = { isConnected: true, isInternetReachable: true }
  network.emit(up)
  expect(listener).not.toHaveBeenCalled()
  network.emit({ isConnected: false, isInternetReachable: false })
  expect(listener).not.toHaveBeenCalled()
  network.emit(up)
  expect(listener).toHaveBeenCalledTimes(1)
  network.emit(up)
  expect(listener).toHaveBeenCalledTimes(1)
  network.emit({ isConnected: true, isInternetReachable: false })
  network.emit(up)
  expect(listener).toHaveBeenCalledTimes(2)
  off()
  expect(network.removed).toBe(1)
})

/**
 * A device database whose consent row the test sets, read back as Evolu's
 * cached rows of `serviceProxySettingQuery`.
 */
const createConsentDeviceEvolu = () => {
  const state = {
    consent: null as typeof sqliteTrue | typeof sqliteFalse | null,
    subscriptions: 0,
    loads: 0,
  }
  const deviceEvolu = {
    subscribeQuery: (query: unknown) => {
      expect(query).toBe(serviceProxySettingQuery)
      return () => {
        state.subscriptions++
        return () => {}
      }
    },
    loadQuery: (query: unknown) => {
      expect(query).toBe(serviceProxySettingQuery)
      state.loads++
      return Promise.resolve([])
    },
    getQueryRows: (query: unknown) => {
      expect(query).toBe(serviceProxySettingQuery)
      return [{ id: "settings", serviceProxyEnabled: state.consent }]
    },
  } as unknown as DeviceEvolu
  return { state, deviceEvolu }
}

const monetaAccountsUrl = "https://api.moneta.cz/api/v4/vip/aisp/my/accounts"
/** A `*.vercel.app` alias of a Finito deployment, never the configured API. */
const aliasOrigin = "https://finito-edge-a1b2c3.vercel.app"

describe("createFetchDep and the service proxy", () => {
  beforeEach(() => {
    vi.stubGlobal("__DEV__", false)
    vi.stubGlobal("window", { location: { origin: aliasOrigin } })
  })

  afterEach(() => {
    platform.OS = "web"
    e2eBuild.enabled = false
    vi.unstubAllGlobals()
  })

  /** Records each call's URL; a call to the proxy comes back relayed. */
  const stubFetch = () => {
    const calls: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : input.toString()
        calls.push(url)
        return new Response("[]", {
          headers: url.includes("/api/proxy/")
            ? { [SERVICE_PROXY_RELAYED_HEADER]: SERVICE_PROXY_RELAYED }
            : {},
        })
      })
    )
    return calls
  }

  const fetchMonetaThroughProxy = async () => {
    const calls = stubFetch()
    const { state, deviceEvolu } = createConsentDeviceEvolu()
    state.consent = sqliteTrue
    await createFetchDep({ deviceEvolu }).fetch(monetaAccountsUrl)
    return calls
  }

  test("reads the consent at each call in the web build, so a fetch handed out earlier follows it", async () => {
    const calls = stubFetch()
    const { state, deviceEvolu } = createConsentDeviceEvolu()
    const { fetch } = createFetchDep({ deviceEvolu })

    await fetch(monetaAccountsUrl)
    state.consent = sqliteTrue
    await fetch(monetaAccountsUrl)
    state.consent = sqliteFalse
    await fetch(monetaAccountsUrl)

    expect(calls).toEqual([
      monetaAccountsUrl,
      `${aliasOrigin}/api/proxy/moneta`,
      monetaAccountsUrl,
    ])
  })

  test("proxies through the page's own origin in a deployed PWA, an alias whose origin is not the configured API included", async () => {
    expect(new URL(nativeEnv.EXPO_PUBLIC_PAYKY_API_BASE_URL).origin).not.toBe(
      aliasOrigin
    )

    expect(await fetchMonetaThroughProxy()).toEqual([
      `${aliasOrigin}/api/proxy/moneta`,
    ])
  })

  test("proxies through the configured API from Expo's dev server, which has no /api of its own", async () => {
    vi.stubGlobal("__DEV__", true)
    vi.stubGlobal("window", { location: { origin: "http://localhost:8081" } })

    expect(await fetchMonetaThroughProxy()).toEqual([
      new URL(
        "/api/proxy/moneta",
        nativeEnv.EXPO_PUBLIC_PAYKY_API_BASE_URL
      ).toString(),
    ])
  })

  test("proxies through the configured API, the mock server, in an e2e build", async () => {
    e2eBuild.enabled = true

    expect(await fetchMonetaThroughProxy()).toEqual([
      new URL(
        "/api/proxy/moneta",
        nativeEnv.EXPO_PUBLIC_PAYKY_API_BASE_URL
      ).toString(),
    ])
  })

  test("keeps the consent current through one subscription per device database", () => {
    const { state, deviceEvolu } = createConsentDeviceEvolu()

    createFetchDep({ deviceEvolu })
    createFetchDep({ deviceEvolu })

    expect(serviceProxyConsent(deviceEvolu)).toBe(
      serviceProxyConsent(deviceEvolu)
    )
    expect(state.subscriptions).toBe(1)
    expect(state.loads).toBe(1)
  })

  test("calls the banks directly in the APK, whatever the consent", async () => {
    platform.OS = "android"
    const calls = stubFetch()
    const { state, deviceEvolu } = createConsentDeviceEvolu()
    state.consent = sqliteTrue

    await createFetchDep({ deviceEvolu }).fetch(monetaAccountsUrl)

    expect(calls).toEqual([monetaAccountsUrl])
    expect(state.subscriptions).toBe(0)
  })

  test("still rethrows an aborted request's reason through the proxy", async () => {
    const reason = new Error("aborted by the caller")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Network request failed")
      })
    )
    const { state, deviceEvolu } = createConsentDeviceEvolu()
    state.consent = sqliteTrue
    const controller = new AbortController()
    controller.abort(reason)

    await expect(
      createFetchDep({ deviceEvolu }).fetch(monetaAccountsUrl, {
        signal: controller.signal,
      })
    ).rejects.toBe(reason)
  })
})
