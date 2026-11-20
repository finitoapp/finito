# 0027 A payment open when its bill closes stays and says nothing is left

Status: accepted
Date: 2026-11-12

## Context

`table-self-pay/0026` tells a guest on the payment step when the bill
changed meanwhile, and left out a bill that closes: it leaves the view, so
the page said there was nothing to pay. A review on 2026-11-12 had staff
close a bill while a guest stood on the bank step. The amount, the
variable symbol and the QR vanished under "Nothing to pay", though the
guest may have sent the money already and needs those details to ask the
staff for it.

## Decision

While a guest's payment is open and its bill leaves the view, the payment
step stays as it was, with its amount, variable symbol and QR, and says
under the amount what `table-self-pay/0026` says when nothing is left: the
bill changed meanwhile, nothing is left to pay, and a guest who has not
sent the money should not send it. The page announces it as a status. Once
the guest goes back, the page says there is nothing to pay.

## Alternatives considered

Leaving the payment step for "Nothing to pay", as before: the guest loses
the details of a transfer that may be on its way.

A message of its own for a closed bill: the guest's next move is the same
as for a bill whose last line staff removed, so the same words serve both.

## Consequences

A payment of a bill that leaves the view for any other reason reads as if
nothing were left. A guest who sends the money anyway still has the amount
and the variable symbol on screen to show the staff.

## Enforced by

- `apps/web-app/e2e/table-self-pay.spec.ts > a guest paying at the table > a guest paying keeps the amount and variable symbol and is told nothing is left once staff close the bill`
