# 0014 A seed from another wallet is recognized by its words, not its length

Status: accepted
Date: 2026-11-17

## Context

Restore accepts only the 20-word SLIP-39 recovery phrase (onboarding/0008)
and names a seed from another wallet as such. 0008 recognized one by its
length alone: 12, 15, 18, 21 or 24 words. The form checks as it goes, so a
merchant typing their own phrase word by word was told at the 12th, the
15th and the 18th word that it came from another wallet, and the unknown
word hints went quiet while the warning stood.

More than half the SLIP-39 list is also BIP-39 (553 of 1024 words), so
"every word is BIP-39" says little about a few typed words either. What only
another wallet's seed holds is a word that BIP-39 has, SLIP-39 does not, and
no SLIP-39 word begins with — so it cannot be a SLIP-39 word still being
typed (1359 of BIP-39's 2048).

## Decision

Restore still accepts only the 20-word SLIP-39 phrase, with the reasons of
onboarding/0008 for anything else, but a seed from another wallet is named
only when the words hold at least one such BIP-39-only word and either
their count is a BIP-39 length or every word is BIP-39. A length alone, or
SLIP-39 words that BIP-39 happens to share, never name it.

## Alternatives considered

- Checking the length only once the button is pressed: the merchant who
  pasted a 12-word seed waits for the button to learn why it stays off.
- Leaving the field being typed out of the check: needs the active field in
  every caller, while the prefix rule makes a half-typed word harmless.

## Consequences

A 12-word BIP-39 seed is still named the moment it is pasted: the chance
that none of its words is BIP-39-only is about (689/2048)¹², nil. A SLIP-39
phrase with a mistyped word that happens to be BIP-39-only may be called a
foreign seed while its count sits at a BIP-39 length; the word is wrong
either way.

## Enforced by

- `packages/app-shared/src/restore-words.test.ts > detectForeignSeed > flags a BIP-39 seed of a BIP-39 length`
- `packages/app-shared/src/restore-words.test.ts > detectForeignSeed > flags BIP-39 words that SLIP-39 does not have`
- `packages/app-shared/src/restore-words.test.ts > detectForeignSeed > leaves a SLIP-39 phrase typed word by word alone at every length`
- `packages/app-shared/src/restore-words.test.ts > detectForeignSeed > leaves a word being typed alone while SLIP-39 can still complete it`
- `packages/app-shared/src/restore-phrase.test.ts > checkRestorePhrase > rejects a seed from another wallet`
- `packages/app-shared/src/restore-phrase.test.ts > checkRestorePhrase > rejects a word count other than 20`
- `packages/app-shared/src/restore-phrase.test.ts > checkRestorePhrase > rejects 20 valid words with a bad checksum`
- `packages/app-shared/src/restore-words.test.ts > analyzeRestoreWords > is complete only with 20 known words`
