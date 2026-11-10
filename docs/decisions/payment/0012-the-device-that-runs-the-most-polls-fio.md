# 0012 The device that runs the most polls FIO, one device at a time

Status: accepted
Date: 2026-10-14

## Context

FIO answers one token at most once every 30 s, counted across every client
that holds it ("Konkrétní token lze použít pouze 1x pro čtení nebo zápis
během 30 sekund", FIO API Bankovnictví, Status Code 409). The FIO sync job
spends that whole budget: with n tokens it checks every 30/n s and uses them
in turn. Every native device and the CLI run the job over the same synced
tokens, so two of them spend the budget twice and FIO answers 409. Start
offsets cannot fix it, because the budget itself is exceeded. Results
already converge, since `accountTransaction.id` derives from the bank
reference, so one poller is enough.

Devices differ in how much they run. A CLI or a till may run all day, while
a phone gets suspended in the background. When the polling device is
killed rather than closed, bank confirmations wait until another device
takes over.

## Decision

One device polls a FIO plugin at a time. It holds a synced lease, one row
of `fioPluginSyncLease` per plugin with its device id and an expiry. The
lease lasts 10 minutes, and the holder renews it, with both columns in one
upsert, at the start of each of its checks once 5 minutes or less are left,
before it calls FIO. A device
that sees another device's live lease does not call FIO. A device that
stops cleanly releases its lease by writing its expiry as now.

Each device measures its uptime: the share of the last day its FIO sync was
running, weighted toward recent hours (an exponential average with a
24-hour time constant). A gap of more than 2 minutes between its 1-minute
ticks counts as off. On start the device reads the figure back from
`fioSyncDeviceUptime`, counts the time since it was saved as off, and saves
the result, so other devices compare against it at once. It saves again
every 30 minutes and when its sync stops. A device whose uptime is at
least 10 points above the holder's takes the lease over.

A device that takes the lease from another device rests every token until
30 s after the earlier of now and the old lease's expiry. That is the
latest the previous holder can have used one. Every device also rests each
token for 30 s from the moment it asks FIO with it, across every sync
session of the plugin, so a check that starts late or a session that a
settings change replaced never reuses a token inside FIO's window. A
check that finds every token resting runs again the moment the first one
comes free.

## Alternatives considered

An owner device the user picks. Nothing would sync while that device is off.

Tokens assigned per device. The user would have to split the tokens and
keep the split current.

Preferring a device by type, the CLI before the app. It cannot tell two
tills apart, and it would prefer a CLI that keeps crashing.

Preferring the longest current run. After every CLI restart, a phone open
for hours would keep the lease until it was suspended, and then its lease
would lapse for up to 10 minutes.

Evolu's `updatedAt` as the renewal time. An upsert stamps `createdAt`, not
`updatedAt`, so a lease renewed by upsert would look frozen.

## Consequences

Devices that see each other's writes never get a 409 from each other. Two
devices that take the lease before either sees the other's write can still
get one, and the token rest absorbs it. So do app versions that predate
the lease, until they update. A device that restarts within 30 s of its
last check can get one too, which counts as a failed sync.

After the holder is killed, bank confirmations can wait up to 10 minutes,
plus 30 s of token rest and one check.
A clean close hands over within one check plus 30 s.

A new CLI needs about a day to outrank a till open 8 to 12 hours a day, and
never outranks a device that runs around the clock. It takes the lease
anyway the first time the till closes, and keeps it after that.

The lease costs up to 288 writes a day per plugin, and uptime up to 48
writes a day per running device that syncs a plugin, plus one per start. A
device that syncs no plugin measures no uptime, and it stops measuring when
its last plugin stops. All of them stay in
Evolu history and sync to every device.

The holder renews with 5 minutes left, so clocks up to 5 minutes apart
still agree on whether a lease is live.

## Enforced by

- `packages/core/src/background-jobs/jobs/fio-account-transaction-sync-job.test.ts > fio account transaction sync job > two devices sharing tokens never use one inside FIO's 30 s limit`
- `packages/core/src/integrations/fio/fio-client.test.ts > fio client > rests each token for 30 s after asking FIO with it`
- `packages/core/src/background-jobs/jobs/fio-account-transaction-sync-job.test.ts > fio account transaction sync job > asks FIO again the moment a resting token comes free`
- `packages/core/src/background-jobs/jobs/fio-account-transaction-sync-job.test.ts > fio account transaction sync job > the other device polls 30 s after the poller stops`
- `packages/core/src/background-jobs/jobs/fio-account-transaction-sync-job.test.ts > fio account transaction sync job > a device that runs clearly more takes the lease over without a 409`
- `packages/core/src/background-jobs/jobs/fio-account-transaction-sync-job.test.ts > fio account transaction sync job > a poller in a backoff longer than the lease loses it`
- `packages/core/src/background-jobs/jobs/fio-account-transaction-sync-job.test.ts > fio account transaction sync job > a device keeps its uptime across restarts and counts a suspension as off`
- `packages/core/src/background-jobs/jobs/fio-account-transaction-sync-job.test.ts > fio account transaction sync job > a device keeps its lease when the plugin's tokens change`
- `packages/core/src/background-jobs/jobs/fio-account-transaction-sync-job.test.ts > fio account transaction sync job > a replaced sync never asks FIO with a token inside the 30 s its predecessor started`
- `packages/core/src/background-jobs/jobs/fio-account-transaction-sync-job.test.ts > fio account transaction sync job > a device whose last FIO plugin stops measures no more uptime`
- `packages/core/src/background-jobs/jobs/fio-account-transaction-sync-job.test.ts > fio account transaction sync job > a device that syncs no FIO plugin measures no uptime`
- `packages/core/src/background-jobs/jobs/fio-account-transaction-sync-job.test.ts > fio account transaction sync job > a device that stops releases its lease and saves its uptime before its database closes`
- `packages/core/src/background-jobs/jobs/fio-account-transaction-sync-job.test.ts > fio account transaction sync job > waits for a resting token instead of counting the wait as a failed sync`
- `packages/core/src/background-jobs/jobs/fio-account-transaction-sync-job.test.ts > FIO sync lease > the first device to check takes a free plugin`
- `packages/core/src/background-jobs/jobs/fio-account-transaction-sync-job.test.ts > FIO sync lease > a device renews its own lease once 5 minutes or less are left`
- `packages/core/src/background-jobs/jobs/fio-account-transaction-sync-job.test.ts > FIO sync lease > a device leaves a live lease to a device that runs about as much`
- `packages/core/src/background-jobs/jobs/fio-account-transaction-sync-job.test.ts > FIO sync lease > a device that runs 10 points more takes a live lease over from now`
- `packages/core/src/background-jobs/jobs/fio-account-transaction-sync-job.test.ts > FIO sync lease > an expired or released lease is taken over from the moment it ended`
- `packages/core/src/background-jobs/jobs/fio-account-transaction-sync-job.test.ts > FIO sync uptime > a day running moves uptime 1 - 1/e of the way to 100 %`
- `packages/core/src/background-jobs/jobs/fio-account-transaction-sync-job.test.ts > FIO sync uptime > a day off keeps 1/e of the uptime`
