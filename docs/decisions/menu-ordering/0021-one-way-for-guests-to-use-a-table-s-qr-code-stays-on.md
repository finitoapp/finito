# 0021 One way for guests to use a table's QR code stays on

Status: accepted
Date: 2026-11-12

## Context

A table's QR code lets guests do up to three things, each switched for the
whole account: pay the table's bill (`menu-ordering/0003`), order from the
menu (`menu-ordering/0001`) and write what they pay for
(`menu-ordering/0004`). menu-ordering/0003 lets the owner switch bill
paying off, and nothing stopped the other two from being off too. With all
three off, every table kept its QR code and a guest who scanned it read
"Nothing to pay", whether the table had an open bill or not, because its
bills were only hidden. The owner had meant to stop guests, and the way to
stop them at a table is to turn its QR code off, which says to pay with the
staff.

## Decision

The last of the three switches still on cannot be switched off. It is
disabled, and a line under it says that one stays on and that turning off a
table's QR code stops guests at that table. While two or three are on,
each switches freely.

This narrows menu-ordering/0003: the owner switches bill paying off only
while guests order from the menu or write what they pay for.

## Alternatives considered

- Refusing the last switch with a message, as the home screen's modes do
  (`settings/0004`). The three switches sit in one card with the reason
  under the one that stays, as the last relay does
  (`table-self-pay/0003`), so a disabled switch with its reason is enough.
- Treating all three off as every table's QR code off. Guests would be sent
  to the staff, but each table would still say its QR code is on, so the
  screen would give two answers to whether a table takes guests.
- A warning while all three are off. The guest would still meet a page
  with nothing to do.

## Consequences

Two devices that each switch off a different one of the last two before
they sync can still leave all three off; guests then read "Nothing to pay"
until the owner switches one on, as before. Stopping guests everywhere
means turning each table's QR code off.

## Enforced by

- `apps/web-app/e2e/menu-orders.spec.ts > one way for guests to use the QR code stays on`
