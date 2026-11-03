# Cashu payments — specification

Status: implemented 2026-10-14 on branch `feat/cashu`, following
`docs/cashu-plan.md`. The manual checks below are still open; see "Implementation
notes" at the end.

Read `AGENTS.md`, `docs/bill-payment-states.md`, `docs/payment-sync.md` and
`docs/decisions/{payment,withdraw,account}/` before starting. Linky's own
description of the formats Payky must match is in `../linky/packages/linkshu/docs/`
(`concepts`, `ports`, `receive`, `topup`, `melt`, `restore`, `mints`,
`autoswap`) and `../linky/packages/linksync/docs/concepts.md`.

## Goal

A merchant can take a BTC payment over Cashu ecash. Payky shows one QR code
and the customer only scans it: their wallet either pays the Lightning invoice
the mint issues (NUT-04), or sends a Cashu token for the NUT-18 payment request
next to it. The ecash lives in **the same wallet Linky shows**: a master
key moved from Linky into Payky sees the same proofs and the same balance, and
the reverse. Payky manages mints the way Linky does, and the balance can be
withdrawn to Lightning from Payky.

## Owner's decisions

| # | Question | Decision |
| --- | --- | --- |
| 1 | Sharing model | Payky syncs Linky's own Cashu shards live and writes into them in Linky's format. No Payky-owned copy of the proofs. |
| 1b | Trust in the shared data | The synced data shared by Linky and Payky is trusted: both writers are the owner's own apps. Payky does not defend against a row because Linky wrote it. Whether a token's mint is trusted is decided once, by whichever app receives it: a `done` incoming operation in the wallet is trusted whatever its mint, Linky's included (§5 "Which mints a token may come from"). |
| 2 | Library | Own implementation in Payky over `@cashu/cashu-ts` as Evolu Tasks. Do not depend on `@linky-fit/linkshu`/`linksync` or Effect. |
| 3 | How the customer pays | Payky shows one BIP-321 QR, `bitcoin:?lightning=<bolt11>&creq=<creqA…>`, and the customer scans it. Their wallet pays whichever leg it understands: the Lightning invoice from the mint, or a Cashu token for the NUT-18 request. |
| 3b | How the token reaches Payky | Over the NUT-18 request's nostr transport: a NIP-17 direct message to Payky's nprofile. Payky never scans the customer's token. No HTTP `post` transport, no paste, no NFC. |
| 3c | Token without a request id | Linky as a payer sends a bare `cashuB…` token, which names no request. It is matched by amount when exactly one open payment fits; otherwise it is received into the wallet unassigned (§5). |
| 4 | Relation to Spark | A separate payment method: its own `AccountKind` `"cashu"`, its own tab on the wait screen, its own payment detail table `paymentCashu` that does not extend `paymentBtc` (§4). It can be enabled next to Spark. |
| 5 | Mint | The one Linky uses: Linky's synced `defaultMint` setting, else Linky's default. |
| 5b | Mint management | The same logic as Linky: mint list, add by URL, set as default (synced to Linky), move funds between mints, remove an unused mint (§7). Where Payky deliberately differs, §7 says so. |
| 5c | Token from another mint | Whoever receives the token decides whether its mint is trusted, and nothing checks the mint again afterwards. Linky receives from any mint. Payky receives only from the current default mint (decision 5); a token from any other mint Payky leaves alone. A token in the wallet pays the payment that holds it, whatever its mint (§5, `cashu/0011`). This is the one receive rule Payky does not copy from Linky. |
| 5d | Input fee of a received token | As in Linky: the mint's NUT-02 input fee is deducted, and the merchant is credited what actually arrived (§5). |
| 6 | Withdraw | In scope (melt to a Lightning invoice / Lightning address). |
| 7 | Linky's `transaction` history | Payky does not write it. A payment Linky happens to settle does appear in Linky's history, because Linky writes its own row when it completes a topup (§5); the others do not. Accepted. |
| 8 | Accounts not created in Linky | Supported. Payky creates Linky's shards for them, and Linky finds them later. |
| 9 | Wallet seed | Always derived from the master key, as in Linky. There is no custom seed like Spark's. |
| 10 | Prototype first | No separate prototype phase. The compatibility risks below are checked inside phase 1. |
| 11 | Someone else settling first | Payky detects that another app or device already claimed a quote or swapped a token, and stops instead of continuing (§5 "Someone else got there first"). |
| 12 | Mint down when a token arrives | Payky writes no `deferredReceive`. The NIP-17 message on the relays is the queue: the listener runs whenever the Cashu account is enabled and retries every token message in its look-back window that has no finished receive (§5 "Mint unreachable"). |
| 13 | What reaches Payky's books | Every incoming Cashu operation — each `done` `receive` and `topup` in the shared wallet, Linky's personal ones included — becomes an `accountTransaction`, as every Spark transfer does. Outgoing money is booked only for Payky's own withdrawals; Linky's sends, melts and autoswaps are not converted. Accepted: the owner's personal incoming payments are visible in Payky, and the books do not match the wallet balance (§5 "Into Payky's books"). |

## Background: what Linky stores and where

Everything below is verified against `../linky` at the time of writing. Treat
Linky's code as the authority when it moves, and keep the cross-app tests in
both repos in step.

### Keys (all from the same 16-byte master secret, SLIP-39)

Payky's `MasterKey` is the same master secret Linky recovers from the SLIP-39
share. Both apps use BIP-85 entropy `hmac-sha512("bip-entropy-from-k", node.privateKey)`
(`packages/core/src/modules/shared/key-derivation.ts`). Linky's paths are in
`packages/identity/src/derivationPaths.ts`.

| What | Path | Derivation |
| --- | --- | --- |
| Linky app (meta) owner | `m/83696968'/39'/0'/24'/1'/0'` | 16 bytes → 12-word BIP-39 → `mnemonicToOwnerSecret` → `createAppOwner` |
| Cashu wallet seed | `m/83696968'/39'/0'/24'/0'` | 32 bytes → 24-word BIP-39 → `mnemonicToSeed(mnemonic, "")` (64 bytes) → cashu-ts `bip39seed` |
| Nostr key (NUT-20 quote lock, NUT-11 unlock) | `m/44'/1237'/0'/0/0` | same key Payky already derives |
| Payky's own owner (unchanged) | `m/83696968'/39'/0'/24'/1'` | 32 bytes used as `OwnerSecret` — **not** Linky's owner |

- Payky's `deriveEntropy` returns 32 bytes. The Linky owner takes the first 16,
  as Spark's derivation already does.
- Payky's Evolu owner stays as it is. The Linky owner is a second, additional
  identity derived next to it.
- Linky's BIP-85 owners `m/…/24'/3'/i'` (`linkyCashuOwner0/1` in the cross-app
  test) are **not** the cashu shard owners. Nothing in Linky uses them for the
  `cashu` scope; the shard owners come from `deriveShardOwner` (below).
- Linky's web app does not always use the derived seed:
  `apps/web-app/src/platform/linkshu/resolveLinkshuSeed.ts` takes the session's
  cashu mnemonic, else the app mnemonic, else a freshly generated one (nsec-only
  logins). For a SLIP-39 master-key account it should be the derived seed;
  phase 1 confirms it on a real account.

### Owners and tables (Linky's `linksync`)

- Linky's app owner holds the `meta` scope: tables `shardPointer` and `setting`
  (`linksync/src/model/scopes.ts`).
- The `cashu` scope lives in Evolu shard owners `deriveShardOwner(linkyAppOwner, ["cashu", index])`.
  It holds tables `cashuProof` and `cashuOperation`.
