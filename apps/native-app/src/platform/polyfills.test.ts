import { getRandomValues } from "expo-crypto"
import { afterEach, expect, test, vi } from "vitest"

const startup = vi.hoisted(() => ({ roundedAmount: 0, disposed: false }))

// The native boundary uses Node's CSPRNG in this test; devices use Expo Crypto.
vi.mock("expo-crypto", () => {
  const webcrypto = globalThis.crypto
  return {
    getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
    randomUUID: webcrypto.randomUUID.bind(webcrypto),
  }
})

const quickSubtle = vi.hoisted(() => ({ marker: "quick-crypto subtle" }))
vi.mock("react-native-quick-crypto", () => ({ subtle: quickSubtle }))
// The e2e setup entry imports (`src/e2e/e2e-setup.ts`) reaches for LogBox;
// Evolu's polyfills look up its native modules, which a test has none of.
vi.mock("react-native", () => ({
  LogBox: { ignoreAllLogs: () => {} },
  TurboModuleRegistry: { get: () => null },
}))

vi.mock("expo-router/entry", async () => {
  // Exercise the real polyfills before the Router can evaluate domain imports.
  await using stack = new AsyncDisposableStack()
  stack.defer(() => {
    startup.disposed = true
  })
  const { promise, resolve } = Promise.withResolvers<number>()
  resolve(12300)
  const { checkSharedLogic } = await import("../core/check-shared-logic.ts")
  startup.roundedAmount = checkSharedLogic()
  expect(await promise).toBe(startup.roundedAmount)
  return {}
})

afterEach(() => vi.unstubAllGlobals())

test("installs secure randomness before the router imports shared domain code", async () => {
  vi.stubGlobal("crypto", undefined)
  vi.stubGlobal("AsyncDisposableStack", undefined)

  await import("../../entry.ts")

  expect(globalThis.crypto.getRandomValues).toBe(getRandomValues)
  expect(globalThis.crypto.subtle).toBe(quickSubtle)
  expect(globalThis.crypto.getRandomValues(new Uint8Array(16))).toHaveLength(16)
  expect(startup.roundedAmount).toBe(12300)
  expect(startup.disposed).toBe(true)
})
