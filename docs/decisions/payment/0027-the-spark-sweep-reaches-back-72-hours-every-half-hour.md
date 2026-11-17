# 0027 The Spark sweep reaches back 72 hours every half hour

Status: accepted
Date: 2026-11-17

## Context

The Spark sync job sweeps the wallet's transfer history every minute and on
every `balance:update` and `deposit:confirmed`. Each sweep fetched every
transfer created since 72 hours before its pointer, the window a completed
transfer's `createdTime` may lag behind when the SDK reports it done (an
on-chain deposit). Each page is a call to the Spark operators and one to the
SSP, decoded on the JS thread, and every transfer it listed took its own
lock and its own query, and an unclaimed one up to five more. Every device
runs it for every Spark account, so on the payment terminal it was steady
work on the UI thread (`docs/plans/background-jobs-performance.md`).

## Decision

- A sweep reaches back 72 hours before the pointer on the session's first
  sweep, when 30 minutes have passed since the last such sweep
  (`SPARK_FULL_SWEEP_INTERVAL_MS`), and after `deposit:confirmed`, whose
  transfer may have been created long before it completed.
- The sweeps in between look back the last hour
  (`SPARK_RECENT_SWEEP_LOOKBACK_MS`).
- Only a full sweep moves the pointer (payment/0026): a recent one did not
  cover the window the pointer stands for.
- A sweep asks which transfers of a page are recorded already, and which of
  them a payment claims, in one query. A claimed one needs nothing more, an
  unclaimed one is offered to reconciliation, and only a new one takes the
  transfer's lock and is recorded.

## Alternatives considered

- Debouncing `balance:update`. Not needed: the sweeps share one keyed queue,
  which runs at most one more after the running one however many events
  arrive, and a recent sweep is now cheap.
- Dropping the 72-hour sweep. Rejected: it is the safety net for a transfer
  whose event was missed.

## Consequences

- A transfer created more than an hour before it completed, whose
  `transfer:claimed` event was missed, is recorded up to 30 minutes later
  than before.
- An unclaimed transfer in the window is still offered to reconciliation on
  every sweep that lists it, now only within the last hour on most of them.

## Enforced by

- `packages/core/src/background-jobs/jobs/spark-account-transaction-sync-job.test.ts > spark account transaction sync job > sweeps the last hour every minute and the 72 hours before its pointer every half hour`
- `packages/core/src/background-jobs/jobs/spark-account-transaction-sync-job.test.ts > spark account transaction sync job > sweeps the 72 hours again once a deposit is confirmed, as its transfer may be older than an hour`
- `packages/core/src/background-jobs/jobs/spark-account-transaction-sync-job.test.ts > spark account transaction sync job > checks a page of recorded transfers in one query, without taking each transfer's lock`
