# 0011 An existing account is opened from the easiest source first

Status: accepted
Date: 2026-11-05

## Context

An account the user already has reaches a device three ways: from Payky on
the same phone (account/0008), from another device by QR (account/0001), or
from its 20-word recovery phrase. Onboarding opened on the phrase form with
the transfers as buttons under it, so the slowest and riskiest way was the
first thing a merchant saw. Settings → Accounts offered the same ways as
four rows beside "Create a new account", each opening differently: an
inline phrase form, the `/pair` route, an inline request to Payky; the web
app used dialogs.

## Decision

"I already have an account" leads to one chooser, the same in onboarding and
in Settings → Accounts, on web and native: where the account is now, then
that one way on its own step. The rows come easiest first — Payky on this
phone, another device, the recovery phrase — with no badge; the order says
it. Payky is offered only where the installed one takes the request, and
never on web (account/0008).

Each way goes back to the chooser. "Cannot scan? Use the recovery phrase"
in the scanner goes straight to the phrase, and the restore sync page sends
a phrase back to the phrase step. In Settings the chooser is
`/settings/accounts/open`, each step a history entry (`?step=`), owner-only
like the accounts screen; `/pair` is gone. The step model and copy live in
`packages/app-shared/src/open-account.ts`.

## Alternatives considered

- The phrase form first with the transfers under it: the most typing and
  the most room for a mistyped or foreign seed, shown to everyone.
- A "Fastest" badge on the Payky row: the order already says it, and a
  badge reads as an advert.
- Keeping `/pair` as a redirect: nothing outside Settings linked to it.

## Consequences

- Opening an account by phrase takes one tap more.
- A new way in is one more `OpenAccountSource` with its copy, offered in
  every place at once.

## Enforced by

- `packages/app-shared/src/open-account.test.ts > openAccountChoices > offers the easiest way first and the recovery phrase last`
- `packages/app-shared/src/open-account.test.ts > openAccountChoices > offers Payky only where it was detected`
- `packages/app-shared/src/open-account.test.ts > opening an account in onboarding > Back from the %s step leads to the chooser, and from there to the welcome screen`
- `packages/app-shared/src/onboarding-form-state.test.ts > getOnboardingSteps > opens an existing account through the chooser`
- `apps/native-app/src/core/route-access.test.ts > native route access > treats an unknown path as owner-only`
