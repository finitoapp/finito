# 0005 The debug console sends its visible log to the support chat

Status: accepted
Date: 2026-11-24

## Context

When something goes wrong at a merchant's, support asks what the app logged.
The debug console can copy and export its log (settings/0006), but the
merchant then has to get the text or the file to support some other way. The
support chat (support/0001) already reaches the team from the app. It sends
text only: a NIP-17 message is a rumor sealed with NIP-44 inside a gift wrap
encrypted with NIP-44 again. Each layer is padded and base64-encoded, so the
wrap comes out at about two and a half times the text, and relays refuse
large events: strfry, the relay the support relays run, refuses events
over 64 KiB. The console holds up to a thousand entries, far more than one
message can carry.

## Decision

The debug console has a "Send to support" button. It sends the entries the
console shows, after the filters and as frozen while paused, as one message
in the support chat, exactly as the chat sends one: the same team, subject
and trailer. The message is added to the chat's conversation, so it is
there when the chat opens. Before sending, a confirmation says what is sent.
The send needs the `settings` permission, which the chat's own screen asks
for, besides the console's `admin`.

The log is redacted as a copied or exported one is (settings/0006). It opens
with a line naming how many entries it holds, followed by the header copy and
export use, without the export time and the entry count. A log longer than
`SUPPORT_MESSAGE_MAX_BYTES` (20 kB of UTF-8) keeps its newest entries that
fit and says it was shortened to the newest so many of how many. When not
even the newest entry fits, that entry is cut to fit. 20 kB of log text heavy
with quotes, newlines and accented letters, sent to ten support members,
makes gift wraps of about 55 kB, so the message stays under 64 KiB with
room to spare; 24 kB already does not.

When the team cannot be loaded or no relay accepted the message for support,
the console says the log could not be sent.

## Alternatives considered

Sending the whole buffer, as export does, which was rejected: it does not fit
in one message, and the filters are how the merchant picks what matters.

Splitting a long log over several messages, which was rejected: it floods
the conversation for support, and a part lost on the way leaves a gap
nobody notices.

Uploading the exported file and sending a link, which was rejected: Payky
has no storage of its own for it, and a link outlives the conversation.

## Consequences

Support gets at most the newest 20 kB of what the merchant filtered; for
more, the merchant still exports the file. Like every message to support,
the send makes sure support can reply (support/0004). Once sent, the log is
in support's copies of the conversation like any other message.

## Enforced by

- `packages/app-shared/src/console-history.test.ts > formatConsoleLogExcerpt > keeps the newest entries that fit in the byte budget, oldest first`
- `packages/app-shared/src/console-history.test.ts > formatConsoleLogExcerpt > cuts the newest entry to fit when not even it fits, redacted`
- `packages/app-shared/src/console-history.test.ts > formatConsoleLogExcerpt > leaves room in a support message for the intro`
- `packages/core/src/integrations/nostr/nostr-support-chat.test.ts > support chat > wraps a message of the longest text within a relay's 64 KiB event limit`
- `apps/web-app/e2e/settings-debug-console.spec.ts > sending the log to support says so when the support team cannot be loaded`
