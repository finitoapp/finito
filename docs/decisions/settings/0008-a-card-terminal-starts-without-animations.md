# 0008 A card terminal starts without animations

Status: accepted
Date: 2026-11-28

## Context

settings/0007 let each device choose whether Finito animates, with Auto as
the default for every device. It left "Off by default on card terminals"
for later.

The PAX A920Pro measurements in settings/0007 show what animations cost on a
card terminal: a keypad tap settles in 0.41–0.45 s instead of 0.12–0.14 s.
Every transition there drops 1–5 frames. A merchant on a terminal sees this
from the first screen of onboarding, before they could find the setting.
Finito is tested on PAX and NEXGO terminals.

Android has no flag that says a device is a card terminal. Other signals do
not work either:

- SwitchioPay can run on a phone (onboarding/0015).
- A terminal's printer and PIN pad are reached only through its maker's SDK.
- A memory or performance class would also catch cheap phones nobody
  measured.

## Decision

Everything in settings/0007 still holds, except for the default. A device
that has not chosen whether to animate gets Off when its Android manufacturer
(`Build.MANUFACTURER`) is a card terminal maker: PAX or NEXGO, compared
ignoring case. The brand is not compared: the NEXGO N92 reports `alps`.
Every other device still gets Auto.

Nothing is written. The device database keeps `null` until the merchant
chooses. A terminal that onboarded before this change gets Off too. A
choice the merchant makes on the Theme screen, Auto included, wins.

## Alternatives considered

- **Write Off when onboarding finishes.** This would miss terminals that
  have already onboarded. It would also tie an appearance setting to
  onboarding, which restoring an account goes through separately.
- **Detect a slow device instead of a terminal.** This needs a native module
  and would change phones that nobody measured. It can be added if a slow
  phone turns out to need it.

## Consequences

- A new terminal maker turns animations off only once it is added to
  `cardTerminalMakers` in `apps/native-app/src/core/animations-preference.ts`.
- On a terminal, the Theme screen shows Off until the merchant chooses.

## Enforced by

- `apps/native-app/src/core/animations-preference.test.ts > resolveReduceMotion > follows the system's reduce-motion setting by default`
- `apps/native-app/src/core/animations-preference.test.ts > resolveReduceMotion > on animates and off does not, whatever the system says`
- `apps/native-app/src/core/animations-preference.test.ts > defaultAnimations > a card terminal starts without animations`
- `apps/native-app/src/core/animations-preference.test.ts > defaultAnimations > any other device follows the system`