- `shardPointer` row: id `createIdFromString("shardPointer/cashu")`, columns
  `scope`, `index`, `rotatedAtMs`. A missing pointer means index 0. Linky only
  reads a pointer whose `ownerId` is the app owner and that is not deleted.
- Rotation (`scopes.ts`, `shardStore.ts`):
  - A new shard after 256 KiB of value bytes or 170 mutations, at most once per
    60 s. Value bytes are `sum(length(value))` and mutations are
    `count(distinct timestamp)` over the local `evolu_history` of the active
    shard's owner (`evolu/evoluShardDb.ts`); the cooldown checks both the
    pointer's `rotatedAtMs` and the local rotation time.
  - The limit exists because the official Evolu relay has a 1 MB quota per
    owner. Payky's writes count toward the same shard.
  - The `cashu` scope is never forgotten, so every shard `0..active` stays
    subscribed.
  - `activeIndex` is `max(pointer, pending local rotation)`; the pending value
    is dropped once observed. Linky does not care who wrote the pointer.
  - After hydration Linky's `repairPointers` probes shards `active+1…` and
    moves the pointer up while a higher shard holds any row, tombstones
    included. It never moves it down.
  - A freshly restored device holds its writes until hydrated
    (`holdWritesUntilHydrated`), so it does not write into shard 0 before the
    pointers arrive. Payky does the same.
- Writes go to the active shard. Updating a row that lives in an older shard
  copies the full row plus the patch into the active shard and tombstones the
  old copy. A soft-deleted cashu row is therefore normal and not a deletion.
- Read merge:
  - `cashuProof` (`mergeProofCopies`, `repositories/wallet.ts`): per id, the
    highest shard's copy wins, **except that any `spent` copy wins**. Spent
    rows are kept even when soft-deleted.
  - `cashuOperation`: the plain merge — the highest shard's copy wins and
    tombstoned copies are dropped.
- `setting` row: `key`/`value`, id `createIdFromString("setting/<key>")`. The
  default mint is under key `defaultMint`. Values are codec-encoded text whose
  keys and encodings never change (`linksync/src/model/settings.ts`).
- Exact column lists: `../linky/packages/linksync/src/model/schema.ts`
  (`cashuProof`, `cashuOperation`, `shardPointer`, `setting`). Notably
  `cashuProof` has no event-time column (Linky reads Evolu's `createdAt`), and
  `cashuOperation` requires `createdAtSec`.
- Row ids (`packages/domain/src/ids.ts`):
  - `cashuProofIdFor(secret)` = `createIdFromString(secret)`
  - `cashuOperationIdFor(key)` = `createIdFromString(key)`, where the key
    (`operationKeyOf`, `linkshu/src/ports/OperationStore.ts`) is
    `kind|tokenText` when `quoteId` is null and `tokenText` is set, otherwise
    `kind|mint|quoteId` with an empty string for a null `quoteId`.
- Proof states: `available`, `held`, `handedOut`, `externalized`, `spent`
  (terminal). A `held` proof with a null `operationId` is legitimate: its
  holder has not synced yet, and it stays out of the balance.
- Operation kinds: `melt`, `topup`, `autoswap`, `send`, `receive`,
  `deferredReceive`, `envelope`. Statuses: `pending`, `paid`, `unpaid`,
  `done`, `failed`, `issued`, `externalized`, `returned`. Per kind
  (`linkshu/docs/concepts.md`): `topup`/`autoswap` go `pending` → `done` |
  `failed`; `melt` goes `pending` → `paid` | `unpaid` | `failed`.
- Linky never deletes a proof or an operation. Payky must not either.

### Writing rows Linky can read

- Linky decodes every row against its own schemas and **silently skips** one
  that fails (`toStoredProof`/`toStoredOperation`). Payky's writes must satisfy
  them: a token text starts with `cashu`, a bolt11 with `ln`, a keyset id is
  even-length hex, amounts are positive. Cross-app tests decode Payky's rows
  with Linky's codecs.
- Leave optional columns out instead of writing `null`, as Linky does. The
  `error` column is truncated to 1000 characters. `locked` is a SqliteBoolean.
- Linky's insert is an upsert: inserting an id that exists in any visible shard
  updates it, and an operation update replaces every field.
- **Mint URLs must match Linky byte for byte.** Proofs, operations and the
  counter scopes are keyed by the URL string. Copy Linky's normalisation
  (`parseMintUrl`, `apps/web-app/src/utils/mint.ts` `normalizeMintUrl`): no
  trailing slash, no search or hash, and any `mint.minibits.cash` URL forced to
  `/Bitcoin`. A cross-app test pins it.

### Locks: per device only

- Linky serialises its own work through leases in its `KeyValueStore`, which
  the web app backs with Web Locks (`localStorageKeyValueStore.ts`):
  - `linkshu.detCounterLock.<mint>.<unit>.<keyset>` around counter use;
  - `linkshu.receiveLock.<mint>` around receives, always taken before the
    counter lock (30 s, then `CounterLockTimeout`);
  - `linkshu.envelopeLock.<mint>.<key>` around envelopes (15 s, then
    `EnvelopeBusy`).
- They exclude other tabs and the service worker of one origin. They **do not
  exclude Payky**, nor another device. No lock spans the two apps.
- Payky's own `lockManager` locks likewise only serialise Payky's work. What
  protects across apps is the mint's answer (quote state, spent proofs,
  "outputs already signed"), the synced `counter` on the operation, and
  NUT-09 reclaim — plus Payky's detection of someone else's claim (§5).

### What Linky does with Payky's rows

- Linky resumes every pending operation in the synced store, Payky's included,
  at launch and whenever it comes back online:
  - topups (`Topup.resumePending`, `useTopupFlow.ts`), polled until expiry and
    closed `failed` (`QuoteExpired`) once the mint reports `UNPAID` past it;
  - melts (`Melt.resumePending`);
  - autoswap claims (dropped after 24 h);
  - deferred receives (`useDeferredReceiveRetry`);
  - pending or transiently failed receives, once per launch
    (`useInterruptedReceiveRecovery.ts`).
- When Linky completes a topup it writes a `transaction` row
  (`transactionIdForQuote`) and shows its "paid" overlay on that device.
- Linky's balance and mint holdings come from the proofs alone, so a missing
  `transaction` row breaks nothing there.

### Compatibility checked from code only

- Linky uses `@evolu/common` 7.4.1, its relay `evolu.linky.fit` included, and
  Payky uses 8.22.3.
- Both have `protocolVersion` 1.
- `deriveShardOwner`, `createSlip21`, `createAppOwner` and `createIdFromString`
  have identical bodies in both, and so does the `evolu_history` table the
  rotation measures.
- Payky already lists `wss://evolu.linky.fit` as a relay.

Phase 1 has to prove all of this with real sync before anything is built on it.

## Architecture

### 1. Linky identity — `packages/core/src/modules/shared/key-derivation.ts`

- Add `deriveLinkyAppOwnerSecret(masterKey)` and `deriveCashuWalletSeed(masterKey)`
  next to the existing derivations. Rename the reserved
  `defaultCashuDerivationPath` to its actual use.
- `key-derivation-cross-app.test.ts` already pins the vectors
  (`sharedCashuWallet`, `linkyMetaOwner`). Bind them to the new Payky API: the
  Linky meta owner id and the 64-byte Cashu seed must equal Linky's
  `crossAppDerivation.test.ts`.
- Linky's test names its Payky mirror `cross-app-derivation.test.ts`; the file
  is `key-derivation-cross-app.test.ts`. Fix the reference in Linky.
- Update the derivation table in `README.md` ("reserved, unused" goes away).

