# 0026 A sync pointer is written only when it moves

Status: accepted
Date: 2026-11-17

## Context

The FIO, MONETA and Spark sync jobs each keep a pointer that narrows the
next sync's window (`docs/payment-sync.md`). Every sync wrote it, whether it
had moved or not: FIO's date every 30 seconds by default, MONETA's every 5
minutes, Spark's timestamp every minute and on every wallet event. These are
synced tables. Each write adds `evolu_history` rows that are never pruned,
travels to every other device of the account, and makes Evolu re-run every
subscribed query there and on the writing device. On the React Native app
that work runs on the UI's JS thread, so the payment terminal paid for
thousands of writes a day that carried nothing new
(`docs/plans/background-jobs-performance.md`).

## Decision

- FIO and MONETA write their pointer only when the date differs from the
  one stored. A sync that ends on the day the pointer already names writes
  nothing.
- Spark writes its pointer only when the sweep's start is at least an hour
  past the stored one (`SPARK_SYNC_POINTER_STEP_MS`), or when the stored one
  is ahead of the clock, which is pulled back to now as before.

## Alternatives considered

- Keeping the Spark pointer in the device database, so it never syncs.
  Rejected for now: the pointer is set for every device when a wallet is
  first selected (so its first sync does not import the wallet's whole
  history), and the settings screen and the CLI edit it for the account.
  Writing it once an hour already removes nearly all of its writes.
- Writing a pointer only when a sync recorded something. Rejected: a quiet
  account would never narrow its window again (`account.ts`,
  `sparkAccountSyncPointer`).

## Consequences

- A Spark pointer may lag the clock by up to an hour, so a sweep may look
  back up to 73 hours instead of 72. That only widens the safety net.
- Two devices that both sync the same bank account write the date once a
  day between them instead of every interval each.

## Enforced by

- `packages/core/src/background-jobs/jobs/fio-account-transaction-sync-job.test.ts > fio account transaction sync job > does not write the sync pointer again when a sync ends on the day it points at`
- `packages/core/src/background-jobs/jobs/moneta-account-transaction-sync-job.test.ts > moneta account transaction sync job > does not write the pointer again when a sync ends on the day it points at`
- `packages/core/src/background-jobs/jobs/spark-account-transaction-sync-job.test.ts > spark account transaction sync job > writes the sync pointer again only once a sweep moves it an hour, or pulls it back to now: $name`
