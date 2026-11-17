# 0013 The reporting job watches a trigger, not what is due

Status: accepted
Date: 2026-11-17

## Context

The EET reporting job kept five queries subscribed: the payments, extra
claims and refunds due a record, and the sales and reversals due delivery.
Evolu re-runs every subscribed query after every write, local or synced,
and on the React Native app it does so on the UI's JS thread. The three
creation queries read every payment or claim in the database, with up to
eight correlated subqueries per payment, and the reversal query grouped
every sale ever recorded. On a synthetic year of 20,000 payments with EET
on for half of it, the five took about 94 ms on a desktop per write, and
the cost grew with the history (`docs/plans/background-jobs-performance.md`).
The job never used their rows: each subscription only queued a pass that
loaded the query again.

## Decision

- The job subscribes to `eetCreationTriggerQuery` instead of the three
  creation queries. It has no row while EET is off, and otherwise changes
  with the EET settings and with the count and the latest `updatedAt` of
  claims, sales, sale confirmations and refunds. When it moves, the job
  loads the creation queries once and creates what is due.
- The one change the trigger cannot see is a row updated by a sync whose
  timestamp is older than the newest row. The job therefore also looks for
  what is due every 5 minutes (`EET_CREATION_RECHECK_MS`).
- The sale and reversal delivery queries stay subscribed: they read the
  sales and reversals alone.
- The creation queries start from the claims made since EET was enabled
  (`reconciliationClaim_claimedAt`), and the sale confirmation a reversal
  waits for is looked up per reversal, not grouped over every sale.

## Alternatives considered

- Only making the queries cheaper, still subscribed. Done as well, but what
  is due cannot be found without reading every claim since EET was enabled,
  so the cost per write would still grow with the history.
- Bounding the creation queries to recent claims. Rejected: a device that
  was offline for days must still report what it settled.
- A trigger with no periodic check. Rejected: a missed change would wait for
  the next unrelated write or restart.

## Consequences

- A subscribed EET query now costs about 3 ms per write on the same data,
  nothing while EET is off.
- A record made due by an update synced with an old timestamp is created
  up to 5 minutes late. Every new claim, sale, confirmation and refund still
  wakes the job at once.
- A new input that can make a record due has to be added to the trigger.

## Enforced by

- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: what wakes it > subscribes to the creation trigger and the deliveries, never to the queries that read every claim`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: what wakes it > finds a sale due at its periodic check when no subscription tells it`
- `packages/core/src/modules/eet/eet-queries.test.ts > eetCreationTriggerQuery > moves with every claim, sale and refund written, and has no row while EET is off`
- `packages/core/src/modules/eet/eet-queries.test.ts > eetExtraClaimsQuery > leaves out a payment claimed only before EET was enabled, which owes no extra sale`
