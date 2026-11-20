import { createStore } from "jotai"
import { describe, expect, test } from "vitest"
import {
  dismissToastAtom,
  showToastAtom,
  toastOffset,
  toastsAtom,
  waitingOrdersNoticeHeightAtom,
  waitingOrdersNoticeRoomAtom,
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
})

describe("the waiting-orders notice's room", () => {
  test("is the notice and the gap under it while it shows, and nothing once it leaves", () => {
    const store = createStore()
    expect(store.get(waitingOrdersNoticeRoomAtom)).toBe(0)
    store.set(waitingOrdersNoticeHeightAtom, 64)
    expect(store.get(waitingOrdersNoticeRoomAtom)).toBe(64 + toastOffset)
    store.set(waitingOrdersNoticeHeightAtom, 0)
    expect(store.get(waitingOrdersNoticeRoomAtom)).toBe(0)
  })
})
