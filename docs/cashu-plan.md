# Cashu payments — implementation plan

Status: draft 2026-10-14, for the owner's approval. Implements `cashu.md`
(the specification); section numbers `§N` refer to it. Where this plan and
the specification disagree, the specification wins and this plan is fixed.

## How to work through this plan

- One branch per phase (`feat/cashu-1-identity`, …), merged to `main` when the
  phase's exit criteria hold. Every step below is one commit (or a few), each
  passing `bun run check`.
- Everything ships dark until phase 3 ends: no route, tab or settings row is
  reachable before the Cashu account can be enabled. Phases 1–2 add code and
  tests only, plus the read-only sync of phase 1 behind a dev-only debug view.
- Each phase writes its decision records (`docs/decisions/cashu/`, `withdraw/`,
  `access/`) together with the code and tests that enforce them, so
  `check:decisions` holds at every merge.
- Linky (`../linky`) is the reference. Before each phase, re-read the Linky
  files that phase names; if Linky moved, update `cashu.md` first.
- Cross-app tests follow `key-derivation-cross-app.test.ts`: a fixed vector
  table copied byte for byte into both repos, each side asserting it. Payky
  never imports Linky code. Each new cross-app test gets its Linky twin in a
  Linky PR in the same phase.
- Stop rules: phase 1 can stop the project (Evolu 7↔8). Any other phase that
  hits a blocker returns to the owner with a proposed change to `cashu.md`
  instead of improvising.

## Target file layout

New files (existing ones changed are listed per step):

| Path | Holds |
| --- | --- |
| `packages/core/src/modules/cashu/cashu-types.ts` | Branded ids (`CashuProofId`, `CashuOperationId`, `ShardPointerId`, `LinkySettingId`), `MintUrl`, proof states, operation kinds and statuses, `KeysetId`, token/bolt11 text brands |
| `packages/core/src/modules/cashu/cashu.ts` | Linky's four tables (`shardPointer`, `setting`, `cashuProof`, `cashuOperation`) copied 1:1, their indexes, row types |
| `packages/core/src/modules/cashu/cashu-utils.ts` | `normalizeMintUrl`, `cashuProofIdFor`, `cashuOperationIdFor`, `operationKeyOf`, proof merge (`mergeProofCopies`), operation merge |
| `packages/core/src/modules/cashu/cashu-queries.ts` | Every query over the four tables, each filtered by owner ids |
| `packages/core/src/modules/cashu/cashu-cross-app.test.ts` | Vectors shared with Linky: ids, mint URLs, row decoding, NUT-18 and BIP-321 encodings |
| `packages/core/src/modules/cashu/cashu-table-isolation.test.ts` | Source scan: the four table names appear only in allowed files (§2) |
| `packages/core/src/cashu/cashu-shard-store.ts` | Owners, pointer, rotation, copy-on-write, merge, hold-until-hydrated; the only writer of Linky's tables |
| `packages/core/src/cashu/linky-owners.ts` | Deriving the Linky app owner and the shard owners, building their transports, `useOwner` registration |
| `packages/core/src/cashu/cashu-wallet.ts` | `CashuWalletDep` over cashu-ts: wallet per `mint|unit`, foreign-keyset check, NUT-07, fees |
| `packages/core/src/cashu/cashu-counters.ts` | Counter reservation (blocks of 64, never backwards, slot 0 unused), restore-on-first-use, collision recovery |
| `packages/core/src/cashu/cashu-restore.ts` | Linky's NUT-09 restore algorithm |
| `packages/core/src/cashu/cashu-topup.ts` | Quote creation, claim, someone-else-first detection, reclaim |
| `packages/core/src/cashu/cashu-receive.ts` | Linky's 10-step token receive |
| `packages/core/src/cashu/cashu-melt.ts` | Melt (withdraw) and its resume |
| `packages/core/src/cashu/cashu-autoswap.ts` | Move funds between mints and its resume |
| `packages/core/src/cashu/cashu-payment-request.ts` | NUT-18 `creqA…` encoding and the BIP-321 builder/parser |
| `packages/core/src/cashu/fake-cashu-mint.ts` | In-memory NUT-04/05/07/09/13/17/20 mint for unit tests, the demo and e2e |
| `packages/core/src/evolu/device-cashu.ts` | Device-database writes: counters, attempt records, seen/added mints |
| `packages/core/src/integrations/nostr/nostr-cashu-inbox.ts` | NIP-17 subscription filtered to 1:1 rooms carrying a Cashu payment |
| `packages/core/src/background-jobs/jobs/cashu-account-sync-job.ts` | Lightning settlement, token listener, booking cursor, pending-operation resume |
| `apps/web-app/src/features/payment-wait/payment-wait-cashu-tab.tsx` | The BIP-321 QR and the token states |
| `apps/web-app/src/features/settings/cashu/…` | Cashu account detail, mints list, mint detail, add mint, move funds |
| `docs/decisions/cashu/0001…` | The records listed in §9 |

