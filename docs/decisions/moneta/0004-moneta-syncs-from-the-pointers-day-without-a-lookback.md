# 0004 MONETA syncs from the pointer's day, without a lookback

Status: accepted
Date: 2026-11-01

## Context

The ČOBS v7 standard MONETA's VIP API follows says only that `fromDate` and
`toDate` bound "the required transaction history", not which of a
transaction's dates they compare. Queries against a live account on
2026-11-01 (a Sunday) showed:

- The bank compares `fromDate` with `bookingDate`, by the date written in
  it alone, its time and offset ignored (moneta/0008): three
  transfers with `valueDate` 2026-11-01 and `bookingDate` 2026-11-02 came for
  `fromDate` 2026-11-02, also for a window of 12:00–13:00 that day, and not
  for `fromDate` 2026-11-03.
- `toDate` bounds a transfer booked in the past, but not one whose
  `bookingDate` is still ahead: the three came for a September window too.

A transfer's booking date is therefore never before the day the bank first
lists it. A late-booked or weekend transfer lands on the day it is booked
or after, which a window starting on the pointer's day reads.

## Decision

The background job reads from the day of its sync pointer, with no
lookback, and the payment-wait screen from the bank day the payment was
created (moneta/0008).
The merchant sets no lookback for MONETA; the field Fio has does not exist
here.

## Alternatives considered

A fixed lookback of one day, as a margin against a bank backdating a
booking into a day already read. It would cost no call, a day fits the same
weekly window, but nothing observed calls for it. A per-plugin lookback, as
Fio has: each week of it costs a call per sync, which the merchant does not
see in the call estimate (moneta/0002).

## Consequences

A background sync is one call while the pointer is within a week of today,
so `estimateMonetaDailyCalls` holds whatever the settings. A transfer
listed with a future `bookingDate` comes in every window until then; the
bank reference keeps it from being recorded twice. Not yet seen: how the
bank filters a pending (`PDNG`) entry, and whether it ever books into a day
already past. If it does, the transfer is missed until the merchant moves
the pointer back.

## Enforced by

- `packages/core/src/background-jobs/jobs/moneta-account-transaction-sync-job.test.ts > moneta account transaction sync job > starts the next sync on the pointer's day, not before it`
- `packages/core/src/background-jobs/jobs/moneta-account-transaction-sync-job.test.ts > moneta account transaction sync job > starts a pointer set in the future today`
- `packages/app-shared/src/moneta-payment-watch.test.ts > monetaPaymentWatchRange > reads the bank days from the payment's up to today, in the bank's time zone`
