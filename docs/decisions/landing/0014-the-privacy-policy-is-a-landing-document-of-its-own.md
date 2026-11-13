# 0014 The privacy policy is a landing document of its own

Status: accepted
Date: 2026-11-13

## Context

Google Play rejected Finito's listing because its privacy policy link did
not lead straight to the policy's text. The policy existed only inside the
app, under Settings › About › Data and privacy, which a visitor without an
account reaches only through the landing and onboarding. A store reviewer,
and anyone else asked to trust the app with a business's data, needs an
address that shows the whole text at once.

## Decision

The policy is a fourth landing document, built and served like the EET page
(landing/0006) and the page on how the app works (landing/0008): at
`/privacy`, `/en/privacy` and `/sk/privacy` on finito.fit and under
`/landing` on payky.me, each with its own title, description, canonical and
`hreflang` links. The slug is `privacy` in every language. Its text is the
app's own `settings.about.privacy.*` copy, taken from `@payky/app-shared`
rather than written again, so the page and the app cannot say two different
things; the page splits it into sections by its numbered titles. The policy
says how to delete the data and names, as its privacy contact, the contact
form on the brand's website (`websiteUrl` in `packages/app-shared/src/brand.ts`):
`https://finito.fit/en#contact` for Finito, which the page links. The whole
text is prerendered and shown without any script or reveal animation. It
shares the header and footer, not the closing section (landing/0010), and
has no structured data. The header's menu does not list it; the footer of
every landing page links to it. Google Play's listing links to
`https://finito.fit/en/privacy`.

## Alternatives considered

A public route in the web app: rejected, the app's routes sit behind
onboarding and the access gate, and the landing is already the brand's
public, prerendered site.

A separate copy of the text for the landing: rejected, two copies of a legal
text drift apart.

## Consequences

`bun run build` writes `landing-privacy-<language>.html` beside the other
documents; `apps/landing/vercel.json`, `landingPagesPlugin` and
`sitemap.xml` know the three addresses. A change to the policy in the app's
copy changes the page with the next landing deployment.

## Enforced by

- `apps/landing/src/landing-server.test.tsx > renderLandingDocument > prerenders the privacy policy in %s at its own address`
- `apps/landing/src/landing-server.test.tsx > renderLandingDocument > prerenders the privacy policy the app shows, every line of it`
- `apps/landing/src/landing-server.test.tsx > renderLandingDocument > leads from the privacy policy to the contact form`
- `apps/landing/src/landing-server.test.tsx > renderLandingDocument > leads from the footer of every landing page to the privacy policy`
- `apps/landing/src/finito-landing.test.tsx > Finito's landing > serves its privacy policy at finito.fit/en/privacy`
- `apps/landing/src/deployment.test.ts > landing deployment > serves every prerendered language and document at its existing address`
- `packages/web-shared/src/landing-redirect.test.ts > isLandingPrivacyPath > reads %s as the privacy policy: %s`
