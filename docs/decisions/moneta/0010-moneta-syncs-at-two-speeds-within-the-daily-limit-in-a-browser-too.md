# 0010 MONETA syncs at two speeds within the daily limit, in a browser too

Status: accepted
Date: 2026-11-11

## Context

A MONETA token may make 5000 calls a day, shared by every device of the
merchant; there is no minimum gap between calls, unlike Fio's API. A customer
paying by bank QR waits at the counter until the transfer shows up, and a
transfer reaches the account within seconds to minutes.

moneta/0002 set the two speeds for the native app and the CLI, the only
places that reached the bank. A browser now reaches it too, through the
service proxy its device allowed (moneta/0009, service-proxy/0001), and a
browser may hold the app open in several tabs, each of which would run the
background job again.

## Decision

Two speeds share one sync (`syncMonetaTransactions`), on every device that
can reach the bank: a native device, the CLI, and a browser whose device
allowed the service proxy. A background job syncs every 300 s by default
from its sync pointer; it keeps 60 s between syncs whatever interval the row
holds, so a value written by the CLI or another device cannot spend the
limit faster. In a browser the job runs in one tab per account owner, the
one holding the bank jobs' Web Lock, so a browser counts as one device
however many tabs it opens. While the payment-wait screen shows a payable
bank transfer to a connected account, it asks the bank every 4 s for at most
10 minutes from the payment's creation, and only there. A refused token
stops both: the job stops calling until the plugin changes, the screen for
the rest of the wait. An exceeded limit skips the job's tick and backs off,
and stops the screen.

## Alternatives considered

Rotating several tokens, as Fio does: the limit is per day, so a second
token only splits the same budget. Checking only from the payment-wait
screen: payments nobody watches — a closed screen, a customer who paid
later — would stay unpaid. Running the job in every tab of a browser: each
tab would spend the limit again, and Fio's interval between calls too.

## Consequences

Three devices in the background spend 864 calls a day; a payment nobody pays
spends 150 more, one that is paid within a minute about 15. The rest covers
more than 25 full waits a day. Each browser, or browser profile, with the
consent on is one more device; its tabs are not. Two tabs showing the same
payment-wait screen each check it, which only the waits themselves cost.
Each transaction page is a call, so the screen waits one 4 s interval per
page its last check read: a busy account is checked less often, but a wait
never spends more than 150 calls. A background interval under 300 s shows
its daily cost in the settings. A catch-up reads a week per call and narrows
only the window the bank lists too many pages for, a day at a time to its
end (moneta/0007). Whether `accounts` and every transaction page count
against the limit is not yet confirmed by MONETA.

## Enforced by

- `packages/core/src/modules/moneta-plugin/moneta-plugin-utils.test.ts > the MONETA call budget > three devices in the background leave room for 25 full payment waits`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-utils.test.ts > monetaPluginCheckIntervalSeconds > keeps a minute between background syncs whatever the row holds`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-utils.test.ts > isMonetaFastWatchActive > asks the bank while a payable payment waits on a device that can reach the bank`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-utils.test.ts > isMonetaFastWatchActive > stops outside the window, where the bank is out of reach, without a plugin, or once the bank refused`
- `packages/app-shared/src/moneta-payment-watch.test.ts > monetaPaymentWatchIntervalMs > waits one interval per page read, so a wait stays within its 150 calls`
- `packages/core/src/background-jobs/jobs/moneta-account-transaction-sync-job.test.ts > moneta account transaction sync job > stops asking the bank once it refuses the token, until a new one is connected`
- `packages/core/src/background-jobs/jobs/moneta-account-transaction-sync-job.test.ts > moneta account transaction sync job > logs an exceeded daily limit without reporting a job error`
- `packages/core/src/integrations/moneta/moneta-client.test.ts > fetchMonetaTransactions > stops at MONETA_MAX_PAGES so a runaway page count cannot spend the daily limit`
- `packages/core/src/background-jobs/run-background-jobs.test.ts > runBackgroundJobsHoldingLock over $name > lets a second holder wait until the first is disposed`
- `packages/core/src/background-jobs/run-background-jobs.test.ts > runBackgroundJobsHoldingLock over $name > holds a lock of its own per account owner`
- `apps/web-app/src/components/app/app-background-jobs.test.tsx > AppBackgroundJobs, CashuBackgroundJobs and BankBackgroundJobs > in a browser, toggling the service proxy starts and stops the bank jobs alone, in one tab`
