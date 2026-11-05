import { atom, type SetStateAction } from "jotai"
import { evoluCounterAtom } from "./evolu-counter.ts"

const terminalAmountDraftAtom = atom<{
  readonly accountVersion: number
  readonly input: string
}>({ accountVersion: 0, input: "" })

/**
 * The amount typed on home's keypad, as the keypad's input string. It
 * outlives the keypad, so leaving home and coming back keeps a half-typed
 * amount; only creating the payment it charges clears it
 * (`useCreateTerminalPayment`), and the tip screen in between keeps it
 * too. It belongs to the account it was typed in: switching accounts bumps
 * `evoluCounterAtom`, and a draft from an earlier account version reads
 * as empty. The keypad passes this atom down as a prop, so a keypress
 * re-renders only what shows the amount (AGENTS.md).
 */
export const terminalAmountInputAtom = atom(
  (get) => {
    const draft = get(terminalAmountDraftAtom)
    return draft.accountVersion === get(evoluCounterAtom) ? draft.input : ""
  },
  (get, set, update: SetStateAction<string>) => {
    const input =
      typeof update === "function"
        ? update(get(terminalAmountInputAtom))
        : update
    set(terminalAmountDraftAtom, {
      accountVersion: get(evoluCounterAtom),
      input,
    })
  }
)
