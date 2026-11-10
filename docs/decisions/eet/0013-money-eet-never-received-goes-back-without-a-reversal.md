# 0013 A tip or kept amount changes nothing in EET, and money EET never received goes back without a reversal

Status: accepted
Date: 2026-10-17

## Context

A sale must reach EET at the latest when its money is received (GFŘ seminar
for developers, slide 17), and money that goes back is reversed as a
negative sale capped at what was reported (see eet/0011). A tip that is an
employee's income is not subject to EET and may be recorded voluntarily
(slide 65). Money above a bill's goods arrives as an ordinary sale or as
extra money (see eet/0012), and staff later says whether it goes back, was
a tip or stays with the business. Money can arrive while EET is off, or
before a device sees the sale that reports it. A refund without a device
gets no reversal on any app version (see eet/0009).

## Decision

A tip, a kept amount or the withdrawal of either sends nothing to EET and
changes no sale or reversal, whoever tips belong to. Kept money is business
income, reported when it arrived while EET was on. The part of any refund
other than a tip refund up to the money EET never received, as the
recording device sees it, is written as a refund without a device: a second
row naming the main one, with its method, currency and moment, or the only
row when all of it is unreported. The main row keeps the device, the
refund lines and the cash register movement. While EET is off and no sale
of the bill was reported, no reversal can follow, so the refund keeps its
device in one row. A refund split this way from the cash register records
no cash handed out (refund/0012), so its reversal is the main row's amount,
not all the cash handed out. Money EET never received is
each payment's money above what its supported sales report less the tips
they report, less what earlier refunds already returned that way. The
payment detail and the sales statistics show and count a refund with its
second row as one.

## Alternatives considered

Reversing an employee's tip and correcting the reversal when the counted tip
changes. The first review found five ways it ended below the goods sold.
Capping every refund's reversal for the whole bill. Devices on an older app
version recreate the reversals it refused, and two devices computing it out
of sync both spend the same room. Both change EET code that every device
runs. Refusing a return through a reported payment while another payment
holds unreported money. It cannot see unreported money inside one payment,
and it dead-ends when the unreported payment cannot be refunded.

## Consequences

EET can hold an employee's tip from an overpayment while checkout tips of
employees are left out (see eet/0005), lawful as a voluntary record. A
device that does not see a sale yet treats that money as never received, so
a refund recorded before its sale exists reverses nothing and EET keeps that
money reported, the over-report eet/0011 and eet/0012 already accept. An
older app version records a refund as one row and reverses it as before,
and shows a refund in two rows as two.

## Enforced by

- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: overpayment resolutions > Tip while tips belong to employees`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: overpayment resolutions > Overpayment returned to EET`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: overpayment resolutions > Overpayment kept`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: overpayment resolutions > EET disabled between the money and its tip`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: overpayment resolutions > Cash returned in full`
- `packages/core/src/modules/refund/refund-actions.test.ts > EET follows only the money > Duplicate payment that EET never received`
- `packages/core/src/modules/refund/refund-actions.test.ts > EET follows only the money > Unreported extra money inside one payment`
- `packages/core/src/modules/refund/refund-actions.test.ts > EET follows only the money > Kept, then returned after all`
- `packages/core/src/modules/refund/refund-actions.test.ts > EET follows only the money > writes the part EET never received as a second row and counts both as one refund`
- `packages/core/src/modules/refund/refund-actions.test.ts > a refund in two rows reads as one, as refund_split_model.py checks > seed %i: refunded amount, refund count, cash by method, cash movements and the EET floor`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: money EET never received > Duplicate payment that EET never received`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: money EET never received > Unreported extra money inside one payment`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: money EET never received > Kept, then returned after all`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: money EET never received > reverses only the part of a return that EET received`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: reversals > keeps a refund recorded before its sale was created out of EET`
- `packages/core/src/modules/bill/bill-overpayment.test.ts > the overpayment model's randomized checks > in sync, seed %i: exact accounting, both caps, no dead end, EET floor`
- `packages/core/src/modules/refund/refund-queries.test.ts > refundByIdQuery > reads a cash refund with the cash it handed out and the device that recorded it`
- `packages/core/src/background-jobs/jobs/eet-reporting-job.test.ts > eet reporting job: reversals of extra money > waits for the extra sale before reversing a refund`