### 2. Linky's data in Payky's own Evolu instance

- **No second Evolu instance.** Payky's app Evolu syncs extra owners next to
  its own:
  - the Linky app owner, for `shardPointer` and `setting`;
  - the cashu shard owners `["cashu", 0..active]`.
- Each extra owner is added with `evolu.useOwner(owner, transports)`. The app
  Evolu is created with `transports: []`, so every extra owner needs explicit,
  non-empty transports, built per owner (`createOwnerWebSocketTransport`).
  Payky's own relay rows embed `${appOwnerId}` in the path and cannot be
  reused. Use Linky's relays: Linky fetches them from
  `https://linky.fit/recommended-relays`, with the bundled fallback
  `wss://evolu.eu.freedomrelay.dev` and `wss://evolu.linky.fit`.
- Writes name their owner through `MutationOptions.owner`.
- Linky's four tables (`shardPointer`, `setting`, `cashuProof`,
  `cashuOperation`) join `AppSchema` in `packages/core/src/evolu/schema.ts`.
  - Column names and types are copied 1:1, and branded ids live in a new
    module `packages/core/src/modules/cashu/`.
  - None of the names collides with a Payky table. `setting` sits next to
    Payky's `appSettings`; the glossary says which is which.
- **Isolation by convention.** Only the shard store
  (`packages/core/src/cashu/cashu-shard-store.ts`) and the Cashu module's queries touch
  these tables.
  - Every query over them filters by the owner ids it expects.
  - A Payky query never reads them without such a filter.
  - All queries share the one `createQuery`, so the guard test is a source
    scan: it fails when a table name (`"cashuProof"`, `"cashuOperation"`,
    `"shardPointer"`, `"setting"`) appears outside the allowed files.
- The extra owners are derived from the active account's master key. They are
  registered when the app Evolu starts (`apps/web-app/src/atoms/evolu.ts`, beside the
  existing `useOwner(evolu.appOwner, …)`) and released with it on an account
  switch.
- **Demo account:** registers no Linky owners. The demo-data generator uses a
  fake Cashu wallet, as it does for Spark. The live Cashu tab in a demo needs
  its own fake, because at runtime a demo account gets the real Spark SDK and
  would get a real mint otherwise.
- The shard store implements the pointer, rotation, copy-on-write, merge and
  hold-until-hydrated rules above, and keeps `useOwner` in step with the
  active index. It owns all writes to Linky's tables. Nothing else upserts
  them.
- Since the data is in one database, a query may join a payment to its Cashu
  operation. `paymentCashu` still stores `quoteId` and `receiveOperationId`,
  because the operation lives in a shard and the claim must find it by value.
- **Payky's own owner never holds a Linky row.** A write without the right
  `owner` lands in Payky's owner and stays invisible to Linky. The shard store
  is the only writer, so it is the one place that has to get this right, and
  its tests check the owner of every write.
- **First-time account (decision 8):** with no `shardPointer`, Payky writes to
  shard 0 and creates the pointer row as Linky would. Linky reads any pointer
  under its app owner, whoever wrote it (`linksync/src/core/shardStore.ts`).

### 3. Wallet — `packages/core/src/cashu/`

- Add the `@cashu/cashu-ts` dependency at the version Linky resolves (4.5.1
  today, `bun.lock`).
- `CashuWalletDep` follows the shape of `SparkWalletDep`. It is a service
  object over `new Wallet(new Mint(url), { unit: "sat", bip39seed })` with
  `loadMint`, cached per `mint|unit`.
- The cashu-ts calls: `createMintQuoteBolt11`, `createLockedMintQuote` (NUT-20),
  `mintProofsBolt11(amount, quote, config, { type: "deterministic", counter })`,
  `meltProofsBolt11`, `restore(start, count, { keysetId })`.
- **Foreign keysets.** NUT-13 does not bind the mint URL
  (`linkshu/docs/mints.md`, "info and fetchInfo"), so, as Linky's
  `rejectForeignKeysets` does on every wallet load: a keyset belongs to the
  mint of the oldest stored proof under that keyset id, and a mint that lists a
  keyset belonging to another mint is refused (`MintRejected`). A keyset no
  proof names belongs to nobody yet.
- **Counters (NUT-13)** — as Linky's (`linkshu/src/internal/counters.ts`):
  one per `(mint, unit, keysetId)`, in the **device database**, as a device
  write function (`AGENTS.md`). Linky keeps its own device-local too
  (`linkshu.detCounter.*` in localStorage); neither syncs. A synced counter
  could not prevent a collision anyway: two devices reading it offline (or
  within the sync delay) reserve the same slots, and last-write-wins merges
  their writes without noticing.
  - Never moves backwards, and slot 0 is never used.
  - Reserves blocks of 64 slots per attempt (`QUOTE_OUTPUT_BLOCK`,
    `SWAP_OUTPUT_BLOCK`).
  - The reserved slot is written to `cashuOperation.counter` **before** the
    mint call. That copy syncs, so any app or device resuming the operation
    re-derives the same outputs. Resuming an operation advances the local
    counter past its block, as Linky does (`quoteClaim.ts`).
  - Serialised through `lockManager` per counter scope (Payky only; see
    "Locks").
  - No floor from synced operations: Linky has none, and it could not work,
    because a `send` records no `counter` (`Send.ts`) and its swap draws two
    blocks (`spend.ts`).
- **Restore on first use — Payky's one difference from Linky.**
  - Linky starts a new device's counter at 1 and runs the NUT-09 restore only
    from a button (`CashuTokensPage`, `CashuProofsPage`); until then it catches
    up through collision recovery alone.
  - A Payky device would then start at 1 against a wallet Linky has advanced
    to tens of thousands. Recovery moves at most about 500 slots per operation
    (5 attempts over a 100-slot window), so the first claims would need on
    the order of a hundred job runs, and a token receive would fail outright.
  - So, when this device has no counter yet for a `(mint, unit, keysetId)`,
    Payky runs Linky's restore algorithm (`linkshu/docs/restore.md`) for that
    keyset before its first operation there. The restore advances the counter
    past the last signed slot.
  - It is Linky's own code path, triggered automatically instead of by a
    button. It may import proofs the shared store lacks, stored `available`
    as Linky's restore stores them, which is harmless.
  - Cost: a first scan walks the keyset's whole derivation tree, which can
    take minutes on a long-used wallet. It runs in the background before the
    device's first Cashu operation at that keyset. If it proves too slow, a
    galloping search for the end of the signed range (doubling, then
    bisecting, about 30 requests) is the fallback — a deviation from Linky to
    make only after measuring.
- **Collision recovery**, as Linky's `collisionRecovery.ts`. Linky and Payky
  share the seed with independent counters, so collisions follow every time
  Linky has used the wallet since Payky's last operation there; every receive
  and claim must handle them.
  - Codes 11003/11005 (already signed) and 11008 (duplicate outputs): NUT-09
    restore over a 100-slot window from the counter, then jump to the last
    signed slot + 1.
  - 11004 (outputs pending) and anything ambiguous: jump 64.
  - Up to 5 attempts, re-checking the quote before each. The advance is kept
    when the attempts run out, so the next operation starts further on.
  - A collision on the operation's **own** synced counter is not a collision:
    it means someone else claimed it (§5).
  - **What exhausting the attempts means (as in Linky).** About 500 slots per
    operation are covered, roughly seven Linky sends between two Payky
    operations at one keyset. A till operates far more often than a personal
    wallet, so this should be rare. Beyond it:
    - a topup claim stays `pending`, and the job retries it on its next run
      (Linky retries only at launch);
    - a token receive ends `failed` with `MintRejected`, which neither Linky
      (`isTransientCashuErrorTag`: only `MintUnreachable` and
      `CounterLockTimeout` are retried) nor Payky's listener retries, and the
      payment stays unpaid. Linky has the same gap; the smallest fix is to
      treat `MintRejected` after exhausted collisions as transient, and it
      belongs in Linky first, so both apps keep one rule.
