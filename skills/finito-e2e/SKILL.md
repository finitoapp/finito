---
name: finito-e2e
description: Write and refactor Finito Playwright end-to-end specs using the current e2e architecture: worker-scoped fixtures, browser harness bridge, shared scenario runner, and seed primitives. Use when adding or changing `e2e/*.ts` specs, `e2e/fixtures.ts`, browser harness code in `app/e2e/page.tsx`, or seed/scenario code in `lib/testing/e2e-*`.
---

# Finito E2E

## Overview

Implement Finito e2e tests in the current project style:
- Playwright specs stay in `e2e/`
- tests go through `e2e/fixtures.ts`
- browser-side bridge lives in `app/e2e/page.tsx`
- scenario routing lives in `lib/testing/e2e-scenarios.ts`
- seed building blocks live in `lib/testing/e2e-primitives.ts`

Read these files before changing e2e behavior:
- `playwright.config.ts`
- `e2e/fixtures.ts`
- `e2e/helpers/harness.ts`
- `app/e2e/page.tsx`
- `lib/testing/e2e-types.ts`

## Workflow

1. Start from the nearest existing spec:
- Catalog CRUD flow: `e2e/catalog.spec.ts`
- Shared runtime and worker setup: `e2e/fixtures.ts`
- Browser bridge contract: `app/e2e/page.tsx`

2. Keep the layering intact:
- Spec files should express business flow only.
- Specs should use `harness` from fixtures instead of raw `page.evaluate(...)`.
- Browser bridge should expose stable coarse-grained operations, not feature-specific implementation details.
- Scenario modules should orchestrate primitives, not duplicate setup logic.

3. Add new data setup through the scenario system:
- Extend `E2EScenarioName`, `E2EScenarioInputMap`, and `E2EScenarioResultMap` in `lib/testing/e2e-types.ts`.
- Register the scenario in `lib/testing/e2e-scenarios.ts`.
- Put reusable data writes in `lib/testing/e2e-primitives.ts`.
- Keep feature scenario files thin orchestration layers.

4. Preserve worker isolation:
- Assume tests may run in parallel.
- Use worker/test context passed through the harness and scenario runner.
- Do not hardcode shared auth file paths, device IDs, or other global mutable state.
- Keep reset behavior explicit through `resetBrowserState`.

5. Write robust specs:
- Seed state first, then navigate UI.
- Prefer role-based locators and stable form field names over fragile CSS selectors.
- Use explicit waits only for real async boundaries such as navigation.
- Assert user-visible outcomes, not internal implementation details, unless the test explicitly validates persisted IDs.

6. Keep browser harness minimal:
- `app/e2e/page.tsx` may translate browser state into a stable API, but should not accumulate feature-specific helpers.
- If a new feature needs e2e support, prefer `runScenario(...)` plus fixture helpers over adding `window.__finitoE2E.doThingForFeatureX`.

7. Verify with the project commands:
- Typecheck relevant changes.
- Run `bun run e2e`.
- If you changed Bun test discovery or shared config, also run `bun run check:tests`.

## Guardrails

- Do not call `page.evaluate(...)` directly from specs when the same operation belongs in `harness`.
- Do not put Playwright `test(...)` files under `app/**`.
- Do not duplicate account/device/billing bootstrap logic in feature scenario files.
- Do not add random global state that breaks worker isolation.
- Do not bypass the scenario runner with feature-specific browser bridge methods unless there is a strong reason.

## Preferred Patterns

- For UI flows:
  - spec -> `harness.seed...(...)` or `harness.runScenario(...)`
  - navigate page
  - act through accessible UI locators
  - assert final visible state

- For new seed capabilities:
  - primitive first
  - scenario composition second
  - fixture/spec usage last

- For cross-feature flows:
  - keep the spec in `e2e/`
  - compose multiple scenarios or add one higher-level scenario entry if the setup is reused

## Key Files

- `playwright.config.ts`
- `e2e/fixtures.ts`
- `e2e/helpers/harness.ts`
- `e2e/catalog.spec.ts`
- `app/e2e/page.tsx`
- `lib/testing/e2e-types.ts`
- `lib/testing/e2e-scenarios.ts`
- `lib/testing/e2e-primitives.ts`
- `lib/testing/e2e-catalog.ts`

## Output Contract

When asked to add or refactor Finito e2e coverage, produce:
- Specs that use the shared fixture/harness pattern.
- Scenario additions routed through the shared scenario system.
- Seed logic extracted into primitives when it is reusable.
- Verification steps using the repository e2e commands.
