# 0016 A removal takes only what the line still holds

Status: accepted
Date: 2026-11-10

## Context

A bill's lines are an append-only ledger of `add` and `remove` rows, which
every device writes against the bill as it last saw it. Two devices can
take off the same unit: one removes a coffee, the other, not yet synced or
showing a stale screen, clears the cart or undoes the add and removes it
again. No guard at write time can prevent that, since each device judges
its own copy and both are right about it. After the merge, a line's removals
add up to more than its adds.

The bill line projection (`calculateBillLineSummaries`) already read that
as "the line is gone": it drops a line whose quantity nets to zero or below
and starts it afresh on the next add. The sales statistics' SQL
(`nettedBillLines`) summed the whole group instead. A coffee ordered again
after such a removal was charged on the bill but missing from the item
leaderboard, the categories and the VAT recap, permanently, since the ledger
is never rewritten.

## Decision

- A removal takes only what the line still holds. A line whose quantity nets
  to zero or below is empty, whatever its removals add up to, and the next
  add starts it afresh at that add.
- The ledger is folded in the order `billLinesByBillIdQuery` reads it
  (`createdAt`, `ownerId`, `id`) per summary (`createBillLineSummaryId`).
- Everything that nets a bill's lines nets them this way: the bill line
  projection, and with it the bill's total, coverage and payment, and the
  sales statistics' SQL, which counts only a group's lines after the last
  point its running quantity reached zero or below.

## Alternatives considered

Refusing an over-removal at write time (`requireRemovalWithinLine` on every
cart write), which stops only the stale screen on an up-to-date device and
never the merge of two offline ones. Summing the whole group everywhere,
which hides an item a customer paid for from the bill they are charged by.

## Consequences

`requireRemovalWithinLine` stays on `appendRemoveBillLine` to tell staff a
line changed rather than to protect the data; clear, undo and redo rely on
this rule instead. The statistics read a group's lines through three window
passes over the range's bill lines rather than one sum. Fractional
quantities fold in the same order on both sides, though SQLite and
JavaScript may round a running sum differently in its last bit.

## Enforced by

- `packages/core/src/modules/sales-stats/sales-stats-queries.test.ts > items and categories > net a removal of more than the line holds as calculateBillLineSummaries does`
- `packages/core/src/modules/sales-stats/sales-stats-queries.test.ts > items and categories > net a discount taken off and added again as calculateBillLineSummaries does`
