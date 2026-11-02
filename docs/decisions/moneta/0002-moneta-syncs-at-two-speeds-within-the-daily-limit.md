# 0002 MONETA syncs at two speeds within the daily limit

Status: accepted
Date: 2026-11-01

## Context

A MONETA token may make 5000 calls a day, shared by every device of the
merchant; there is no minimum gap between calls, unlike Fio's API. A customer
paying by bank QR waits at the counter until the transfer shows up, and a
transfer reaches the account within seconds to minutes.

## Decision

Two speeds share one sync (`syncMonetaTransactions`). A background job syncs
every 300 s by default from its sync pointer, on every native device and the
CLI; it keeps 60 s between syncs whatever interval the row holds, so a value
written by the CLI or another device cannot spend the limit faster. While
the payment-wait screen shows a payable bank transfer to a connected
account, it asks the bank every 4 s for at most 10 minutes from the
payment's creation. A refused token stops both: the job
stops calling until the plugin changes, the screen for the rest of the wait.
An exceeded limit skips the job's tick and backs off, and stops the screen.

## Alternatives considered

Rotating several tokens, as Fio does: the limit is per day, so a second
token only splits the same budget. Checking only from the payment-wait
screen: payments nobody watches — a closed screen, a customer who paid
later — would stay unpaid.

## Consequences

Three devices in the background spend 864 calls a day; a payment nobody pays
spends 150 more, one that is paid within a minute about 15. The rest covers
more than 25 full waits a day. Each transaction page is a call, so the screen
waits one 4 s interval per page its last check read: a busy account is
checked less often, but a wait never spends more than 150 calls. A
background interval under 300 s shows its daily cost in the settings.
A catch-up reads a week per call and narrows only the window the bank lists
too many pages for, a day at a time to its end (moneta/0007). Whether `accounts` and
every transaction page count against the limit is not yet confirmed by
MONETA.

## Enforced by

- `packages/core/src/modules/moneta-plugin/moneta-plugin-utils.test.ts > the MONETA call budget > three devices in the background leave room for 25 full payment waits`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-utils.test.ts > monetaPluginCheckIntervalSeconds > keeps a minute between background syncs whatever the row holds`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-utils.test.ts > isMonetaFastWatchActive > stops outside the window, on the web, without a plugin, or once the bank refused`
- `packages/app-shared/src/moneta-payment-watch.test.ts > monetaPaymentWatchIntervalMs > waits one interval per page read, so a wait stays within its 150 calls`
- `packages/core/src/background-jobs/jobs/moneta-account-transaction-sync-job.test.ts > moneta account transaction sync job > stops asking the bank once it refuses the token, until a new one is connected`
- `packages/core/src/background-jobs/jobs/moneta-account-transaction-sync-job.test.ts > moneta account transaction sync job > logs an exceeded daily limit without reporting a job error`
- `packages/core/src/integrations/moneta/moneta-client.test.ts > fetchMonetaTransactions > stops at MONETA_MAX_PAGES so a runaway page count cannot spend the daily limit`
