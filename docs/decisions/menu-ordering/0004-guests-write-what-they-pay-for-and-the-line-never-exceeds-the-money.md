# 0004 Guests write what they pay for, and the line never exceeds the money

Status: accepted
Date: 2026-11-06

## Context

A bar at a gig has a chalkboard, not a catalog. A guest should pay on their
phone by writing what they pay for and naming the amount, and staff should see
who paid, how much and for what.

Nothing can recompute such an amount: no stored bill and no menu price stand
behind it. `table-self-pay/0005` lets the device believe only what it can
recompute, and anyone holding the sticker can name any amount. A line at the
named amount would let a stranger who pays the self-pay minimum leave almost
ten million owed on any table.

## Decision

A switch for the account, off by default and independent of paying the bill and
ordering from the menu (`appSettings.writtenOrders`), offers guests a line of
text and an amount. The menu says whether it is on (`written`), and while only
writing is on the menu has no items.

The written order goes through the order pipeline: a selection the payment
names with a pointer, a reference that starts with 9, a bill of its own with a
number of the day, a confirmation under the pointer. Staff tell it from a menu
order by `menuOrder.writtenAmount`.

Its one line is named by the guest's text, and it is the money that arrived,
at most the named amount. What arrives above the named amount is the tip. The
bill closes at once, so it leaves nothing owed on the table. More money with
the same pointer raises the line, up to the named amount, and above that it is
overpaid for staff to resolve. The named amount narrows what the money says and
tells staff what the guest meant to pay, which `table-self-pay/0005` allows.

The device records it only while the switch is on when the money arrives, so
switching off stops a stranger at once, though the menu versions that offered
writing stay stored for 7 days. Otherwise the money waits among the unmatched
transactions. Money for an order already recorded is credited whatever the
switch says, so a guest can pay the rest, and it announces nothing new.

One validator holds for the guest page and the device: a text of 1 to 255 UTF-16
units, the most an item name holds, trimmed, with none of a fixed list of
invisible code points, except the joiner and variation selectors emoji need. The
list is written out, because a browser and Hermes must judge a text alike
whatever their Unicode version or regular expressions support. The device never
trims the text, because the pointer hashes it exactly.

The text is a stranger's. It is shown as text and labelled as the guest's, is
never published, reaches the assistant only as `guestText`, and sales statistics
count written orders as one row.

## Alternatives considered

A payment with no bill, as the keypad makes. There would be no number, no "To
serve" row and no confirmation.

A line at the named amount with the bill left open until paid. That is the debt
above.

A line added to the table's open bill. Prepaid and unpaid lines would mix, as
`menu-ordering/0001` rejects for orders.

The text in the bank message alone. It has 35 characters, the bank reads it,
and Lightning has no variable symbol.

## Consequences

Payky checks that money arrived, not what was sold, so a place that offers this
runs on the honor system. A guest who pays less than they named is recorded at
what arrived; the announcement and the "To serve" list say both amounts and
staff decide what to serve.

A written line has no tax rate, as a keypad amount has none, so a VAT payer
keeps the switch off.

Finito runs nothing in the background, so while the till app is closed nothing
is recorded or announced, and the money waits.

A new order paid in full, from the menu too, writes `closedAt` in the same batch
as its rows, so it never shows on the floor as owed. Money that arrives more than
7 days after an order's bill closed does not record the order again, and stays
unmatched for staff.

## Enforced by

- `packages/core/src/modules/menu-order/menu-order-utils.test.ts > what a guest writes > takes %s`
- `packages/core/src/modules/menu-order/menu-order-utils.test.ts > what a guest writes > refuses %s`
- `packages/core/src/modules/menu-order/menu-order-utils.test.ts > what a guest writes > names an amount from the self-pay minimum up to what a QR payment carries`
- `packages/core/src/background-jobs/jobs/table-self-pay-menu-publishing.test.ts > guests writing what they pay for > publishes a menu with no items that offers writing while only writing is on, and the view names it`
- `packages/core/src/background-jobs/jobs/table-self-pay-menu-publishing.test.ts > guests writing what they pay for > publishes a new menu version when writing is switched on over an unchanged menu`
- `packages/core/src/background-jobs/jobs/table-self-pay-menu-publishing.test.ts > guests writing what they pay for > confirms an order recorded just before both switches went off`
- `packages/core/src/background-jobs/jobs/table-self-pay-menu-publishing.test.ts > guests writing what they pay for > says nothing in the table's view about a paid order`
- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > a paid written order > becomes a bill of its own on the table, with one line named by the guest's text`
- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > a paid written order > closes at what arrived when less arrives, and leaves nothing owed`
- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > a paid written order > closes at the minimum when a stranger names millions, and leaves nothing owed`
- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > a paid written order > raises its line when the rest arrives, up to what the guest named`
- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > a paid written order > takes the rest of an order already recorded, though writing has been switched off since`
- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > a paid written order > leaves money that arrives long after its bill closed unmatched, and the order as it was`
- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > money for a written order that cannot be recorded > waits unmatched when writing is off as the money arrives, though the menu it names offered writing`
- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > money for a written order that cannot be recorded > waits unmatched when its text breaks the rules with %s`
- `packages/core/src/modules/menu-order/menu-order-actions.test.ts > money for a written order that cannot be recorded > waits unmatched when its amount is %s`
- `packages/core/src/ai/assistant-tools.test.ts > the data tools > returns a written order's text marked as the guest's`
- `packages/core/src/ai/assistant-tools.test.ts > the data tools > marks it in the latest payments too`
