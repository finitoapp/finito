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

## Environment

| Variable | `finito` | `finito-edge` |
| --- | --- | --- |
| `PAYKY_BRAND` | `finito` | `finito` |
| `EXPO_PUBLIC_PAYKY_API_BASE_URL` | unset (`https://app.finito.fit`) | `https://edge.app.finito.fit` |
| `EXPO_PUBLIC_SENTRY_DSN` | Payky's DSN | Payky's DSN |
| `PAYKY_DONATE_IDENTIFIER` | `donate@finito.fit` | `donate@edge.finito.fit` |
| `PAYKY_DONATE_SPARK_MNEMONIC` | Payky's | Payky's |
| `PAYKY_AI_UPSTREAM_API_KEY` | Payky's | Payky's |
| `PAYKY_AI_UPSTREAM_URL`, `_MODEL`, `PAYKY_AI_MAX_TOKENS` | Payky's | unset |

The secrets are Payky's own values (one donation wallet, one AI key, one Sentry
project); Vercel does not reveal sensitive values, so they are entered by hand.
`PAYKY_DONATE_IDENTIFIER` is needed because the Lightning address
`donate@finito.fit` is answered through the landing on `finito.fit`, while the
function sees its own host, `app.finito.fit`.

## Outside Vercel

- `live-relay.finito.fit`: DNS and TLS to the live relay's server, which
  routes by path, not host. New Finito accounts start on it (brand/0003).
- Android: the Play listing for `fit.finito.app`, its keystore and the GitHub
  secrets the release job signs with.