## Phase 1 — Identity and sync

Goal: Payky sees Linky's Cashu shards and balance for a master key moved from
Linky, then writes one row Linky reads. Proves Evolu 7.4.1 ↔ 8.19.0.

### 1.1 Derivations

- `packages/core/src/modules/shared/key-derivation.ts`:
  - rename `defaultCashuDerivationPath` to `cashuWalletSeedDerivationPath`
    (`m/83696968'/39'/0'/24'/0'`);
  - add `linkyAppOwnerDerivationPath` (`m/83696968'/39'/0'/24'/1'/0'`);
  - `deriveLinkyAppOwnerSecret(masterKey): OwnerSecret` — first 16 bytes →
    12-word BIP-39 → `mnemonicToOwnerSecret` (as Linky);
  - `deriveCashuWalletSeed(masterKey): CashuWalletSeed` — 32 bytes → 24-word
    BIP-39 → `mnemonicToSeed(mnemonic, "")`, a branded 64-byte value.
- `key-derivation-cross-app.test.ts`: bind `sharedCashuWallet` and
  `linkyMetaOwner` to the new functions (owner id and seed equal Linky's
  `crossAppDerivation.test.ts`).
- `README.md`: derivation table, drop "reserved, unused".
- Linky PR: fix its reference to the Payky test file name.

### 1.2 Confirm the seed on a real account (manual, blocking)

- In Linky's web app, with a SLIP-39 master-key account, check what
  `resolveLinkshuSeed` (`apps/web-app/src/platform/linkshu/resolveLinkshuSeed.ts`) returns and compare it with
  `deriveCashuWalletSeed`. Write the result into `cashu.md` §Background.
- If it is not the derived seed: stop and return to the owner (decision 9
  rests on it).

### 1.3 Linky's tables and types

- `packages/core/src/modules/cashu/cashu-types.ts` and `cashu.ts`: copy column names and
  types from `../linky/packages/linksync/src/model/schema.ts`. Use the existing
  `id(...)`/`standardSchemaToZod` id pattern; brands encode Linky's decode
  rules (token text starts with `cashu`, bolt11 with `ln`, keyset id even-length
  hex, amounts positive).
- Register the four tables in `packages/core/src/evolu/schema.ts`. Indexes:
  `cashuProof(mint, state)`, `cashuOperation(kind, status, createdAtSec)`,
  `cashuOperation(quoteId)`.
- `cashu-utils.ts`: `normalizeMintUrl` (Linky's `parseMintUrl` +
  `normalizeMintUrl`: no trailing slash, no search/hash, minibits → `/Bitcoin`),
  `operationKeyOf`, `cashuProofIdFor`, `cashuOperationIdFor` (via
  `createIdFromString`).
- `cashu-cross-app.test.ts`: vectors for ids, operation keys, and mint URL
  normalisation. Linky PR adds the twin.
- `cashu-table-isolation.test.ts`: fails when `"cashuProof"`,
  `"cashuOperation"`, `"shardPointer"` or `"setting"` (as a table name) appear
  outside `packages/core/src/modules/cashu/`, `packages/core/src/cashu/cashu-shard-store.ts` and
  `packages/core/src/evolu/schema.ts`.
- `docs/glossary.md`: `setting` versus `appSettings`, Linky owner, proof, mint.

### 1.4 Extra owners in the app Evolu

