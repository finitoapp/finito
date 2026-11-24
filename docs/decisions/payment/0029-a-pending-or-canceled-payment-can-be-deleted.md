# 0029 A pending or canceled payment can be deleted

Status: accepted
Date: 2026-11-23

## Context

Payments started by mistake, or canceled, stayed in the history for good.
Staff want to take them off it.

## Decision

- The payment detail offers deleting a payment that is Pending or Canceled
  and has no money. It asks for confirmation first, and for `discard`, the
  permission canceling needs (access/0012).
- `deleteUnpaidPayment` refuses a payment with an active claim, a canceled
  one included (payment/0004), and any other status.
- It also refuses a payment whose money may be on its way: a card attempt
  that is pending or has an unknown outcome (payment/0006), also once the
  payment is canceled, a Qerko payment in progress, or a Cashu token being
  received. That money is recorded only on a payment that is still there.
- A pending payment is canceled in the same write. The statistics' canceled
  payments signal counts deleted payments too, so deleting one does not hide
  that staff called it off.
- The payment number stays used.

## Alternatives considered

- Deleting an expired payment as well: not asked for.
- Dropping deleted payments from the signal: whoever cancels could then
  erase the trace of it.

## Consequences

A transfer or a Lightning payment sent for a deleted payment arrives on its
account but is matched to nothing, and the confirmation says so. The guards
are best effort: another offline device can take money for a payment this
one deletes. A payment whose card attempt stays unknown cannot be deleted.

## Enforced by

- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > deleting an unpaid payment (payment/0029) > a pending payment is deleted, and canceled with it`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > deleting an unpaid payment (payment/0029) > a canceled payment is deleted`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > deleting an unpaid payment (payment/0029) > a payment money arrived for is refused, canceled or not`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > deleting an unpaid payment (payment/0029) > an expired payment is refused`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > card payment attempts > canceling a payment whose card attempt is unknown (payment/0025) > keeps it from being deleted, canceled or not (payment/0029)`
- `packages/core/src/modules/sales-stats/sales-stats-queries.test.ts > signals > a canceled payment stays counted once it is deleted (payment/0029)`
