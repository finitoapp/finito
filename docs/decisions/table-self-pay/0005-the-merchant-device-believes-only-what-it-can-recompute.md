# 0005 The merchant device believes only what it can recompute

Status: accepted
Date: 2026-10-14

## Context

Anyone with the sticker can pay with any message, so everything a payment
claims besides the money is a stranger's text. The money itself is the
only input a stranger cannot fake: it arrived on the merchant's own
account, seen by the merchant device's FIO or Spark sync
(docs/table-self-pay-design.md, "Proof instead of permission").

## Decision

Nothing in the payment is taken on faith. A claim can only narrow what the
merchant device already knows, never widen it. The device credits the
money that arrived to the one bill the reference names, decodes the lines
against a version it stored or, while the bill is open on its table, the
bill as it stands, prices the share with the function the guest page
used, and keeps what arrived above the
share as the tip. Money it cannot match stays unmatched for staff, and
money whose lines do not check out counts toward the bill without paying
lines. The check for each claim is in docs/table-self-pay-design.md §4.

Allocations only mark lines paid. Coverage and status read money alone.
Every row a match writes derives from the transaction, its message and the
bill, and the payment id derives from `self-pay:{transactionId}`
(`createSelfPayArrival`), so two merchant devices that see the same
arrival write the same rows. Two values are the exception: the claim time
of a bank transfer (`table-self-pay/0008`), and the `closedAt` of a bill
the match closes, which the device stamps with its own clock.

## Alternatives considered

None recorded.

## Consequences

A wrong or late allocation can never make a bill look settled, and no tip
field travels that a guest could inflate. Every check a stranger can make a
merchant device run costs the stranger a payment to the merchant.

This decision has no exit. It is the invariant the other self-pay
decisions rest on.

## Enforced by

- `packages/core/src/modules/table-self-pay/table-self-pay-reconciliation.test.ts > self-pay by bank transfer > credits exactly what arrived with another bill's reference`
- `packages/core/src/modules/table-self-pay/table-self-pay-reconciliation.test.ts > self-pay by bank transfer > leaves money with %s unmatched`
- `packages/core/src/modules/table-self-pay/table-self-pay-reconciliation.test.ts > self-pay by bank transfer > leaves a transfer in another currency than the bill unmatched`
- `packages/core/src/modules/table-self-pay/table-self-pay-reconciliation.test.ts > self-pay by bank transfer > leaves money naming a reference two bills share unmatched`
- `packages/core/src/modules/table-self-pay/table-self-pay-reconciliation.test.ts > self-pay by bank transfer > does not offer a bill whose device is unknown`
- `packages/core/src/modules/table-self-pay/table-self-pay-reconciliation.test.ts > self-pay by Lightning > leaves a payment naming %s unmatched`
- `packages/core/src/modules/table-self-pay/table-self-pay-reconciliation.test.ts > self-pay by Lightning > credits no more than the money is worth`
- `packages/core/src/modules/table-self-pay/table-self-pay-reconciliation.test.ts > self-pay by Lightning > ignores a flood of one-satoshi payments`
- `packages/core/src/modules/table-self-pay/table-self-pay-reconciliation.test.ts > two devices recording one arrival > write the same payment and settlement`
- `packages/core/src/modules/table-self-pay/table-self-pay-reconciliation.test.ts > two devices recording one arrival > write the same Lightning payment and settlement`
- `packages/core/src/modules/table-self-pay/table-self-pay-allocation.test.ts > self-pay allocation > counts less money than the share without allocation and without a tip`
- `packages/core/src/modules/table-self-pay/table-self-pay-allocation.test.ts > self-pay allocation > keeps what arrives above the share as the tip`
- `packages/core/src/modules/table-self-pay/table-self-pay-allocation.test.ts > self-pay allocation after the bill changed > counts money for a line removed meanwhile without marking it paid`
- `packages/core/src/modules/table-self-pay/table-self-pay-rate-utils.test.ts > rate MAC > fails when %s changed`
