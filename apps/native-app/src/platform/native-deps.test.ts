import { sqliteFalse, sqliteTrue } from "@evolu/common"
import { serviceProxySettingQuery } from "@payky/core/evolu/device-account"
import type { DeviceEvolu } from "@payky/core/evolu/device-client"
import { afterEach, describe, expect, test, vi } from "vitest"

const network = vi.hoisted(() => ({
  emit: (_state: { isConnected: boolean; isInternetReachable: boolean }) => {},
  removed: 0,
}))
const platform = vi.hoisted(() => ({ OS: "web" as "web" | "android" }))

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

describe("createFetchDep and the service proxy", () => {
  afterEach(() => {
    platform.OS = "web"
    vi.unstubAllGlobals()
  })

  const stubFetch = () => {
    const calls: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        calls.push(input instanceof Request ? input.url : input.toString())
        return new Response("[]")
      })
    )
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
      new URL(
        "/api/proxy/moneta",
        nativeEnv.EXPO_PUBLIC_PAYKY_API_BASE_URL
      ).toString(),
      monetaAccountsUrl,
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