- **NUT-07** state check before every spend, and before every receive at a mint
  that lists NUT-07. A proof becomes `spent` only on a definitive answer or
  error 11001. Transient failures change nothing.
- **Fees:** NUT-02 input fees from the keyset.
- **Known mints**, as Linky's `knownMints`: the union of mints named by stored
  proofs (any state), by stored operations (`mint` and `sourceMint`), and the
  mints this device has seen or added. Linky keeps the "seen" set
  device-local, so Payky keeps its own in the device database. Known mints feed
  the mints screen (§7). Being known says nothing about trust: which tokens
  pay a payment is decided when they are received (§5, decision 5c).

### 4. Payment method

**Account**
- `AccountKind` gets `"cashu"`.
- New table `accountCashu` with no secret column (decision 9). Its derived id
  is `account:cashu:<linkyAppOwnerId>`, alongside `createSparkAccountId`.
- The mint is not stored on the account. It is the default mint (§7) read at
  use time.

**Payment detail — `paymentCashu`**
- A table of its own, keyed by `PaymentId`, a sibling of `paymentIban` and
  `paymentCashRegister`. It does **not** extend `paymentBtc`:
  `paymentBtc` and `paymentBtcLightning` hold one account, one sats amount and
  one invoice per payment, so a payment with Spark and Cashu both prepared
  would overwrite Spark's row and break its reconciliation join
  (`paymentBtc.accountId = accountTransaction.accountId`). Spark's tables and
  queries stay untouched.
- Columns: `accountId`, `amountSats`, `exchangeRate`, `exchangeRateSource`,
  `exchangeRateFetchedAt` (the Yadio rate, as in `paymentBtc`), `mintUrl`,
  `quoteId`, `lnInvoice`, `quoteExpiresAt`, `receiveOperationId`.
- `quoteExpiresAt` is the mint quote's expiry. The Cashu tab reads it to show
  the quote as expired and to prepare a new one; it does not decide the
  payment's status (step 5 below).
- `receiveOperationId` is nullable and set only by a token received over nostr (§5). Index
  on `quoteId` and on `receiveOperationId`.
- Everything that reads sats or the invoice from `paymentBtc` for display
  (payment detail, `paymentRequestQuery`, stats) also reads `paymentCashu`
  (§8).

**`prepareCashuMethod` in `preparePaymentMethod`**
1. Refuse a zero amount and convert fiat to sats, as Spark does.
2. Create the quote at the default mint: `createLockedMintQuote` with the nostr
   key when the mint advertises NUT-20, else `createMintQuoteBolt11`.
3. Write the pending `topup` `cashuOperation` into the active shard, using
   Linky's id and every field Linky needs to decode it
   (`linkshu/src/topup/internal/topupRecords.ts`): `kind`, `status`, `mint`,
   `unit`, `keysetId` (the wallet's bound keyset), `amount`, `quoteId`,
   `invoice`, `createdAtSec`, `expiresAtSec`, `locked`. `counter` stays unset.
   Without `keysetId` Linky silently ignores the topup.
4. Write `paymentCashu`.
5. Write `payment.expiresAt` from the quote's expiry exactly as a Spark
   preparation writes it from the invoice's, under the same
   `hasNonExpiringMethod` rule. `derivePaymentStatus` and the bill's editing
   lock read only `payment.expiresAt`, so the copy in `paymentCashu` is not
   enough on its own.
   - With Spark and Cashu on one payment, whichever preparation runs last
     sets it. Accepted: Spark's path stays untouched.
   - Money that arrives after the payment shows as expired is not lost: the
     settlement matches by `quoteId` (§5).

**Payment request (NUT-18)**
- Built in `prepareCashuMethod` after the quote, from the same data Linky's
  `encodeNostrPaymentRequest` takes, and byte-identical to it (a cross-app
  test pins the encoding):
  - `a` the amount in sats, `u: "sat"`, `s: true` (single use);
  - `m` the default mint only, the one the quote is at;
  - one `nostr` transport to Payky's nprofile, tagged `["n", "17"]`, listing
    the relays Payky listens on;
  - `i` the payment id;
  - `d` a description, when the payment has one.
- The QR is `bitcoin:?lightning=<bolt11>&creq=<creqA…>`. Payky has no
  BIP-321 builder today and writes its own, with its own tests, producing what
  Linky's `buildBip321PaymentUri` (`linkshu/src/paymentRequest/bip321.ts`)
  produces and parsing back with Linky's `pickBip321PayableLeg`; a cross-app
  test pins both. Both legs are deterministic
  from stored data (`paymentCashu`), so the screen rebuilds the QR after a
  restart; the request itself is not stored.

**Wait screen**
- New tab `cashu` with the BIP-321 QR.
- A Lightning wallet pays the invoice, including a Cashu wallet without NUT-18
  that melts at its own mint. A Cashu wallet with NUT-18 sends a token instead
  (Linky prefers `creq`, `pickBip321PayableLeg`), which saves the customer the
  Lightning fee reserve.
- The screen shows a received token's amount, its mint and the input fee as
  soon as the message arrives, before the swap finishes.
- A token sent for this payment from a mint other than the default shows as
  not accepted: it names the mint and the amount and says the payment stays
  unpaid (§5 "Which mints a token may come from").
- Phase 3 checks that common Lightning wallets read a `bitcoin:` URI with an
  empty address. If some do not, the tab gets a switch that shows the bare
  bolt11 instead.
- Bolt Card over NFC, which keys on `lnInvoice` for Spark, is out of scope for
  Cashu for now.

### 5. Settlement — background job `cashu-account-sync`

The job runs on native and browser, not in the CLI for now. In
`background-jobs.ts` the native list spreads the CLI list, so the job is added
to `nativeBackgroundJobs` and `browserBackgroundJobs` explicitly.

**Lightning**
- For each pending `topup` operation that belongs to an open payment, race a
  NUT-17 websocket subscription against polling. Use Linky's poll schedule:
  every 5 s for 5 min, every 1 min up to 1 h, then every 5 min, counted from
  the quote's creation. A push never mints on its own; the claim re-checks
  over HTTP.
- On `PAID`, claim:
  1. Re-read the synced operation. Stop if someone else got there first (below).
  2. Re-check the quote. `ISSUED` means someone else got there first (below).
  3. Reserve the counter, write it to the operation, and record in the device
     database that this device made that attempt.
  4. Call `mintProofsBolt11` with deterministic outputs.
  5. Insert the proofs as `available`.
  6. Set the operation to `done`.
- If Payky's own attempt lost its response (its counter is on the operation and
  the quote is `ISSUED`), reclaim through NUT-09 `restore(counter, 64,
  { keysetId })`.

**Token** (the nostr listener, part of the job)
- Whenever the Cashu account is enabled, not only while a payment waits, the
  job subscribes to NIP-17 direct messages for Payky's nostr key on the relays
  the request names, through the existing nostr client
  (`packages/core/src/integrations/nostr/`).
  - The subscription looks back over a window (tunable, 7 days to start).
    NIP-17 timestamps are randomised up to two days back, so it can never be
    shorter than that.
  - On every tick the listener tries each token message in the window whose
    `receive` operation is not `done` or `failed`. A message that arrived while
    the app was closed, or whose mint was down, is simply picked up again;
    dedup by operation id makes a repeat harmless. This is the only retry
    mechanism for tokens (decision 12).
  - A message that ended in a final refusal that writes nothing
    (a mint other than the default, `TokenLocked`, an undecodable token,
    `AmountConsumedByFee`, already spent elsewhere) is remembered in memory for the run and skipped. After a
    restart it is tried once more, which costs at most a state check.
