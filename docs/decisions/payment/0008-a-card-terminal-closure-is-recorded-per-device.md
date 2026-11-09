# 0008 A card terminal closure is recorded per device

Status: accepted
Date: 2026-11-08

## Context

SwitchioPay settles card payments in batches, and a batch has to be closed
every day after the shift (ECR protocol v6.19.0, section 4.1). Finito could
only take payments, so staff closed the batch by hand in SwitchioPay and the
business had no record of it outside each phone. The closure request carries
no data and names no terminal: it closes the batch of the SwitchioPay on the
phone it is sent from. Its result is a `CLOSE_BATCH` answer with
`batchTotals` (batch and shift numbers, counts and amounts of debits,
credits and adjustments) and, optionally, the terminal's time. `debitsAmount`
includes tips: it is what the cards were charged.

## Decision

Finito closes the batch of the terminal on the phone it runs on
(`closeCardSwitchioBatch`) and records each successful closure in the synced
`cardSwitchioClosure` table, so every device of the business sees when each
terminal was last closed, the record outlives the phone, and a later
reconciliation with Finito's own card payments has a window to count in.

- Only a successful closure with readable totals is recorded. A failed one
  closed nothing; an unreadable one (a cancelled result with no data, or a
  success whose totals cannot be read) may have closed the batch, so it is
  shown as an unknown outcome to check in SwitchioPay, never as a failure —
  the same reasoning as payment/0006 — but there is nothing to record.
- The terminal's identity is the device: the result carries no terminal id,
  and one closure closes exactly the SwitchioPay of that phone. A business
  with several terminals closes each on its own phone.
- The row's id derives from the device, the batch number and the terminal's
  time, so the same result recorded twice — through its promise and again
  from the copy `MainActivity` stores when Android killed the app meanwhile
  — is one row, and the second write keeps the first `closedAt`. Native
  code stores the result before it resolves the promise, and nothing orders
  the promise against the app coming back to the foreground, so the restore
  path leaves the stored copy alone while a closure is in flight in this JS
  runtime: each result is recorded by one path, never by both at once.
- The currency is the card account's at closing time; the result names none.

## Alternatives considered

Showing the result without storing it, which leaves the business no view of
which terminals were closed and nothing to reconcile against. Keying a
closure on a terminal id, which the result does not have. A random id per
recording, which would turn a restored result into a second closure.

## Consequences

A closure started in SwitchioPay itself, or SwitchioPay's own automatic
closure, is not recorded: Finito never sees it. Whether the batch number
survives reinstalling or re-pairing SwitchioPay is still to be checked on a
device; if it restarts, the terminal's time keeps two closures apart. The
closure has its own request code and result store on the native side, so its
result never reaches the payment's recovery. Web (Payky) takes card payments
but does not close batches.

## Enforced by

- `packages/core/src/switchio.test.ts > interpretSwitchioClosureResult > accepts a closed batch and keeps its totals`
- `packages/core/src/switchio.test.ts > interpretSwitchioClosureResult > reports a cancelled result with no payload as an unknown outcome, not a failure`
- `packages/core/src/switchio.test.ts > interpretSwitchioClosureResult > treats a success without readable batch totals as unknown, since nothing can be kept`
- `packages/core/src/modules/card-switchio-closure/card-switchio-closure-actions.test.ts > closeCardSwitchioBatch > records a closed batch under the device with the card account's currency`
- `packages/core/src/modules/card-switchio-closure/card-switchio-closure-actions.test.ts > closeCardSwitchioBatch > writes nothing when the terminal does not close the batch`
- `packages/core/src/modules/card-switchio-closure/card-switchio-closure-actions.test.ts > recordRestoredCardSwitchioClosure > records the same result once, whether it came back through the promise or after a restart`
- `packages/core/src/modules/card-switchio-closure/card-switchio-closure-actions.test.ts > lastCardSwitchioClosurePerDeviceQuery > lists each device's latest closure with the device's name`
- `apps/native-app/src/platform/switchio.test.ts > never hands a closure result to the payment's store or recovery`
- `apps/native-app/src/platform/switchio-restore.test.ts > a SwitchioPay result is settled by one path (payment/0008) > leaves a closure's stored result to its promise while the closure is in flight`
- `apps/native-app/src/platform/switchio-restore.test.ts > a SwitchioPay result is settled by one path (payment/0008) > takes a stored closure result no promise in this runtime is waiting for`
