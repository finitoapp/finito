# 0020 A payment points to a selection the guest published

Status: accepted
Date: 2026-10-22

## Context

A table's sticker hands its keys to whoever scans it, and a photo of it
works from anywhere, so every guest may be an attacker who tries to forge
a bill, flood a merchant device or take credit for someone else's payment
(docs/table-self-pay-design.md, "The problem"). The merchant device is a
phone or a PWA that loses Wi-Fi and is off at night, and there is no Payky
server. A payment must still say which lines it pays, and an order must
carry its items and a note for the kitchen, while QR Platba allows 60
characters of message and Spark 120 bytes of Lightning description.

## Decision

No merchant device answers a guest. The guest page reads the table's view
from relays, publishes what the guest pays for, and pays, and a merchant
device reads a guest's event only for money that names it. On Lightning the
page mints the invoice on Spark for the merchant's identity
(`spark-guest-invoice.ts`), which is part of paying, not a message to the
merchant device.

Before it shows how to pay, the guest page publishes the selection to the
relays the sticker names, and the payment carries a pointer to it.

The pointer:
- It is the first 160 bits of SHA-256 over the selection, written as 32
  base32 characters (`deriveSelfPayPointer`).
- The selection includes 16 random bytes, so two guests with the same split
  hold different pointers.
- The bank message is `PK1` and the pointer with no space, 35 characters, one
  line of a Czech interbank message. The Lightning description carries the
  same pointer after the bill's reference.

The event:
- It is a kind 30078 event signed by a key derived from the pointer and from
  the account's selection key, which every table's view carries.
- Its content is encrypted under another key derived from both
  (`deriveSelfPayPointerKeys`).
- A bank or Lightning operator that sees the pointer can therefore neither
  find the event nor read it.

The guest page shows the payment on the first relay that accepts the event
(`publishSelfPaySelection`).

A merchant device asks relays only for the event of a pointer that arrived
with money (`lookUpSelfPaySelection`). It uses a selection only when the
content hashes to the pointer and names the bill the payment's reference
names. Lines are priced against the stored view version the selection
names.

When a device does not find the selection, it keeps asking for 10 minutes
after it first saw the money. `self-pay-pointer-job.ts` asks again at 1, 3, 6
and 11 minutes. After that the device counts the money toward the bill
without allocation, so a device that found the selection writes its rows
first (`table-self-pay/0005`).

## Alternatives considered

- The share in the payment itself, as one number against the view the guest
  saw. In 56 characters it names a share of each line only on bills of up
  to about 60 lines, and it carries no order or note.
- The nostr event id in the payment. It takes 52 of the 56 characters a
  message leaves, and banks that shorten messages cut it.
- A short tag and a query by tag. Anyone who sees the event can bury it
  under the same tag, and relays return a limited page newest first.
- Guests joining the table's Evolu owner. Evolu 8.19 never syncs a
  read-only owner (`@evolu/common` `Protocol.js:762`), so guests would need
  the write key, and any guest could overwrite the view for every other
  guest. A fresh guest downloads about 1.1 KB per rewrite ever made, and
  Evolu adds 602 KB brotli to a 213 KB page.
- Nostr RPC to the merchant device (kind 23195, NIP-04), as Finito did.
  Public relays banned that traffic over time, and it needs a merchant
  device online.
- The merchant device serving guests: an encrypted request, a signed reply,
  a short reference. A merchant device must be online, and every sticker
  holder can flood requests.
- A blind proxy mailbox. It is a service to run and keep online, and it
  needs per-source ceilings and proof of work to survive floods.
- WebRTC between guest and merchant device. About 30 % of hole punches fail
  without a relay ([arxiv 2510.27500](https://arxiv.org/abs/2510.27500)),
  iOS suspends the page when the guest switches to the bank app, guest
  Wi-Fi often isolates clients, and signaling still needs a public meeting
  point.
- Keys derived from the pointer alone. A bank or Lightning operator that
  sees the message could fetch the selection and read what the guest ordered.
- 20 characters (100 bits). That is safe against reading, but two
  selections under one pointer cost only about 2^50 hashes.
  `table-self-pay/0005` makes such a collision harmless, and the owner still chose the margin of a full hash.

## Consequences

- Guests write one event per payment.
- When no relay accepts it within 5 seconds, a bill share can still be paid,
  and it counts toward the bill without marking lines.
- A pointer cut short counts at once without allocation. A pointer changed
  or lost counts without allocation after 10 minutes.
- Lines are not limited by the payment.
- Lightning needs a rate the merchant signed in advance
  (`table-self-pay/0006`).

Revisit when the default relays refuse kind 30078 events from guests' fresh
keys.

## Enforced by

- `packages/core/src/modules/table-self-pay/table-self-pay-pointer-utils.test.ts > self-pay pointer > names a selection of any size in 32 characters and a 35-character message`
- `packages/core/src/modules/table-self-pay/table-self-pay-pointer-utils.test.ts > self-pay pointer > gives two guests who pick the same share different pointers`
- `packages/core/src/modules/table-self-pay/table-self-pay-pointer-utils.test.ts > self-pay pointer > ignores a different selection published under the pointer after paying`
- `packages/core/src/modules/table-self-pay/table-self-pay-pointer-utils.test.ts > self-pay pointer > is found only under its own key, however many events others publish`
- `packages/core/src/modules/table-self-pay/table-self-pay-pointer-utils.test.ts > self-pay pointer > tells a relay nothing about the table, the bill or the amounts`
- `packages/core/src/modules/table-self-pay/table-self-pay-pointer-utils.test.ts > self-pay pointer > cannot be found or read from the pointer alone, as a bank sees it`
- `packages/core/src/modules/table-self-pay/table-self-pay-reference-utils.test.ts > bank message > is PK1 and the pointer in 35 characters, one line of a Czech interbank message`
- `packages/core/src/modules/table-self-pay/table-self-pay-allocation.test.ts > self-pay allocation > marks the lines the payment's pointer names as paid`
- `packages/core/src/modules/table-self-pay/table-self-pay-allocation.test.ts > self-pay allocation > counts a cut pointer toward the bill at once without allocation`
- `packages/core/src/modules/table-self-pay/table-self-pay-allocation.test.ts > self-pay allocation > counts an edited pointer toward the bill without allocation once 10 minutes passed`
- `packages/core/src/modules/table-self-pay/table-self-pay-allocation.test.ts > looking up the selection a payment points to > credits money whose selection no relay returns without allocation once 10 minutes passed`
- `packages/core/src/modules/table-self-pay/table-self-pay-allocation.test.ts > looking up the selection a payment points to > marks the lines paid when a relay returns the selection on a later try`
- `packages/core/src/modules/table-self-pay/table-self-pay-allocation.test.ts > looking up the selection a payment points to > keeps the lines a device that found the selection recorded, when another device could not look it up`
- `packages/core/src/modules/table-self-pay/table-self-pay-allocation.test.ts > looking up the selection a payment points to > reads no relay for selections nobody paid`
- `packages/core/src/background-jobs/jobs/self-pay-pointer-job.test.ts > nextSelfPayPointerAttemptAt > asks again at 1, 3, 6 and 11 minutes, then every hour`
- `packages/core/src/background-jobs/jobs/self-pay-pointer-job.test.ts > self-pay pointer job > marks the lines paid once the selection reaches a relay after the money`
- `apps/web-app/e2e/table-self-pay.spec.ts > guests pay a fifth of a line at the table while nobody reserves anything`
