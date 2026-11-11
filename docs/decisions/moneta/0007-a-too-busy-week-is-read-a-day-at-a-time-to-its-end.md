# 0007 A too-busy MONETA week is read a day at a time to its end

Status: accepted
Date: 2026-11-01

## Context

The background job catches up a week per call of the sync, and reads a week
the bank lists more pages for than one call reads again a day at a time
(moneta/0006). After the first day it went back to a week, starting a day
later: a week that overlaps the one just found too busy, so it was usually
too busy as well. Each such week cost a full `MONETA_MAX_PAGES` (20) calls
before the job narrowed it again, about 20 calls more for every day of a
busy catch-up, all from the daily limit the merchant's devices share
(moneta/0010).

## Decision

Once a week is found too busy, the job reads it a day at a time to its end,
and only then goes back to a week.

## Alternatives considered

Staying at a day for the rest of the catch-up: a quiet stretch after one
busy week would then cost seven calls a week instead of one.

## Consequences

A busy week costs its truncated read and one call per day, about 27 calls,
instead of about 20 more for every day of it.

## Enforced by

- `packages/core/src/background-jobs/jobs/moneta-account-transaction-sync-job.test.ts > moneta account transaction sync job > reads a too-busy week a day at a time to its end, then a week again`
