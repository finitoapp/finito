# 0011 A card terminal closure needs confirm

Status: accepted
Date: 2026-11-08

## Context

The daily closure of the card terminal (payment/0008) is done at the end of
a shift by whoever runs it, usually a shift lead rather than the owner. The
card terminal's settings sit under the payment methods, which are owner-only
(`admin`, access/0002), so a closure placed there would need the owner's
PIN every evening.

## Decision

Closing the batch needs `confirm`, the permission of the shift lead preset
and above, which already covers confirming that money arrived. It has its
own screen, `/settings/card-closure`, straight under Settings, gated by
`confirm`; the button checks `confirm` again before it launches the
terminal, so the action is held even where the route is not. The payment
methods and the card terminal's settings stay `admin`; they link to the
closure screen.

## Alternatives considered

Putting the closure on the card terminal's settings screen, which would make
it owner-only. A new permission of its own, which would add a tenth switch
for one action that belongs with the other end-of-shift checks.

## Consequences

A device with `confirm` can close its own terminal's batch without the PIN.
It sees the other devices' closures but cannot start them; a closure only
ever closes the phone it runs on.

## Enforced by

- `apps/native-app/src/core/route-access.test.ts > native route access > lets a shift lead close the card terminal's batch, while its settings stay owner-only`
