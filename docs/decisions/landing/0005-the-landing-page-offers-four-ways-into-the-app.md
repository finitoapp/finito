# 0005 The landing page offers four ways into the app

Status: accepted
Date: 2026-10-11

## Context

The landing page offered Zapstore for Android and a link into the web app,
with installing the web app left to a paragraph of instructions. A visitor
without Zapstore had no way to the Android app, and the page itself could
not be installed: it is a document of its own (landing/0002) without the
app's manifest, so the browser never offered to. The GitHub release of every
version carries the same signed APK that Zapstore distributes, so the two
update each other.

## Decision

The landing page offers two ways in, each a button with a menu of two
options and a one-line hint for each:

- The native app, for Android, with every feature:
  - Zapstore, the recommended option: updates arrive on their own.
  - The newest signed APK, the same app without automatic updates, linked
    as `https://github.com/finitoapp/finito/releases/latest/download/app-release-signed.apk`.
    The release workflow uploads only the signed APK, under that name.
- The web app, for any phone, tablet or computer, updated on its own but
  without what needs native code, such as card payments through a terminal:
  - Installing it as a PWA. The landing page links the app's manifest, so
    the browser can install the app from it. Where the browser offers its
    own install dialog (Chromium), the option opens it; elsewhere (Safari,
    Firefox) it says how to install by hand.
  - Opening it in the browser, as before (landing/0003), the PWA without a
    window of its own.

An app installed from the landing page starts in that page's language, as
the web-app link does. Its start URL is the app's `/`, which cannot carry
the language, so the page keeps it in `localStorage` when the browser reports
the app installed. An installed app with no account then opens onboarding
in it, and onboarding forgets it once opened, so a language picked there is
not undone by the next start. An installed app that starts on the landing
page itself, as a home-screen app can, goes to onboarding in that page's
language.

## Alternatives considered

A landing-page manifest whose start URL carries the language, which was
rejected because it would make a second app beside the one installed from
the app, and existing merchants' installs keep `/` (landing/0001).

Ordering the options by the visitor's platform, which was rejected for now:
the order is the same for everyone, and the prerendered page needs no
browser to render it.

Four cards, each explaining its option in a paragraph, which was rejected
as too wordy: the two menus say the same in a line per option.

## Consequences

The APK link breaks if the release workflow renames the file or a release
that is not a stable version becomes GitHub's latest one
(`docs/releases.md`). An APK installed from GitHub gets no automatic updates;
its hint says so. Installing the app from the browser's menu still stores
the language; on iOS, whose home-screen apps do not share the browser's
storage, only an app that starts on the landing page keeps it.

## Enforced by

- `apps/landing/src/landing-server.test.tsx > renderLandingDocument > offers a native and a web-based way into the app`
- `apps/web-app/e2e/landing-redirect.spec.ts > the native app comes from Zapstore or as the newest APK`
- `apps/web-app/e2e/landing-redirect.spec.ts > without the browser's install offer, the landing page says how to install by hand`
- `packages/web-shared/src/landing-redirect.test.ts > install language > keeps the language the app was installed in until onboarding opens`
- `apps/web-app/e2e/landing-redirect.spec.ts > the landing page installs the app, which starts in the page's language`
- `apps/web-app/e2e/landing-redirect.spec.ts > an installed app that starts on the landing page goes to onboarding in its language`
