# 0028 Charge on a partly paid bill asks for the rest

Status: accepted
Date: 2026-11-21

## Context

A bill can stay open with money already claimed against it (payment/0014):
a bank transfer for less than the payment asked, or two devices racing, one
adding an item while the other's payment is confirmed. Charge created its
payment for the bill's whole total all the same, so paying it closed the
bill overpaid by everything paid before, money only a refund could hand
back.

## Decision

- Charge asks for what the bill owes less what its payments have paid
  (`deriveBillAmountDue`): the same total and the same claimed sum coverage
  compares (`deriveBillCoverage`), so paying it brings the bill to exactly
  `paid`. A bill nobody paid for is charged its whole total, as before.
- The tip screen starts from that amount, so a tip is added to the rest,
  not to the whole bill.
- While anything has been paid, the cart shows what was paid and what is
  still due under the total, and a large monitor's Charge names the amount
  due.
- Both apps do the same.

## Alternatives considered

Charging the whole total and leaving staff to refund the difference, which
returns money outside the payment it belongs to and makes every partly paid
bill a refund. Disabling Charge on a partly paid bill, which leaves it no
way to be settled but changing the cart.

## Consequences

`createPayment` still takes whatever amount it is given: the rule is the
apps', like the rest of the checkout (`deriveBillCheckout`), and a payment
created another way (the CLI) can still overpay a bill.

## Enforced by

- `packages/core/src/modules/bill/bill-utils.test.ts > deriveBillAmountDue > charges the whole total on a bill nobody paid for`
- `packages/core/src/modules/bill/bill-utils.test.ts > deriveBillAmountDue > charges only the rest on a partly paid bill`
- `packages/core/src/modules/bill/bill-utils.test.ts > deriveBillAmountDue > owes nothing on a bill paid off, over or below zero`
- `apps/web-app/e2e/activity-bills.spec.ts > Charge on a partly paid bill asks only for what is still due`
