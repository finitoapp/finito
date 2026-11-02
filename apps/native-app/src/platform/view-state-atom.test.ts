import { createStore } from "jotai"
import { expect, test, vi } from "vitest"
import { z } from "zod"

const stored = vi.hoisted(() => new Map<string, string>())

vi.mock("react-native-mmkv", () => ({
  createMMKV: () => ({
    getString: (key: string) => stored.get(key),
    set: (key: string, value: string) => stored.set(key, value),
    remove: (key: string) => stored.delete(key),
  }),
}))

import { viewStateAtom } from "./view-state-atom.ts"

const Mode = z.enum(["numpad", "pos"])

test("reads the stored value, writes changes back, and falls back on a bad entry", () => {
  stored.set("mode", JSON.stringify("pos"))
  const modeAtom = viewStateAtom("mode", Mode, "numpad")
  const store = createStore()
  expect(store.get(modeAtom)).toBe("pos")

  store.set(modeAtom, "numpad")
  expect(stored.get("mode")).toBe(JSON.stringify("numpad"))
  // A restart re-creates the atom, which reads the store again.
  expect(createStore().get(viewStateAtom("mode", Mode, "pos"))).toBe("numpad")

  stored.set("stale", JSON.stringify("grid"))
  expect(createStore().get(viewStateAtom("stale", Mode, "numpad"))).toBe(
    "numpad"
  )
  stored.set("corrupt", "{")
  expect(createStore().get(viewStateAtom("corrupt", Mode, "pos"))).toBe("pos")
  expect(createStore().get(viewStateAtom("missing", Mode, "pos"))).toBe("pos")
})
