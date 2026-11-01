# 0013 Finito's landing lives at the root of finito.fit

Status: accepted
Date: 2026-11-01

## Context

Finito is the native app's brand (brand/0001), with its PWA and API on
app.finito.fit. Its marketing site is finito.fit, a domain of its own that no
app proxies, unlike Payky's landing under payky.me/landing (landing/0012).
The landing is one workspace; its copy and pages are the same for both apps
but for the name and the hosts.

## Decision

`apps/landing` is built once per brand, picked at build time by
`PAYKY_LANDING_BRAND` (Payky when unset), so the prerender and the hydration
agree. `src/core/landing-sites.ts` holds each brand's site: Payky's documents
under `/landing` on payky.me, Finito's at the root of finito.fit (`/`, `/en`,
`/eet-2-0`, ...). Assets stay under `/landing/` on both, which `vercel.json`
maps to the build's root; it serves both brands' addresses, so the four
landing projects share it.

- **Copy.** The landing names its app through the brand placeholders and
  cases of brand/0002, and the hosts it mentions through `{siteHost}`,
  `{appHost}` and `{liveRelayHost}`.
- **Way into the app.** Payky's landing links to `/onboarding` on its own
  origin. Finito's links to the app on app.finito.fit (the edge landing to
  the edge app, through `VITE_PAYKY_API_BASE_URL`), with the page's language.
- **Installing.** Only a landing on the app's own origin offers the browser's
  install (landing/0005), since it shares the app's manifest; Finito's
  leaves it to the app. Finito is not in Zapstore, so its landing offers the
  APK alone among the native ways in, `finito-release-signed.apk`.
- **Search.** Canonical, alternate and sitemap addresses name the brand's
  production site; the prerender writes `sitemap.xml` and `robots.txt` for it.
- **Lightning address.** finito.fit and edge.finito.fit forward
  `/.well-known/lnurlp/donate` to the app's API, which answers
  `donate@finito.fit` (brand/0003).

## Alternatives considered

Proxying finito.fit/landing from app.finito.fit as payky.me does: rejected,
Finito's marketing site is the domain itself. A second landing workspace:
rejected, the pages would drift apart.

## Consequences

A new landing address needs a rewrite for both brands, and a new mention of
the app or a host goes through a placeholder. The native app's onboarding
does not yet read the landing's `lang`, so a visitor from finito.fit starts
in the device's language.

## Enforced by

- `apps/landing/src/deployment.test.ts > landing deployment > serves every prerendered language and document at its existing address`
- `apps/landing/src/deployment.test.ts > landing deployment > answers Finito's Lightning address on %s from %s`
- `apps/landing/src/finito-landing.test.tsx > Finito's landing > lives at the root of finito.fit`
- `apps/landing/src/finito-landing.test.tsx > Finito's landing > names Finito and none of Payky's hosts`
- `apps/landing/src/finito-landing.test.tsx > Finito's landing > sends visitors to the app on app.finito.fit`
- `apps/landing/src/finito-landing.test.tsx > Finito's landing > offers no install from the page and no Zapstore`
- `apps/landing/src/i18n/brand-copy.test.ts > landing brand copy > names the app and its hosts only through placeholders`
- `apps/landing/src/i18n/brand-copy.test.ts > landing brand copy > puts no name-dependent preposition before the name`
- `packages/web-shared/src/landing-redirect.test.ts > a landing at the domain's root > reads %s as %s`
