/**
 * The state machine behind `InlineEditField`, kept apart from the component
 * so it can be exercised as the pure function it is.
 *
 * The shape rules out the combinations the old flag set allowed: there is no
 * validation error without a draft to blame it on, no blink outside an edit,
 * and nothing invalid while a save is already in flight.
 */
export type InlineEditState =
  | { readonly status: "idle" }
  | {
      readonly status: "editing"
      readonly draft: string
      /** The draft cannot be decoded; the field shows its error message. */
      readonly invalid: boolean
      /** A click elsewhere was refused and the input is flashing. */
      readonly blinking: boolean
    }
  /** Confirmed and handed to `onSave`; the draft stays on screen until it lands. */
  | { readonly status: "saving"; readonly draft: string }

export type InlineEditAction =
  /** A keystroke. Also what starts an edit. */
  | { readonly type: "edit"; readonly draft: string }
  /** Confirmed, but the draft does not decode. */
  | { readonly type: "reject" }
  /** A click elsewhere while editing, which the field refuses. */
  | { readonly type: "refuseBlur"; readonly invalid: boolean }
  | { readonly type: "blinkEnd" }
  /** `Escape`, the discard button, or a confirm that changed nothing. */
  | { readonly type: "discard" }
  /** Confirmed and decoded; the save starts. */
  | { readonly type: "commit" }
  /** The save settled, whether or not it succeeded. */
  | { readonly type: "settle" }

export const inlineEditInitialState: InlineEditState = { status: "idle" }

/**
 * Edit mode entered before the user typed anything, for a field a caller
 * mounts *as* an editor. Being in edit mode is that field's premise, so it
 * holds the focus from the start rather than from the first keystroke.
 */
export const inlineEditStartedState = (draft: string): InlineEditState => ({
  status: "editing",
  draft,
  invalid: false,
  blinking: false,
})

/**
 * Actions that do not apply to the current status are ignored rather than
 * throwing: a late `blinkEnd` from an animation whose element has already
 * been re-rendered is normal, not a bug.
 */
export const inlineEditReducer = (
  state: InlineEditState,
  action: InlineEditAction
): InlineEditState => {
  switch (action.type) {
    case "edit":
      // A keystroke during a save is dropped: the input is read-only then,
      // and accepting one would strand a draft the save is about to clear.
      if (state.status === "saving") return state
      return {
        status: "editing",
        draft: action.draft,
        invalid: false,
        blinking: false,
      }

    case "reject":
      if (state.status !== "editing") return state
      return { ...state, invalid: true }

    case "refuseBlur":
      if (state.status !== "editing") return state
      return { ...state, invalid: action.invalid, blinking: true }

    case "blinkEnd":
      if (state.status !== "editing") return state
      return { ...state, blinking: false }

    case "discard":
      return inlineEditInitialState

    case "commit":
      if (state.status !== "editing") return state
      return { status: "saving", draft: state.draft }

    case "settle":
      if (state.status !== "saving") return state
      return inlineEditInitialState
  }
}
