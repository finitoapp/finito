# 0014 A confirmation counts only for the view it names

Status: accepted
Date: 2026-10-16

## Context

The guest page warns when no merchant device has confirmed the table for ten
minutes (`SELF_PAY_STALE_AFTER_SECONDS`). The confirmation is the liveness
event a merchant device signs every five minutes (`table-self-pay/0006`).
A sticker copied with relays of its own reads only those relays
(`table-self-pay/0003`). They could serve an old view of the table next to
the newest liveness copied from the merchant's relays, and the page showed
the old bill as confirmed.

## Decision

Each liveness names the view its device published last (`viewVersion`). The
page counts it as a confirmation only for that view or a newer one
(`selfPayViewConfirmedAt`). When it names a newer view than the relays gave,
the page asks them once more before it warns that the restaurant has not
confirmed the bill. The bill stays payable, as every stale view does.

## Alternatives considered

Reading the build's default relays too when the view is behind. It would show
the right bill for a merchant on the defaults, but it reads relays the
sticker does not name, which `table-self-pay/0003` rules out, and it does
nothing for a merchant on relays of their own.

## Consequences

A copied sticker can still show an old view without a warning for at most ten
minutes after the bill changed, because every liveness it can pair with that
view was signed before the change. It can still withhold the view, and a
sticker with keys of its own can still show anything (`table-self-pay/0003`).

A device behind on sync names its older view, and that still confirms the
fresher view a guest reads.

## Enforced by

- `packages/core/src/modules/table-self-pay/table-self-pay-guest-utils.test.ts > loading the view > counts a confirmation only for the view it names or a newer one`
- `packages/core/src/background-jobs/jobs/table-self-pay-publishing-job.test.ts > table self-pay publishing job > names in each confirmation the view it published last`
- `apps/web-app/src/features/table-self-pay-guest/use-self-pay-view.test.ts > asks the relays once more before it shows a view older than the one confirmed`
