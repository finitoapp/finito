# 0028 A guest whose payment closes the bill is thanked

Status: accepted
Date: 2026-11-12

## Context

`table-self-pay/0019` makes a guest whose payment on the shown bill is
confirmed done. A payment that closes the bill takes the bill out of the
view, so the page had no bill to be done with. A review on 2026-11-12
paid half of a bill and then the rest: the page ended on "Nothing to pay,
there is no open bill at this table" under two identical "you are done"
cards, moved no focus, announced nothing, and dropped the Bill tab of a
table that also offers its menu.

## Decision

When no bill is open and the guest has a confirmed payment of their own in
the view, the Bill part says that nothing more is left to pay and that the
bill is closed, and thanks the guest. It takes focus and is announced as a
status. The Bill part stays offered beside the menu while it says so.

The guest's own payments read as one card. Only the payment just confirmed
on a shown bill says the guest is done. Every other payment of the guest,
and every payment once the bill is closed, says what was paid and when.

## Alternatives considered

Leading with the newest payment's "you are done" card, as for a bill in
view: the thank-you below it would say the same thing a second time.

Dropping the Bill tab once the bill closes, as before: the guest's last
screen would jump to the menu as the payment completes.

## Consequences

A view keeps a confirmation for an hour, so for an hour after paying the
guest's page opens on the thank-you rather than on "Nothing to pay", also
when the guest comes back to order. A table whose bill another guest closed
still says there is nothing to pay to a guest who paid nothing of it.

## Enforced by

- `apps/web-app/e2e/table-self-pay-menu.spec.ts > a guest who pays the rest of the bill is thanked with focus, keeps the bill and the menu, and sees both payments`
- `apps/web-app/e2e/table-self-pay.spec.ts > a guest paying at the table > a guest who pays again is done only with the new payment, and the first reads as paid at its time`
