# 0006 Lightning works for an hour without a merchant device

Status: accepted
Date: 2026-10-14

## Context

A Lightning payment is in sats and a bill is in fiat, so the guest page
needs a rate to price the share and the merchant device must be able to
trust it when the money arrives (`table-self-pay/0005`). The guest cannot
ask a merchant device for one (`table-self-pay/0020`), and the merchant
device may be offline when the guest pays.

## Decision

The merchant device publishes a rate signed with a MAC under a key derived
from the merchant's master key. The rate travels in a liveness event beside
the view, every 5 minutes while the table has an open bill and offers
Lightning (`LIVENESS_INTERVAL_MS`). Each rate stays valid for
one hour from its start (`RATE_WINDOW_SECONDS`), and the money
must arrive at most 10 minutes after that hour, the life of the page's
invoice. The page uses a rate only while more than a minute of it is left.
Without one it mints no invoice and says Lightning is available again once
the restaurant confirms the bill.

## Alternatives considered

None recorded.

## Consequences

Lightning needs a merchant device that was online within the last hour.
Bitcoin typically moves about 0.5 % in an hour, so the merchant risks about
5 CZK on a 1,000 CZK bill, and a guest who waits for a drop gains at most
that. An invoice minted with a longer expiry cannot be paid later at the
old rate.

Revisit when merchant devices stay offline for longer than an hour during
service, or when the price swings make that exposure matter. A rate taken
from a public source at payment time is the candidate.

## Enforced by

- `packages/core/src/modules/table-self-pay/table-self-pay-rate-utils.test.ts > createSelfPayRate > turns a fiat-per-BTC quote into msat per major unit for an hour`
- `packages/core/src/background-jobs/jobs/table-self-pay-publishing-job.test.ts > table self-pay publishing job > confirms the table every interval with a rate the terminal accepts`
- `packages/core/src/modules/table-self-pay/table-self-pay-guest-utils.test.ts > paying by Lightning > offers only a rate still valid for a fresh invoice`
- `packages/core/src/modules/table-self-pay/table-self-pay-reconciliation.test.ts > self-pay by Lightning > credits a payment made 50 minutes after the last rate was published`
- `packages/core/src/modules/table-self-pay/table-self-pay-reconciliation.test.ts > self-pay by Lightning > %s an invoice made in the rate's last minute and %s`
