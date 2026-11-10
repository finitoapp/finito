# 0004 The assistant is off until the device allows it, with the docs alone or with the merchant's data

Status: accepted
Date: 2026-10-06

## Context

The assistant in the settings (ai/0002) was offered to every merchant and
asked no consent. Whatever it reads, and whatever the merchant asks, leaves
the device through Payky's AI proxy to the provider (ai/0001). The two other
features that send data off the device, error reporting and product lookup,
are off until the merchant turns them on in Settings > About > Data and
privacy, each for the device it is turned on at. Much of what a merchant
asks, how Payky works, needs only Payky's public documentation and code
(ai/0003), not their bills and payments.

## Decision

The device setting `aiAssistantAccess` decides what the assistant may send
off the device, and the privacy settings offer it next to error reporting
and product lookup:

- `off`, the default, also for merchants who used the assistant before: the
  settings do not list the assistant, and its address leads to the privacy
  settings.
- `public`: the assistant reads Payky's documentation and code only. The
  model gets no data tools, and the page suggests questions about how Payky
  works.
- `all`: the assistant also reads the merchant's bills and payments on the
  device through the data tools.

It is a setting of the device, like the other two, not of the account: it
does not sync, and every device asks again.

The conversation lives in a Jotai atom: it outlives leaving the page and
moving around the app, but not a reload, and nothing of it is written to
Evolu. It belongs to the account and the access it was held with, so
switching accounts or changing the access starts afresh: replies about the
merchant's data are not sent again once the device allows less. The model
sees the last twenty messages of it, starting at a question; a question
that failed is left out until it is asked again.

Leaving the page or the stop button stops a reply that is still coming, and
the words that came so far stay, marked as stopped.

A button in the header starts a new conversation: it stops a reply that is
still coming and forgets the conversation.

Replies are plain text: the system prompt asks for it and the page shows
the text as it is, without a Markdown renderer.

The CLI asks for no setting and always has the data tools: it runs on a git
checkout, with the data of the account its recovery phrase opens, or of the
local test owner without one (account/0012).

## Alternatives considered

The assistant for everyone without a consent, which was ai/0002 and is
replaced by this decision: data left the device without the merchant
choosing it.

Two switches, one for the assistant and one for the data, which was
rejected: data without the documentation is no state anyone needs, and one
choice of three cannot express it.

A setting of the account, synced to its devices, which was rejected to keep
it like the other two consents: the choice is about what leaves this device.

Showing the assistant while it is off, with a prompt to allow it, which was
rejected: the assistant stays out of sight until the merchant asks for it.

Keeping the conversation in Evolu, which was rejected for now: it would
sync across the account's devices, but needs a table, its deletion and a
schema change for a prototype.

A Markdown renderer, which was rejected to keep a dependency out; a model
that writes Markdown anyway shows its asterisks.

## Consequences

A merchant finds the assistant only in the privacy settings. In both modes
the question the merchant types and the account's owner id, the proxy's
bearer token (ai/0001), still reach Payky's server and the provider; the
privacy card says that what the merchant asks leaves the device. With
`public`, the assistant cannot answer about the merchant's own bills and
payments and says so. A reload loses the conversation, and another device
of the account never sees it. Each request carries the conversation so far,
so a long one costs more tokens, up to the twenty-message cap.

## Enforced by

- `packages/core/src/ai/assistant-tools.test.ts > createAssistantTools > leaves the data tools out unless the merchant allowed their data`
- `apps/web-app/e2e/settings-assistant.spec.ts > hides the assistant until the device allows it`
- `apps/web-app/e2e/settings-assistant.spec.ts > answers from the documentation alone without the data tools`
- `packages/app-shared/src/assistant-conversation.test.ts > toAssistantMessages > sends the earlier questions and replies, then the new question`
- `packages/app-shared/src/assistant-conversation.test.ts > toAssistantMessages > leaves out a turn that failed or was stopped before any reply`
- `packages/core/src/ai/assistant.test.ts > recentMessages > keeps the last twenty messages, starting at a question`
- `packages/core/src/ai/assistant.test.ts > askAssistant > stops with the reply so far when its run is aborted`
- `apps/web-app/e2e/settings-assistant.spec.ts > asks the assistant and keeps the conversation`
- `apps/web-app/e2e/settings-assistant.spec.ts > retries a question the assistant could not answer`
- `apps/web-app/e2e/settings-assistant.spec.ts > starts a new conversation`
