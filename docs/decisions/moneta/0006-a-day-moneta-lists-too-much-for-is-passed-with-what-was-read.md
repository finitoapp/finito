# 0006 A day MONETA lists too much for is passed with what was read

Status: accepted
Date: 2026-11-01

## Context

One call of the sync reads at most `MONETA_MAX_PAGES` (20) pages of a
window, so the daily call limit a merchant's devices share (moneta/0010)
cannot be spent by one window. The background job read a window the bank
listed more pages for again a day at a time, then an hour at a time, and
kept its sync pointer when even an hour was too long, retrying the window
after a backoff of up to 15 minutes.

Queries against a live account on 2026-11-01 showed that the bank reads
only the date of `fromDate` and `toDate`: a window of 12:00–13:00 listed the
whole day (moneta/0004). An hour therefore lists the same as its day, and a
day the bank lists too much for stays too much for every narrower request.
Each retry spent about 60 calls on it without reading more, enough to use up
the daily limit and with it the payment-wait screen's checks.

## Decision

The job narrows a too-long window to a day and no further. A day still too
long is passed: the transfers read from it are recorded, the pointer moves
past it and the job logs an error naming the window. A narrower window that
would end where the truncated one did, because both are clamped to now, is
not asked for.

## Alternatives considered

Keeping the pointer until someone moves it with the CLI
(`set-sync-pointer`): the job retries a request that cannot succeed and
spends the shared limit on it. Reading a narrower window than a day: the
bank offers none.

## Consequences

On a day with more bookings than one sync reads, the transfers the bank
lists past the last page read are not recorded by the job, and the error
log is the only sign. The bank lists the newest first, so a job syncing
every few minutes still reads the transfers that arrived since its last
sync. A payment such a transfer pays is confirmed by hand.

## Enforced by

- `packages/core/src/background-jobs/jobs/moneta-account-transaction-sync-job.test.ts > moneta account transaction sync job > passes a day that lists more pages than one sync reads, and logs it`
- `packages/core/src/background-jobs/jobs/moneta-account-transaction-sync-job.test.ts > moneta account transaction sync job > asks no narrower window that would end where the truncated one did`
- `packages/core/src/background-jobs/jobs/moneta-account-transaction-sync-job.test.ts > moneta account transaction sync job > reads a window the bank lists too many pages for a day at a time`
