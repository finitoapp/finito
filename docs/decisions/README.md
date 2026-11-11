# Decisions

One file per business decision, grouped by domain, so what Payky does and
why sit together: `access/`, `account/`, `ai/`, `brand/`, `cashu/`, `catalog/`, `demo-data/`, `eet/`, `landing/`, `lightning-address/`, `moneta/`, `navigation/`, `notification/`, `onboarding/`, `payment/`, `qerko/`, `refund/`, `scanner/`, `settings/`, `support/`, `withdraw/`. Each file states the
decision, the context that forced it, what was rejected and what follows
from it. The code shows what happens. These files keep the reason, so
nobody has to dig it out of old commits and nobody undoes it by accident.

Every accepted decision names the tests that hold it, or says why no test
can. `bun run check` runs `check:decisions`, which fails when a decision has
no accepted or superseded status, or an accepted decision names no test and
gives no reason, or names a test that vitest or playwright does not list.
Renaming or deleting a test a decision relies on therefore fails the check
until the decision is updated. It also fails when a file is not `<domain>/NNNN-title.md`
or its heading carries a different number, when two records share a
number, when a record has no `Date:` line, when a "superseded by" points at a
record that does not exist, or when the domain list above and the
directories disagree. Whether a named test really holds its
decision is for review to judge.

## Format

A decision lives in `docs/decisions/<domain>/NNNN-short-title.md`,
numbered within its domain:

```markdown
# 0011 Short statement of the decision

Status: accepted
Date: 2026-10-01

## Context

The facts and constraints that forced a choice, with their source.

## Decision

What Payky does.

## Alternatives considered

What was rejected, and why, or "None recorded."

## Consequences

What follows, including what it costs.

## Enforced by

- `packages/core/src/modules/eet/eet-actions.test.ts > createEetSale > reports what was received for $name`
- `apps/web-app/e2e/eet.spec.ts > a cash sale is reported as the cash received`
```

A test is named by its path from the repository root, then every
`describe` title and the test title, all joined with ` > `. A `test.each`
is named by its title template.

A decision no test can hold says why instead of listing tests:

```markdown
## Enforced by

Untestable: the reason, so a reviewer can judge it.
```

A decision refers to another one by domain and number, such as
`eet/0007`.

## Changing a decision

Do not rewrite an accepted decision to change what Payky does. Add a new
one, set the old one to `Status: superseded by eet/0011`, and let the new
one name the tests. A superseded decision keeps its reasoning and is not
checked. A correction that makes a record true without changing the
decision is an edit, and so is a consequence that now points to the
decision that changed it.
