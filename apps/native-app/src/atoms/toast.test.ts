import { createStore } from "jotai"
import { describe, expect, test } from "vitest"
import { dismissToastAtom, showToastAtom, toastsAtom } from "./toast.ts"

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
})
