# 0016 The business's public name is kept in the account and published as the profile

Status: accepted
Date: 2026-11-28

## Context

onboarding/0004 made the account's Nostr profile name the only business
name: onboarding published it, Settings > Profile republished it, and the
bank QR read it back from relays on the payment screen (payment/0005). A
second name in the app was rejected because it could disagree with the
profile customers see.

Reading it back cost more than a slow name. On a PAX A920Pro the payment
screen's first profile read after a start held the JS thread for 7 to 7.6
seconds, nearly all of it checking the relays' event signatures in
JavaScript, while the first charge of a session waited behind it
(2026-11-28). A device that never reached relays, or a new device, had no
name at all, and a name typed in onboarding was dropped when no relay
accepted it. The registered company name a legal entity carries may also
differ from the name customers know the business by.

## Decision

The business's public name is a column of the account's synced
`legalEntity` row, `publicName`, beside its country and VAT status. It is
the source the app reads; the Nostr profile name is its publication.

Onboarding's optional business name and the name in Settings > Profile write
`publicName` first and then publish it as the profile's `name` and
`display_name`, preserving the rest of the profile as onboarding/0004 did.
A name no relay accepts stays stored: onboarding still offers to retry or
continue without publishing, and continuing keeps the name. Clearing the
name in Settings clears `publicName`. Changing the country or VAT status
leaves the name as it is.

Settings > Profile shows when the stored name and the published one differ:
not yet published, or published under another name (Linky, which shares the
profile, can rename it). It offers to publish the stored name and, when the
profile carries one, to keep the published name instead. Nothing republishes
by itself.

While an account has no `publicName`, as one named before this decision,
the first read of its published profile stores the profile's name.

## Alternatives considered

- Keeping the profile on relays as the only source (onboarding/0004): every
  reader waits on relays and on signature checks, and an unpublished name is
  lost.
- A copy on the device account only, as the account list already keeps: it
  is per device, so a new device starts without it.
- Republishing a differing stored name automatically, or adopting a newer
  published one: a device whose sync lags would push its stale name over a
  fresh one in either direction, and a rename in Linky would be undone
  silently. The merchant chooses instead.
- Storing the picture with the name: a data URL is too large for a synced
  row, and no payment needs it. It stays on the profile.

## Consequences

The payment screen and anything else naming the business read the account,
not relays, and a restored or new device has the name once the account
syncs. The name and the profile can disagree until the merchant publishes or
keeps one; the editor says so. `publicName` is not the registered company
name, which can be added beside it later.

## Enforced by

- `packages/core/src/modules/legal-entity/legal-entity-actions.test.ts > legal entity actions > keeps the public name when the country or VAT status changes`
- `packages/core/src/modules/legal-entity/legal-entity-actions.test.ts > legal entity actions > adopts the published name only while none is stored`
- `packages/core/src/modules/app-settings/app-settings-actions.test.ts > finishOnboarding > stores the business name typed beside the country it starts in`
- `packages/core/src/integrations/nostr/nostr-client.test.ts > nostr client > publishing a name preserves the picture and all other profile metadata`
- `packages/core/src/integrations/nostr/nostr-client.test.ts > nostr client > publishing a name refuses an unreadable profile instead of overwriting it`
- `apps/web-app/src/features/settings/profile/profile-settings-page.test.tsx > ProfileSettingsPage > edits the stored public name over the published one and offers either`
- `apps/web-app/src/features/settings/profile/profile-settings-page.test.tsx > ProfileSettingsPage > offers to publish a stored public name the profile does not carry`
- `apps/web-app/src/features/settings/profile/profile-settings-page.test.tsx > ProfileSettingsPage > shows no notice when the profile publishes the stored name`
- `apps/web-app/e2e/onboarding.spec.ts > business name publication during onboarding: success`
- `apps/web-app/e2e/onboarding.spec.ts > business name publication during onboarding: retry`
- `apps/web-app/e2e/onboarding.spec.ts > business name publication during onboarding: skip`
- `apps/web-app/e2e/onboarding.spec.ts > business name publication during onboarding: empty`
