# 0012 get-payment settles what paymentClosed never said

Status: accepted
Date: 2026-11-04

## Context

`paymentClosed` arrives only over the websocket. When the connection drops
mid-payment, or the device holding it goes away, it never arrives and the
payment would wait forever.

## Decision

Every Qerko attempt still in progress is asked about with REST `get-payment`
once a 30 s grace period after its start is over, leaving the ordinary path to
the websocket, then with backoff from 5 s to a minute, and at once when the
device comes back online. It runs on every device, since REST needs no
websocket, and the payment screen does the same while it shows an attempt
past the grace period. The answer goes through the same write as
`paymentClosed`.

## Alternatives considered

Asking only on the device holding the connection: it may be the one that
went away.

## Consequences

The writes must agree whoever makes them; see `qerko/0013`.

## Enforced by

- `packages/core/src/background-jobs/jobs/qerko-payment-sync-job.test.ts > qerko payment sync job > leaves an attempt to the websocket during the grace period`
- `packages/core/src/background-jobs/jobs/qerko-payment-sync-job.test.ts > qerko payment sync job > asks get-payment after the grace period until Qerko says PAID`
- `packages/core/src/background-jobs/jobs/qerko-payment-sync-job.test.ts > qerko payment sync job > a final state that is not PAID closes the attempt without money`
