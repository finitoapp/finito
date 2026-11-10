# 0012 Resolving an overpayment is `refund`

Status: accepted
Date: 2026-10-19

## Context

access/0008, and the map with the catalog that replaced it (access/0010),
put acknowledging an excess settlement under `refund`, because
acknowledging it silenced the warning that would expose a false claim.
payment/0013 removed the acknowledgement: staff now answers the money above
a bill by returning it, recording it as a tip or keeping it, and withdraws a
mistaken tip or kept amount.

## Decision

Returning, tipping, keeping and withdrawing an overpayment need `refund`, as
the acknowledgement did. A return is a refund and asks for `refund` as every
refund does. Recording a tip or a kept amount, and withdrawing one, ask for
it as "Resolve an overpayment". The permission's description names refunds
and resolving an overpayment.

## Alternatives considered

`sell` for a tip or a kept amount, since neither moves money. Both silence
the overpayment warning as the acknowledgement did, so they stay with
refunds.

## Consequences

A Basic or Staff device asks for the PIN before it records or withdraws a
tip or a kept amount.

## Enforced by

- `apps/web-app/e2e/access-gates.spec.ts > keeping money paid above a bill asks a Basic device for the PIN`
- `apps/web-app/e2e/access.spec.ts > a refund asks for the PIN when its screen opens, naming the permission it needs`
