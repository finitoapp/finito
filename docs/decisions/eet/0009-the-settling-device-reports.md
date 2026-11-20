# 0009 The device that took the money reports the sale, and others take over after 10 minutes

Status: accepted
Date: 2026-09-29

## Context

EET wants a sale recorded at the latest when its money is received, or when
the order to pay is issued if that comes first (GFŘ seminar for developers,
slide 17), with the identifier of the cash register on which it is recorded
(slide 19). EET treats a message with the same body as the same sale, and
the body includes that identifier (interface description, chapter 4).

## Decision

A payment's sale belongs to the device that recorded its first settlement:
where staff confirmed cash or card, or matched a transfer by hand. A
settlement Payky matched on its own belongs to the device that created the
payment. An extra money sale follows the same rule for the payment's latest
claim (see eet/0012). A reversal belongs to the device that recorded the
refund, and a refund without a device gets none. For 10 minutes only that
device creates the record and sends it automatically. The 10 minutes start
at the settlement the sale follows, and for a reversal at the later of the
refund and the latest confirmation of its payment's sales. After that, any
device of the account creates a missing record and delivers an unconfirmed
one, still with the recording device's cash register identifier.

## Alternatives considered

Only the creating device ever sending, which left a lost device's sales
unreported. Any device sending at any time, which lets two devices both
claim the first sending. A lease renewed with each attempt, which would have
to outlast the 15-minute backoff and delay the takeover it exists for.

## Consequences

Several devices may take over at once. Each sends the same body marked as a
repeat, so EET sees one sale. Retry on another device waits the same 10
minutes unless the record already has an attempt.

A self-pay payment names the device that opened its bill, not the device
that matched the money (table-self-pay/0013), so its sale belongs to that
device.

## Enforced by

- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: takeover > reports a payment on the device that settled it in cash`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: sale records > reports a bank payment on the device that confirmed it by hand`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: sale records > reports an automatically matched payment on the device that created it`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: reversals > reverses nothing for a refund with no device`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: extra money > reports extra money on the device that matched it by hand`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > card payment attempts > records the device that took the card payment on its claim`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: takeover > takes over a pending sale once its device's priority is over`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: takeover > creates a sale its recording device never created`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: takeover > takes over a reversal only after its sale's confirmation and the priority`
- `packages/core/src/modules/eet/eet-utils.test.ts > getEetRecordingDeviceWaitEndsAt > keeps another device waiting for 10 minutes unless an attempt exists`
- `packages/core/src/modules/eet/eet-utils.test.ts > getEetReversalStartsAt > starts at the later of the refund and its sale's confirmation`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: extra money > leaves automatically matched extra money to the device that created the payment`
- `apps/web-app/e2e/eet.spec.ts > another device's sale waits for that device, then is sent from here as a repeat`
