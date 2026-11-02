# 0008 MONETA windows are bank days

Status: accepted
Date: 2026-11-01

## Context

The sync sent `fromDate` and `toDate` as ISO date-times with the device's
offset (`2026-10-29T00:00:00+01:00`), and its windows ran from one local
midnight to the next or to the present moment. Queries against a live
account on 2026-11-01 showed what the bank reads of them:

- Only the date written in the value. `2026-10-30T23:30:00Z`, already
  2026-10-31 in Prague, listed the transfer booked on 2026-10-30;
  `2026-10-29T23:30:00Z`, already 2026-10-30 in Prague, did not; and
  `2026-10-30T00:30:00+05:00`, still 2026-10-29 in Prague, did. The time
  and the offset are ignored (moneta/0004).
- Each bound takes its day whole, `toDate` included: a window from one
  midnight to the next listed two days.
- A bare date (`2026-10-30`) is accepted and lists the same as a date-time
  on that day.

A booking date is a day at the bank, in Prague. A device in another time
zone — the CLI on a server in UTC, a merchant abroad — wrote another date
for the same instant, and could start or end its window a day off.

## Decision

A MONETA window is a range of bank days, both included, sent as bare dates
(`yyyy-MM-dd`). A day is the date of an instant in Europe/Prague
(`monetaBankDay`), whatever the device's time zone. The background job's
week covers seven days and its narrowest window one; after a window it
moves its pointer to the day after the window's last, and to today when the
window reached today, which is read again on the next sync as it is not
over. The payment-wait screen reads from the bank day the payment was
created up to today.

## Alternatives considered

Keeping date-times and the device's midnights: the request then says
something the bank does not do, and a device outside Prague's time zone
reads the wrong days. Taking the device's date as the bank day: the same
shift, only hidden.

## Consequences

The windows the code asks for are the days the bank lists, so no window
reads a day twice and a narrower window is exactly one day. `@date-fns/tz`
is a dependency of the core package for the conversion.

## Enforced by

- `packages/core/src/modules/moneta-plugin/moneta-plugin-utils.test.ts > monetaBankDay > counts days in the bank's time zone, whatever the device's`
- `packages/core/src/integrations/moneta/moneta-client.test.ts > fetchMonetaTransactions > sends the bounds as bare booking days`
- `packages/app-shared/src/moneta-payment-watch.test.ts > monetaPaymentWatchRange > reads the bank days from the payment's up to today, in the bank's time zone`
- `packages/core/src/background-jobs/jobs/moneta-account-transaction-sync-job.test.ts > moneta account transaction sync job > reads a long gap a week at a time, saving the pointer after each week`