- `packages/core/src/cashu/linky-owners.ts`:
  - `deriveLinkyAppOwner(masterKey)` (`createAppOwner`) and
    `deriveCashuShardOwner(linkyAppOwner, index)` (`deriveShardOwner(…,
    ["cashu", index])`);
  - transports per owner via `createOwnerWebSocketTransport` over Linky's
    relays: fetch `https://linky.fit/recommended-relays` (zod-validated through
    `fetchAndValidateJson`, new `packages/core/src/integrations/linky/` client), fallback
    `wss://evolu.eu.freedomrelay.dev`, `wss://evolu.linky.fit`.
- `apps/web-app/src/atoms/evolu.ts`: next to `useOwner(evolu.appOwner, …)`, register the
  Linky app owner and shards `0..active` for a non-demo account with a master
  key; release on account switch (same `unuse` lifecycle).
- Env: the relay-list URL and fallbacks in `apps/web-app/src/core/app-env.ts`
  (`VITE_LINKY_RELAYS_URL`), per the env rule.
- Test (`packages/core/src/evolu/…` with `createEvoluTest`): owners registered and
  released; demo account registers none.

### 1.5 Shard store, read-only

- `cashu-shard-store.ts`:
  - read `shardPointer/cashu` under the Linky app owner only, not deleted;
    missing → 0;
  - `activeIndex = max(pointer, pendingLocalRotation)`, dropping the pending
    value once observed;
  - `repairPointers` after hydration: probe `active+1…`, move up while a
    higher shard has any row (tombstones included), never down;
  - keep `useOwner` registrations in step with `0..active`;
  - hydration signal (`isHydrated`) for hold-until-hydrated;
  - read merge: `mergeProofCopies` (highest shard wins, any `spent` copy wins,
    spent kept even when soft-deleted) and the plain operation merge.
- `cashu-queries.ts`: proofs and operations across shard owners, filtered by
  owner ids; `cashuBalanceByMintQuery` (sum of merged `available` proofs).
- Tests: merge rules with crafted multi-shard rows; pointer repair; a pointer
  written "by Linky" mid-run is tolerated.
- Dev-only debug view (behind `import.meta.env.DEV`, not a `_terminal` route in
  production) showing the shard index, hydration and balance per mint.

### 1.6 Real-sync check (manual, blocking)

- Move a master key from a Linky account with Cashu history into Payky (dev
  build). The debug view must show Linky's balance per mint exactly.
- Record the hydration time and shard count in `cashu.md`.
- If sync fails between Evolu 7 and 8: stop and report (risk "Evolu 7 vs 8").

### 1.7 First write

- Shard store write path: writes always carry `MutationOptions.owner` of
  the active shard (or the Linky app owner for `meta`); update of a row in an
  older shard copies full row + patch into the active shard and tombstones the
  old copy; optional columns left out (`removeUndefinedValues`); `error`
  truncated to 1000; inserts are upserts by id across visible shards.
- Rotation: after 256 KiB value bytes or 170 distinct timestamps in the active
  shard owner's `evolu_history`, at most once per 60 s (pointer `rotatedAtMs`
  and local time); creates the pointer row when missing (decision 8).
- Hold writes until hydrated.
- `evolu-history-shape.test.ts` (beside `evolu-backdate-patch.test.ts`): fails
  when `evolu_history`'s columns or the binary encoding of `ownerId`/`id` change.
- Tests: the owner of every write; never Payky's own owner; rotation
  thresholds and cooldown; copy-on-write.
- Cross-app row-decoding vectors: rows Payky writes (proof, topup, receive,
  pointer, setting) serialised and decoded by Linky's codecs in Linky's twin.
- Manual: a dev button writes a dummy `setting` row (a throwaway key); it
  appears in Linky's synced store. Then remove the button.

Exit: 1.2 and 1.6 confirmed in `cashu.md`; first write seen in Linky; all
cross-app twins merged in Linky.

Decision record: `cashu/0001` the shared Linky wallet, its format and trust
(decisions 1, 1b, 2, 8, 9). Enforced by the cross-app and isolation tests.

## Phase 2 — Wallet core

Goal: a tested `CashuWalletDep` that can mint, swap, restore and check
state against a fake mint and against `testnut.cashu.space`.

### 2.1 Dependency and fake mint

