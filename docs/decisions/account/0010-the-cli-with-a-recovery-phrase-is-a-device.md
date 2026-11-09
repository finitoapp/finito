# 0010 The CLI with a recovery phrase is a device of the account and runs the jobs a native device runs

Status: accepted
Date: 2026-10-13

## Context

A till that runs only as a PWA stops when its tab sleeps. With no app open,
nothing published the self-pay view or the signed Lightning rate. On
2026-10-13 a guest's phone kept asking for money the CLI had already
matched, and guests could not mint a Lightning invoice until someone
opened the app. The CLI already opens the account from its recovery phrase
(`PAYKY_RECOVERY_MNEMONIC`) to run the Fio and Spark syncs, so it holds
everything a device needs.

## Decision

- `background-jobs run` with a recovery phrase runs as a device of the
  account. It keeps one device id per data directory, in its `device-id`
  file readable only by its user, and registers its
  device row on start like the app does (access/0004): named
  `CLI on <hostname>`, type `cli`, holding no permissions.
- It runs the jobs of a native device: Fio and MONETA sync, Spark sync, EET
  reporting once it has EET's production endpoint (`PAYKY_EET_PRODUCTION_URL`),
  since without one it would send a production account's sales to the
  playground, settling Qerko terminal and Lightning address payments
  (qerko/0005), self-pay publishing, asking again for self-pay selections
  and orders not found yet, and bill closing, with the device id and the self-pay
  root the app derives
  from the same master key. It publishes to the account's
  self-pay relays (table-self-pay/0003), whose defaults it takes from
  `PAYKY_SELF_PAY_RELAYS`.
- Without a recovery phrase it runs no job and says it needs one. The
  public Evolu test owner it would open is no account, and its tables must
  not reach real relays or EET.
- It serves no Qerko QR payments: their connection and sync run on the
  device a merchant chose for them, which the CLI never is.
- It raises no backup reminder (account/0009): the reminder reads its
  snooze from a device database, which the CLI has none of, and nothing in
  the CLI would show it.

## Alternatives considered

- Keeping the CLI to the Fio and Spark syncs, which leaves self-pay guests
  without a confirmed view or a Lightning rate whenever no app is open.
- A device database for the CLI like the app's. The CLI holds one account
  per data directory and no PIN or settings, so a file with the id is
  enough.
- A device id derived from the owner and the hostname, which collides for
  two CLIs on one computer and changes when the computer is renamed.

## Consequences

- The CLI never records a settlement itself: a self-pay payment belongs to
  the device that opened its bill, and an automatic match to the device
  that created the payment. In EET it only takes over another device's
  sale after 10 minutes, as eet/0009 lets any device do. For withdrawals
  it is another device, so withdraw/0007's 24 hours still apply to it.
- An app and a CLI that share the Fio tokens poll one at a time, the one
  that runs the most (payment/0012).
- Every new data directory is a new device row, which the owner removes in
  Settings → Access when it is stale.

## Enforced by

- `apps/cli/src/cli-device.test.ts > CLI device > keeps one device id per data directory, in a file only its user reads`
- `apps/cli/src/cli-device.test.ts > CLI device > registers as a device named after the computer, holding no permissions, and keeps a name the owner gave it`
- `packages/core/src/runtime/node-evolu.test.ts > createNodeEvolu > carries the self-pay root of its account, and none without one`
- `packages/core/src/background-jobs/background-jobs.test.ts > getBackgroundJobsForRuntime > runs every other job of a native device in the CLI, EET reporting and Qerko's terminal included`
- `packages/core/src/background-jobs/background-jobs.test.ts > getBackgroundJobsForRuntime > keeps the backup reminder out of the CLI, which has no device database or screen`
- `apps/cli/src/cli-background-jobs.test.ts > the jobs it runs > leave EET reporting out without an EET production endpoint, so no production sale goes to the playground`
