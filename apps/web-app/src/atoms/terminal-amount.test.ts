import { createStore } from "jotai"
import { describe, expect, test } from "vitest"
import { reloadAppEvoluAtom } from "@/atoms/evolu-counter.ts"
import { terminalAmountInputAtom } from "@/atoms/terminal-amount.ts"

describe("terminalAmountInputAtom", () => {
  test("keeps the typed amount until it is cleared", () => {
    const store = createStore()
    store.set(terminalAmountInputAtom, "12")
    store.set(terminalAmountInputAtom, (current) => `${current}5`)

    expect(store.get(terminalAmountInputAtom)).toBe("125")
  })

  test("drops the amount of the account switched away from", () => {
    const store = createStore()
    store.set(terminalAmountInputAtom, "125")
    store.set(reloadAppEvoluAtom)

    expect(store.get(terminalAmountInputAtom)).toBe("")

    store.set(terminalAmountInputAtom, (current) => `${current}7`)
    expect(store.get(terminalAmountInputAtom)).toBe("7")
  })
})
