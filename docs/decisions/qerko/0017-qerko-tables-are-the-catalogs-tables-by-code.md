# 0017 Qerko's tables are the catalog's tables, by code

Status: accepted
Date: 2026-11-18

## Context

In Qerko's table flow the restaurant pairs Qerko's QR codes with tables in
Qerko's administration, from the list `getTableList` answers (`id`, `name`).
A guest's scan then calls `getTableContents(idTable)` with that `id` and
expects the table's open bills; several bills on one table are part of the
protocol. Qerko defines no error for a table it does not know.

Each catalog table has a `code`, eight generated characters that never
change, kept until now for a future QR sticker. Its name can be renamed and
its id is an Evolu id. PR #220 (table self-pay) does not use `code`: its
stickers carry keys derived per table.

## Decision

- `getTableList` lists the catalog's tables that are not deleted, in their
  `sortOrder`, each as `{ id: code, name }`. Two tables sharing a code are
  listed once, as the first; `getTableContents` answers for that one.
- `getTableContents(code)` lists the table's open bills, the one opened
  first first, each judged by its live status (`loadBillStatusSnapshot`),
  not the `closedAt` cache, and offered as `qerko/0018` says. A bill with
  nothing left to pay is left out. A bill another payment locks is listed,
  and paying it is refused (`qerko/0018`).
- Several open bills on one table are listed separately, each named by its
  label or `#` and its number, so the guest picks theirs. Bills are never
  merged: each payment lands on the one bill it names.
- An unknown code, and an empty table, answer an empty list. A missing or
  malformed table id is `BAD_PARAMETER`.

## Alternatives considered

- The table's Evolu id as Qerko's id: a QR code paired in Qerko's
  administration is long-lived, and so is a code; ids are no worse but say
  nothing to a person reading Qerko's list.
- One merged bill for a table with several: a payment would have to be split
  across bills Payky keeps apart, and the guest would pay for other guests'
  bills.
- Offering only the newest bill: a guest at a table with two parties would
  pay the wrong one.
- An error for an unknown table: Qerko defines none, and an empty table is
  what a QR code paired with a deleted table should show.

## Consequences

Renaming a table keeps its QR codes working, deleting one leaves them on an
empty table. Re-pairing in Qerko's administration is needed only for a new
table. `getTableContents` is called on every scan and loads each open bill
of the table once.

## Enforced by

- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > getTableList > lists the catalog's tables by code, in their order, once per code`
- `packages/core/src/modules/payment/payment-qerko-table-utils.test.ts > createQerkoTableList > lists each code once, as the first table that has it`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > getTableContents > offers each open bill of the table line by line, the one opened first first`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > getTableContents > an unknown table is empty`
- `packages/core/src/modules/payment/payment-qerko-table-actions.test.ts > getTableContents > an empty table is empty, and so are bills with nothing to pay`
- `packages/core/src/integrations/qerko/qerko-rpc.test.ts > createQerkoRpcSession > answers getTableContents with %s as BAD_PARAMETER`
- `packages/core/src/integrations/qerko/qerko-rpc.test.ts > createQerkoRpcSession > dispatches Qerko's calls to the handlers and answers by uuid`
