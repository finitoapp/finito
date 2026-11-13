# 0015 The card terminal documentation is a Finito-only landing document

Status: accepted
Date: 2026-11-13

## Context

Comgate certifies an app that drives its SwitchioPay terminals over the ECR
protocol before signing it and distributing it through the Switchio Store.
It asks for "short documentation, at least of how to trigger every type of
payment operation the app integrates" (apidoc.comgate.cz/terminaly). Finito
is certified running on a NEXGO N92 payment terminal next to SwitchioPay,
and integrates payment, reversal, refund to the card and the batch closure.
Payky, the web app, takes card payments only, so it has nothing to certify.

Comgate does not need a public page, but a public one also serves
merchants, can be regenerated, and a link to it is all the e-mail with the
APK has to carry. Until now every landing document existed for both brands
(landing/0013: the pages are the same for both apps but for the name and the
hosts).

## Decision

The card terminal documentation is a fifth landing document, built and
served like the privacy policy (landing/0014), for Finito alone: at
`/terminal`, `/en/terminal` and `/sk/terminal` on finito.fit, each with its
own title, description, canonical and `hreflang` links, and an `FAQPage`
with its own questions. The slug is `terminal` in every language. Payky's
landing has no such document: its site has no addresses for it
(`createLandingSitePaths`), so it is neither prerendered, nor in its
sitemap, nor linked from its footer, and `vercel.json` rewrites only the
three root addresses. This narrows landing/0013's "the same pages for both
apps": a document may exist for one brand only, and a brand's site lists the
documents it has. The footer of every Finito page links to it; the header's
menu does not, as for landing/0008 and landing/0014. It ends with its FAQ and
the footer (landing/0010).

The page claims only what the code does, as landing/0009 asks of the page
on how the app works: what Finito sends SwitchioPay, when it reverses and
when it refunds to the card (refund/0008), what it records, and how it
behaves when SwitchioPay gives no readable answer (payment/0006). Where the
behaviour is still to be verified on Comgate's development terminal — a
payment cancelled on the terminal, a partial approval — the page says so
instead of guessing. The simulator's amounts are Comgate's, with their
source and the date they were checked.

Every step in the app shows a screenshot generated from the real app, never
drawn or photographed by hand: the native app's screens on the terminal's
720×1600 display, in the dark theme, per language, named by
`TerminalShotName` (`packages/doc-mockups/src/terminal-shots.ts`) and kept in
`apps/native-app/docs/terminal/<language>/`. SwitchioPay's own screens
cannot be generated from the app, so where SwitchioPay takes over, the page
shows an HTML placeholder of the same size instead (`SwitchioPayPlaceholder`):
a neutral surface with a card icon and a translated label, read by screen
readers and drawn in the page's light or dark theme.

## Alternatives considered

A page on both landings: rejected, Payky integrates neither the reversal,
the refund nor the closure, and would document what it cannot do.

A PDF or a page in the repository sent with the APK: rejected, merchants
would not find it, and a public address is easier to keep current.

Photographs of SwitchioPay's screens: rejected, they cannot be regenerated
when its look changes, and would need a copy per language.

## Consequences

`bun run build:landing` writes `landing-terminal-<language>.html` only for
Finito. A screenshot that is missing fails a test; one that is out of date
does not, so a change to the design, the copy or the card flow means
regenerating the set. Each behaviour of the card flow the page describes
changes its copy in all three languages when the code changes.

## Enforced by

- `apps/landing/src/finito-landing.test.tsx > Finito's landing > serves its card terminal documentation at finito.fit/terminal`
- `apps/landing/src/landing-server.test.tsx > renderLandingDocument > keeps the card terminal documentation to Finito's landing`
- `apps/landing/src/deployment.test.ts > landing deployment > serves the card terminal documentation at Finito's addresses only`
- `apps/landing/src/features/landing/landing-terminal-shots.test.ts > the card terminal documentation's screenshots > has every screenshot in %s`
- `apps/landing/src/features/landing/landing-terminal-shots.test.ts > the card terminal documentation's screenshots > shows every screenshot on the page`
- `apps/landing/src/features/landing/landing-terminal-shots.test.ts > the card terminal documentation's screenshots > stands a placeholder in for SwitchioPay's own screens`
- `packages/web-shared/src/landing-redirect.test.ts > isLandingTerminalPath > reads %s on Finito's landing as the card terminal documentation: %s`
- `packages/web-shared/src/landing-redirect.test.ts > isLandingTerminalPath > finds no card terminal documentation at %s on Payky's landing`