- A message is one of two forms (`payment-requests.md`, "Taking a payment"):
  - the NUT-18 payload, JSON `{id, memo, mint, unit, proofs}`, sent by most
    wallets. Its `id` is the payment id;
  - a bare `cashuA…`/`cashuB…` token, sent by Linky. It names no request.
- **One inbox, shared with the support chat and with Linky's chats.** The
  support chat speaks NIP-17 over the same key (`nostr-support-chat.ts`), and
  Linky uses it for its contacts. The listener therefore takes a rumor only
  when:
  - its room is 1:1, the sender plus Payky's key. A support room (the account
    plus the team, current or former) or any other group is skipped; the
    support chat already ignores every 1:1 room, so a payment never shows up
    there;
  - it is a kind 14 message whose content is one of the two forms above. Any
    other content is someone talking to the owner in Linky, and Payky ignores
    it without logging or storing it.
- **Default mint first (decision 5c):** the listener receives a token only
  when its mint is the current default mint. A token from any other mint is
  not received, matched or held by any payment; the message stays on the
  relays, and if Linky receives the token, Payky books it like any other
  incoming operation (§5 "Into Payky's books"), unassigned.
- **Matching to a payment (decisions 3c, 5c):** the mint plays no part in it.
  - A payload goes to the payment its `id` names, if that payment is open and
    has a Cashu request. Otherwise it is received unassigned.
  - A bare token goes to the one open Cashu payment whose amount equals the
    token's face amount. With none or several, it is received unassigned.
  - Unassigned means the swap still happens and the money lands in the wallet
    and in the books as an `accountTransaction` with no claim (decision 13).
    Nothing assigns it to a payment afterwards: there is no new screen for it,
    and `claimManualReconciliation` keeps having no UI. The payment stays
    unpaid, and the merchant deals with it the way an unpaid payment is dealt
    with today (another method, or cancelling it). The money stays in the
    wallet and in the Cashu account's transaction list.
- The message text is the token text. Payky receives it unchanged, as Linky
  does, so both compute the same `receive` operation id,
  `cashuOperationIdFor("receive|" + text)`. It names the operation whoever
  performs the receive and whenever.
- **The nostr key is Linky's too.** Linky auto-accepts Cashu tokens from chat
  messages (`useChatMessageEffects.ts`), so a running Linky may receive the
  token first. The money lands in the same wallet, the operation id is the same,
  and "Someone else got there first" below covers it.
- **The payment holds the receive id before anyone receives.** As soon as a
  token is matched to a payment and passes the check that writes nothing
  (step 1 below), Payky writes `cashuOperationIdFor("receive|" + text)` to
  that payment's `paymentCashu.receiveOperationId`. The id is computed from the
  text alone, so it is right whether Payky, a running Linky or another device
  performs the receive. Writing it later, together with the operation, would
  leave the payment unlinked whenever Linky received the token first: Payky
  stops at step 3 and never reaches the write, and the payment would wait
  forever for a `done` it cannot see.
- Follow Linky's receive order (`linkshu/docs/receive.md`):
  1. Refuse a P2PK token Payky cannot sign (`TokenLocked`); one locked to the
     nostr key is signed with it (NUT-11).
  2. Load the mint and decode the token against its keysets; a foreign keyset
     fails here (§3). The mint is not checked against anything else: a token
     from any mint is received, as Linky does (below).
  3. Stop if someone else got there first (below). The payment already holds
     the receive id, so it settles from the winner's operation.
  4. Dedup by token text and by each proof secret.
  5. Check the fee. `AmountConsumedByFee` when the input fee eats the whole
     token.
  6. NUT-07 check, when the mint lists NUT-07. If anything is `SPENT`, fail
     and write nothing — unless the receive operation exists (step 3 applies).
  7. Dedup once more over freshly loaded rows.
  8. Insert the pending `receive` operation with `tokenText`.
  9. Swap with deterministic outputs, writing `keysetId` and `counter` to the
      operation before each attempt.
  10. Insert the proofs as `available` and set the operation to `done`.
- A receive that fails for good (spent, `AmountConsumedByFee`) leaves the
  payment holding an id whose operation is `failed` or missing. The payment
  stays unpaid, as it would without the token, and the wait screen says why.
- **Mint unreachable (decision 12).** If the mint cannot be loaded or does not
  answer before the swap, Payky writes nothing and leaves the token where it
  is: in the NIP-17 message on the relays. It writes no `deferredReceive`.
  - The listener tries the message again on its next tick, as it does every
    unfinished token message in its window, assigned or not.
  - Whoever finishes the receive — Payky, or Linky, which receives the same
    message on its own — writes the `receive` under the id the payment holds,
    and the payment settles from its `done` as usual. A token that turns out
    spent leaves the payment unpaid.
  - The wait screen shows the payment as waiting for the mint meanwhile.
  - `deferredReceive` rows Linky writes are Linky's: Payky reads them only
    where Linky's own rules need them (removing a mint, §7) and never resumes
    or closes them.
  - Known limit: the queue lives as long as the look-back window and the
    relays keep the message. A mint down for longer than that leaves the token
    to Linky's own deferral, or to the merchant to settle by hand.
- A token for a payment that is already paid (the customer paid both legs, or
  sent twice) is received unassigned and stays an unclaimed transaction.

**Someone else got there first (decision 11)**
- Linky resumes every pending operation it syncs (§Background), and its locks
  do not exclude Payky. So Payky detects a claim made elsewhere and stops,
  rather than racing it to the end:
  - **Topup:** the operation is `done`, or it carries a `counter` this device
    did not reserve (no attempt recorded in the device database), or the mint
    answers `ISSUED` for a quote this device has not minted, or the mint
    reports the operation's own counter as already signed.
  - **Token:** the `receive` operation already exists (`pending` or `done`)
    and this device did not insert it, or the swap fails as already spent
    (11001) or already signed while such an operation exists.
- On detection Payky writes nothing: no proofs, no counter, and **never
  `failed`**. A losing attempt that wrote `failed` would overwrite the winner's
  `done` (`receive.md`, "Two devices receiving the same token").
- The payment then waits for the winner's `done` and proofs to sync, and
  settles from them as usual.
- If they do not arrive within a grace period (tunable, minutes), and the
  operation carries the winner's `counter`, Payky reclaims through NUT-09 from
  that counter, inserts the proofs (idempotent, ids come from the secrets) and
  sets `done`. Without a synced counter it keeps waiting, and the merchant
  settles the payment by hand if the other device never syncs.
- Payky closes a topup `failed` only when the mint confirms `UNPAID` past the
  quote's expiry, as Linky does.

**Which mints a token may come from (decision 5c)**
- Linky accepts a token from any mint and keeps the proofs there. They show up
  in its mint list and can be moved to another mint by hand
  (`linkshu/docs/receive.md`, `MintMoveFundsForm.tsx`).
- That is fine for a personal wallet, but not for a till. Anyone can run a
  mint, issue ecash on it, pay with tokens worth nothing and walk away with the
  goods.
