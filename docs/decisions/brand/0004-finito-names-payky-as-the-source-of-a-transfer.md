# 0004 Finito names Payky as the source of a transfer

Status: accepted
Date: 2026-11-05

## Context

brand/0001 keeps the word Payky out of everything Finito shows. The
transfer from Payky on the same phone (account/0008) has to tell the user
which app is about to open and what it said: "Open Payky", "Payky declined
the request". A brand placeholder would print Finito's own name there.

## Decision

Finito names Payky only as the source app of that transfer, and only
through `brandName(paykyBrand)` passed to the copy as `{sourceApp}`
(`accountFromPayky.*`). Copy never spells the name, and no other Finito
screen shows it. Czech and Slovak copy puts it after "aplikace"/"aplikácia"
or in the nominative, so the undeclined name reads right.

Payky names the requester the way Android names it, never with a literal
"Finito".

## Alternatives considered

- A neutral "the other app": the user is told to open and check an app
  they cannot pick out.

## Consequences

`app-brand.test.ts` still finds no "Payky" in Finito's string literals; the
name reaches the screen only through `paykyBrand`. A third brand that can be
a transfer source passes its own `brandName` the same way.

## Enforced by

- `apps/native-app/src/core/app-brand.test.ts > the native app's code shows no Payky`
- `apps/native-app/src/features/shared/account-from-payky-failures.test.ts > names the source app through its placeholder, never literally`
