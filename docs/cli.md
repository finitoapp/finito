# CLI

With an account's recovery phrase, `apps/cli/src/cli.ts` opens that account, syncs it
like the app does, and runs as a device of it, so the jobs keep running while
no app is open. The README's CLI section says how to run it and lists every
variable. The decisions behind it are
[`decisions/account/0010`](decisions/account/0010-the-cli-with-a-recovery-phrase-is-a-device.md)
and
[`decisions/account/0012`](decisions/account/0012-the-cli-opens-an-account-from-its-recovery-phrase.md).

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `PAYKY_RECOVERY_MNEMONIC` | none | An account's 20-word recovery phrase. The CLI opens that account and syncs it through the default Evolu relays. Without it the CLI opens the public Evolu test owner, which never syncs. `background-jobs run` needs it. |
| `PAYKY_DATA_DIR` | `.data/<ownerId>` with a recovery phrase, `.data` without, at the repository root | The directory of the database, `payky.db`, and the device id. With a recovery phrase every account gets a directory of its own under it: rows of two accounts in one file mix in every query. |
| `PAYKY_SELF_PAY_RELAYS` | `defaultSelfPayRelays` in `packages/core/src/integrations/nostr/nostr-default-relays.ts` | Comma-separated `wss:` relays the account's self-pay relay list starts from ([`decisions/table-self-pay/0003`](decisions/table-self-pay/0003-the-merchant-picks-the-relays-tables-publish-to.md)). Keep it equal to the app build's `VITE_PAYKY_SELF_PAY_RELAYS`: a sticker on the defaults names no relays, and its guest page reads the build's. |
| `PAYKY_QERKO_POS_ID` | `payky` | The `Pos-Id` header of the Qerko card terminal API ([`docs/qerko.md`](qerko.md)). Keep it equal to the app build's `VITE_PAYKY_QERKO_POS_ID`. |
| `PAYKY_EET_PRODUCTION_URL` | none | EET's production endpoint. Keep it equal to the app build's `VITE_PAYKY_EET_PRODUCTION_URL`. Without it the CLI reports nothing to EET, since it would send a production account's sales to the playground. |

## Run it as a device of an account

`background-jobs run` registers the CLI as a device of the account, named
`CLI on <hostname>`, of type `cli` and holding no permissions. Then it runs
the jobs a native device runs: Fio and MONETA sync, Spark sync, EET
reporting with `PAYKY_EET_PRODUCTION_URL` set, settling Qerko card payments and Lightning address payments,
the self-pay publishing and the lookups of guests' selections, and closing bills that money paid. Guests see their payments and can pay by Lightning while
no app is open.

It keeps its device id in `device-id` in its data directory, readable only by
its user, so every new data directory is a new device. The owner removes a stale one in
Settings → Access.

It runs until SIGINT or SIGTERM, then stops its jobs. A second signal stops it
at once.

Keep its computer's clock synced, since it signs the Lightning rate. It shares
the Fio tokens with the app, and one device polls at a time, the one that runs
the most ([`decisions/payment/0012`](decisions/payment/0012-the-device-that-runs-the-most-polls-fio.md)).

A browser or PWA cannot call the Fio API, so it never syncs Fio transactions.
Its Fio settings show the plugin off and cannot switch it on, though saving the
interval or the lookback there leaves it as it is. The CLI syncs and switches
the plugin on under the same recovery phrase:

```bash
# Write PAYKY_RECOVERY_MNEMONIC="word1 ... word20" into the git-ignored .env.cli
# with an editor, never with echo, which leaves the phrase in shell history.
touch .env.cli && chmod 600 .env.cli && $EDITOR .env.cli
# Download the account from the relays, then stop it with Ctrl+C.
bun --env-file=.env.cli apps/cli/src/cli.ts background-jobs run
# Switch the Fio plugin on once. The list shows the plugin's accountId and
# also its Fio token, so mind who sees the screen.
bun --env-file=.env.cli apps/cli/src/cli.ts fio-plugins list
bun --env-file=.env.cli apps/cli/src/cli.ts fio-plugins save -a <accountId> -i 30 -x 1
bun --env-file=.env.cli apps/cli/src/cli.ts background-jobs run
```

A one-shot command such as `fio-plugins list` works on the local file as it
is, so run `background-jobs run` first to bring it up to date.

## Keep the phrase and the file safe

The phrase gives full control of the account, its wallet included, to whoever
can read it on that machine. Keep it in a file only its user reads, as above.
The database holds the account's secrets too, so the CLI keeps its file
readable only by its user and creates a missing directory the same way.
