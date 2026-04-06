# AGENTS Instructions (Finito)

This file contains only **high-priority, project-wide rules** for AI/code agents.
Detailed workflows and advanced playbooks should live in skills.

## 1) Scope and priorities
- Scope: whole repository.
- If there are nested `AGENTS.md` files, the deeper file has priority for its directory.
- Direct user/developer/system instructions have priority over any `AGENTS.md` rule.

## 2) Architecture guardrails (must keep)
- Finito is **local-first**: prefer Evolu queries/writes over introducing new API dependencies.
- Keep the split between:
  - **app Evolu** for business data (`lib/evolu.ts`),
  - **device Evolu** for device/account/preferences (`lib/device-evolu.ts`).
- Preserve App Router structure and route groups (`app/(client)`, `app/admin/(private)`).
- Treat `components/data-table.tsx` as shared critical infrastructure; avoid breaking its cursor-based pagination contract.

## 3) Evolu write rules
- Use `evolu.update` for partial changes to an existing row.
- Use `evolu.upsert` for creating a row or writing a coherent full row state.
- Use `evolu.insert` when you need a new row with Evolu-generated `id`.

## 4) Error handling rules
- Define typed errors with `defineError` from `lib/shared/error.ts`.
- Name factories with `create...Error` (e.g., `createRpcResponseTimeoutError`).
- Export error types as `ReturnType<typeof create...Error>`.
- Prefer typed error objects with a `type` discriminant (not classes).
- Branch by `error.type` when narrowing.

## 5) Result rules
- Prefer `Result` from `@evolu/common` for fallible operations (instead of `T | Error`).
- Return with `ok(value)` / `err(error)`.
- Narrow by `result.ok`.
- In callbacks, pass `Result` consistently.
- Keep error unions explicit (e.g., `Result<Value, MyError | OtherError>`).

## 6) i18n and UI consistency
- Never hardcode user-facing strings in feature code; use i18n keys.
- Keep reusable labels in shared namespaces (`common`, `components`), domain wording in domain namespaces.

## 7) Safe change workflow
Before editing:
- Identify affected layer (app Evolu vs device Evolu).
- Check if impacted UI uses shared table/query abstractions.

After editing:
- Run relevant checks for changed area (`bun run check:types`, `bun run check:lint`, targeted tests).
- If behavior changes in a visible UI component/page, capture a screenshot when tooling is available.

## 8) High-risk files (extra caution)
- `lib/evolu.ts`
- `lib/device-evolu.ts`
- `atoms/account.ts`
- `atoms/evolu.ts`
- `components/data-table.tsx`
- payment/invoice flows under `app/admin/(private)/`

## 9) What belongs in skills (not here)
- Step-by-step feature workflows.
- Long architecture tutorials.
- Specialized operational procedures.

AGENTS should stay short and enforce only non-negotiable project rules.
