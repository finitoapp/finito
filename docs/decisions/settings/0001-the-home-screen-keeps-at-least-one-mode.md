# 0001 The home screen keeps at least one mode

Status: superseded by settings/0004
Date: 2026-10-05

## Context

The home screen switches between two modes, the keypad (`numpad`) and the
tables-and-bills grid (`pos`). Not every business uses both: a stand that
only types amounts has no use for tables, a restaurant may want the grid
only. Which modes are on offer is a business choice for the whole account,
so it syncs as part of `appSettings`; which mode a device last showed stays
device view state in `localStorage`.

## Decision

Settings let each mode be switched on or off, and at least one always stays
on. Switching off the last one is refused with a message saying why, rather
than the switch being disabled, so the reason is visible at the moment it
matters. The set is stored as one JSON column, `enabledHomeModesJson`, so two
devices each switching off a different mode resolve to one of their writes
and never to both modes off. The column stays `null` until the set is first
changed, and `null` (or anything unreadable) means every mode.

While the remembered mode is switched off, the home screen shows the first
enabled one in the fixed order keypad, tables. The remembered value is left
alone, so switching its mode back on returns to it. With a single mode on,
the header's mode switch is hidden.

## Alternatives considered

- One boolean column per mode: Evolu merges per column, so concurrent edits
  on two devices could leave both off.
- Disabling the last enabled switch: it prevents the empty set but gives no
  hint why the switch does not move.
- A user-defined mode order: no one asked for it; the order is fixed.

## Consequences

Accounts onboarded before this setting existed, and new ones, offer every
mode without a migration, and a mode added later is on for anyone who never
narrowed the set. Older app versions ignore the column and keep showing both
modes.

## Enforced by

- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > setEnabledHomeModes > refuses to disable every mode and keeps the stored set`
- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > setEnabledHomeModes > onboarding leaves the home modes unset, which means all of them`
- `packages/core/src/modules/app-settings/app-settings-utils.test.ts > parseEnabledHomeModes > treats an unreadable or empty value as every mode`
- `packages/core/src/modules/app-settings/app-settings-utils.test.ts > resolveTerminalHomeMode > falls back to the first enabled mode when the remembered one is disabled`
- `apps/web-app/e2e/home-mode-toggle.spec.ts > disabling a home mode in settings hides the switch, falls back to the first enabled mode and never leaves none`
