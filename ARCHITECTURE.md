# Finito Architecture (LLM-Oriented)

This document is optimized for AI/code-assistant navigation and safe code changes.
It focuses on where things live, how data flows, and which patterns must stay consistent.

## 1) Project at a Glance

- Stack: Next.js App Router + React + TypeScript + Bun.
- State/data: Jotai atoms + Evolu (local-first DB/sync) + TanStack Query (API-style fetching).
- UI: shared component library in `components/` (Radix-based primitives + app-specific components).
- Targets:
  - Web app (`app/`).
  - Desktop wrapper via Tauri (`src-tauri/`).

## 2) Runtime Topology

- Root app shell is in `app/layout.tsx`.
- Global providers are wired in `app/providers.tsx`:
  - Jotai `Provider`
  - TanStack `QueryClientProvider`
  - Tooltip provider
- Two major app surfaces:
  - Merchant/admin: `app/admin/...`
  - Client/customer: `app/(client)/...`

## 3) Source Tree Map (What to Open First)

- `app/`
  - Route handlers/pages/layouts (App Router).
  - Merchant domain lives in `app/admin/(private)/...`.
  - Customer domain lives in `app/(client)/...`.
- `components/`
  - Reusable UI and feature components.
  - `components/data-table.tsx` is a key abstraction used across admin tables.
- `atoms/`
  - Jotai async atoms for account/session/evolu bootstrapping.
  - `atoms/evolu.ts` creates app Evolu instance and seeds baseline records.
  - `atoms/account.ts` resolves active account from device-level storage.
- `hooks/`
  - Query helpers and UI state bridges.
  - `hooks/use-evolu.ts` is the standard way to access Evolu instance.
  - `hooks/use-data-table-visibility-driver.ts` persists table column visibility.
- `lib/`
  - Core domain + infra utilities.
  - `lib/evolu.ts`: main Evolu schema + creation.
  - `lib/device-evolu.ts`: device-local schema (accounts, table visibility, transports).
  - `lib/nostr-message-bus.ts`: encrypted request/response over Nostr DMs.
- `src-tauri/`
  - Desktop integration and native commands (e.g., invoice sending).

## 4) Data Architecture (Critical)

### 4.1 Two Evolu layers

- App-level Evolu (`lib/evolu.ts`, via `atoms/evolu.ts`):
  - Business data (items, invoices, payments, clients, tables, accounts, etc.).
  - Sync transports are based on currently selected account.
- Device-level Evolu (`lib/device-evolu.ts`, via `atoms/device-evolu.ts`):
  - Local device settings and account registry.
  - Used to pick active account and storage-like UI preferences.

### 4.2 Account boot flow

1. `atoms/account.ts` reads latest account from device Evolu.
2. If none exists, it creates a default account + default websocket transport.
3. `atoms/evolu.ts` uses account mnemonic/transports to create app Evolu.
4. `atoms/evolu.ts` seeds baseline domain data if missing (e.g., default Spark account, background notification row).

## 5) UI/Query Pattern: DataTable Contract

`components/data-table.tsx` expects server-like pagination response:

- `data: TData[]`
- `cursor?: string`

When using external filtering (`onFilterChange`), keep this pattern:

1. Memoize callback with `useMemo<DataTableOnFilterChange<RowType>>`.
2. Build a single Evolu query for the primary table.
3. Initial load: `evolu.loadQuery(query)` then `setData(...)`.
4. Live updates: `evolu.subscribeQuery(query)(() => setData(format(evolu.getQueryRows(query))))`.
5. Keep cursor-based pagination stable (`limit + 1` strategy + deterministic tie-break by `id`).

Why this matters:
- Stable callback reference prevents unnecessary effect restarts in `DataTable`.
- `getQueryRows(query)` inside subscription avoids redundant reloading of the same query.

## 6) Domain Areas (Merchant/Admin)

Key CRUD-like admin sections under `app/admin/(private)/`:

- `items/`
- `categories/`
- `clients/`
- `tables/`
- `accounts/`
- `invoices/`
- `payments/`
- `pos/`
- `settings/`

Common implementation style:
- List page -> `*-table.tsx` with `DataTable`.
- Form page -> `*-form.tsx`.
- Evolu queries are defined inline in feature files (currently no centralized repository/query layer).

## 7) Cross-App Messaging

- `lib/nostr-message-bus.ts` implements typed RPC-style messaging over Nostr:
  - Request event (`type: "req"`),
  - Response event (`type: "res"`),
  - Encrypted via signer + NIP-04.
- Used where merchant/client coordination is required.

## 8) Build/Test/Validation Commands

From `package.json`:

- Dev: `bun run dev`
- Lint: `bun run lint` or `bun run check:lint`
- Types: `bun run check:types`
- Tests: `bun run check:tests`
- Full check: `bun run check`

Note:
- The repository may contain pre-existing TypeScript issues unrelated to your change.
- For small feature edits, validate changed files + relevant runtime paths even if full typecheck is noisy.

## 9) Change Guidelines for LLM Agents

### 9.1 Before editing

- Identify which data layer is relevant:
  - device/account/visibility -> device Evolu,
  - business domain -> app Evolu.
- Confirm if the target UI uses `DataTable`; if yes, follow its cursor contract exactly.

### 9.2 While editing

- Preserve local-first semantics:
  - avoid introducing API calls where Evolu query already exists.
- Reuse existing format helpers from `lib/format-utils.ts`.
- Keep route-group patterns (`(client)`, `(private)`) intact.

### 9.3 After editing

- Check for:
  - pagination regressions (cursor, next/prev behavior),
  - subscription cleanup correctness (unsubscribe returned),
  - query stability under sorting/filter changes.

## 10) High-Risk Areas

- `lib/evolu.ts` schema changes:
  - can cascade widely and break typed queries/forms.
- `components/data-table.tsx`:
  - behavior affects all admin list screens.
- account bootstrapping atoms:
  - mistakes can block app initialization.
- payment/invoice flows:
  - include derived computations and message-bus interactions.

## 11) Fast Navigation Cheatsheet

- “Where is the DB schema?” -> `lib/evolu.ts`, `lib/device-evolu.ts`
- “Where is current account selection?” -> `atoms/account.ts`
- “Where is app Evolu created?” -> `atoms/evolu.ts`
- “Where do admin table lists load data?” -> `app/admin/(private)/*/*-table.tsx`
- “Where is generic table behavior?” -> `components/data-table.tsx`
- “Where is Nostr RPC-like messaging?” -> `lib/nostr-message-bus.ts`
- “Where is desktop/native bridge?” -> `src-tauri/src/lib.rs`

