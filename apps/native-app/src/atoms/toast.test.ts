import { createStore } from "jotai"
import { describe, expect, test } from "vitest"
import {
  dismissToastAtom,
  showToastAtom,
  toastLifetimeMs,
  toastsAtom,
} from "./toast.ts"

describe("toast queue", () => {
  test("enqueues with distinct ids and dismisses by id", () => {
    const store = createStore()
    const a = store.set(showToastAtom, { variant: "success", message: "a" })
    const b = store.set(showToastAtom, { variant: "error", message: "b" })
    expect(a).not.toBe(b)
    expect(store.get(toastsAtom).map((toast) => toast.message)).toEqual([
      "a",
      "b",
    ])
    store.set(dismissToastAtom, a)
    expect(store.get(toastsAtom).map((toast) => toast.message)).toEqual(["b"])
  })

  test("keeps a toast that names its length for that long, and any other for 4 seconds", () => {
    expect(
      toastLifetimeMs({
        id: 1,
        variant: "default",
        message: "Nová objednávka 1",
        durationMs: 30_000,
      })
    ).toBe(30_000)
    expect(
      toastLifetimeMs({ id: 2, variant: "success", message: "Uloženo" })
    ).toBe(4000)
  })
})
