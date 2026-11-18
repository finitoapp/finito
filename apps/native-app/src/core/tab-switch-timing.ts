import { type MenuTab, menuPositionOf } from "./menu-routes.ts"

/** How long one tab switch took, in milliseconds from the press. */
export interface TabSwitchTiming {
  readonly tab: MenuTab
  readonly pathname: string
  /** Until the root layout committed the new route. */
  readonly commitMs: number
  /** Until the frame after that commit, about when the screen is drawn. */
  readonly frameMs: number
}

export interface TabSwitchTimer {
  /** A menu entry or home's hamburger was pressed and is about to navigate to `tab`. */
  readonly markPress: (tab: MenuTab) => void
  /**
   * The root layout committed `pathname`; when it is a root screen of the
   * tab last pressed, `report` hears how long that took, once the next
   * frame has come.
   */
  readonly arrive: (
    pathname: string,
    report: (timing: TabSwitchTiming) => void
  ) => void
}

/**
 * A press that has not arrived by then never will (a locked tab's PIN, a
 * press the route ignored), and must not be counted against a later visit.
 */
const MAX_WAIT_MS = 5000

/**
 * Measures a tab switch from the press to the new route's commit and the
 * frame after it, so a slow tab can be told from a slow transition on the
 * device itself (navigation/0006). Only one press is followed at a time:
 * a second press before the first arrived replaces it.
 */
export function createTabSwitchTimer({
  now,
  nextFrame,
}: {
  readonly now: () => number
  readonly nextFrame: (callback: () => void) => void
}): TabSwitchTimer {
  let pending: { readonly tab: MenuTab; readonly pressedAt: number } | null =
    null
  return {
    markPress: (tab) => {
      pending = { tab, pressedAt: now() }
    },
    arrive: (pathname, report) => {
      if (pending === null) return
      const committedAt = now()
      const { tab, pressedAt } = pending
      if (committedAt - pressedAt > MAX_WAIT_MS) {
        pending = null
        return
      }
      const position = menuPositionOf(pathname)
      if (position?.tab !== tab || !position.root) return
      pending = null
      nextFrame(() => {
        report({
          tab,
          pathname,
          commitMs: Math.round(committedAt - pressedAt),
          frameMs: Math.round(now() - pressedAt),
        })
      })
    },
  }
}

/** The app's one timer: menu entries mark presses, the root layout reports arrivals. */
export const tabSwitchTimer = createTabSwitchTimer({
  now: () => performance.now(),
  nextFrame: (callback) => {
    requestAnimationFrame(callback)
  },
})
