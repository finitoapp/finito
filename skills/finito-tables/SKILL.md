---
name: finito-tables
description: Implement and refactor Finito admin table grids built on `components/data-table.tsx`, TanStack Table, and Evolu queries. Use when working on `*-table.tsx` or history-grid files in `app/admin/**`, adding sortable/filterable/paginated list views, wiring `useDataTableVisibilityDriver`, or creating admin tables backed by `createQuery` + `subscribeToEvoluQuery`.
---

# Finito Tables

## Overview

Implement admin grids in the existing Finito style:
`DataTable` wrapper + memoized columns/filter config + manual Evolu query with cursor pagination.

Read [references/table-patterns.md](references/table-patterns.md) before editing when you need a concrete example to copy.

## Workflow

1. Pick the closest example first:
- Simple entity list: `categories-table.tsx`
- Rich financial list: `transactions-table.tsx`
- Bill history list: `bill-history-table.tsx`
- Revision/history grid: `item-history-grid.tsx`

2. Define a row type before writing JSX:
- Include only rendered/filterable/sortable fields.
- Keep `id`, optional `deviceId`/`deviceName`, and any detail-link identifiers explicit.

3. Build columns with project conventions:
- Use `createSortableHeader(...)` for sortable headers.
- Use a link-button in the primary column for navigation to detail pages.
- Reuse the existing device-link pattern for `deviceName`.
- Format money and dates with shared helpers such as `formatMoney` and `formatDateTime`.
- Render missing values as `"-"` unless a nearby example clearly uses a different empty state.

4. Keep sorting and filtering explicit:
- Add a `sortingFields` map with `satisfies Record<...>`.
- Default to `createdAt` descending when the table is chronological.
- Add `createFilterableColumns(...)` only for fields that are actually useful.
- For enum-like filters, prefer `options` over free-text search.

5. Implement the query in the table component:
- Use `createQuery(...)` with joins, null guards, and `$narrowType`.
- Use `subscribeToEvoluQuery(...)` inside `onFilterChange`.
- Keep cursor pagination in the standard pattern: decode previous cursor, apply comparison on the selected sort field, order by selected field and then stable `id`, fetch `limit + 1`.
- Filter in SQL, not client-side.

6. Wire rendering through the shared table shell:
- Use `useDataTableVisibilityDriver("<stable-key>")`.
- Memoize `columns`, `filterableColumns`, and `onFilterChange`.
- Render `<DataTable ... />` inside `ResponsiveCard` + `CardContent className={"px-0"}`.

7. Keep related page and i18n work aligned:
- Put the table component in a sibling file when the page is only a thin wrapper.
- If the table introduces new `t(...)` keys, update both EN and CS locale files.
- When translation work is non-trivial, also use `finito-i18n`.

## Key Files

- Core primitives:
  - `components/data-table.tsx`
  - `hooks/use-data-table-visibility-driver.ts`
- Representative tables:
  - `app/admin/(private)/catalog/categories/categories-table.tsx`
  - `app/admin/(private)/payments/(default)/transactions/transactions-table.tsx`
  - `app/admin/(private)/payments/bills/history/bill-history-table.tsx`
  - `app/admin/(private)/catalog/detail/history/item-history-grid.tsx`

## Output Contract

When asked to add or refactor a Finito table grid, produce:
- A table component that follows the shared `DataTable` + Evolu query pattern.
- Correct sorting, filtering, pagination, and link behavior for the feature.
- Matching page wrapper and i18n updates when the table introduces new UI text.
