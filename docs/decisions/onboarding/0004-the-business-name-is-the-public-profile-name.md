# 0004 The business name is the public profile name

Status: superseded by onboarding/0016
Date: 2026-10-16

## Context

A merchant's Nostr profile name is already edited in Settings > Profile and
used as the recipient name in bank payment QR codes (payment/0005).
Onboarding should let a merchant introduce their business before accepting
payments, without creating another competing business-name field.

## Decision

The final onboarding screen is Business setup. Above its payment methods it
offers an optional business name, marked as public. The name is the same
Nostr profile name Settings > Profile edits, with the same 255-character
limit and whitespace trimming.

Typing, changing steps and leaving the name blank publish nothing. On final
confirmation, a nonblank name is published as both `name` and `display_name`
using the active account's key. The current profile is read first; its picture
and all other metadata are preserved. An unreadable profile is a failure,
not an empty profile that can safely be overwritten.

A rejected read or publish keeps the form filled in and leaves onboarding
unfinished. The merchant can retry or explicitly continue without publishing
the name. Blank names do not require the profile service and do not erase
an existing name. No background retry is queued after continuing without
publication. Payment-method choices and the finish label remain as in
onboarding/0003, and the recovery phrase stays outside onboarding (0002).

## Alternatives considered

- A second name stored in app settings: it could disagree with the profile
  used elsewhere and shown to customers.
- Publish while typing or on blur: a draft would become public before the
  merchant confirms the form.
- Finish silently after publication fails: it would imply the name was saved.
- Require a name: a merchant should still be able to start without one.

## Consequences

A named business needs working Nostr relays to publish its name. Choosing to
continue without publication or leaving the name blank still lets the
merchant start and set the profile name later. A successful publication is
public even if a subsequent local onboarding write fails.

## Enforced by

- `packages/core/src/integrations/nostr/nostr-client.test.ts > nostr client > publishing a name preserves the picture and all other profile metadata`
- `packages/core/src/integrations/nostr/nostr-client.test.ts > nostr client > publishing a name refuses an unreadable profile instead of overwriting it`
- `packages/core/src/integrations/nostr/nostr-client.test.ts > nostr client > publishing a name reports a rejected publish`
- `apps/web-app/e2e/onboarding.spec.ts > business name publication during onboarding: success`
- `apps/web-app/e2e/onboarding.spec.ts > business name publication during onboarding: retry`
- `apps/web-app/e2e/onboarding.spec.ts > business name publication during onboarding: skip`
- `apps/web-app/e2e/onboarding.spec.ts > business name publication during onboarding: empty`
