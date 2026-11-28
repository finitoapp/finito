// @vitest-environment jsdom
import { atom, createStore, Provider, useAtomValue } from "jotai"
import { Activity, act } from "react"
import { createRoot } from "react-dom/client"
import { expect, test } from "vitest"

const amountAtom = atom("")
const Amount = () => <span>{`[${useAtomValue(amountAtom)}]`}</span>

/**
 * `patches/jotai@3.0.2.patch`: a component hidden under React's `Activity`
 * shows a value its atom took while it was hidden once it is revealed.
 * Unpatched, it kept the value it had rendered before hiding whenever the
 * atom went back to the value it mounted with: Finito's keypad showed the
 * charged amount after the payment had cleared it.
 */
test("a revealed component shows its atom's value set while it was hidden", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const store = createStore()
  const container = document.createElement("div")
  const root = createRoot(container)
  const render = (mode: "visible" | "hidden") =>
    act(() =>
      root.render(
        <Provider store={store}>
          <Activity mode={mode}>
            <Amount />
          </Activity>
        </Provider>
      )
    )

  await render("visible")
  await act(() => store.set(amountAtom, "10"))
  expect(container.textContent).toBe("[10]")

  await render("hidden")
  await act(() => store.set(amountAtom, ""))
  await render("visible")
  expect(container.textContent).toBe("[]")

  await act(() => root.unmount())
})
