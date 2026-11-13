# Finito deployment

Finito is the native app in `apps/native-app` and the PWA exported from it
(`docs/decisions/brand/`). Its PWA and the API it calls are served from
`app.finito.fit`; the Android app calls the same API by URL.

## Vercel projects

All four live in the `josef-ks-projects` team, connected to `finitoapp/payky`,
with files outside the Root Directory enabled as build inputs and Node 24:

| Project | Root Directory | Production Branch | Domain |
| --- | --- | --- | --- |
| `finito-edge` | `apps/native-app` | `main` | `edge.app.finito.fit` |
| `finito` | `apps/native-app` | `production` | `app.finito.fit` |
| `finito-landing-edge` | `apps/landing` | `main` | `edge.finito.fit` |
| `finito-landing` | `apps/landing` | `landing-production` | `finito.fit`, `www.finito.fit` (308 to `finito.fit`) |

`finito` and `finito-landing` share their production branches with `payky`
and `payky-landing`, so a release (`docs/releases.md`) or a landing promotion
ships both brands at once. Both have preview deployments off and an Ignored
Build Step of `[ "$VERCEL_GIT_COMMIT_REF" != "production" ]`, resp.
`!= "landing-production"`; `finito-edge` skips `production`.

## The app project

`apps/native-app/vercel.json` installs from the repository root and runs
`bun run build:native:web`: Expo's web export into `apps/native-app/dist`,
stamped with the build's version (`bin/app-build.ts`, an edge build carries
its commit), plus the `repo-snapshot.json` the assistant reads. Every path
without a dot falls back to `index.html` for expo-router.

The API is the web app's, unchanged. Vercel deploys only the functions under
the project's own `api/`, so `apps/native-app/api` holds one re-export per
handler of `apps/web-app/api`; `src/core/api-reexports.test.ts` fails on a
handler without its twin. A deployment names its brand through `PAYKY_BRAND`
(brand/0003).

Among them are the service proxies `/api/proxy/fio` and `/api/proxy/moneta`,
through which the PWA reaches the banks once a device allows it
(service-proxy/0001). They answer only their own origin, so the PWA calls
them on the origin it was served from, a `*.vercel.app` alias included; only
Expo's dev server, which has no `/api`, calls `EXPO_PUBLIC_PAYKY_API_BASE_URL`
and needs its origin in `PAYKY_SERVICE_PROXY_ALLOWED_ORIGINS`. `vercel.json` sets
`"regions": ["fra1"]` at the top level, as `apps/web-app/vercel.json` does for
Payky: it keeps the bank data in the EU and moves every function of the
project, not just the proxies, to Frankfurt.

## Environment

| Variable | `finito` | `finito-edge` |
| --- | --- | --- |
| `PAYKY_BRAND` | `finito` | `finito` |
| `PAYKY_APP_CHANNEL` | `production` | `edge` for Production, `prev` for Preview |
| `EXPO_PUBLIC_PAYKY_API_BASE_URL` | unset (`https://app.finito.fit`) | `https://edge.app.finito.fit` |
| `EXPO_PUBLIC_SENTRY_DSN` | Payky's DSN | Payky's DSN |
| `PAYKY_DONATE_IDENTIFIER` | `donate@finito.fit` | `donate@edge.finito.fit` |
| `PAYKY_DONATE_SPARK_MNEMONIC` | Payky's | Payky's |
| `PAYKY_AI_UPSTREAM_API_KEY` | Payky's | Payky's |
| `PAYKY_AI_UPSTREAM_URL`, `_MODEL`, `PAYKY_AI_MAX_TOKENS` | Payky's | unset |
| `PAYKY_SERVICE_PROXY_ALLOWED_ORIGINS` | unset | local dev origins, such as `http://localhost:8081` |

The secrets are Payky's own values (one donation wallet, one AI key, one Sentry
project); Vercel does not reveal sensitive values, so they are entered by hand.
`PAYKY_DONATE_IDENTIFIER` is needed because the Lightning address
`donate@finito.fit` is answered through the landing on `finito.fit`, while the
function sees its own host, `app.finito.fit`.

`PAYKY_SERVICE_PROXY_ALLOWED_ORIGINS` lists, comma-separated, the foreign
origins the service proxies answer with CORS besides their own: Expo web on
`localhost:8081` (and Payky's `bun run dev` on `payky-edge`) point their API at
an edge deployment and call it cross-origin. It is set on the edge projects
only; production answers its own origin alone. Unset or invalid, it allows
none.

## Channels

A build names its channel in the name an installed app shows (brand/0005),
so a home screen tells the builds apart:

| Channel | Build | Name |
| --- | --- | --- |
| `production` | `finito` (app.finito.fit); the release APK and AAB | `Finito` |
| `edge` | `finito-edge`, Production (edge.app.finito.fit) | `Finito edge` |
| `prev` | `finito-edge`, Preview (pull requests) | `Finito prev` |
| `dev` | Expo's dev server, a local `bun run build:native:web`, the debug APK | `Finito dev` |

The PWA takes its channel from `PAYKY_APP_CHANNEL`, which
`scripts/build-web.ts` reads and writes into the exported `index.html` and
`manifest.webmanifest`. Unset, it is `dev`, so plain `Finito` is only ever
set on purpose. Expo's dev server names only its tab. The APK takes its
channel from the Gradle build type instead: the release build keeps the
config's `name`, and `plugins/with-debug-app-id.cjs` names the debug build
types `Finito dev`.

## The landing projects

`finito-landing` and `finito-landing-edge` build `apps/landing` with
`PAYKY_LANDING_BRAND=finito` (landing/0013): the same pages as Payky's, at
the root of `finito.fit`, naming Finito, plus the card terminal
documentation Comgate certifies Finito by, which Payky's landing does not
have (landing/0015). After a deployment, verify `/`, `/en`, `/eet-2-0`,
`/jak-to-funguje`, `/privacy` and `/terminal` with their `/en` and `/sk`
variants. The terminal page's screenshots come from
`apps/native-app/docs/terminal/<language>/`; a missing one fails
`landing-terminal-shots.test.ts`, so regenerate the set with the card flow,
its design or its copy. `VITE_PAYKY_API_BASE_URL` names the
app they send visitors to and whose `/api/contact` the form calls:
`https://app.finito.fit`, resp. `https://edge.app.finito.fit`. The prerender
writes the site's `sitemap.xml` and `robots.txt`; `apps/landing/vercel.json`
forwards `/.well-known/lnurlp/donate` to the matching app, which answers
`donate@finito.fit`.

## Outside Vercel

- `live-relay.finito.fit`: DNS and TLS to the live relay's server, which
  routes by path, not host. New Finito accounts start on it (brand/0003).
- Android: the Play listing for `fit.finito.app`, its upload keystore and the
  `FINITO_ANDROID_*` GitHub secrets the release job signs with
  (`docs/releases.md`). Google Play takes API uploads only once an app has a
  first release, so the first AAB is uploaded by hand in the Play Console.

## Android release

`finito-android` in `.github/workflows/release.yml` builds the APK and AAB from
the same tag as Payky's. `plugins/with-release-signing.cjs` signs the release
build with the key Gradle is handed as `finitoReleaseStoreFile` and its
passwords; without them it keeps the debug key, as a local or e2e release
build does, and the job fails on an APK signed by it. The APK is published as
`finito-release-signed.apk`, the name Finito's landing links.
