# 0009 The refund badge shows every amount given back, the tip included

Status: accepted
Date: 2026-11-08

## Context

A payment's refund badge ("Refunded 50 Kč", "Partly refunded 20 Kč") showed
the goods refunded only, because refund/0004 measures the refunded state by
goods. Once a card refund gave back a whole payment of 55 Kč with a tip of
5 Kč (refund/0008), the badge read 50 Kč while 55 Kč had left the account and
both refunds were listed right under it.

## Decision

The badge's amount is every refund of the payment added up, the tip refund
included (`PaymentRefundSummary.returnedAmount`). Whether it reads as partly
or fully refunded is still measured by goods alone (refund/0004), so giving
back all the goods reads as refunded in full whether the tip went back or
not.

## Alternatives considered

Counting the tip in the refunded state too, which refund/0004 rejected: a
tip refund alone would read as a partly refunded sale. Leaving the amount at
goods, which states less than went back.

## Consequences

A payment whose tip alone was refunded still shows no badge, as its state is
"none"; its refund list shows the tip refund.

## Enforced by

- `packages/app-shared/src/activity-history.test.ts > refundBadgeLabel > shows every amount given back, the tip included, while its state counts goods`
- `packages/core/src/modules/refund/refund-utils.test.ts > summarizeRefundsByPayment > leaves a tip refund out of the refunded state`
