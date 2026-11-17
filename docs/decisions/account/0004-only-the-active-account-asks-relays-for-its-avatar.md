# 0004 Only the active account asks relays for its avatar

Status: superseded by account/0011
Date: 2026-10-08

## Context

Settings → Accounts lists every account on the device, and each has a
Nostr profile whose picture would make the list easier to tell apart. The
accounts are separate identities, often separate businesses. A list that
fetched every profile at once would show a relay one IP address asking for
several pubkeys together, which links accounts that otherwise never meet:
outside this list, Payky only ever talks to relays as the active account.

## Decision

Only the active account's profile is fetched. Whenever it loads, or a
profile save replaces it, its picture is stored on the device account row
(`nostrPicture`), and the list shows the other accounts with the picture
they last had while active. A `data:` picture, a non-https one or one longer
than 2048 characters is not stored, so the device database does not grow by
whole images; such an account shows its initial, as does one whose image
fails to load.

## Alternatives considered

- Fetching every account's profile while the list is open: always current,
  but links the accounts at the relays, makes a request per account that may
  wait seconds for each, and shows nothing offline.

## Consequences

- An inactive account's avatar is as old as its last active session.
- Image hosts still see the device's IP address when a stored picture
  loads, as they do for the active account's profile card.

## Enforced by

- `packages/core/src/evolu/device-account.test.ts > storableNostrPicture > keeps an https picture and drops data, http and overlong ones`

That inactive accounts are never fetched is structural rather than tested:
the list reads them from the device database only, and the one relay read,
`useActiveNostrProfile`, takes no pubkey but the active account's.
