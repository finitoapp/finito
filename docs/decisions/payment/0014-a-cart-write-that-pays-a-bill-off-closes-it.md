# 0014 A cart write that pays a bill off closes it

Status: accepted
Date: 2026-11-10

## Context

A bill can stay open with money already claimed against it: a split payment
covered part of it. Its derived status turns `closed` once its coverage stops
being `underpaid` with a claim behind it, and that happens not only when a
claim arrives but also when its total drops: a bill of 300 with 200 paid
closes the moment an item of 100 is taken off — and, once an item can cost
less than nothing, the moment a discount is added. Until now
only a claim wrote `bill.closedAt` (`loadBillClosedAtIfCovered`), so such a
bill read `closed` to every guard while the floor view, which filters on
`closedAt`, still showed it: it could be neither edited, paid nor canceled.
Taking the total below what was paid closed the bill overpaid, money that
only a refund should hand back.

## Decision

- Every cart write behind `requireEditableBill` (`addCatalogItemToBill`,
  `addManualAmountToBill`, `addTipToBill`, `appendRemoveBillLine`,
  `appendGuardedBillLines`, `splitBill`, `splitBillIntoNewBill`; for a split
  both the source and the target) judges the total the bill would come to
  after it against what its payments have paid (`deriveCartWriteClosing`):
  - no active claim on the bill: the write goes through and the bill stays
    open, as before;
  - a total above what was paid: the bill stays open;
  - a total equal to it: the write goes through and writes `closedAt` in the
    same batch as its lines;
  - a total below it: the write is refused with `BillTotalBelowPaid`, and the
    apps tell staff to return money through a refund.
- The total after the write is the same projection coverage reads: the
  bill's ledger with the new lines folded on, tip lines included.
- The rule is best-effort, like every guard: two offline devices can get
  past it together. `closedAt` stays a cache, and `cli bills close` still
  repairs it.

## Alternatives considered

Closing the bill when a later read finds it covered, which leaves the bill
hanging until someone looks. Accepting a write below what was paid and
letting the bill close overpaid, which gives money back outside a refund and
outside the refund's records.

## Consequences

`closedAt` now has a second automatic source besides a claim.
`docs/bill-payment-states.md` gains the section "Cart writes on a partly
paid bill". A discount added to a partly paid bill closes it
when it pays the bill off and is refused when it would take the total below
what was paid. Staff who want to give money back after a partial payment go
through a refund.

## Enforced by

- `packages/core/src/modules/bill/bill-utils.test.ts > deriveCartWriteClosing > keeps a bill nobody has paid for open, whatever total the write leaves`
- `packages/core/src/modules/bill/bill-utils.test.ts > deriveCartWriteClosing > keeps a partly paid bill open while its total stays above what was paid`
- `packages/core/src/modules/bill/bill-utils.test.ts > deriveCartWriteClosing > closes a partly paid bill the write brings down to exactly what was paid`
- `packages/core/src/modules/bill/bill-utils.test.ts > deriveCartWriteClosing > refuses a write that takes the total below what was paid, below zero included`
- `packages/core/src/modules/bill/bill-actions.test.ts > cart writes on a partly paid bill > taking off the line a partly paid bill was waiting on closes it and takes it off the floor view`
- `packages/core/src/modules/bill/bill-actions.test.ts > cart writes on a partly paid bill > a cart-level append (undo, redo, clear) closes a bill it pays off the same way`
- `packages/core/src/modules/bill/bill-actions.test.ts > cart writes on a partly paid bill > refuses a write that would take a partly paid bill below what was paid`
- `packages/core/src/modules/bill/bill-actions.test.ts > cart writes on a partly paid bill > refuses a split that would take a partly paid source below what was paid, and closes one it pays off`
- `packages/core/src/modules/bill/bill-actions.test.ts > cart writes on a partly paid bill > a bill nobody has paid for keeps behaving as before`
- `packages/app-shared/src/bill-checkout.test.ts > cartWriteErrorKeys > tells staff a partly paid bill cannot drop below what was paid, rather than to try again`
