# 0007 Finito's animations follow the system unless the device chooses

Status: superseded by settings/0008
Date: 2026-11-27

## Context

Finito already drew without animations under the system's reduce-motion
setting (Android's "Remove animations"). It covered press fills, pulses,
skeletons, collapsibles, dialogs and toasts. The native stack's screen
transitions still animated.

On a PAX A920Pro card terminal, measured on v26.11.11 with atrace, turning
animations off sped up every interaction:

- A keypad tap settled in 0.12–0.14 s instead of 0.41–0.45 s.
- A tab switch settled in 0.42–0.53 s instead of 0.57–0.73 s.
- Opening or leaving a nested screen took 0.42–0.53 s instead of
  0.62–0.80 s.
- The main and render threads did about a quarter of the work per tap.

With animations on, every transition there dropped 1–5 frames. A terminal
often does not let the merchant into Android's settings.

## Decision

Each device chooses whether Finito animates: Auto, On or Off, on the Theme
screen under the appearance mode. Auto is the default and follows the
system's reduce-motion setting. On animates even when the system has
animations off. Off never animates.

"No animations", whether from Off or from Auto under the system's setting,
also turns off the stack's screen transitions.

The choice belongs to the device, as the theme does. It is stored in the
device database's `deviceSettings.animations` and never syncs. `null`
means Auto.

## Alternatives considered

- **An on/off switch where off means "follow the system".** It cannot animate
  against the system's setting, and it would be the only appearance setting
  not shaped like the theme's Auto, Light and Dark.
- **Off by default on card terminals.** This is left until merchants turn
  out not to find the setting. Auto keeps every device as it was.
- **Relying on the system setting alone.** A terminal often locks Android's
  settings, and the system's scales do not stop the native stack's
  transitions.

## Consequences

- Web offers no such setting. Payky leaves reduced motion to the browser's
  `prefers-reduced-motion`.
- A kit view reads the choice once, when it mounts. A change therefore
  mounts every screen again. The open screen stays open, but its scroll
  position resets.
- With animations off, a pressed button shows no fill. The first thing that
  changes is the result, about 0.12 s after the tap, instead of a fill fading
  in after 0.04 s.

## Enforced by

- `apps/native-app/src/core/animations-preference.test.ts > resolveReduceMotion > follows the system's reduce-motion setting by default`
- `apps/native-app/src/core/animations-preference.test.ts > resolveReduceMotion > on animates and off does not, whatever the system says`
