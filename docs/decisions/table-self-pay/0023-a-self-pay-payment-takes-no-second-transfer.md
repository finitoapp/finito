# 0023 A self-pay payment takes no second transfer

Status: accepted
Date: 2026-11-05

## Context

Since payment/0007 a paid payment is a candidate for a second bank transfer
that quotes its symbols, so the transfer overpays it rather than staying
unclaimed. A self-pay payment is recorded from money that already arrived,
and its variable symbol is the bill's reference. Every guest of the bill
quotes that reference, often with the same amount: two guests who split a
bill in halves send two equal transfers.

## Decision

A self-pay payment is never a candidate for a bank transfer. A transfer that
quotes a self-pay bill's reference goes to the self-pay match, which credits
it to the bill as the next guest's money, with the pointer it carries.
payment/0007 holds unchanged for every payment a till asked for.

## Alternatives considered

Let the earlier guest's payment take it as an overpayment: rejected, the
second guest's share would show as the first guest's overpayment, the lines
the second guest paid would stay open, and staff would be asked to return
money nobody overpaid.

## Consequences

Two guests who pay the whole remainder each leave the bill overpaid by the
second transfer, which staff resolve as any overpaid bill.

## Enforced by

- `packages/core/src/modules/table-self-pay/table-self-pay-reconciliation.test.ts > self-pay by bank transfer > records two guests who each pay the whole remainder, leaving the bill overpaid`
- `packages/core/src/modules/table-self-pay/table-self-pay-allocation.test.ts > self-pay allocation > credits two guests who pay the same fifth from the same view`
