# 0009 Background jobs hold the self-pay root, never the master key

Status: accepted
Date: 2026-10-14

## Context

The publishing job signs each table's view with the table's key and its
Lightning rate with the rate key, and reconciliation checks that rate when
the money arrives (`table-self-pay/0006`). Both keys derive from the
merchant's master key. Background jobs run for the whole session on every
device.

## Decision

Background jobs get the table self-pay root, derived from the master key
by `deriveTableSelfPayRoot`, and never the master key itself. The Cashu
job alone holds the master key, from which the shared Cashu wallet derives
its keys. A device without the root leaves Lightning self-pay to the
devices that can verify its rate.

## Alternatives considered

None recorded.

## Consequences

Any job but the Cashu job can derive the table keys and the rate key, and
no key outside them.
Jobs still hold `evolu`, whose owner secret derives from the master key,
and through it every secret the account stores in its database, the Spark
wallet secrets included. What stays out of their reach is the master key
and the keys derived from it only when used, such as the nostr key.

## Enforced by

- `packages/core/src/background-jobs/background-jobs.test.ts > AppBackgroundJobContext > hands jobs the self-pay root and never the master key`
- `packages/core/src/modules/table-self-pay/table-self-pay-reconciliation.test.ts > self-pay by Lightning > leaves Lightning to devices that hold the self-pay key`
