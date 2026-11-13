import { decimalAmountToMinorUnits } from "@payky/core/modules/shared/money"
import type { FiatCurrency } from "@payky/core/modules/shared/schema"
import { useIsFocused } from "expo-router"
import { type PrimitiveAtom, useStore } from "jotai"
import { useEffect, useEffectEvent } from "react"
import { useIsConfirmOpen } from "../../hooks/use-is-confirm-open.ts"
import { addHardwareKeyListener } from "../../platform/hardware-keys"
import { initialKeypadKeyboardState, readKeypadKey } from "./keypad-keyboard.ts"

/**
 * Types the keypad amount on a physical keyboard, as web's
 * `AmountKeypad` does: a counter terminal often has one attached.
 * Enter charges the amount on screen, read from the atom when the key comes
 * (`useStore().get`), so the keypad still re-renders only its display. Keys
 * typed into a text field, while a confirmation is up or a charge is
 * pending, or while another screen is on top are not the keypad's. A scan's
 * burst is undone rather than typed (`readKeypadKey`).
 */
export function useKeypadKeyboard({
  amountInputAtom,
  currency,
  pending,
  onCharge,
}: {
  readonly amountInputAtom: PrimitiveAtom<string>
  readonly currency: FiatCurrency
  readonly pending: boolean
  readonly onCharge: (minor: number) => void
}) {
  const store = useStore()
  const focused = useIsFocused()
  const confirmOpen = useIsConfirmOpen()
  const charge = useEffectEvent(onCharge)
  const isPending = useEffectEvent(() => pending)

  useEffect(() => {
    if (!focused || confirmOpen) return

    let state = initialKeypadKeyboardState
    return addHardwareKeyListener((event) => {
      if (event.inTextField || isPending()) return

      const amount = store.get(amountInputAtom)
      const result = readKeypadKey(state, event, amount, currency)
      state = result.state
      if (!result.handled) return

      event.preventDefault()
      if (result.amount !== amount) store.set(amountInputAtom, result.amount)
      if (!result.charge) return
      const minor = decimalAmountToMinorUnits({
        currency,
        value: result.amount,
      })
      if (minor !== null) charge(minor)
    })
  }, [amountInputAtom, confirmOpen, currency, focused, store])
}
