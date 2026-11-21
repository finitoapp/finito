# 0016 A Linky contact withdrawal a crash cut off is settled from the wallet

Status: accepted
Date: 2026-11-21

## Context

A withdrawal to a Linky contact (withdraw/0015) is written in steps: the
withdrawal, then the swap that makes the token and the link to its `send`,
then the message, then the booking. Android may kill Finito between any
two. Nothing came back to such a withdrawal: it stayed pending for good,
the sats gone from the wallet's balance and missing from the books.
Finito cannot tell from its own rows whether the message went out, and
returning the proofs of a token the recipient may hold would let them
redeem it from under the wallet (withdraw/0015 rules that out).

## Decision

The Cashu job settles a Linky contact withdrawal that has been pending for
10 minutes (`CASHU_SEND_SETTLE_AFTER_MS`, far longer than a send takes)
from what the shared wallet and the mint say (`settlePendingCashuSends`):

- **No send linked**, on the device that recorded it: nothing it knows of
  left the wallet, so it fails. Another device leaves it alone, since the
  link may still be syncing.
- **Its send taken back** (`returned`: by this device after a failed
  delivery, or by the merchant in Linky): the sats are the wallet's again,
  so it fails.
- **Its token redeemed** (every handed-out proof spent at the mint, or
  Linky closed the send `done`): the token left, so it is booked as the
  sats plus the swap's fee, which the withdrawal now keeps beside its send
  (`withdrawalCashuSend.feeSats`).
- **Otherwise** it stays pending, the proofs untouched, until the
  recipient redeems the token or the merchant takes it back in Linky.

## Alternatives considered

Returning an unredeemed send's proofs after a while: the recipient may
hold the token, and a later redeem would take sats the books show as back.
Booking every linked send as sent: a crash before the message went out
would book money that never left, and Linky taking the send back later
would leave the books short. Matching an unlinked `send` to its withdrawal
by mint, amount and time: guesswork over Linky's own sends.

## Consequences

- A crash between the swap and the write that links its send leaves a
  `send` no withdrawal names: the withdrawal fails while the token's sats
  wait handed out in Linky, which can take them back. The window is one
  local write.
- A send made before `feeSats` existed is booked without its fee.
- Settling a withdrawal recorded on a device that never comes back is left
  to that device, when it has no send linked.

## Enforced by

- `packages/core/src/modules/withdraw/withdraw-cashu-send-actions.test.ts > settling a Linky contact withdrawal a crash left pending (withdraw/0016) > fails one with no send linked, on its own device once no send can still run`
- `packages/core/src/modules/withdraw/withdraw-cashu-send-actions.test.ts > settling a Linky contact withdrawal a crash left pending (withdraw/0016) > leaves another device's unlinked one to that device`
- `packages/core/src/modules/withdraw/withdraw-cashu-send-actions.test.ts > settling a Linky contact withdrawal a crash left pending (withdraw/0016) > fails one whose send was taken back`
- `packages/core/src/modules/withdraw/withdraw-cashu-send-actions.test.ts > settling a Linky contact withdrawal a crash left pending (withdraw/0016) > books one whose token the recipient redeemed, with its fee`
- `packages/core/src/modules/withdraw/withdraw-cashu-send-actions.test.ts > settling a Linky contact withdrawal a crash left pending (withdraw/0016) > keeps one whose token nobody redeemed pending, its proofs untouched`
