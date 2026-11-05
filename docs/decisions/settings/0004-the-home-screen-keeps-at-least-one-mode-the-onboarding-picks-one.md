# 0004 The home screen keeps at least one mode, and the onboarding picks the first

Status: accepted
Date: 2026-11-05

## Context

settings/0001 let an account switch each home mode, the keypad (`numpad`)
and the tables-and-bills grid (`pos`), on or off, kept at least one on,
and left a new account with the set unset, so every mode. onboarding/0012
now asks a new account how it sells and offers home that one mode, which
narrows the last part.

## Decision

Settings let each mode be switched on or off, and at least one always stays
on. Switching off the last one is refused with a message saying why, rather
than the switch being disabled. The set is stored as one JSON column,
`enabledHomeModesJson`, so two devices each switching off a different mode
resolve to one of their writes and never to both modes off; `null` (or
anything unreadable) means every mode.

The onboarding writes the one mode the merchant chose (onboarding/0012).
An account that never went through it, onboarded before it asked or
seeded for tests and the demo, keeps the column `null` and so every mode.

While the remembered mode is switched off, the home screen shows the first
enabled one in the fixed order keypad, tables. The remembered value is left
alone, so switching its mode back on returns to it. With a single mode on,
the header's mode switch is hidden.

## Alternatives considered

- One boolean column per mode: Evolu merges per column, so concurrent edits
  on two devices could leave both off.
- Disabling the last enabled switch: it prevents the empty set but gives no
  hint why the switch does not move.
- Leaving a new account with every mode and only remembering the chosen one
  as the device's view: the switch would stay on home for a business that
  uses one mode.

## Consequences

Accounts onboarded before the question keep every mode without a
migration. Older app versions ignore the column and keep showing both
modes. This supersedes settings/0001.

## Enforced by

- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > setEnabledHomeModes > refuses to disable every mode and keeps the stored set`
- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > setEnabledHomeModes > an account onboarded without a mode leaves the home modes unset, which means all of them`
- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > finishOnboarding > offers home only the mode the merchant chose and keeps their tips choice`
- `packages/core/src/modules/app-settings/app-settings-utils.test.ts > parseEnabledHomeModes > treats an unreadable or empty value as every mode`
- `packages/core/src/modules/app-settings/app-settings-utils.test.ts > resolveTerminalHomeMode > falls back to the first enabled mode when the remembered one is disabled`
- `apps/web-app/e2e/home-mode-toggle.spec.ts > disabling a home mode in settings hides the switch, falls back to the first enabled mode and never leaves none`
