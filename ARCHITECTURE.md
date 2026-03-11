# Finito Architecture (LLM-Oriented)

This document is optimized for AI/code-assistant navigation and safe code changes.
It focuses on where things live, how data flows, and which patterns must stay consistent.

## 1) Project at a Glance

- Stack: Next.js App Router + React + TypeScript + Bun.
- State/data: Jotai atoms + Evolu (local-first DB/sync) + TanStack Query (API-style fetching).
- UI: shared component library in `components/` (Base-UI-based primitives + app-specific components).
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

### 4.3 CRDT data-model requirements

Because app data uses Evolu (CRDT/local-first), schema and write patterns must be CRDT-safe:

- Prefer storing immutable facts/intents; avoid modeling core workflows as frequent in-place overwrite of a single authoritative row.
- Treat derived/read-optimized state as projection/materialization over base facts, not as the primary source of truth.
- Ensure merge outcomes are deterministic across replicas:
  - define stable ordering and tie-break rules for competing writes,
  - avoid logic that depends on local timing or process order.
- Model conflicts explicitly when needed (multiple concurrent intents can coexist until resolved by deterministic rules).
- Keep write operations idempotent and safe to replay (background retries and multi-device writes are expected).
- Minimize strict constraints that are not replica-friendly under concurrent offline writes; prefer eventual validation/resolution flows.
- When adding schema fields/tables, preserve forward/backward sync compatibility for clients on different app versions.

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

## 8) Internationalization (i18n)

- i18n stack: `i18next` + `react-i18next`.
- Init/runtime:
  - `lib/i18n/config.ts` defines supported languages and namespace list.
  - `lib/i18n/resources.ts` wires locale resources for `en` and `cs` from TypeScript modules.
  - `lib/i18n/client.ts` initializes i18next and handles language persistence (`localStorage` key `finito:language`).
  - `components/i18n-provider.tsx` is mounted from `app/providers.tsx`.
- Runtime model:
  - App currently uses client-side translations (`react-i18next` hooks in React components).
  - SSR translation hydration is not used in current implementation.
- Locale files are namespace-split TypeScript modules:
  - `locales/en/*.ts`
  - `locales/cs/*.ts`
  - Example namespaces: `common`, `navigation`, `admin`, `settings`, `tables`, `invoices`, `components`.
- Translation key style in code:
  - Always use `namespace:key.path` format, e.g. `t("tables:page.newTable")`.
  - Prefer semantic sections over file-name-based keys:
    - `page.*`, `form.*`, `table.*`, `actions.*`, `label.*`, `description.*`, `title.*`, `placeholder.*`.
  - Keep generic reusable UI labels in shared namespaces (`common`, `components`).
  - Keep domain/business wording in domain namespaces (`admin`, `settings`, `tables`, `invoices`, ...).
- Component composition pattern:
  - For forms/tables/navigation definitions, prefer factory functions that accept translator instance (`t`) and return config objects.
  - In consuming components, create translated config via `useMemo(() => createConfig(t), [t])`.
  - This keeps translation decisions close to UI field/column/link definitions and avoids hardcoded strings.
- Interpolation and dynamic text:
  - Use i18next interpolation for variable content (`{{count}}`, `{{message}}`, etc.).
  - Keep interpolation key names stable and descriptive across locales.

## 9) Build/Test/Validation Commands

From `package.json`:

- Dev: `bun run dev`
- Lint: `bun run lint` or `bun run check:lint`
- Types: `bun run check:types`
- Tests: `bun run check:tests`
- Full check: `bun run check`

Note:
- The repository may contain pre-existing TypeScript issues unrelated to your change.
- For small feature edits, validate changed files + relevant runtime paths even if full typecheck is noisy.

## 10) Change Guidelines for LLM Agents

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

## 11) High-Risk Areas

- `lib/evolu.ts` schema changes:
  - can cascade widely and break typed queries/forms.
- `components/data-table.tsx`:
  - behavior affects all admin list screens.
- account bootstrapping atoms:
  - mistakes can block app initialization.
- payment/invoice flows:
  - include derived computations and message-bus interactions.

## 12) Fast Navigation Cheatsheet

- “Where is the DB schema?” -> `lib/evolu.ts`, `lib/device-evolu.ts`
- “Where is current account selection?” -> `atoms/account.ts`
- “Where is app Evolu created?” -> `atoms/evolu.ts`
- “Where do admin table lists load data?” -> `app/admin/(private)/*/*-table.tsx`
- “Where is generic table behavior?” -> `components/data-table.tsx`
- “Where is Nostr RPC-like messaging?” -> `lib/nostr-message-bus.ts`
- “Where is desktop/native bridge?” -> `src-tauri/src/lib.rs`

## 13) Jotai State Architecture (Re-render Control)

These rules are project-wide. They are not specific to one feature.

### 13.1 Core principle

- Pass atom references down the tree; read atom values as deep as possible.
- Avoid passing large computed value props from parent components when children can subscribe directly.

### 13.2 Ownership model

- Root feature component should create/own atom instances (or atom factory output).
- Root should mostly pass `stateAtoms` (or specific atoms), not resolved values.
- Child components should call `useAtomValue`/`useAtom` for the exact state they render.

### 13.3 Read/write split

- Components that only update state should use `useSetAtom` only.
- Do not subscribe (`useAtomValue`) in write-only components.
- This prevents unnecessary subscriptions and render cascades.

### 13.4 Granularity rules

- Prefer multiple small atoms over one broad object atom.
- Use `atomFamily` for per-entity/per-row subscriptions (`byId`, `rowIds`, etc.).
- Keep derived data in derived atoms (filtering, grouping, collision checks, visibility flags).

### 13.5 Interaction state placement

- Keep pointer/gesture session details local to interaction hooks/components unless shared globally.
- Persist only necessary shared interaction output in atoms (e.g., selected id, preview patch).
- Separate committed data atoms from transient preview atoms when UI stability matters.

### 13.6 Anti-patterns to avoid

- Parent component reads many atoms and forwards raw values through multiple levels.
- One atom stores entire feature UI state as a single object and updates frequently.
- Global atom updates on every pointer move when only one subtree needs the data.

### 13.7 Practical checklist before merge

- For each atom change, list which components subscribe to it.
- Verify that drag/typing/high-frequency interactions do not trigger root-level re-renders.
- Confirm expensive derived computations are in derived atoms, not top-level React renders.
