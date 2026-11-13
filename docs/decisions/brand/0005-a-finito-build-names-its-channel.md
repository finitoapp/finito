# 0005 A Finito build names its channel

Status: accepted
Date: 2026-11-13

## Context

Finito ships from one source to several places: app.finito.fit and the
release APK/AAB, edge.app.finito.fit off `main`, finito-edge's preview
deployments of pull requests, and the developer's own builds (Expo's dev
server, a local web export, the debug APK). Installed on one home screen they
all read "Finito", so nobody can tell which build they are about to open, or
which one a bug report came from.

## Decision

A build carries its channel in the name an installed app shows: plain
"Finito" for `production`, and "Finito edge", "Finito prev" and "Finito dev"
for the others. One function, `appTitle(brandName, channel)` in
`apps/native-app/src/core/app-title.cjs`, writes it from the brand's name:
the web build script and the config plugins read the Expo config's `name`,
the app its brand (`brandName(appBrand)`), and a test holds the two equal.

- **PWA.** `PAYKY_APP_CHANNEL` names the channel of a web export
  (`docs/finito-deployment.md`), and `scripts/build-web.ts` writes the name
  into the exported `index.html` (`<title>`, `apple-mobile-web-app-title`)
  and `manifest.webmanifest` (`name`, `short_name`). Unset, a build is `dev`:
  plain "Finito" is set on purpose, never by a forgotten variable. A source
  file without those fields fails the build. Expo's dev server names only its
  tab, "Finito dev".
- **APK.** The Gradle build type is the channel: the release build is
  `production` and keeps the config's `name`, the debug build types are `dev`
  (`plugins/with-debug-app-id.cjs`).

## Alternatives considered

Deriving the channel from `VERCEL_ENV`: rejected, `finito` and `finito-edge`
both build as Vercel's production, so it cannot tell app.finito.fit from
edge.app.finito.fit. Putting the channel into the config's `name`: rejected,
it would rename the release APK.

## Consequences

Every name stays within 11 characters, which Android's launcher shows
unabridged. Each Vercel project and environment needs `PAYKY_APP_CHANNEL`
set by hand; one that misses it shows as "Finito dev".

## Enforced by

- `apps/native-app/src/core/app-title.test.ts > appTitle > names production by the brand alone`
- `apps/native-app/src/core/app-title.test.ts > appTitle > names the %s channel after the brand`
- `apps/native-app/src/core/app-title.test.ts > appTitle > takes the same brand name in the app as in the Expo config`
- `apps/native-app/src/core/app-title.test.ts > appTitle > fits Android's launcher label on every channel`
- `apps/native-app/src/core/app-title.test.ts > the APK's name > keeps the release build plain Finito`
- `apps/native-app/src/core/app-title.test.ts > the APK's name > names the debug build types after the dev channel`
- `apps/native-app/src/core/web-export-title.test.ts > retitleIndexHtml > names the page and its home-screen title`
- `apps/native-app/src/core/web-export-title.test.ts > retitleIndexHtml > fails when the page has no %s`
- `apps/native-app/src/core/web-export-title.test.ts > retitleWebManifest > names the app and keeps every other field`
- `apps/native-app/src/core/web-export-title.test.ts > retitleWebManifest > fails on a manifest with %s`