- `bun add @cashu/cashu-ts@4.5.1` (exact; match Linky's `bun.lock`).
- `fake-cashu-mint.ts`: in-memory mint implementing the HTTP surface cashu-ts
  calls (keysets, keys, info, mint quote/mint, swap, check state, restore, melt
  quote/melt) with real blind signatures, configurable input fee, NUT-07/20
  support flags, and failure injection (unreachable, 11001/11003/11004/11005/
  11008, lost response). Served through an injected `fetch` (`FetchDep`).

### 2.2 `CashuWalletDep`

- Shape of `SparkWalletDep`: `create(mintUrl)` → a disposable wallet over
  `new Wallet(new Mint(url), { unit: "sat", bip39seed })` with `loadMint`,
  cached per `mint|unit`.
- Foreign keysets: on every load, reject a mint listing a keyset whose oldest
  stored proof is at another mint (`MintRejected`).
- NUT-02 input fee helper; NUT-07 `checkProofStates` wrapper that marks
  `spent` only on a definitive answer or 11001.
- Errors via `defineError`: `MintUnreachable`, `MintRejected`, `TokenLocked`,
  `AmountConsumedByFee`, `ProofsSpent`, `CounterLockTimeout`, `QuoteExpired`.
- Wire into `apps/web-app/src/hooks/use-app-run.ts` deps and the CLI deps.

### 2.3 Counters

- Device schema (`packages/core/src/evolu/device-client.ts`): `cashuCounter` (scope
  `mint|unit|keysetId` → next slot), `cashuClaimAttempt` (operation id →
  counter this device reserved), `cashuSeenMint`, `cashuAddedMint`.
- `packages/core/src/evolu/device-cashu.ts`: synchronous write functions
  (`reserveCashuCounterBlock`, `advanceCashuCounter`, `recordCashuClaimAttempt`,
  `markCashuMintSeen`, `addCashuMint`, `removeCashuMint`).
- `cashu-counters.ts`: reserve 64 slots under `lockManager` per counter scope;
  never backwards; slot 0 unused; resuming an operation advances past its
  block.
- Tests: monotonicity, concurrent reservations serialised, resume advance.

### 2.4 Restore on first use

- `cashu-restore.ts`: port Linky's restore (`linkshu/docs/restore.md`):
  batches, stop after the empty-batch rule, NUT-07 the found proofs, store
  unspent as `available`.
- Counters: when this device has no counter for a scope, run restore first
  and set the counter past the last signed slot.
- Measure on a long-used Linky wallet (manual): record duration in `cashu.md`.
  If minutes are unacceptable, propose the galloping search to the owner — do
  not implement it unasked.

### 2.5 Collision recovery

- Port `collisionRecovery.ts`: 11003/11005/11008 → restore a 100-slot window,
  jump to last signed + 1; 11004/ambiguous → jump 64; up to 5 attempts,
  re-checking the quote before each; keep the advance on exhaustion.
- A collision on the operation's own synced counter returns
  `ClaimedElsewhere` instead (used by phase 3).
- Tests against the fake mint with a pre-advanced "Linky" counter.

### 2.6 Known mints

- `knownCashuMintsQuery`: union of mints named by proofs (any state),
  operations (`mint`, `sourceMint`) and the device's seen/added sets.

### 2.7 Live check

- One opt-in test (`describe.skipIf(!env.CASHU_LIVE)`) against
  `testnut.cashu.space`: quote → mint → swap → state check → restore.

Exit: unit tests green against the fake mint; live run recorded; restore time
measured.

## Phase 3 — Lightning receive

Goal: a merchant enables Cashu, a customer pays the mint's invoice, the
payment settles into Payky's books. First user-visible phase.

### 3.1 Account

- `account-types.ts`: `"cashu"` in `AccountKindSchema`.
- `account.ts`: `accountCashu` table (no secret column).
- `account-utils.ts`: `createCashuAccountId(linkyAppOwnerId)` →
  `account:cashu:<id>`.
- `account-actions.ts`: `deriveAccountKind`, `deriveNewAccountId`,
  `createAccount`, `updateAccount`'s per-kind detail, `saveCashuAccount`
  (sibling of `saveSparkAccount`). Enabling writes `defaultMint`
  (`MAIN_MINT_URL`, `https://cashu.cz`) through the shard store when no row
  exists (`seedOnboardingDefaultMint`).
- Default mint read: `cashuDefaultMintQuery` over `setting/defaultMint` under
  the Linky app owner, decoded with Linky's codec, fallback `https://cashu.cz`.
- `apps/cli/src/cli-accounts.ts`: list/show the kind.

### 3.2 Union and lookup tables (§8)

Work through §8 in one commit per area, letting `tsc` find the gaps:
`DefaultPaymentMethodSchema`, `PaymentMethodTab`, `PaymentMethodOption`,
`preparingPaymentMethodKeys`, `payment-wait-method-tabs.tsx`, settings
row-state table, `payment-method-display.tsx`, stats `methodColors` (new
`--chart-6` token in `apps/web-app/src/index.css`, light and dark), `kindKeys` in
`spark-transactions-page.tsx` (check by hand, it is `Partial`),
`onboardingPaymentMethodOrder` (leave Cashu unlisted: onboarding unchanged),
`apps/cli/src/cli-payments.ts`, `apps/cli/src/cli-account-transfers.ts`, i18n in
`en`/`cs`/`sk` (`payment.ts`, `settings.ts` groups).

### 3.3 `paymentCashu`

- `payment.ts`: table per §4 (`accountId`, `amountSats`, `exchangeRate`,
  `exchangeRateSource`, `exchangeRateFetchedAt`, `mintUrl`, `quoteId`,
  `lnInvoice`, `quoteExpiresAt`, `receiveOperationId?`), indexes on `quoteId`
  and `receiveOperationId`. Register in `schema.ts`.
- `paymentRequestQuery` and the payment detail and stats readers also read
  `paymentCashu` sats/invoice (§8).

### 3.4 `prepareCashuMethod`

- `payment-preparation-actions.ts`: new branch in `preparePaymentMethod`,
  steps 1–5 of §4: refuse zero, convert via Yadio, create the quote
  (`createLockedMintQuote` with the nostr key when NUT-20, else
  `createMintQuoteBolt11`), write the pending `topup` through the shard store
  (all fields from `topupRecords.ts`, `keysetId` set, `counter` unset), write
  `paymentCashu`, write `payment.expiresAt` under `hasNonExpiringMethod`.
- Fold the Payky-side writes into one `runMutationWithCompletion` batch where
  owners allow (the topup goes to a shard owner, so it is its own batch, written
  first).
- Tests: fake mint with and without NUT-20; Spark + Cashu on one payment keeps
  Spark's rows untouched; topup row decodes with the cross-app vectors.

### 3.5 BIP-321 QR (Lightning leg)

- `cashu-payment-request.ts`: `buildBip321PaymentUri({ lightning, creq? })`
  and `pickBip321PayableLeg`, matching Linky's `bip321.ts`; cross-app vectors.
- In this phase the QR carries only `lightning`.

### 3.6 Wait-screen tab

- `payment-wait-cashu-tab.tsx`: QR (reuse `payment-wait-qr-request.tsx`),
  quote-expired state from `paymentCashu.quoteExpiresAt` with "new quote".
- `payment-wait-page.tsx`: options list, `activePaymentMethodIsPrepared`,
  `prepare` mapping, `onValueChange` guard.
- Manual: scan the `bitcoin:?lightning=…` QR (no on-chain address) with
  Phoenix, Wallet of Satoshi, Breez, Zeus, Blink and Muun. If any of them
  cannot pay it, add the bare-bolt11 switch (§4).

### 3.7 `cashu-account-sync` job

- `cashu-account-sync-job.ts`, in its own group `cashuBackgroundJobs`
  (not the CLI list).
- Lightning settlement (§5): per pending `topup` of an open payment, NUT-17
  subscription raced with Linky's poll schedule; claim steps 1–6; reclaim
  through NUT-09 when Payky's own attempt lost its response.
- Someone-else-first (decision 11): `done`, foreign `counter`, `ISSUED`
  without own attempt, own counter already signed → write nothing, wait for
  the winner; after the grace period (5 minutes, tunable), reclaim from the
  synced counter.
- Close `failed` only on `UNPAID` past expiry.
- Resume Payky's own pending topups on start (melts and autoswaps join in
  phases 5–6).
