# 0001 Demo data lives in its own demo account, which never syncs

Status: accepted
Date: 2026-10-10

## Context

An empty Payky shows little of what the app looks like in use, which makes
it hard to demonstrate, take screenshots of or try a screen against
realistic data. The developer section of Settings → About therefore offers
to generate fictional data: catalog, tables, devices, up to three months
of bills and payments by every method, tips, cancellations and refunds.

Three constraints shaped how:

- Fictional data must never reach a relay: it would spread to every device
  of the account and stay there, since CRDT history cannot be taken back.
  Switching relays off on one device is not enough, because another paired
  device of the same account would still upload it, and so would switching
  them back on later.
- A history only looks real if its rows were created in the past. Evolu
  sets `createdAt` itself, from a hybrid logical clock that only moves
  forward and lives in the database worker, so no mutation can date a row
  in the past.
- The outside services the payment flows call (the Yadio rate, the Spark
  wallet, the SwitchioPay terminal, the bank) must not be reached with
  fictional payments, and fictional sales must never be reported to EET.

## Decision

- Generating creates a **new demo account** on the device and switches to
  it. Existing accounts are never written to. The device database marks the
  account with `account.demo` (`pending`, then `seeded`).
- A demo account never syncs: `evoluAtom` gives its app Evolu no
  transports whatever its transport rows say. Its default relays are stored
  switched off, and the security settings show them locked with a note.
- A demo account runs no background jobs (`AppBackgroundJobs`): every job
  talks to an outside service.
- Evolu is patched (`patches/@evolu%2Fcommon@8.27.2.patch`) with
  `evolu.setMutationBackdate(millis | null)`. While set, mutations are
  stamped at that time from a separate per-owner clock that stays unique and
  ordered, and the real clock is not advanced, so later writes are dated
  normally. Earlier millis start that ordering over, so the generator can
  step back a day into a span it has not written yet.
- `generateDemoData` (`packages/core/src/demo-data/`) only composes the domain Tasks
  the UI uses, at a simulated time that the backdate and a fake `date` dep
  share. Fakes answer the exchange rate, wallet invoices and card terminal;
  nothing is fetched.
- EET is left unset in a demo account: no settings, no certificate, no
  sales. Reporting fictional sales, even to the playground, is not
  something a demo should do, and a demo account then cannot start
  reporting by itself.
- History is generated **from today back, a day at a time**, each day in
  time order, for at most 90 days, and the user can stop at any time: the
  day in progress is finished and the history so far stays, unbroken up to
  now. Every day is planned first, oldest first, so bills carry explicit
  display numbers in the order they were opened; stopped early, the oldest
  bill written starts where the unwritten older days would have left off.
- `DemoDataSeed` generates the history once, the first time the app opens a
  `pending` demo account, in a dialog that cannot be dismissed. The account
  is marked `seeded` before generating: a run cut short leaves a partial
  demo account, removed and created again, rather than a second history
  written over the first.
- The page warns, before anything is created, that the data is fictional
  and irreversible short of removing the account, that relays stay off,
  that no outside service is reached and EET stays off, and that
  generating three months takes about half an hour but can be stopped.

## Alternatives considered

- **Generating into the current account** with relays switched off on this
  device, as first asked for. Rejected: another paired device, or switching
  the relays back on, would still upload the data, and the real data would
  be mixed with fictional rows for good.
- **Leaving `createdAt` at the time of generation.** Rejected: every list,
  recap and chart groups by it, so three months would read as one minute.
- **Generating in the CLI with a fake clock and delivering it through a
  local relay.** Rejected: no button in the app, and the device would have
  to reach that relay.
- **A domain timestamp column next to `createdAt`.** Rejected: every query
  would change for the sake of demo data.
- **Writing rows directly instead of through the domain Tasks.** Faster, but
  it would duplicate the domain's invariants (payment numbers, claims, bill
  closing) and drift from them.

## Consequences

- Every Evolu upgrade has to carry the patch over;
  `evolu-backdate-patch.test.ts` fails first when it is lost.
- Generation is bound by Evolu's write batches, ten or so per guest, each
  an OPFS commit that slows as the database grows: about 10 s per simulated
  day at first and 35 s by day 80 in desktop Chrome, half an hour for three
  months and longer on a low-end Android WebView. That is why generation
  starts at today and can be stopped instead of asking for a length up
  front. The screen is kept awake meanwhile.
- A demo account still derives a real Spark wallet from its own master key,
  so a payment taken in it by hand uses that empty wallet like any account.
  The generated Spark history is not in the wallet, so its balance stays
  empty.
- Split bills, Spark withdrawals and EET records are not generated, so the
  EET screens of a demo account stay empty.

## Enforced by

- `packages/core/src/evolu/evolu-backdate-patch.test.ts > evolu backdate patch > stamps createdAt in the past, also jumping back, and leaves later writes on the real clock`
- `packages/core/src/demo-data/demo-data-generator.test.ts > generateDemoData > records a backdated history whose every payment is settled or canceled, with EET left unset`
- `packages/core/src/evolu/device-account.test.ts > insertDemoAccount > adds an active demo account whose relays are all switched off`
- `packages/core/src/demo-data/demo-data-generator.test.ts > generateDemoData > stopped early, leaves the newest days with bills numbered as if the older ones existed`
- `apps/web-app/e2e/demo-data.spec.ts > a demo account generates from today back until stopped, with its relays locked off`
- `apps/native-app/src/platform/switchio-demo.test.ts > a demo account and SwitchioPay (demo-data/0001) > never launches the terminal for a card payment`
- `apps/native-app/src/platform/switchio-demo.test.ts > a demo account and SwitchioPay (demo-data/0001) > never closes the terminal's batch`
- `apps/native-app/src/platform/switchio-demo.test.ts > is told by useAppRun whether the active account is a demo`
- `apps/web-app/src/platform/switchio-demo.test.ts > a demo account and SwitchioPay in Payky (demo-data/0001) > never launches the terminal for a card payment`
- `apps/web-app/src/platform/switchio-demo.test.ts > a demo account and SwitchioPay in Payky (demo-data/0001) > is told by useAppRun whether the active account is a demo`
