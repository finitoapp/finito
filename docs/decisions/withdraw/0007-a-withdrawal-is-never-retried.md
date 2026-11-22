# 0007 A withdrawal is never retried; one whose transfer never appears is marked failed

Status: accepted
Date: 2026-10-09

## Context

Only our own client sends the money, during the SDK call. If the transfer
`getTransfer(transferId)` asks for does not exist long after sending, it
never will. But device clocks differ, `createdAt` is stamped by the
creating device's clock, and an app frozen mid-call still holds its send.

## Decision

- No withdrawal is retried. A failed one is followed by a new withdrawal.
- The sync job marks a Lightning withdrawal whose transfer does not exist
  `not-created`: on the creating device after 10 minutes and only while it
  does not hold the withdrawal's `withdrawal-<id>` lock (held from the
  first write through sending); on any other device, and in the CLI, which
  is a device too, after 24 hours.
- "New withdrawal" is offered only after a failure confirmed by something
  other than time: `rejected`, `returned` and `manual`. A
  `not-created` one explains how to check the balance instead: a new
  withdrawal to the same Lightning address could pay twice.

## Alternatives considered

Retrying with the same `transferId`, which the SDK accepts as an
idempotency key: it means keeping the invoice and the quote, and does not
help once the invoice expired.

## Consequences

A device whose clock is off by more than a day could mark a withdrawal
another device is still sending; such a skew is not expected. Should the
transfer appear after all, its movement turns the withdrawal done.

## Enforced by

- `packages/core/src/modules/withdraw/withdraw-check-actions.test.ts > checkPendingWithdrawals > on the creating device, marks a missing transfer not-created after ten minutes, not before`
- `packages/core/src/modules/withdraw/withdraw-check-actions.test.ts > checkPendingWithdrawals > does not mark a withdrawal this device is still sending`
- `packages/core/src/modules/withdraw/withdraw-check-actions.test.ts > checkPendingWithdrawals > seen from %s, marks a missing transfer not-created only after 24 hours`
- `packages/core/src/modules/withdraw/withdraw-actions.test.ts > executeWithdrawal > holds the withdrawal's lock while sending`