- Tests: every someone-else-first branch writes nothing and never `failed`.

### 3.8 Into the books

- `account-transaction.ts`: kind `cashu`, `accountTransactionCashu` detail
  (`cashuOperationId`, indexed); `deriveAccountTransactionId`/`Kind`; id
  prefix in `account-transaction-utils.ts` (not in
  `manualPaymentTransactionIdPrefixes`).
- Local-only `_cashuBookingCursor` table in `schema.ts`.
- Booking (§5 "Into Payky's books"): bootstrap (wait hydrated → `max(rowid)`
  → book last month's `done` incoming without detail row → store cursor);
  incremental over `evolu_history` rowids for `cashuOperation.status` under
  shard owners; write only what is missing; advance cursor after the batch.
- Automatic claim in the same batch: by `quoteId` or `receiveOperationId`
  (+ mint equality), never by amount; extend
  `loadAutomaticReconciliationClaimForNewAccountTransaction` and
  `reconcileAccountTransaction`.
- Triggers: start, `subscribeQuery` over operations, fallback interval.
- Tests: cursor survives offline-device arrivals with old timestamps; no
  re-upsert of booked operations (count mutations); Linky-performed topup is
  booked and claimed; an unclaimed one reaches no stats/EET.

### 3.9 Settings and access

- Settings detail route for the Cashu account next to Spark's (thin route,
  `*Page` in `apps/web-app/src/features/settings/cashu/`), `staticData.access`.
