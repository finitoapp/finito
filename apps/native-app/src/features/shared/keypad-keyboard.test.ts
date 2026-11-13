import { MAX_SCAN_KEY_GAP_MS } from "@payky/app-shared/hardware-scan"
import { describe, expect, it } from "vitest"
import {
  initialKeypadKeyboardState,
  keypadKeyAction,
  readKeypadKey,
} from "./keypad-keyboard.ts"

/** Types `keys` `gap` ms apart onto `amount`, as the hook folds them. */
const type = (keys: ReadonlyArray<string>, gap: number, amount = "") => {
  let state = initialKeypadKeyboardState
  let current = amount
  const charges: string[] = []
  keys.forEach((key, index) => {
    const result = readKeypadKey(
      state,
      { key, timeStamp: 1000 + index * gap },
      current,
      "EUR"
    )
    state = result.state
    current = result.amount
    if (result.charge) charges.push(current)
  })
  return { amount: current, charges }
}

const typing = 200
const scanning = MAX_SCAN_KEY_GAP_MS / 5

describe("keypadKeyAction", () => {
  it("maps keys as web's keypad does", () => {
    expect(keypadKeyAction("7")).toEqual({ type: "type", key: "7" })
    expect(keypadKeyAction(".")).toEqual({ type: "type", key: "." })
    expect(keypadKeyAction(",")).toEqual({ type: "type", key: "." })
    expect(keypadKeyAction("Backspace")).toEqual({ type: "type", key: "<" })
    expect(keypadKeyAction("Delete")).toEqual({ type: "clear" })
    expect(keypadKeyAction("Escape")).toEqual({ type: "clear" })
    expect(keypadKeyAction("Enter")).toEqual({ type: "charge" })
    expect(keypadKeyAction("a")).toBeNull()
    expect(keypadKeyAction("Shift")).toBeNull()
  })
})

describe("readKeypadKey", () => {
  it("types, corrects and charges the amount on screen", () => {
    expect(type(["5", ",", "9", "Backspace", "7", "Enter"], typing)).toEqual({
      amount: "5.7",
      charges: ["5.7"],
    })
  })

  it("clears on Escape", () => {
    expect(type(["Escape"], typing, "12.5").amount).toBe("")
  })

  it("leaves keys it does not know unhandled", () => {
    const result = readKeypadKey(
      initialKeypadKeyboardState,
      { key: "a", timeStamp: 0 },
      "3",
      "EUR"
    )
    expect(result).toMatchObject({ amount: "3", handled: false, charge: false })
  })

  it("undoes a scan burst instead of charging it", () => {
    const scan = [..."12345678", "Enter"]
    expect(type(scan, scanning, "4.2")).toEqual({ amount: "4.2", charges: [] })
  })

  it("undoes only the burst, keeping what was typed before it", () => {
    let state = initialKeypadKeyboardState
    let amount = ""
    const keys: ReadonlyArray<readonly [string, number]> = [
      ["3", 0],
      ["9", 500],
      ["4", 505],
      ["0", 510],
      ["0", 515],
      ["Enter", 520],
    ]
    for (const [key, timeStamp] of keys) {
      const result = readKeypadKey(state, { key, timeStamp }, amount, "EUR")
      state = result.state
      amount = result.amount
      expect(result.charge).toBe(false)
    }
    expect(amount).toBe("3")
  })

  it("charges a fast short entry, which no scan is", () => {
    expect(type(["1", "2", "Enter"], scanning).charges).toEqual(["12"])
  })

  it("undoes an alphanumeric scan whose letters the keypad ignores", () => {
    const scan = ["Shift", "A", "1", "2", "3", "Enter"]
    expect(type(scan, scanning, "8")).toEqual({ amount: "8", charges: [] })
  })
})
