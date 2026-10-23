# 0024 Each brand's stickers open its own guest host

Status: accepted
Date: 2026-11-05

## Context

Payky and Finito share an account (brand/0001), and a Finito user should not
meet payky.me (brand/0003). A table's sticker names the guest page's origin,
and both apps show and print the stickers of the same tables.

## Decision

A brand names its guest host: `t.payky.me` for Payky and `t.finito.fit` for
Finito (`selfPayOrigin` in `packages/app-shared/src/brand.ts`). Each app
prints stickers for its own brand's host; its env still overrides it for
dev, preview and e2e.

- One web deployment serves the guest page on every brand's guest host. The
  page names the brand whose host it runs on, Payky on any other host.
- Both hosts read the same view, so a sticker of either brand pays the same
  table, and the sticker check judges a sticker by its keys on any brand's
  guest host. A host no brand serves is foreign, as before.
- `/` on Finito's guest host sends a visitor to finito.fit.

## Alternatives considered

A guest deployment per brand with the brand fixed at build time, as the API
does: rejected, two more projects and builds to change one title, while a
static page can read its own host. The guest page as a screen of the native
app's web export: rejected, every guest would load the till's bundle cold
from a QR, under the till's content security policy (table-self-pay/0010).

## Consequences

`t.finito.fit` needs DNS and a domain on the Payky web project before Finito
ships self-pay. Stickers printed earlier by either app keep working.

## Enforced by

- `packages/app-shared/src/brand.test.ts > brandOfSelfPayHost > names the brand whose guest host the page runs on`
- `apps/web-app/src/guest-origin.test.ts > the guest page's origin > is served on every brand's guest host and on no app's origin`
- `apps/web-app/src/guest-origin.test.ts > the guest page's origin > sends a visitor of Finito's guest host to Finito's site`
- `packages/core/src/modules/table-self-pay/table-self-pay-sticker-utils.test.ts > checkTableSelfPaySticker > names the table of a sticker on another brand's guest host`
- `apps/native-app/src/core/app-brand.test.ts > the native app's code shows no Payky`