- Trust is decided once, at the receive, by whichever app receives the token
  (`cashu/0011`). Nothing checks the mint again afterwards: not the match, not
  the booking, not the automatic claim.
  - **Linky receives** from any mint, as it does today
    (`useChatMessageEffects.ts`, `useSaveCashuFromText.ts`). It is the owner's
    own app, and the shared data is trusted (decision 1b).
  - **Payky receives** only from the current default mint, Linky's synced
    `defaultMint` (decision 5). That check is the one receive rule Payky does
    not copy from Linky, and the only one it adds. Linky keeps no synced list
    of trusted mints, so the default is the one mint both apps share.
  - A token from any other mint Payky does not receive, match or hold a
    receive id for. If Linky receives it later, it is booked unassigned.
- A token in the wallet — received by Payky or by Linky — pays the payment
  that holds its receive id, whatever its mint. A bare token is matched by
  amount alone (decision 3c).
  - The worthless ecash of a rogue mint Linky accepted only sits in the wallet
    and in the books. It cannot affect other mints: counters are per mint and
    keyset, and foreign keysets are refused (§3).
- Cost: unused mints collect in the shared wallet and in Linky's mint list, as
  they do in Linky already.

**Input fee (decision 5d)**
- Linky's receipt amount is what reached the wallet after the mint's NUT-02
  input fee (`payment-requests.md`: "compare it with what you asked for").
- Payky records that amount. A short receipt shows as underpaid under the
  existing coverage rules (`docs/bill-payment-states.md`). The merchant settles
  it like any other underpayment.
- Many mints charge no input fee, so this is usually zero.

**Into Payky's books**
- **Every incoming operation (decision 13).** Whenever a `receive` or a
  `topup` is `done`, whoever performed it — Payky, Linky, another device —
  write an `accountTransaction` of kind `cashu`, with its id derived from the
  operation id, and an `accountTransactionCashu` detail row holding that
  `cashuOperationId` (indexed), as `accountTransactionSpark` holds
  `sparkTransferId`.
  - **Write only what is missing.** The job never re-upserts a booked
    operation: an Evolu upsert of unchanged values is still a new mutation
    that syncs, so rewriting the history on every run would grow with the
    wallet's age.
  - **Read only what is new: a cursor over arrival order.** A query over all
    operations grows with the wallet too (measured on desktop SQLite with
    indexes: 2 ms at 10 000 operations, 33 ms at 100 000, 193 ms at 500 000,
    and it reruns on every change). A cursor by time does not work either:
    `createdAtSec` and Evolu timestamps are the writer's clock, and an
    operation from a device that was offline for a week arrives under a week-old
    time, behind any time cursor. So the cursor follows the order in which
    changes **arrived on this device**: the `rowid` of `evolu_history`, which,
    unlike the app tables (`without rowid`), has one.
  - **Bootstrap, when there is no cursor yet:**
    1. Wait until the Linky shards are hydrated (the shard store's
       hold-until-hydrated signal).
    2. Read `max(rowid)` of `evolu_history`. Taken **before** the scan, so a
       change arriving during it lands above the cursor and is processed by
       the next run.
    3. Book the incoming `done` operations with `createdAtSec` in the last
       month that have no `accountTransactionCashu` row (an anti-join on
       `cashuOperationId`; index `cashuOperation(kind, status, createdAtSec)`).
    4. Store the cursor from step 2.
  - **Every run after that:**
    1. Read the `evolu_history` rows above the cursor with `table =
       'cashuOperation'`, `column = 'status'` and a Linky shard owner. A
       `rowid` range, so the cost follows the new changes only.
    2. For each operation id they name, load the operation and book it if it
       is a `done` `receive` or `topup` with no `accountTransactionCashu` row
       (point lookups). A copy into a newer shard shows up as a new change and
       is skipped here as already booked.
    3. Advance the cursor only after the batches complete. A crash in between
       repeats the work, which the derived id makes harmless, as it does a
       concurrent write by a second Payky device.
  - Triggers: at job start, on a `subscribeQuery` over Linky's operations,
    and on a fallback interval, as the Spark job does
    (`spark-account-transaction-sync-job.ts`).
  - **The cursor lives in a local-only table of the app database**
    (`_cashuBookingCursor`; an underscore-prefixed table is never synced,
    `@evolu/common` `isLocalOnlyTable`), not in the device database. A `rowid`
    is valid only for the database file it came from: when the app database is
    deleted and synced again, `rowid`s restart, and a cursor kept elsewhere
    would skip everything. In the same database it disappears with it, and
    the bootstrap runs again.
  - **`evolu_history` is Evolu's internal table.** Its `ownerId` and `id` are
    binary, and its shape may change with an Evolu upgrade. Payky depends on
    it already for shard rotation (§Background), so this adds no new kind of
    risk; a test that fails when its shape changes guards both, as
    `evolu-backdate-patch.test.ts` guards the backdate patch.
  - This is Spark's model: its sync books every transfer, claimed or not.
  - Unclaimed transactions reach no revenue, EET or stats: those read
    `accountTransaction` only through `reconciliationClaim`
    (`sales-stats-queries.ts`, `eet-queries.ts`, `payment-queries.ts`).
- In the same batch, when a `paymentCashu` holds the operation — its `quoteId`
  at the payment's `mintUrl` (Lightning; a quote id is unique only within its
  mint), or its `receiveOperationId` (token) at whatever mint — write the
  automatic `reconciliationClaim`. The token's mint is not checked here: it was
  trusted by whoever received it (§5 "Which mints a token may come from"). It matches by quote or operation
  id **only**. Unlike Spark's candidate query, it does not compare
  `amountSats` with the transaction amount: a token after its input fee would
  never match.
- Outgoing operations are not converted: Linky's `send`, `melt`, `autoswap`
  and `envelope` write nothing in Payky. A withdrawal from Payky is booked as
  withdrawals are today (§6), and so is Finito's own `send` to a Linky
  contact, by its withdrawal the moment a relay holds the token
  (withdraw/0015). Converting Linky's sends would mean deciding when a
  handed-out token becomes an outflow and how a returned one reverses it.
- Accepted consequences:
  - A new Payky device books only the last month of an existing wallet's
    incoming operations (the bootstrap above). Older ones are in the books
    only if another Payky device booked them, and their `accountTransaction`
    syncs. Years of a Linky wallet's personal history do not flood the books.
  - The owner's personal incoming payments (tokens from friends, Linky's own
    topups) sync into Payky's account and show in the Cashu account's
    transaction list, to everyone with access to it.
  - The books do not match the wallet balance: Linky's personal spending is
    missing from them. The balance screen shows the wallet, the books show
    what came in. A send Linky takes back (`returnToWallet`,
    `linkshu/docs/tokens.md`) runs the receive flow, so it shows as income
    although the money never left; phase 4 confirms whether it writes a
    `receive` operation.
- Add a candidate query per kind, as Spark has.
- Do not set `closedAt` beyond what the existing claim path does.
- The amount recorded is the sats received after fees. Over- and underpayment
  follow the existing coverage rules.

### 6. Withdraw (melt)

- The balance is the sum of `available` proofs per mint, read from Linky's cashu shards
  through the shard store. It is the shared Linky balance, so it includes money received in
  Linky. That is intended: it is one wallet.
- Withdraw from one mint at a time. The default mint is preselected, and other
  mints with funds can be chosen.
- Destinations: a Lightning invoice and a Lightning address. On-chain is out of
  scope. Finito also takes a Linky contact, to which it hands a token over a
  NIP-17 message instead of melting (withdraw/0015, `cashu-send.ts`,
  `nostr-cashu-send.ts`, `linky-contact.ts`).
