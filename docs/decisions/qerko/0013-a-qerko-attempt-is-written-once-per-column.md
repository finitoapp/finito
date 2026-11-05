# 0013 A Qerko attempt is written once per column, keyed by Qerko's id

Status: accepted
Date: 2026-11-04

## Context

Several devices write a Qerko payment's outcome: the one holding the
websocket, every device's `get-payment` and a refund from anywhere. Evolu
merges each column on its own by last write, so one mutable "current
attempt" row, as the terminal keeps, would let a stale `PROCESSING` overwrite
a `PAID` and a late `paymentClosed` of one attempt clear the next.

## Decision

Each Qerko payment is its own `qerkoPaymentAttempt` row, its id derived from
Qerko's payment id, so every writer reaches the same row. `paymentStart`
writes its start; every other column only ever goes from null to a value, and
the closing columns are written together, only while the attempt is open.
Qerko's final state does not change, so two devices writing it write the same
values. An attempt is in progress while `closedAt` is null.

## Alternatives considered

The terminal's single row with pending markers: correct only while one
writer at a time answers for an attempt.

## Consequences

The payment detail can list every attempt. Settling is idempotent, whoever
delivers the answer and however often.

## Enforced by

- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > startQerkoPayment > records the attempt once, however often Qerko repeats it`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > settleQerkoPayment > a late PROCESSING or CANCELLED does not undo PAID`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > settleQerkoPayment > a late CANCELLED of the first attempt leaves the second alone`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > settleQerkoPayment > a state still in progress only marks the attempt processing`
