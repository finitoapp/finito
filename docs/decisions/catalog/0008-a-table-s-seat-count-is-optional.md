# 0008 A table's seat count is optional

Status: accepted
Date: 2026-11-16

## Context

A table had to have a seat count (`table.seatCount` was a positive integer
the form, the inline edit and the CLI all required). Many places that sell
at tables do not count their seats, or the count says nothing: a bar
counter, a terrace whose chairs move, a takeaway window set up as a
"table" so its bills sit on the floor view. The merchant had to make up a
number to save the table, and the app then showed that number on the
tables list, in the table picker of a bill and on the floor view's tile.

## Decision

- `table.seatCount` is nullable: null means the merchant has not said how
  many people the table seats.
- The seat count field of the table form is optional, marked as such in its
  placeholder as the catalog marks its other optional fields ("Optional —
  e.g. 4"). Left empty, the table is saved with null. Filled in, it must
  still be a whole number above zero, with the same message as before.
- Clearing the inline seat count of an existing table saves null, on web
  and in Finito (`optionalPositiveIntegerCodec`). The CLI's `tables create`
  takes no `--seat-count` for a table without seats, and `tables update
  --seat-count null` clears it, as `payment-number-series update --prefix
  null` does.
- A table without seats shows no count anywhere: no trailing text on the
  tables list, no subtitle in the table picker and no seat badge (nor its
  accessible label) on the floor view's free tile, in both apps.
- The table queries no longer require a seat count, so a table without one
  is listed, picked and edited like any other.

## Alternatives considered

Storing zero for "not counted", which would keep the column required but
make zero mean two things and need its own display rule everywhere the
count is shown. A separate "counted" flag, which adds a column to say what
null already says.

## Consequences

No migration: Evolu keeps every column nullable in SQLite and applies
synced values without validating them against the schema, so existing rows
keep their counts.

A version of the apps released before this decision filters its table
queries on `seatCount is not null`. It does not crash on a table without
seats; it does not see one. Such a table is missing from its tables list,
table picker and floor view, its edit screen says the table no longer
exists, and a bill assigned to it does not appear on that version's floor
view (neither on a tile nor in the strip of bills without a table), though
the bill keeps its table name and stays reachable from Activity. Clearing
the count of an existing table hides it from such a version the same way.
Every device of the account should run a version with this decision before
a merchant leaves seat counts empty.

## Enforced by

- `packages/app-shared/src/table-form.test.ts > parseTableForm > accepts a table without seats`
- `packages/app-shared/src/table-form.test.ts > parseTableForm > rejects a seat count that is not a positive integer`
- `packages/app-shared/src/inline-edit-codecs.test.ts > optionalPositiveIntegerCodec > treats blank as not set and still rejects anything but a whole count`
- `packages/app-shared/src/inline-edit-codecs.test.ts > optionalPositiveIntegerCodec > encodes not set back to an empty input`
- `packages/core/src/modules/table/table-actions.test.ts > table actions > creates and lists a table without seats, and clears a seat count`
- `apps/web-app/e2e/catalog-tables.spec.ts > a table without seats lists without a seat count`