- Linky's melt flow, step by step (`linkshu/docs/melt.md`):
  1. Get a quote and check it is `UNPAID` and not expired. Cost = amount +
     `feeReserve` + the input fee of the melt inputs and of the cutting swap.
  2. NUT-07 select.
  3. Fee-inclusive swap.
  4. Persist a pending `melt` operation: inputs `held`, the remainder
     `available`, the sources `spent`.
  5. `meltProofsBolt11` with NUT-08 blank outputs recorded on the operation.
  6. `PAID` stores the change and closes `paid`. `UNPAID` returns the inputs
     to `available` and closes `unpaid`. A definitive rejection returns the
     inputs and closes `failed`. A lost response stays `pending`, and the job
     resumes it — and so may Linky.
- Generalise the withdraw module over Spark and Cashu:
  - `loadSparkAccount` (private today), the fee quote and the execution;
  - the schema: `withdrawalLightning.sparkTransferId` is required today, so a
    Cashu withdrawal needs its own detail or a nullable column;
  - the destination parsing and the form (`withdraw-destination-utils.ts`,
    `withdraw-form-step.tsx`).
- The existing `withdraw/` decisions apply, and new records cover what differs:
  - the fee reserve is the mint's `feeReserve`;
  - a withdrawal may spend money received in Linky;
  - resuming a pending melt after a lost response is not a retry in the sense
    of `withdraw/0007` ("a withdrawal is never retried"): it settles the one
    payment already sent.
- Withdrawing asks for the PIN (`access/0007`).

### 7. Mints screen (decision 5b) — under the Cashu account settings

Mirror Linky's screens: `apps/web-app/src/pages/MintsPage.tsx`,
`MintNewPage.tsx`, `MintDetailPage.tsx`, `components/MintMoveFundsForm.tsx`,
`app/state/wallet/defaultMint.ts` and `utils/mint.ts`.

- **Default mint.**
  - Linky resolves it as: this device's override
    (`linky.cashu.defaultMintOverride.v1`), which mirrors the synced `setting`
    row `defaultMint`, otherwise the npub.cash suggestion, otherwise
    `MAIN_MINT_URL` (an env value, `https://cashu.cz` by default).
  - A synced value that differs from the override is adopted
    (`adoptSyncedDefaultMint`).
  - Payky reads the synced `defaultMint` row directly and keeps no device
    override. The override only exists in Linky so its UI works before sync.
    The fallback is `https://cashu.cz`.
  - **Set as default** writes the synced `setting` row through the shard store
    (meta scope, app owner), skipping the write when the value is the same. It
    moves no funds.
  - In Linky, changing the default also re-points the user's npub.cash
    Lightning address to the new mint. Payky has no npub.cash and cannot do
    that, so a default changed in Payky leaves Linky's Lightning address paying
    into the old mint until the user changes the default in Linky. The setting
    screen says so.
  - Linky's onboarding writes `MAIN_MINT_URL` once
    (`seedOnboardingDefaultMint`). Payky does the same when the Cashu account
    is enabled and no `defaultMint` row exists.
- **List.** Linky shows its preset mints, the default, and the mints holding a
  balance or a pending deferred receive. Payky shows its known mints (§3) with
  their balance and a default badge, plus the preset
  suggestions (`PRODUCTION_MINTS`: cashu.cz, mint.minibits.cash/Bitcoin,
  kashu.me, cashu.21m.lol). Fetch suggestions with a fetch that does not record
  them as seen (`fetchInfo`).
- **Add by URL.** Prefix `https://` when the scheme is missing, require a dot
  in the host, then normalise (§Background). Linky stops there and makes the
  new mint the default. Payky differs:
  - a mint whose info (NUT-06) and keysets fail to load is refused, and so is
    a mint that lists another mint's keyset;
  - a mint that loads is added to the known mints;
  - adding does not change the default, so Payky still does not receive the
    mint's tokens (§5).
- **Detail.** Name and icon, balance, "set as default", "move funds".
- **Move funds** is Linky's autoswap (`linkshu/docs/autoswap.md`):
  1. Get a topup quote at the target.
  2. Melt at the source to pay it.
  3. Mint at the target.
  - It estimates the cost first and moves an amount or sweeps everything. A
    sweep retries with up to 4 smaller amounts.
  - It writes two operations: an `autoswap` (mint = target, `sourceMint` =
    source) and a `melt` at the source.
  - The job resumes interrupted swaps, and so may Linky; the rules of §5
    "Someone else got there first" apply to the claim.
  - It only ever runs on an explicit user action.
  - It is a money movement, so it asks for the PIN like a withdrawal.
- **Remove.** Allowed only while no non-`spent` proof and no pending
  `deferredReceive` (written by Linky) names the mint (`MintInUse`, as linkshu's
  `removeKnownMint`). Removing drops the mint from this device's added and seen
  sets only; a proof or operation naming it brings it back. Linky's web app
  differs: its "Delete" only hides its cached mint info, with no balance check.
- **Not copied:**
  - The npub.cash suggestion. It is part of Linky's Lightning address feature,
    which Payky lacks.
  - The "allow test mints" switch. Payky lists no test mint (Linky's presets
    include `testnut.cashu.space`); a test mint can still be added by URL.

### 8. Every place a new method must be added

These are the union and lookup tables:
- `AccountKindSchema`, and through it `AccountTransactionKind`, `eetSale.method`
  and the CLI account commands (`apps/cli/src/cli-accounts.ts`). EET needs nothing
  more: `method` is stored, not sent.
- `DefaultPaymentMethodSchema` (a separate enum, not derived from
  `AccountKind`), `PaymentMethodTab`, `PaymentMethodOption`,
  `preparingPaymentMethodKeys`, the `switch` in `payment-wait-method-tabs.tsx`.
- The settings row-state table, `payment-method-display.tsx`, the stats
  `methodColors` (all five `--chart-*` tokens are taken; Cashu needs a new
  one), the demo-data generator.
- `deriveAccountKind`/`deriveNewAccountId`/`createAccount`,
  `deriveAccountTransactionId`/`Kind`, the `accountTransactionCashu` detail
  table and the local-only `_cashuBookingCursor` (§5 "Into Payky's books"),
  the account-transaction id prefixes in
  `account-transaction-utils.ts` (Cashu stays out of
  `manualPaymentTransactionIdPrefixes`), the reconciliation fan-out
  (`loadAutomaticReconciliationClaimForNewAccountTransaction`,
  `reconcileAccountTransaction`).
- `enabledPaymentMethodAccountsQuery`, `paymentRequestQuery`,
  `packages/core/src/evolu/schema.ts`, i18n in `en`/`cs`/`sk`.
- `payment-wait-page.tsx` beyond the keys table: building the options list,
  `activePaymentMethodIsPrepared`, the `prepare` mapping, the `onValueChange`
  guard.
