# 0012 Self-pay keeps the Spark wallet private

Status: accepted
Date: 2026-10-14

## Context

To pay by Lightning, the guest page mints an invoice to the merchant's
Spark wallet, so the self-pay view publishes that wallet's identity public
key to everyone who scans a table's QR code.

Spark wallets are public by default: with the identity key or the Spark
address, anyone can read the wallet's Bitcoin balance and full transfer
history through a public read-only client
([Wallet Viewer](https://docs.spark.money/wallets/readonly-client)).
Privacy mode restricts both to the owner and one authorized viewer. Token
activity stays public, and Payky uses no tokens
([Privacy Mode](https://docs.spark.money/wallets/privacy)). The Spark
account settings already offer privacy mode as a switch, off by default.

On 2026-10-14 a fresh mainnet wallet with privacy mode on still received a
100 sat invoice minted by `createGuestLightningInvoice`. Minting reads
nothing of the receiver: it asks the service provider for an invoice to the
receiver's key and stores the preimage shares for that key.

## Decision

Before the view offers Lightning, the merchant device reads the wallet's
settings and turns privacy mode on when it is off. The view offers
Lightning only when the wallet is confirmed private. When privacy mode
cannot be confirmed, the view offers no Lightning. A table whose self-pay
is switched off publishes a view without Lightning and leaves the wallet's
privacy mode as it is.

## Alternatives considered

Leaving privacy mode to the merchant's switch. Any guest at the table could
read the merchant's takings.

Offering Lightning only after the merchant turns privacy mode on. Lightning
would stay off for every merchant until they find the switch.

A fresh identity per sticker or per day. It would need a wallet per epoch
for the merchant device to watch, and privacy mode already hides what the
key reveals.

## Consequences

While self-pay offers Lightning, privacy mode stays on. A merchant who
switches it off in the Spark account settings has it switched back on at
the next publish. Every publish costs one more request to Spark.

## Enforced by

- `packages/core/src/background-jobs/jobs/table-self-pay-publishing-job.test.ts > table self-pay publishing job > turns Spark privacy mode on before offering Lightning`
- `packages/core/src/background-jobs/jobs/table-self-pay-publishing-job.test.ts > table self-pay publishing job > offers no Lightning while the Spark wallet stays public`
- `packages/core/src/background-jobs/jobs/table-self-pay-publishing-job.test.ts > table self-pay publishing job > leaves Spark privacy mode alone while self-pay is switched off`
