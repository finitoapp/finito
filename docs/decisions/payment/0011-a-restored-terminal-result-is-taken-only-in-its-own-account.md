# 0011 A restored terminal result is taken only in its own account

Status: accepted
Date: 2026-11-09

## Context

When Android kills Finito while SwitchioPay is in front, the terminal still
charges the card, refunds it or closes the batch, and `MainActivity` keeps
its answer so Finito can settle it afterwards (payment/0006, payment/0008,
refund/0007). That copy lives in the phone's preferences, not in an account:
it outlives a switch of the active account, and the account it was launched
in may be removed before Finito comes back. A payment or a refund at least
names its row, so in the wrong account it is merely not found and dropped; a
closure names nothing, so it was recorded in whichever account was active —
under that account's card account, in its currency, in its synced history.

## Decision

Every SwitchioPay launch — a payment, a closure, a reversal, a referral
refund — stores the account it was made in beside its result, and the
restore path takes a stored result only in that account.

- A result of another account still on the phone stays stored, untouched,
  until that account is active again. Until then the phone launches no new
  attempt of the same kind, as with any result not yet settled: overwriting
  it would lose what the terminal did.
- A result whose account is gone from the phone is cleared and shown as one
  that could not be settled, to check in SwitchioPay: there is nowhere left
  to record it, and keeping it would block that kind of launch for good.
- A result stored by a build that did not keep the account is taken in the
  active account, as it was before, so an upgrade loses nothing.

## Alternatives considered

Recording a closure into the active account and letting staff fix it, which
puts money of one business into another's synced history. Clearing every
result of another account, which loses a charged card or a closed batch
whenever someone switches accounts at the wrong moment.

## Consequences

Staff who switch accounts while a result is waiting cannot take a card
payment, refund to the card or close the batch in the new account until
they open the old one, which then settles it.

## Enforced by

- `apps/native-app/src/platform/switchio-restore.test.ts > a stored SwitchioPay result belongs to the account it was launched in > stores the account with each launch`
- `apps/native-app/src/platform/switchio-restore.test.ts > a stored SwitchioPay result belongs to the account it was launched in > leaves a closure of another account on this device for that account`
- `apps/native-app/src/platform/switchio-restore.test.ts > a stored SwitchioPay result belongs to the account it was launched in > leaves a payment and a refund of another account on this device for that account`
- `apps/native-app/src/platform/switchio-restore.test.ts > a stored SwitchioPay result belongs to the account it was launched in > clears a result whose account is gone from this device as unusable`
- `apps/native-app/src/platform/switchio-restore.test.ts > a stored SwitchioPay result belongs to the account it was launched in > takes a result stored before the account was kept in the active account`
- `apps/native-app/src/platform/switchio.test.ts > keeps the account each launch was made in with its stored result`