- The account save and update paths (`saveSparkAccount` has no Cashu
  counterpart yet, `updateAccount`'s per-kind detail) and a settings detail
  route next to the Spark one; `kindKeys` in `spark-transactions-page.tsx` is a
  `Partial` and will not fail to compile.
- Onboarding's `onboardingPaymentMethodOrder` decides the tab order, though an
  unlisted method is appended anyway.
- The CLI beyond accounts: `apps/cli/src/cli-payments.ts`, `apps/cli/src/cli-account-transfers.ts`.
- Access permissions for the new routes and actions (mints screen, set as
  default, add, remove, move funds, withdraw) in `packages/core/src/modules/access`.
  Every new `_terminal` route declares `staticData.access`.
- The nostr client: a NIP-17 direct-message subscription for Payky's key, next
  to the support chat's, taking only 1:1 rooms whose content is a Cashu
  payment (§5 "One inbox").
- The landing "how it works" page (`landing-tech-page.tsx`,
  `landing-tech-diagrams.tsx`, the `landing.tech.services.*` keys).

Onboarding enables cash and Spark automatically and places Cashu immediately
after Spark in the method order. Cashu is enabled in settings
(`onboarding/0006`).

### 9. Docs and decisions

- New domain `docs/decisions/cashu/`, with records for:
  - the shared Linky wallet and its format (decision 1), and the trust in the
    shared data (1b);
  - the default mint shared with Linky and the mint management logic, with the
    deliberate differences of §7 (decisions 5, 5b);
  - `paymentCashu` as its own payment detail (decision 4);
  - who settles a topup or a token, and stopping when someone else got there
    first (§5, decision 11);
  - the one BIP-321 QR with a NUT-18 request over nostr, and matching a token
    to a payment by request id, else by amount (decisions 3, 3b, 3c);
  - tokens received by Payky only from the default mint, by Linky from any,
    and a received token paying the payment that holds it whatever its mint;
    an unassigned token never assigned to one afterwards (decision 5c,
    `cashu/0011`, superseding `cashu/0007`);
  - every incoming operation is booked, outgoing only for Payky's
    withdrawals (decision 13);
  - no `deferredReceive` in Payky: the NIP-17 message is the queue while the
    mint is down (decision 12);
  - the input fee is the merchant's to settle as an underpayment (5d), and
    matching by quote or operation id, never by amount.
- `withdraw/`: the records of §6.
- `access/`: the new permissions change the permission map (`access/0002`,
  `access/0008`), so they get a new record.
- `docs/glossary.md`: proof, mint, token, known mint, the payment's mint, Linky
  owner, and `setting` versus `appSettings`.
- `docs/payment-sync.md`: the Cashu job.
- `README.md`: the key table.
- `docs/decisions/landing/0009`: the "how it works" page must list the new
  outbound connections: the mints, Linky's relays, and the nostr relays the
  payment request names.
- Linky: a note in its `AGENTS.md` naming Payky as a second writer of the
  `meta` and `cashu` scopes, like the one its `derivationPaths.ts` already
  carries.

## Phases

1. **Identity and sync.**
   - Key derivations and cross-app tests.
   - Confirm which seed Linky's web app holds for a SLIP-39 account.
   - Linky's owners and tables in the app Evolu, and the shard store, read-only first.
   - Done when Payky shows the Linky balance for a master key moved from Linky.
   - Then the first write: a proof row written by Payky appears in Linky, and
     cross-app tests decode Payky's rows with Linky's codecs.
   - This phase proves the Evolu 7↔8 compatibility. It stops the project if
     that fails.
2. **Wallet core.** `CashuWalletDep`, counters, restore on first use (and
   how long it takes on a long-used wallet), collision recovery, NUT-07,
   known mints, mint URL normalisation, with tests against a fake
   mint and one run against `testnut.cashu.space`.
3. **Lightning receive.** Account, the default mint (read and seed), method,
   `paymentCashu`, the BIP-321 QR (Lightning leg first, `creq` added in phase
   4), wait-screen tab, job, the someone-else-first detection, settlement into
   the books with the `evolu_history` cursor and its bootstrap. Check the empty-address `bitcoin:` URI with common wallets.
4. **Token receive.** The NUT-18 request and its cross-app encoding test, the
   NIP-17 listener, matching (id, then mint and amount, else unassigned), the
   matching only from the payment's mint, the unassigned token on the wait
   screen, fee display, retrying a token while its mint is down. Test with
   Linky as the payer; the NUT-18 payload form is covered by unit tests only
   (owner's decision 2026-10-14).
5. **Mints screen.** List, add, set as default, remove, move funds (autoswap).
6. **Withdraw.** Melt, the resume of pending melts, the withdraw UI over both
   kinds.

## Risks

- **Two writers on one format.**
  - Linky's `linksync` changes can silently break Payky, and a row Payky writes
    wrong is silently skipped by Linky.
  - Mitigation: cross-app tests on ids, derivations, URL normalisation and row
    decoding in both repos, plus the note in Linky's `AGENTS.md`.
- **Evolu 7 vs 8.** Shown compatible only by reading the code. Phase 1 decides.
- **Shard rotation by two apps.**
  - Both apps may rotate the same scope at once.
  - Linky's `activeIndex` takes the maximum of the pointer and a pending
    value, and `repairPointers` only moves it up. Payky must do the same and
    tolerate a pointer written by Linky meanwhile.
- **Cross-device races.** Linky's locks are per device. The races documented in
  Linky (`receive.md`, "Two devices receiving the same token") stay open
  between Linky devices; between Payky and Linky, §5 "Someone else got there
  first" keeps Payky from writing over the winner.
- **A claim that never syncs.** If another device claims a quote or swaps a
  token and never syncs, Payky can reclaim only when the operation's counter
  synced; otherwise the merchant settles the payment by hand.
- **Bare tokens match by amount.** Two open Cashu payments of the same amount
  at the same mint make a bare token from Linky ambiguous; it is then received
  unassigned and pays neither. Asking Linky to send the NUT-18 payload when
  the request has an id removes the ambiguity.
- **NUT-18 support in customer wallets.** A wallet that understands neither
  `creq` nor the BIP-321 `lightning` parameter cannot pay; the bare-bolt11
  switch is the fallback.
- **Default mint changed in Linky while a payment waits.** The quote is already
  at the old mint, and `paymentCashu.mintUrl` keeps it. Only new payments use
  the new mint. A token for the waiting payment from the old mint is no
  longer received by Payky (`cashu/0011`); the Lightning leg still pays.
- **npub.cash drift.** A default mint changed in Payky does not move Linky's
  Lightning address (§7).

## Implementation notes (2026-10-14)

Open manual checks, which code cannot settle:

- **1.2 Which seed Linky's web app holds** for a SLIP-39 master-key account
  (`resolveLinkshuSeed`). Not yet confirmed on a real account.
- **1.6 Real sync between Evolu 7 and 8**: move a master key from a Linky
  account with Cashu history into a dev build, enable Cashu, and compare the
  balance per mint on the debug console's development card. Hydration time
  and shard count not yet recorded.
- **1.7 First write seen in Linky**: the debug console's "Write a test
  setting for Linky" button writes `setting/paykyWriteCheck`; check it in
  Linky's synced store, then remove the button.
- **2.4 Restore time on a long-used wallet**: not measured.
- **3.6 Wallets reading `bitcoin:?lightning=…&creq=…`** (Phoenix, Wallet of
  Satoshi, Breez, Zeus, Blink, Muun): not tried; no bare-bolt11 switch added.
- **4.6 Linky as the payer** (bare token), and a mint down then up: not tried
  by hand; covered by unit tests with the fake mint.

Deviations from the plan, each small:

- Linky's owners sync only while the Cashu account is enabled (§2 said "when
  the app Evolu starts"): otherwise every Payky account would contact
  Linky's relays, which landing/0009 rules out.
- The pointer row is created by the first rotation, as Linky does; a first
  write into shard 0 writes no pointer.
- The device keeps seen and added mints in one table (`cashuKnownMint`).
- `prepareCashuPaymentMethod` is its own Task next to `preparePaymentMethod`.
- Settlement polls on Linky's schedule; there is no NUT-17 subscription yet.
- A Cashu withdrawal withdraws all only to a Lightning address
  (`withdraw/0014`); an invoice without an amount is refused. It has its own
  pages under the Cashu account (new, history, detail) rather
  than the Spark ones; they share the destination, amount and options fields
  and the withdrawal history and detail with Spark.
- A token from an unreachable mint that no payment holds is booked at face
  value instead of waiting for its fee.
- The `MintRejected`-after-exhausted-collisions proposal for Linky (§3) is not
  filed as an issue yet.
