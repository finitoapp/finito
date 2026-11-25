# 0030 The Spark sweep waits for an incoming claim

Status: superseded by payment/0031
Date: 2026-11-25

## Context

payment/0027 sweeps the wallet's transfer history every minute and on every
`balance:update` and `deposit:confirmed`. The SDK sends `balance:update`
twice for an incoming payment: once the event stream delivers the transfer,
with its amount still incoming, and again once the SDK claimed it. The first
sweep finds the transfer unfinished (`SENDER_KEY_TWEAKED`) and skips it.
Measured on a PAX A920Pro (finitoapp/finito#275), that sweep ran for 3 s
beside the claim, whose 5 s are signing on the same JS thread.

## Decision

- A `balance:update` whose balance has an amount incoming starts no sweep:
  the claim it announces ends in another `balance:update`, with nothing
  incoming, which does.
- Otherwise as payment/0027: a sweep runs every minute, on every other
  `balance:update` and on `deposit:confirmed`. It reaches back 72 hours
  before the pointer on the session's first sweep, when 30 minutes have
  passed since the last such sweep (`SPARK_FULL_SWEEP_INTERVAL_MS`), and
  after `deposit:confirmed`; the sweeps in between look back the last hour
  (`SPARK_RECENT_SWEEP_LOOKBACK_MS`). Only a full sweep moves the pointer
  (payment/0026). A sweep asks which transfers of a page are recorded
  already, and which of them a payment claims, in one query.

## Alternatives considered

- Debouncing `balance:update`. Rejected, as in payment/0027: the sweeps
  share one keyed queue, and the first sweep is not redundant, it is early.

## Consequences

- A claim that fails leaves its transfer to the minute's sweep, and to the
  SDK, which tries again every 10 s on React Native.
- While another incoming transfer stays unclaimed, a balance update of one
  that completed sweeps nothing: its own `transfer:claimed` records it, or
  the minute's sweep.

## Enforced by

- `packages/core/src/background-jobs/jobs/spark-account-transaction-sync-job.test.ts > spark account transaction sync job > sweeps on a balance update only once nothing is incoming, after the claim`
- `packages/core/src/background-jobs/jobs/spark-account-transaction-sync-job.test.ts > spark account transaction sync job > sweeps the last hour every minute and the 72 hours before its pointer every half hour`
- `packages/core/src/background-jobs/jobs/spark-account-transaction-sync-job.test.ts > spark account transaction sync job > sweeps the 72 hours again once a deposit is confirmed, as its transfer may be older than an hour`
- `packages/core/src/background-jobs/jobs/spark-account-transaction-sync-job.test.ts > spark account transaction sync job > checks a page of recorded transfers in one query, without taking each transfer's lock`
