# 0026 A guest paying is told when the bill changed meanwhile

Status: accepted
Date: 2026-11-11

## Context

Nothing is reserved (`table-self-pay/0007`): while a guest has a payment
open, another guest can pay part of the same bill and staff can remove
lines. The payment step kept asking the amount the guest had picked, and
the only trace of the change was a recent payment listed at the bottom of
the long bank screen. A guest who then sent that amount overpaid the bill
for staff to resolve.

## Decision

While a guest pays a share of a bill and the bill's remainder drops below
that share, the payment step says under the amount that the bill changed
and how much is left, or that nothing is left. It tells a guest who has not
sent the money yet to go back and choose again, or not to send it, and the
page announces it as a status. The amount of the open payment stays as it
was, since the guest may have sent it already, and money that arrives is
credited as `table-self-pay/0007` says.

The guest's own payment never shows it. Its confirmation comes in the same
view as the lower remainder and ends the payment step.

## Alternatives considered

Changing the open payment to the new remainder: rejected, a guest whose
transfer is already on its way would see an amount that no longer matches
what they sent, and a QR code that changes under the camera.

Reserving the share when a payment opens: rejected by `table-self-pay/0007`.

## Consequences

A guest who already sent the money reads a notice that is not meant for
them, and its wording says so. Two guests who both send the money before
either view updates still overpay the bill, as `table-self-pay/0007`
accepts. A bill that others pay in full closes and leaves the view, so the
page says there is nothing to pay instead of showing this notice.

## Enforced by

- `apps/web-app/e2e/table-self-pay.spec.ts > a guest paying at the table > a guest paying is told what is left once another guest paid meanwhile`
- `apps/web-app/e2e/table-self-pay.spec.ts > a guest paying at the table > a guest paying is told nothing is left once staff remove every line meanwhile`
