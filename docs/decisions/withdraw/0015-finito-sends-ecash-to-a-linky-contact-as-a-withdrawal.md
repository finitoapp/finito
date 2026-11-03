# 0015 Finito sends ecash to a Linky contact as a withdrawal

Status: accepted
Date: 2026-11-03

## Context

The Cashu wallet is the one Linky shows (cashu/0001), and its owner's
friends and suppliers are on Linky too. Fazole lets a merchant type a Linky
name, an npub or a profile link and hands the ecash over as a token in a
NIP-17 message, the way Linky's chat does; Payky could only melt it over
Lightning (withdraw/0012), which costs a Lightning fee and needs the other
side to have a Lightning address at all. A merchant who wants to move money
to their own Linky, or pay someone on it, should be able to name them.

## Decision

Finito's withdrawal from the Cashu wallet takes a Linky contact as well as
a Lightning destination, and sends a token when it gets one.

- **What names a contact.** A bare name is a NIP-05 name on `linky.fit`
  (`hynek` is `hynek@linky.fit`), looked up in Linky's `nostr.json`. An
  npub, an nprofile, a hex key, a `nostr:` URI or a Linky profile link names
  the key outright. `name@other.domain` is a Lightning address, never a
  contact. (`linky-contact.ts`)
- **A send is Linky's send.** The amount is swapped out of one mint as a
  token (`cashuB…`, encoded as Linky encodes it), stored as a `send`
  operation `pending` with its proofs `handedOut`, the change `available`
  and the consumed inputs `spent`, so every sat is in the store at every
  step (`cashu-send.ts`). Whoever redeems the token pays the mint's input
  fee on its proofs, as with a token Linky sends; the swap's own input fee
  is the withdrawal's fee.
- **The token goes as a NIP-17 message** to the recipient's key, in a 1:1
  room, over the account's relays, which Linky's users read; the account's
  own copy follows so the merchant's Linky shows the send too
  (`nostr-cashu-send.ts`). "Withdraw all" sends the mint's balance less the
  most the swap's fee can take.
- **It is a withdrawal.** Recorded before anything leaves (withdraw/0001),
  in its own detail table `withdrawalCashuSend` (the recipient's key, the
  address they were named by, the send operation), booked as the movement
  of the sats plus the fee as soon as a relay holds the token, and failed
  with the proofs the wallet's again when none does: the token never left
  the device, so there is nothing to retry (withdraw/0007). The PIN is asked
  as for every withdrawal (access/0007).
- **Finito alone.** Payky's withdrawal form keeps its Lightning
  destinations; the shared core takes either.

## Alternatives considered

- Paying a contact's Lightning address from their Linky profile: a
  Lightning fee and a melt for money that is already ecash at a mint Linky
  trusts, and a contact without a Lightning address could not be paid.
- Showing the token as a QR or text to copy: Linky's chat delivers it
  without the recipient doing anything, and a token on a screen is money
  anyone can photograph.
- Booking the send only once Linky's receive is seen: Payky cannot see
  the recipient's receive, and the money has left the merchant's wallet the
  moment the token is on a relay (cashu.md §5 "Into Payky's books").
- Recording the send in the shared wallet only, without a withdrawal row:
  every withdrawal is its own record (withdraw/0001), and the books would
  silently diverge from the wallet.

## Consequences

- `cashu-send.ts` writes a `send` operation and `handedOut` proofs in
  Linky's shape; Linky sees the send in its token list and can take it
  back itself. Finito never resumes or returns a send on its own after the
  message is out.
- A relay that accepts the recipient's copy but loses it loses the token:
  Linky's own outbox has the same exposure, and the relays are Linky's.
- The web app's withdrawal screens show a `cashuSend` withdrawal (kind,
  recipient, mint) but cannot make one.
- `cashu.md` §5's "outgoing operations are not booked" holds for Linky's
  sends; Finito's own are booked by their withdrawal.

## Enforced by

- `packages/core/src/cashu/cashu-send.test.ts > sendCashu (withdraw/0015) > hands the amount out as a pending send and keeps the change`
- `packages/core/src/cashu/cashu-send.test.ts > sendCashu (withdraw/0015) > the token names the mint and carries exactly the handed-out proofs`
- `packages/core/src/cashu/cashu-send.test.ts > sendCashu (withdraw/0015) > returnCashuSend gives the proofs back and closes the send returned`
- `packages/core/src/integrations/linky/linky-contact.test.ts > parseLinkyContactInput > a bare name is a NIP-05 address on linky.fit`
- `packages/core/src/integrations/linky/linky-contact.test.ts > parseLinkyContactInput > a name on another domain is not a contact, it is a Lightning address`
- `packages/core/src/integrations/nostr/nostr-cashu-send.test.ts > sendCashuTokenMessage (withdraw/0015) > wraps the bare token for the recipient, then for the account itself`
- `packages/core/src/modules/withdraw/withdraw-cashu-send-actions.test.ts > Linky contact withdrawal (withdraw/0015) > records the withdrawal, hands the token over and books the movement`
- `packages/core/src/modules/withdraw/withdraw-cashu-send-actions.test.ts > Linky contact withdrawal (withdraw/0015) > fails with nothing gone when no relay takes the token`
