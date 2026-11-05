# 0011 One device of the account serves Qerko payments

Status: accepted
Date: 2026-11-04

## Context

Qerko allows one POS websocket per restaurant: a new connection closes the
previous one with `4409`. Qerko calls the POS over it for every Qerko payment
of the restaurant, whichever device created the payment.

## Decision

One device of the account, `accountQerkoPayment.connectionDeviceId`, holds
the websocket and serves every device's Qerko payments; the others see the
outcome through sync. The choice syncs and the last one wins, as Qerko's own
last connection does: a device that sees another chosen disconnects. Whether
the connection is up, taken over (`stolen`) or refused (`unauthorized`)
stays local to the device. A taken-over or refused connection stays down
until the device is chosen again or paired again. Across the tabs of one
browser, a lock keeps it to one.

## Alternatives considered

Every device connecting: they would close each other's connection in turn.

## Consequences

The device has to stay on with the app open for customers to pay; the
payment screen warns when no device is chosen, or when this one is and is
not connected. On Android the connection is held only while the app is in
the foreground.

## Enforced by

- `packages/core/src/background-jobs/jobs/qerko-payment-connection-job.test.ts > qerko payment connection job > connects only on the device chosen to serve Qerko payments`
- `packages/core/src/background-jobs/jobs/qerko-payment-connection-job.test.ts > qerko payment connection job > choosing another device hands the connection over`
- `packages/core/src/background-jobs/jobs/qerko-payment-connection-job.test.ts > qerko payment connection job > a connection taken over stays down until this device is chosen again`
- `packages/core/src/background-jobs/jobs/qerko-payment-connection-job.test.ts > qerko payment connection job > a refused key waits for a new pairing`
