# 0009 A Qerko bill is one line paid at once

Status: accepted
Date: 2026-11-04

## Context

Qerko shows the customer a bill and lets them pay part of it, add a tip or
apply a discount, unless the bill says otherwise. A Payky payment already has
its amount, tip included, and may be one of several payments of a bill.

## Decision

The bill Qerko gets for a payment is one line, "Platba #N", with the whole
amount: `allowPartialPayment`, `allowTip` false, `denyDiscounts`,
`denyMenus` true. Its id is the payment's id, which is also what the QR code
hands `searchBills`. `paymentStart` is refused with `INVALID_DATA` when its
currency, amount or a discount does not match, with `BILL_CLOSED` when the
payment no longer waits, and with `BILL_LOCKED` while another Qerko payment
of it is in progress.

## Alternatives considered

Sending the bill's own lines: a payment may cover only part of its bill, and
Qerko would then let the customer pay something other than the payment.

## Consequences

The receipt `paymentProcessed` answers has one line too. Its VAT lines come
from the payment's bill lines when they cover it, a tip on top as 0 %, and
otherwise one 0 % line, so base and tax always add up to the amount.

## Enforced by

- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > resolveQerkoBill > offers the payment as one line, paid at once, without tip or discount`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > resolveQerkoBill > a payment no longer waiting is a closed bill`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > startQerkoPayment > refuses %j as %s`
- `packages/core/src/modules/payment/payment-qerko-payment-actions.test.ts > startQerkoPayment > locks the bill while another Qerko payment of it is in progress`
- `packages/core/src/modules/payment/payment-qerko-payment-utils.test.ts > createQerkoReceipt > uses the bill's VAT lines when they cover the payment`
