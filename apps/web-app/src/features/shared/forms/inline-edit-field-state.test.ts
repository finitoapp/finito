import { describe, expect, it } from "vitest"

import {
  type InlineEditAction,
  type InlineEditState,
  inlineEditInitialState,
  inlineEditReducer,
  inlineEditStartedState,
} from "@/features/shared/forms/inline-edit-field-state.ts"

const run = (
  actions: ReadonlyArray<InlineEditAction>,
  from: InlineEditState = inlineEditInitialState
): InlineEditState => actions.reduce(inlineEditReducer, from)

describe("inlineEditStartedState", () => {
  it("opens in edit mode so the focus is held before the first keystroke", () => {
    expect(inlineEditStartedState("Reduced rate")).toEqual({
      status: "editing",
      draft: "Reduced rate",
      invalid: false,
      blinking: false,
    })
  })
})

describe("inlineEditReducer", () => {
  it("starts editing on the first keystroke", () => {
    expect(run([{ type: "edit", draft: "12" }])).toEqual({
      status: "editing",
      draft: "12",
      invalid: false,
      blinking: false,
    })
  })

  it("keeps the error up until the draft changes", () => {
    const rejected = run([{ type: "edit", draft: "abc" }, { type: "reject" }])
    expect(rejected).toMatchObject({ invalid: true })

    expect(run([{ type: "edit", draft: "abc4" }], rejected)).toMatchObject({
      invalid: false,
    })
  })

  it("blinks on a refused blur, and says why when the draft cannot be saved", () => {
    expect(
      run([
        { type: "edit", draft: "abc" },
        { type: "refuseBlur", invalid: true },
      ])
    ).toMatchObject({ blinking: true, invalid: true })

    // A valid but unconfirmed draft blinks without claiming to be wrong.
    expect(
      run([
        { type: "edit", draft: "12" },
        { type: "refuseBlur", invalid: false },
      ])
    ).toMatchObject({ blinking: true, invalid: false })
  })

  it("clears the blink when the animation ends", () => {
    expect(
      run([
        { type: "edit", draft: "12" },
        { type: "refuseBlur", invalid: false },
        { type: "blinkEnd" },
      ])
    ).toMatchObject({ blinking: false })
  })

  it("discards straight back to idle", () => {
    expect(
      run([
        { type: "edit", draft: "abc" },
        { type: "reject" },
        { type: "discard" },
      ])
    ).toEqual(inlineEditInitialState)
  })

  it("holds the draft through the save and drops it on settle", () => {
    const saving = run([{ type: "edit", draft: "12" }, { type: "commit" }])
    expect(saving).toEqual({ status: "saving", draft: "12" })
    expect(run([{ type: "settle" }], saving)).toEqual(inlineEditInitialState)
  })

  it("ignores a keystroke while the save is in flight", () => {
    const saving = run([{ type: "edit", draft: "12" }, { type: "commit" }])
    expect(run([{ type: "edit", draft: "123" }], saving)).toBe(saving)
  })

  it("ignores actions that do not apply to the current status", () => {
    expect(run([{ type: "reject" }])).toBe(inlineEditInitialState)
    expect(run([{ type: "blinkEnd" }])).toBe(inlineEditInitialState)
    expect(run([{ type: "settle" }])).toBe(inlineEditInitialState)
    expect(run([{ type: "commit" }])).toBe(inlineEditInitialState)
  })
})
