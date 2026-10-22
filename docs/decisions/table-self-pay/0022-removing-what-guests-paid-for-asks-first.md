# 0022 Removing what guests paid for asks first

Status: accepted
Date: 2026-10-22

## Context

A line guests paid for stays editable (`table-self-pay/0001`), so one tap
on "−" removed the beer guests had paid for without a question. Their
money stayed on the bill, where it now paid for the other lines, and the
till asked only for what was left. Discarding a bill that held guest money
warned only that its items would be removed.

## Decision

Before an edit removes units of a line guests paid for, staff are asked,
with the line's name and what guests paid for it, and told that the money
stays on the bill. When the same edit would also close or overpay the bill,
that one question says so in its title, and no second question follows.
Before a bill that holds money is discarded, the question names the amount
already paid and says it stays on the canceled bill to resolve. Each item
brick of a line with guest money shows what guests paid for it.

The line stays editable: asking first changes nothing about what staff may
do, only that they decide knowing the money is there.

## Alternatives considered

Locking a line guests paid for. `table-self-pay/0001` rejects it, because a
late or wrong allocation would then decide what staff can edit.

Moving the guest money off the bill with the line. Nothing moves money
between bills, and the money belongs to the bill guests paid, so staff
resolve it there.

## Consequences

Staff get one more question on a table with self-pay, and only when the
edit touches guest money. The discard question counts every claimed
payment on the bill as paid, so a partial payment staff took on another
device is named there too.

## Enforced by

- `packages/core/src/modules/bill/bill-overpayment-guards.test.ts > an edit that removes what guests paid for > names the line and what guests paid for it`
- `packages/core/src/modules/bill/bill-overpayment-guards.test.ts > an edit that removes what guests paid for > asks nothing about a line nobody paid for`
- `apps/web-app/e2e/table-self-pay.spec.ts > the till > removing the beer guests paid for asks first with the amount, and so does discarding the bill`
