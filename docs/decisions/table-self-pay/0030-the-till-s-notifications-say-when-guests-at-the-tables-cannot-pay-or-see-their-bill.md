# 0030 The till's notifications say when guests at the tables cannot pay or see their bill

Status: accepted
Date: 2026-11-12

## Context

A table with its QR code on can leave its guests stuck in two ways the
owner can fix: no payment method reaches guests (no bank account with bank
sync and no Bitcoin), or no relay took the table's last publish, so guests
see no bill. Both warnings lived only on the tables' screens under the
catalog. A review on 2026-11-12 turned Bitcoin off with the bank unsynced
while a table kept its QR code on, and home, "To serve" and the bell said
nothing: the first to learn of it was a guest at the table.

## Decision

A background job raises two notifications (`notification/0001`), read from
the same state the tables' screens warn from and writing nothing:

- `guestsCannotPay` while some table has its QR code on and no payment
  method reaches guests. It reads "Guests at the tables cannot pay", says
  what is missing as the table's warning does, and opens Payment methods.
- `tableBillsUnseen` while some table with its QR code on had its last
  publish refused by every relay, and a payment method reaches guests. It
  reads "Guests cannot see the tables' bills" and opens the tables.

Both need the catalog permission, the one that sets the tables up.

## Alternatives considered

- A banner on home. It would take room from every sale for something only
  the owner can fix, and notifications are where the till already says what
  needs attention.
- One notification per table. The missing payment method holds for every
  table at once, and a relay that refuses one table's publish usually
  refuses them all, so one notification each says it without a list.

## Consequences

The job runs on the native app and in the browser, not in the CLI, which
shows no notifications. Like every job's, its notifications appear a moment
after the app opens and never on a demo account. While no payment method
reaches guests, the notification about relays stays away, as the table's
own card shows only the payment method then. The notification about relays
names no table; the table's detail says which one and offers to try again.

## Enforced by

- `packages/core/src/background-jobs/jobs/table-self-pay-reach-job.test.ts > table self-pay reach job > says guests cannot pay while a table with its QR code on has no payment method`
- `packages/core/src/background-jobs/jobs/table-self-pay-reach-job.test.ts > table self-pay reach job > says guests cannot see the bills while every relay refused a table's last publish`
- `packages/core/src/background-jobs/jobs/table-self-pay-reach-job.test.ts > table self-pay reach job > disposing the job drops its notifications`
- `packages/core/src/background-jobs/background-jobs.test.ts > getBackgroundJobsForRuntime > keeps the tables' notifications out of the CLI, which shows none`
- `apps/web-app/src/hooks/use-active-notifications.test.ts > useActiveNotifications > shows the tables' notifications only to a device with catalog`
- `apps/native-app/src/core/notification-permissions.test.ts > the tables' notifications need catalog`
- `apps/web-app/e2e/catalog-tables.spec.ts > a self-pay table no payment method reaches says so and links to the payment methods and the bank account`
- `apps/web-app/e2e/self-pay-relays.spec.ts > a publish every relay refused is marked on both cards, and a retry clears it`
