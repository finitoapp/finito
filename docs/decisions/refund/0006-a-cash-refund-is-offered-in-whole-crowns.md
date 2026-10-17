# 0006 A refund from the cash register is offered in whole crowns

Status: superseded by refund/0012
Date: 2026-10-02

## Context

A CZK cash total is rounded to the whole crown (see payment/0002), so cash
can only be handed back in whole crowns. A storno is a message with a
negative amount whose other details follow the real state (GFŘ seminar for
developers, slide 58), so it must carry the money actually handed back.

## Decision

When a CZK payment is refunded from the cash register, the refund dialog
prefills the amount rounded to the whole crown, 50 haléř up, or one crown
lower when that would exceed what is left. Staff record the cash they hand
back, and the reversal sends that. The limit stays as refund/0014 sets it,
so the rounding the customer paid can still be returned.

## Alternatives considered

Capping a refund of goods at the charge. A 78.90 sale paid with 79 could
then record only 78.90 while 79 goes back in coins, and the storno would
not match the money returned. Rounding whatever staff enter. It would
record an amount nobody typed.

## Consequences

Returning only the goods of a payment whose cash was rounded up leaves the
rounding with the business, still reported in EET, and shows the payment
partly refunded. The prefill follows the chosen method until staff type an
amount, so a refund outside Payky is offered exactly. A tip refund returns
the exact tip, also from the cash register.

## Enforced by

- `packages/core/src/modules/refund/refund-utils.test.ts > deriveRefundPrefillAmount > prefills $prefill of $remaining $currency left for a refund $method`
- `apps/web-app/e2e/eet.spec.ts > a payment settled twice reports the extra money, and refunding it reverses only that`
