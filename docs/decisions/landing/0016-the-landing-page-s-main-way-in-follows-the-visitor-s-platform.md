# 0016 The landing page's main way in follows the visitor's platform

Status: accepted
Date: 2026-11-19

## Context

landing/0005 gave both ways into the app, native and web-based, a button
that only opened a menu of two options, so every visitor chose twice. The
native menu recommended Zapstore, and Finito, not in Zapstore then, offered
the APK alone (landing/0013). Finito is now listed in Google Play as
`fit.finito.app`, where most Android merchants look for an app first, and in
Zapstore. Installing the web app from the page's own button added a third
choice the browser's own menu already offers.

## Decision

The page has one main way in, by the visitor's platform:

- **On Android**, the recommended store: the first store the brand's app is
  listed in, Google Play before Zapstore. Finito's is Google Play
  (`https://play.google.com/store/apps/details?id=fit.finito.app`), Payky's
  Zapstore (`me.payky`). The header's button reads "Download" and the hero's
  names the store; both open it.
- **Everywhere else** (iPhone, iPad, Mac, Windows, Linux, ...), the web app in
  the page's language (landing/0003): the header's "Start" and the hero's
  "Start <app>".

The hero's second button, "More options", scrolls to the download section,
which on the home page comes before the FAQ, as Linky's does: the app's
logo, "Get the app", and every way in as a button, each opening its way at
once. The main way comes first and is the only one filled in; the others
follow in order: "Start" (the web app), Google Play and Zapstore where the
brand's app is listed there (Finito's Zapstore is `fit.finito.app`), and the
newest signed APK from the GitHub release. None says anything about updates.
The structured data names the recommended store as the app's `installUrl`.

The page is prerendered as a page away from Android sees it, and an Android
visitor's page switches to the store right after hydrating, so the two
renders agree (landing/0002). The landing page offers no install button of
its own. Where it shares the app's origin, it still links the app's
manifest, so the browser installs the app from its own menu, and an app
installed so starts in the page's language, as landing/0005 had it.

## Alternatives considered

Dropping Zapstore and the APK from Finito's landing once it is in Google
Play: rejected, a device without Google Play still gets the app, and the
three carry the same signed build.

Keeping the page's install button and the two menus with a paragraph and a
hint per option: rejected as too wordy and one choice too many.

Prerendering a page per platform: rejected, the address is the same for
everyone and a crawler is no platform.

## Consequences

A brand listed in a new store needs its URL in `landing-sites.ts`. The order
decides which store Android visitors are sent to. An Android visitor sees
the web app's buttons for a moment, until the page hydrates. Safari and Firefox users no longer
get the page's instructions for installing by hand.

## Enforced by

- `apps/landing/src/finito-landing.test.tsx > Finito's landing > offers Google Play first, then Zapstore and the APK`
- `apps/landing/src/landing-server.test.tsx > renderLandingDocument > offers every way in before the FAQ, opening the web app first`
- `apps/web-app/e2e/landing-redirect.spec.ts > the download section offers every way in, the web app first`
- `apps/web-app/e2e/landing-redirect.spec.ts > on Android the main way in is the store`
- `packages/web-shared/src/landing-redirect.test.ts > install language > keeps the language the app was installed in until onboarding opens`
- `apps/web-app/e2e/landing-redirect.spec.ts > an app installed from the landing page starts in the page's language`
- `apps/web-app/e2e/landing-redirect.spec.ts > an installed app that starts on the landing page goes to onboarding in its language`
