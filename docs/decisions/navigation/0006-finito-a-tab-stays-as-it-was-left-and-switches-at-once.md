# 0006 Finito: a tab stays as it was left and switches at once

Status: accepted
Date: 2026-11-18

## Context

Finito's tabs (navigation/0004) were screens of one native stack, and a
tab switch replaced the screen shown with the new tab's root. Each switch
built that tab again from nothing, and only once React had rendered it did
the stack's Android transition start, which shows the new screen after a
delay of its own (100 ms on Android 10, 50 ms on Android 13 and later)
and then slides or scales it in. The pill of the bar, animated on the
native thread, reached its tab first, so on a PAX A920Pro the screen
seemed to wait for the pill: a push of the tip screen there took about
1.3 s from the press to the start of its transition (2026-11-18). Nothing
in the app or in Expo Router waited for the pill; the time went on
building the screen. Web never had the transition: navigation/0001 has a
tab switch swap instantly.

## Decision

Finito alone; Payky keeps navigation/0001 as it is.

- **The tabs' root screens live in a tabs navigator of their own**,
  `app/(menu)/_layout.tsx`: home, Activity with its three screens, Notifications
  and Settings. The screens they open (a setting, a payment's detail, the
  bill, the payment steps) stay on the root stack above it, with Back and
  their transition as before.
- **A tab, once opened, stays mounted.** Switching back to it shows it as it
  was left, its scroll and its Activity sub-tab included, instead of
  building it again. A tab is first built when first opened. While another
  tab shows, React's `Activity` hides it, which keeps its state and runs its
  effects' cleanups, so a hidden tab holds no subscription or timer.
- **A tab switch has no transition**: the new tab shows at once, as on the
  web.
- **Back from any tab returns home**, the tabs navigator's first screen, so
  the section is still left the way it was entered (navigation/0001).
- **A tab switch is timed on the device.** The time from the press to the
  new route's commit and to the frame after it is written to Settings ›
  Debug console on every build, release included, so a slow tab can be told
  from a slow transition on the terminal itself.

## Alternatives considered

- Only turning off the stack's transition for the tab roots: it saves the
  100 to 200 ms the transition holds the screen back, but every switch
  still builds the tab again.
- Preloading the other tabs' roots on the stack (`router.prefetch`): the
  replace a tab switch was can take a preloaded route, but it drops the tab
  it leaves, which then has to be preloaded, built again, behind every
  switch.
- `freezeOnBlur` instead of `Activity`: it keeps a hidden tab's effects
  running, so its timers and subscriptions would go on behind the screen
  shown.
- Building every tab at start (`lazy: false`): the first switch would be
  instant too, but the start already holds back the background jobs to
  keep a terminal's first screen quick.

## Consequences

- `menu-routes.ts`'s root screens are exactly the route files under
  `app/(menu)`.
- A tab is reached with `router.navigate` from a root screen and with
  `router.dismissTo` from a screen above the tabs navigator; `showMenuRoot`
  (`src/core/menu-navigation.ts`) picks between them. `router.replace` from
  a screen above the tabs navigator would stack a second one, so the places
  that go home after an account switch, the end of a PIN session, the demo
  data or a restore go through `showMenuRoot` too.
- Home's hamburger opens Activity as a tab switch, without the transition
  it had.
- A tab's screens stay in memory once opened: the four roots, not their
  details.
- A hidden tab hears no jotai atom (its effects are cleaned up), so shown
  again it renders once with what it last read. Every tab is therefore
  built again when the app Evolu client is (an account switch, an account
  added or removed, the demo data), keyed outside the `Activity` that
  hides it; otherwise home, shown again after an account was added, read
  the client just disposed.

## Enforced by

- `apps/native-app/src/core/menu-routes.test.ts > the tabs' root screens stay mounted (navigation/0006) > keeps every root screen in the menu's tabs navigator and nothing else`
- `apps/native-app/src/core/menu-routes.test.ts > the tabs' root screens stay mounted (navigation/0006) > orders the navigator's screens as the tabs, home first, where Back returns`
- `apps/native-app/src/core/menu-routes.test.ts > the tabs' root screens stay mounted (navigation/0006) > hides a tab under React's Activity and switches tabs without a transition`
- `apps/native-app/src/core/menu-routes.test.ts > the tabs' root screens stay mounted (navigation/0006) > builds every tab again with the app Evolu client`
- `apps/native-app/src/core/tab-switch-timing.test.ts > tab switch timing (navigation/0006) > reports the time from the press to the commit and to the next frame`
- `apps/native-app/src/core/tab-switch-timing.test.ts > tab switch timing (navigation/0006) > counts any root screen of the pressed tab and nothing else`
- `apps/native-app/src/core/tab-switch-timing.test.ts > tab switch timing (navigation/0006) > reports a press once, and drops one that never arrived`
