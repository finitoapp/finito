# 0008 Restore accepts only Payky recovery phrases

Status: superseded by onboarding/0014
Date: 2026-10-25

## Context

Restoring an account (onboarding and Settings → Accounts) took one hidden
textarea and answered every failure with the same sentence. Nothing said which
seed is accepted, so people tried the Spark BIP-39 seed or a Trezor backup and
got "enter a valid SLIP-39 recovery phrase" (issue #164).

## Decision

Restore accepts only the 20-word SLIP-39 recovery phrase Payky shows in
Settings → Security. The screen says so before the first word is typed and
rejects anything else with a reason: a seed from another wallet (12, 15, 18,
21 or 24 words, or BIP-39 words) is named as such, a wrong word count and an
unknown word are named, and 20 known words with a bad checksum say the phrase
does not fit. Words go into 20 numbered fields, hidden until shown, and the
button stays off until all 20 are words from the SLIP-39 list. Seeds from
other wallets are not supported and not planned.

## Alternatives considered

- Accepting a Spark BIP-39 seed or a Trezor backup: they derive different
  keys, so the account they open is not the Payky account.
- One textarea with a single error: leaves the merchant guessing what failed.

## Consequences

The checks live in `restore-words.ts` and `checkRestorePhrase`, shared by web
and native. The phrase only ever lives in component state.

## Enforced by

- `packages/app-shared/src/restore-phrase.test.ts > checkRestorePhrase > rejects a seed from another wallet`
- `packages/app-shared/src/restore-phrase.test.ts > checkRestorePhrase > rejects a word count other than 20`
- `packages/app-shared/src/restore-phrase.test.ts > checkRestorePhrase > rejects 20 valid words with a bad checksum`
- `packages/app-shared/src/restore-words.test.ts > detectForeignSeed > flags BIP-39 word counts`
- `packages/app-shared/src/restore-words.test.ts > analyzeRestoreWords > is complete only with 20 known words`