- Access: new permissions per §8 in `packages/core/src/modules/access`; new record
  `access/0009` superseding the map in `access/0008`.
- Demo: demo-data generator uses the fake Cashu wallet; a demo account gets
  the fake mint at runtime too (no Linky owners).
- E2E (`apps/web-app/e2e/cashu.spec.ts`, read `apps/web-app/e2e/AGENTS.md` first): enable Cashu, prepare
  a payment against the fake mint, simulate `PAID`, see it settle.

Exit: a real payment at cashu.cz from a Lightning wallet settles; Linky shows
the topup; Payky books it once.

Decision records: `cashu/0002` default mint shared with Linky (5), `cashu/0003`
`paymentCashu` as its own detail (4), `cashu/0004` who settles and stopping
when someone else got there first (11), `cashu/0005` every incoming operation
booked, outgoing only own withdrawals, matching by quote/operation id never by
amount (13, 5d part), `access/0009`.

## Phase 4 — Token receive

Goal: a NUT-18 wallet (Linky and one other) pays by token over NIP-17.

### 4.1 NUT-18 request

- `cashu-payment-request.ts`: `encodeNostrPaymentRequest` byte-identical to
  Linky's (`a`, `u: "sat"`, `s: true`, `m` = payment mint, one nostr transport
  to Payky's nprofile tagged `["n","17"]` with listening relays, `i` payment
  id, `d` description when present). Cross-app vectors.
- The tab's QR gains `creq`; rebuilt from `paymentCashu`, not stored.

### 4.2 NIP-17 inbox

- `nostr-cashu-inbox.ts` over `nostr-client.ts`: subscribe gift wraps for the
  nostr key, look-back window (tunable, 7 days to start, never under 2), unwrap, keep
  only 1:1 rooms (sender + Payky) with kind 14 content that is a NUT-18 payload
  `{id, memo, mint, unit, proofs}` or a bare `cashuA…`/`cashuB…` token.
  Everything else is dropped without logging.
- Tests: support rooms and chat text are ignored; the support chat still
  ignores 1:1 rooms (`nostr-support-chat.test.ts` stays green).

### 4.3 Matching and the receive id

- Match rules of §5 (id → open payment with Cashu request and same mint; bare
  token → exactly one open payment at that mint with equal face amount; else
  unassigned).
- After receive step 1 passes, write `paymentCashu.receiveOperationId =
  cashuOperationIdFor("receive|" + text)` before any receive.

### 4.4 Receive

- `cashu-receive.ts`: the 10 steps of §5 in Linky's order, NUT-11 signing with
  the nostr key, counter + `keysetId` written before each swap attempt.
- Someone-else-first for tokens; final refusals remembered in memory per run;
  `MintUnreachable` writes nothing (decision 12) and the next tick retries.
- Job: listener runs whenever the Cashu account is enabled; each tick retries
  every token message in the window without a `done`/`failed` receive.

### 4.5 Wait screen states

- Token arrived (amount, mint, input fee) before the swap; waiting for the
  mint; another mint → shown as not counted; failed receive → why.
