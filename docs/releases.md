# Releases

| Target | Ships | Version shown |
| --- | --- | --- |
| `edge.payky.me`, `edge.app.finito.fit` (PWAs) | every push to `main` | `<last release>-edge.<sha>` |
| `payky.me`, `app.finito.fit` (PWAs), both Android apps on Google Play (internal track) and GitHub Releases | a `v<version>` tag | `<version>` |

One tag ships both brands (`docs/decisions/brand/`): Payky is the web app and its Capacitor shell (`me.payky`), Finito the native app (`fit.finito.app`, `docs/finito-deployment.md`).

Versions are CalVer `YY.M.MICRO` (`26.10.3`); MICRO restarts at 0 each month and stays below 100, because the Android `versionCode` is `YY*10000 + M*100 + MICRO` (`apps/native-shell/android/app/build.gradle`).

## How the version gets into a build

`version` in `package.json` is the last release. `bun run release` (`bin/release.ts`) is the only thing that changes it: it commits the next version as `chore(release): v<version>` and tags that commit. `apps/web-app/vite.config.ts` builds the release commit as the version itself and every other commit as `<version>-edge.<sha>`; that string is `__APP_VERSION__`, the About page's version and Sentry's release. Gradle reads the same `package.json`.

## Release

1. On an up-to-date `main` with a clean working tree, run `bun run release`.
2. The pushed tag starts `.github/workflows/release.yml`, which checks the tag matches `package.json`, runs `bun run check`, then in parallel:
   - `web` force-pushes the `production` branch to the tag; the `payky` and `finito` Vercel projects deploy it to `payky.me` and `app.finito.fit`.
   - `android` builds Payky's signed APK and AAB from `apps/native-shell`, `finito-android` Finito's from `apps/native-app` (`expo prebuild`, then Gradle, signed by `apps/native-app/plugins/with-release-signing.cjs`). Each keeps its APK for the release and uploads its AAB to Google Play's internal track.
   - `github-release` then creates one release, `Payky / Finito v<version>`, with both APKs, once both are built, even if a Google Play upload failed. The landings link them as `https://github.com/finitoapp/payky/releases/latest/download/app-release-signed.apk` and `.../finito-release-signed.apk`, so the files keep those names and every release carries both (`docs/decisions/landing/0005`).

A failed job is re-run from the Actions page. A tag is never moved: a fix ships as the next version.

## Hotfix

1. `git switch -c hotfix/<name> v<version>`, commit the fix and push the branch.
2. Run `bun run release` on that branch; the release commit and tag land on it.
3. Cherry-pick the fix to `main`, or the next release drops it. `package.json` on `main` keeps the older version until then, which only affects edge's label.

## Rollback

The PWA: Instant Rollback in the `payky` Vercel project, which lasts until the next release moves `production`. Google Play has no rollback; ship a hotfix.

## Edge

Edge is a separate origin with its own local storage, but it syncs through the same Evolu servers and calls the same services as production. Whatever edge writes must stay readable by the last release.

## Vercel and GitHub setup

Two Vercel projects build the payment app from this repository:

- `payky`: Production Branch `production`, domain `payky.me`. Preview deployments are disabled and the Ignored Build Step is `[ "$VERCEL_GIT_COMMIT_REF" != "production" ]`, so it builds nothing else.
- `payky-edge`: Production Branch `main`, domain `edge.payky.me`. Pull request previews come from this project.

Each app project has its own environment variables (AI proxy key, donation wallet, Sentry); a new one goes into both, and into Finito's `finito` and `finito-edge`, which serve the same API on `app.finito.fit` (`docs/finito-deployment.md`).

GitHub secrets used by `release.yml`: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` for Payky, `FINITO_ANDROID_KEYSTORE_BASE64`, `FINITO_ANDROID_KEYSTORE_PASSWORD`, `FINITO_ANDROID_KEY_ALIAS`, `FINITO_ANDROID_KEY_PASSWORD` for Finito, and `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, which needs release access to both apps.

## Workspace build inputs

The root `package.json` remains the version source. Web/Vite and Sentry read it
from `apps/web-app`; Gradle reads it from `apps/native-shell/android/app`.
Run native commands through the root `cap:*` scripts. The keystore remains at
the repository root, outside the native project; release artifacts are under
`apps/native-shell/android/app/build/outputs`. Capacitor sync regenerates the
Android and iOS dependency references after installation.

The Vercel project root is `apps/web-app`. Enable access to source files outside
that root so the deployment can install the root lockfile, apply the Evolu patch
and build `packages/core`. The checked-in Vercel commands install and build from
the repository root and serve `apps/web-app/dist`. Validate a preview before
shipping: the local Node API smoke test does not verify Vercel tracing or rewrites.

## Landing site

Two further Vercel projects build `apps/landing`: `payky-landing-edge` ships
from `main`, and `payky-landing` from `landing-production`, independently of
the app's release branch and CalVer. Each app proxies `/landing` and
`/sitemap.xml` to its corresponding landing project's stable address. See
[landing deployment](landing-deployment.md) for setup, local development,
preview behavior and rollout order.
