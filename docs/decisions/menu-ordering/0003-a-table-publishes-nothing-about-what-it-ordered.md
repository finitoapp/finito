# 0003 A table publishes nothing about what it ordered

Status: accepted
Date: 2026-10-22

## Context

A table's view lists its open bills, so anyone holding a photo of its
sticker can follow what the table orders and who pays
(`table-self-pay/0004`). Places that take orders from the menu do not need
guests to see the table's bill.

## Decision

The owner can switch off guests paying the table's bill
(`appSettings.selfPayBillsHidden`). While it is off, no view lists a bill,
so a view does not change when guests order. While ordering is on, the view
names the account's menu, which carries nothing about tables, bills or
orders. Orders and their confirmations are encrypted under keys derived from
each order's pointer.

## Alternatives considered

A menu for each table. Every table would publish again whenever the menu
changed, and that would add nothing a guest can use.

## Consequences

Relays see one event per order and one confirmation, so they can count
orders and their times, but not which table ordered or what.

## Enforced by

- `packages/core/src/background-jobs/jobs/table-self-pay-menu-publishing.test.ts > the view while guests order from the menu > names the menu and lists no bill while bill paying is off`
- `packages/core/src/background-jobs/jobs/table-self-pay-menu-publishing.test.ts > the view while guests order from the menu > lists the bills again and no menu with the switches back`
