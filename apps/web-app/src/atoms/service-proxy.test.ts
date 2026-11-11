import {
  setServiceProxyEnabled,
  updateDeviceSettings,
} from "@payky/core/evolu/device-account"
import type { DeviceEvolu } from "@payky/core/evolu/device-client"
import { createTestDeviceEvolu } from "@payky/core/testing/device-evolu"
import { createStore } from "jotai"
import { describe, expect, test, vi } from "vitest"
import { consoleOutputHistoryAtom } from "@/atoms/console.ts"
import { serviceProxyConsentAtom } from "@/atoms/service-proxy.ts"

const device = vi.hoisted(() => ({
  evolu: null as DeviceEvolu | null,
}))

vi.mock("@/atoms/device-evolu.ts", async () => {
  const { atom } = await import("jotai")
  return { deviceEvoluAtom: atom(() => device.evolu) }
})

describe("serviceProxyConsentAtom", () => {
  test("hands out one reader that reads the stored consent at each call", async () => {
    await using test = await createTestDeviceEvolu()
    device.evolu = test.deviceEvolu
    updateDeviceSettings(test.deviceEvolu, { language: "en" })
    const store = createStore()

    const isEnabled = await store.get(serviceProxyConsentAtom)
    expect(isEnabled()).toBe(false)

    setServiceProxyEnabled(test.deviceEvolu, true)
    await expect.poll(isEnabled).toBe(true)
    expect(await store.get(serviceProxyConsentAtom)).toBe(isEnabled)

    setServiceProxyEnabled(test.deviceEvolu, false)
    await expect.poll(isEnabled).toBe(false)
  })

  test("reads a consent stored before it was first asked", async () => {
    await using test = await createTestDeviceEvolu()
    device.evolu = test.deviceEvolu
    setServiceProxyEnabled(test.deviceEvolu, true)

    const isEnabled = await createStore().get(serviceProxyConsentAtom)

    expect(isEnabled()).toBe(true)
  })

  test("reads the proxy as off when the first load fails, then follows the consent", async () => {
    await using test = await createTestDeviceEvolu()
    device.evolu = test.deviceEvolu
    vi.spyOn(test.deviceEvolu, "loadQuery").mockRejectedValueOnce(
      new Error("device database unavailable")
    )
    const store = createStore()

    const isEnabled = await store.get(serviceProxyConsentAtom)

    expect(isEnabled()).toBe(false)
    expect(
      store
        .get(consoleOutputHistoryAtom)
        .getEntries()
        .some((entry) => entry.method === "error")
    ).toBe(true)

    setServiceProxyEnabled(test.deviceEvolu, true)
    await expect.poll(isEnabled).toBe(true)
  })
})