- Underpayment after fee uses the existing coverage UI.

### 4.6 Tests and manual

- Unit: every match branch, foreign-mint token stays unassigned and never
  claims, payment already paid → unassigned, Linky-received-first settles.
- Manual: Linky as the only reference payer (bare token); mint down then up.
  No other NUT-18 wallet is tested by hand (owner's decision 2026-10-14), so
  the NUT-18 payload form is covered by unit tests only, built with cashu-ts
  the way a NUT-18 wallet sends it.

Decision records: `cashu/0006` one BIP-321 QR with a NUT-18 request over
nostr and matching by id, else mint and amount (3, 3b, 3c), `cashu/0007`
tokens from any mint received, matched only from the payment's mint, never
assigned afterwards (5c), `cashu/0008` no `deferredReceive`, the NIP-17
message is the queue (12), `cashu/0009` the input fee is settled as an
underpayment (5d).

## Phase 5 — Mints screen

- Routes under the Cashu account settings: list, detail, add (thin routes,
  pages in `apps/web-app/src/features/settings/cashu/`), each with `staticData.access`.
- List: known mints with balance and default badge, plus presets
  (`PRODUCTION_MINTS`) fetched via `fetchInfo` without marking seen.
- Add by URL: prefix `https://`, require a dot, normalise, refuse when info or
  keysets fail or a foreign keyset is listed; add to known mints; default
  unchanged.
- Set as default: shard-store write of `setting/defaultMint`, skipped when
  unchanged; the npub.cash warning copy.
- Remove: refused with `MintInUse` while a non-`spent` proof or a pending
  Linky `deferredReceive` names the mint; drops device seen/added only.
- Move funds (`cashu-autoswap.ts`): estimate, amount or sweep (up to 4 smaller
  retries), `autoswap` + `melt` operations, PIN required, job resumes
  interrupted swaps with the someone-else-first rules.
- Tests: add/remove rules, default write idempotent, autoswap resume.
- Decision record: `cashu/0010` mint management and its deliberate differences
  from Linky (5b).

## Phase 6 — Withdraw

- `cashu-melt.ts`: Linky's melt steps 1–6 (§6), NUT-08 blank outputs, resume
  of a pending melt after a lost response (job, start and interval).
- Withdraw module over both kinds:
  - export a kind-dispatching `loadWithdrawAccount` replacing the private
    `loadSparkAccount`; fee quote and execution per kind;
  - schema: a separate detail table `withdrawalLightningCashu` (`id`,
    `mintUrl`, `meltOperationId`, `quoteId`), registered in `schema.ts`;
    `withdrawalLightning.sparkTransferId` stays required and Spark's rows stay
    untouched (owner's decision 2026-10-14);
  - `withdraw-destination-utils.ts` and `withdraw-form-step.tsx`: mint picker
    (default preselected, mints with funds), Lightning invoice and address.
- Balance: `cashuBalanceByMintQuery` (the shared Linky wallet).
- PIN per `access/0007`.
- Tests: paid/unpaid/failed/lost response; withdrawal booked once; resume is
  not a retry.
- Decision records in `withdraw/`: fee reserve is the mint's `feeReserve`; a
  withdrawal may spend money received in Linky; resuming a pending melt is not
  a retry under `withdraw/0007`.

## Phase 7 — Docs and wrap-up

Most docs land with their phase; this phase checks nothing is missing.

- `docs/payment-sync.md`: the Cashu job (settlement, listener, booking cursor).
- `docs/glossary.md`: token, known mint, the payment's mint.
- `docs/decisions/README.md`: add `cashu/` to the domain list.
- Landing "how it works" (`landing-tech-page.tsx`, `landing-tech-diagrams.tsx`,
  `landing.tech.services.*`) and `landing/0009`: mints, Linky's relays, the
  request's nostr relays.
- `AGENTS.md`: `packages/core/src/cashu`, the shard-store isolation rule, the
  `@cashu/cashu-ts` wrapper rule (like Spark's).
- Linky: `AGENTS.md` note naming Payky as a second writer of `meta` and
  `cashu`; the `MintRejected`-after-exhausted-collisions proposal (§3) as an
  issue there.
- `cashu.md` status → implemented.
