import {
  type AmountKeypadKey,
  applyAmountKey,
} from "@payky/app-shared/amount-entry"
import {
  emptyScanBuffer,
  readScanKey,
  type ScanBuffer,
} from "@payky/app-shared/hardware-scan"
import type { Currency } from "@payky/core/modules/shared/schema"

/** What the terminal keypad does with a physical key, as web's keydown handler. */
type KeypadKeyAction =
  | { readonly type: "type"; readonly key: AmountKeypadKey }
  | { readonly type: "clear" }
  | { readonly type: "charge" }

const digitKeys = new Set<string>([
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
])

/**
 * Web's `AmountKeypad` mapping: digits type, `.` and `,` type the
 * decimal separator (whichever the locale shows), Backspace deletes, Delete
 * and Escape clear, Enter charges. Any other key is not the keypad's.
 */
export function keypadKeyAction(key: string): KeypadKeyAction | null {
  if (digitKeys.has(key)) return { type: "type", key: key as AmountKeypadKey }
  if (key === "." || key === ",") return { type: "type", key: "." }
  if (key === "Backspace") return { type: "type", key: "<" }
  if (key === "Delete" || key === "Escape") return { type: "clear" }
  if (key === "Enter") return { type: "charge" }
  return null
}

export interface KeypadKeyboardState {
  /** The burst the keys so far make, read as the scanner reads it. */
  readonly scan: ScanBuffer
  /** The amount before the current burst's first key. */
  readonly amountBeforeBurst: string
}

export const initialKeypadKeyboardState: KeypadKeyboardState = {
  scan: emptyScanBuffer,
  amountBeforeBurst: "",
}

/**
 * Folds one hardware key into the typed `amount`. A barcode scanner types
 * its code through the same keys, too fast for a person (scanner/0001), and
 * the scanner hook opens a bill with it; the keypad cannot hold the code's
 * digits back, since nothing marks the first one as a scan, so the Enter
 * closing a scan puts back the amount from before the burst instead of
 * charging. `handled` says the key was the keypad's (web prevents its
 * default); `charge` asks the caller to charge the returned amount.
 */
export function readKeypadKey(
  state: KeypadKeyboardState,
  event: { readonly key: string; readonly timeStamp: number },
  amount: string,
  currency: Currency
): {
  readonly state: KeypadKeyboardState
  readonly amount: string
  readonly handled: boolean
  readonly charge: boolean
} {
  const read = readScanKey(state.scan, event)
  const startsBurst = read.buffer.code.length === 1
  const next: KeypadKeyboardState = {
    scan: read.buffer,
    amountBeforeBurst: startsBurst ? amount : state.amountBeforeBurst,
  }

  if (read.scanned !== null) {
    return {
      state: next,
      amount: state.amountBeforeBurst,
      handled: true,
      charge: false,
    }
  }

  const action = keypadKeyAction(event.key)
  if (action === null) {
    return { state: next, amount, handled: false, charge: false }
  }
  return {
    state: next,
    amount:
      action.type === "type"
        ? applyAmountKey(amount, action.key, currency)
        : action.type === "clear"
          ? ""
          : amount,
    handled: true,
    charge: action.type === "charge",
  }
}
