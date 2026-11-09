# 0013 A card refund keeps what its terminal answered

Status: accepted
Date: 2026-11-09

## Context

A refund to the card through SwitchioPay (refund/0007) or the Qerko terminal
(qerko/0004) starts as an attempt, and the attempt is soft deleted once the
terminal approves and the `refund` row is written. Only that deleted attempt
still held the terminal's transaction and, for SwitchioPay, whether the
payment was reversed or refunded to the card (refund/0008). A deleted attempt
also means one staff took away, so it cannot tell the two apart, and the
terminal's answer gave nothing more to keep. Staff match a refund with the
terminal's own records and receipt by what the terminal answered, and the
refund detail (`/activity/:paymentId/refunds/:refundId`) is where they look
for it. Plan: `docs/plans/refund-detail.md`. A payment keeps what its refund
needs on its own detail table for the same reason (payment/0009).

## Decision

A card refund keeps what its terminal answered in a detail table beside the
`refund` row, under the refund's id, owned by the refund module:

- **SwitchioPay**, `refundCardSwitchio`: the transaction id the attempt sent
  (the ECR request id SwitchioPay finds the refund by), its kind (`reversal`
  or `referralRefund`), and the `authCode` and `sequenceNumber` of the
  approval, which the terminal's receipt prints, when the answer carried
  them. Settled again from an answer without them, the row keeps what the
  first answer said.
- **Qerko terminal**, `refundQerkoTerminal`: Qerko's transaction id of the
  refund and the terminal it went to (TID, qerko/0006). Qerko's approval
  carries nothing more.

The row is written in the batch that settles the refund, with the refund and
its money movement, however the approval arrives: the result itself, a result
restored after a restart, the terminal asked afterwards, or the Qerko sync
job. A refund of the whole payment writes a row under each of its two
refunds, goods and tip (refund/0011), for the one transaction both went
through. The Qerko repair that writes a tip refund an older version left out
(`repairQerkoTerminalTipRefunds`, refund/0010) writes the tip's row from the
attempt too.

A SwitchioPay reversal recorded because the payment already reads as
reversed (refund/0007) keeps no auth code or sequence number: the terminal's
answer was about the payment, not this refund.

## Alternatives considered

Reading the soft-deleted attempt, which already holds the transaction and
kind but also stands for an attempt staff took away, and which nothing else
reads once it is deleted. One row for the goods and tip refunds of a whole
refund, which would need a column grouping them (rejected in the plan).

## Consequences

Refunds written before this have no detail row and are not backfilled: the
refund detail shows only their method. The detail rows are soft deleted only
with their refund. The refund detail reads them through `refundByIdQuery`.

## Enforced by

- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > what the terminal answered, kept beside the refund > a refund to the card keeps its transaction and what the receipt prints`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > what the terminal answered, kept beside the refund > a reversal of the whole payment keeps the one transaction under both refunds`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > what the terminal answered, kept beside the refund > a restored result settled again keeps one row and what the first answer said`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > what the terminal answered, kept beside the refund > a refund the terminal reports when asked keeps what its answer carried`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > what the terminal answered, kept beside the refund > a reversal recorded because the payment reads as reversed keeps no receipt of the payment's`
- `packages/core/src/modules/refund/refund-qerko-actions.test.ts > refund to the card through Qerko > records the refund and the money going out once the terminal approves`
- `packages/core/src/modules/refund/refund-qerko-actions.test.ts > refund of the whole payment to the card through Qerko > asks the terminal once for the goods and the tip and records them as two refunds`
- `packages/core/src/modules/refund/refund-qerko-actions.test.ts > refund of the whole payment to the card through Qerko > the tip an older version left out when it settled the attempt is written once`
- `packages/core/src/modules/refund/refund-queries.test.ts > refundByIdQuery > reads a refund an older version wrote, without its cash row or device, as nulls`
