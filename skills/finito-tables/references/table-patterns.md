# Finito Table Patterns

Use this reference when you need a close example before implementing a new grid.

## Core Building Blocks

- `components/data-table.tsx`
  - Shared TanStack wrapper with filter inputs, column visibility, and cursor pagination.
- `hooks/use-data-table-visibility-driver.ts`
  - Persists hidden columns under a stable table key.

## Example Selection

- `app/admin/(private)/catalog/categories/categories-table.tsx`
  - Smallest useful example.
  - Good for plain entity lists with one text filter and a detail link.

- `app/admin/(private)/payments/(default)/transactions/transactions-table.tsx`
  - Good for financial/admin tables with money, dates, joins, and device links.
  - Shows the usual `createdAt` fallback sort and cursor handling.

- `app/admin/(private)/payments/bills/history/bill-history-table.tsx`
  - Good for chronological history over append-only rows.
  - Shows enum filter options and joins from change rows to related entities.

- `app/admin/(private)/catalog/detail/history/item-history-grid.tsx`
  - Good for history/revision views that need richer row actions or dialogs.

## Repeated Patterns

### Row Shape

- Keep row types close to the SQL select list.
- Add nullable relation labels/IDs explicitly when rendering optional links.
- Prefer shared scalar types such as `Id`, `DateIso`, `Integer`, and `Currency`.

### Query Shape

- Start from the primary table.
- Add joins needed for labels and links.
- Add `where(..., "is not", null)` guards for required columns.
- Finish with `$narrowType<...>()` so the render layer can stay simple.

### Cursor Pagination

- Default field: often `createdAt`.
- Resolve current sort field from `sortingFields`.
- Apply cursor predicate on the selected sort column plus stable `id`.
- Fetch `limit + 1`.
- Slice the extra row and build `nextCursor` from the last kept row.

### UI Conventions

- Primary entity column: link button to detail page.
- Device column: existing linked button pattern.
- Empty values: `"-"`.
- Money: `formatMoney(...)`.
- Date/time: `formatDateTime(...)` or `new Date(...).toLocaleString()` to match nearby code.

### Filtering

- Text filters use SQL `like` with prefix matching.
- Enum filters use `filterableColumns[].options`.
- Do not expose filters that are not materially useful for the screen.
