# 0008 A bank self-pay is claimed when matched, Lightning when it arrived

Status: accepted
Date: 2026-10-14

## Context

The claim time of a self-pay payment is the sale time EET reports, and a
sale must be recorded at the latest when its money is received (see
eet/0001). Spark tells when Lightning money arrived. FIO books a bank
transfer only by its date: its midnight comes before the guest paid, and on
the day EET is switched on it falls before the switch, so that sale would
never be reported.

## Decision

Lightning self-pay money is claimed when Spark received it. A bank
self-pay transfer is claimed when the merchant device matched it.

## Alternatives considered

Claiming a bank transfer at the midnight of its booking date, which every
device would derive alike. It dates the sale before the guest paid and
loses the sale on the day EET is switched on.

## Consequences

A bank transfer's claim time is the one value of a self-pay match that is
not derived from the money, its message and the bill
(`table-self-pay/0005`): two devices that match the same transfer each
claim it when they matched it. A transfer matched before EET was enabled is
never reported.

## Enforced by

- `packages/core/src/modules/table-self-pay/table-self-pay-reconciliation.test.ts > self-pay by bank transfer > settles a transfer when it was matched, since the bank books only its date`
- `packages/core/src/modules/table-self-pay/table-self-pay-reconciliation.test.ts > self-pay by Lightning > settles Lightning money when Spark received it`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: self-pay > reports a self-pay transfer at the time it was matched, not at midnight of its booking date`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: self-pay > never reports a self-pay transfer matched before EET was enabled`
