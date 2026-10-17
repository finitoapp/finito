# 0011 A refund is reversed in EET as a negative sale of what was reported

Status: accepted
Date: 2026-10-01

## Context

EET 2.0 has no storno message. A storno is a message with a negative amount,
sent with the current time and a new message identifier, and it cannot be
linked to the original sale (GFŘ seminar for developers, slides 17 and 58).
A tip that belongs to employees is not part of the reported sale (see
eet/0005).

## Decision

A refund of a payment with a supported sale becomes at most one reversal,
sent as a negative sale at the moment of the refund. A refund of goods
reverses its amount. A tip refund (see refund/0004) reverses the tip the
payment's sale reports, which the sale fixes when it is created: the whole
tip while tips belong to the business, nothing while they belong to
employees, and nothing for a sale created before it recorded this. Both are
capped at what the payment's sales reported minus earlier reversals that can
be sent, so a refund with nothing to reverse, such as the tip refund of a
tip that belonged to employees, gets no reversal. A reversal waits until
every sale of its payment is confirmed, because one sent first could take
EET below what it holds if a sale were later rejected.

## Alternatives considered

Blocking the refund until the sale is confirmed. A refund is a real money
event staff must record when it happens, even while EET is down. Reading a
sale without a recorded tip as reporting the whole tip. A tip refund of such
a sale created while tips belonged to employees would send a storno and take
EET below what was sold.

## Consequences

The tip refund of a sale created before the reported tip was recorded sends
no storno, so a tip that sale did report stays in EET, which errs toward
reporting more than was sold. A reversal waits for good if a sale of its
payment is never confirmed. A reversal created while EET is off, or in
another environment or for another taxpayer than its sale, is never sent and
is listed among the unconfirmed sales in the EET settings. A tip refund
reverses no more than it returned (see payment/0003). The part of a refund
up to money EET never received, a refund recorded before its sale exists
included, gets no reversal (see eet/0013).

## Enforced by

- `packages/core/src/modules/eet/eet-actions.test.ts > createEetReversal > reverses $name`
- `packages/core/src/modules/eet/eet-actions.test.ts > createEetReversal > caps later refunds at what the sale has left`
- `packages/core/src/modules/eet/eet-actions.test.ts > createEetReversal > caps refunds at what every sale of the payment reports, whichever sale they name`
- `packages/core/src/modules/eet/eet-actions.test.ts > deliverEetReversal > sends the negative amount at the moment of the refund`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: reversals > sends a reversal only once its sale is confirmed`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: reversals of extra money > returning the duplicate leaves the real sale reported`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: reversals of extra money > returning everything reverses the sale and the extra money`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: reversals of extra money > sends the reversal only once the extra sale is confirmed`
- `packages/core/src/modules/eet/eet-actions.test.ts > createEetReversal > marks a reversal unsupported while EET is off`
- `packages/core/src/modules/eet/eet-actions.test.ts > createEetReversal > never sends a reversal once EET runs in another environment`
- `packages/core/src/modules/eet/eet-actions.test.ts > createEetReversal > never sends a reversal once EET reports for another taxpayer`
- `packages/core/src/modules/eet/eet-queries.test.ts > unconfirmedEetReversalsQuery > lists a reversal until it is confirmed, also one never sent`
- `packages/core/src/modules/eet/eet-actions.test.ts > createEetSale > fixes the tip it reports`
- `packages/core/src/modules/eet/eet-actions.test.ts > createEetReversal > reverses no tip refund of a tip that belonged to employees`
- `packages/core/src/modules/eet/eet-actions.test.ts > createEetReversal > reverses the tip refund of a tip that belonged to the business`
- `packages/core/src/modules/eet/eet-actions.test.ts > createEetReversal > reverses no tip refund of a sale that recorded no reported tip`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: extra money > reports no tip on an extra sale`
- `apps/web-app/e2e/eet.spec.ts > a refunded tip reaches EET only while tips belong to the business`
