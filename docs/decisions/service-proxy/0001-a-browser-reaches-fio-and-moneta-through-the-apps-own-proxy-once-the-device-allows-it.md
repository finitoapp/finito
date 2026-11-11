# 0001 A browser reaches Fio and MONETA through the app's own proxy once the device allows it

Status: accepted
Date: 2026-11-11

## Context

Fio's API (`fioapi.fio.cz`) and MONETA's VIP API (`api.moneta.cz`) answer a
browser's CORS preflight with no CORS headers, so neither can be called from
Payky's web app or Finito's PWA. Until now their sync jobs ran only in the
native apps and the CLI, the payment-wait screen asked MONETA only natively,
and the settings told a browser user to install the mobile app. moneta/0001
rejected relaying the calls through Payky's own `/api`, because every
merchant's bank token would pass Payky's server. A merchant who runs the
terminal in a browser, or as Finito's PWA, had no automatic matching at all.

## Decision

A browser build calls Fio and MONETA through the app's own proxy, and only
once the device allows it. The privacy settings of both apps offer one
consent, named for connected services in general and saying that for now
these are Fio banka and MONETA Money Bank, and what the proxy sees. It is the
device setting `deviceSettings.serviceProxyEnabled`, like the other consents:
it does not sync, and every device asks again. It is off by default; the
column is nullable, neither the defaults seeding nor onboarding writes it,
and `null` reads as off (`isServiceProxyEnabled`), so no device, old or new,
uses the proxy before its user turns it on. Turning it on or off takes the
owner PIN (`admin`, asked as an action on the `free` privacy page), as the
AI data access does (access/0012): on, it sends the bank tokens through the
server; off, it stops the browser's bank matching. The native apps (Payky's APK over
`capacitorFetch`, Finito's APK) and the CLI call the banks directly whatever
the consent; the card says so where the app runs natively.

The browser's fetch (`createServiceProxyFetch`) sends a call to a service of
the registry (`service-proxy-services.ts`) to `/api/proxy/<service>` on the
brand's own API while the consent is on, and every other call unchanged. It
reads the consent at each call, so turning it on or off reaches every fetch
already handed out. The upstream path and query travel in the `x-proxy-path`
header, never in the URL, since a Fio token is part of Fio's path. A failure
of the proxy itself carries `x-service-proxy-error` and becomes a network
failure (`FetchError`), never a bank's refusal of the token. Only a response
the proxy marks as relayed from the bank (`x-service-proxy: upstream`) is
taken as the bank's answer; anything else, such as the hosting platform's own
401, 403, 429 or error page, is a proxy failure too.

Payky's web app calls the proxy on the origin it was served from. So does
Finito's PWA, because every deployment and `*.vercel.app` alias of `finito`
and `finito-edge` serves its own `/api/proxy`; only Expo's dev server and the
e2e builds, which have no `/api`, call the configured
`EXPO_PUBLIC_PAYKY_API_BASE_URL`.

The proxy (`/api/proxy/fio`, `/api/proxy/moneta`, served by both brands)
passes on only what the registry names: a bodiless `GET`, to the service's
one fixed origin, on a path of the calls its client makes, with only the
service's request headers (`accept`; for MONETA also `authorization`). It
follows no redirect, sends the bank's answer back with its status and
`content-type` and `cache-control: no-store`, stores nothing and logs
nothing. It sees the bank token and the bank's answers: the IBAN and the
account's transactions with amounts, counter-accounts, payer names, symbols
and messages. It answers only the app's own frontend: it sends no CORS
headers by default, and refuses a request whose `Origin` is not its own, or
whose `Sec-Fetch-Site` is `cross-site` or `same-site`, with 421 before
calling the bank. `PAYKY_SERVICE_PROXY_ALLOWED_ORIGINS` lists foreign
origins it answers with CORS besides, for an edge deployment serving local
development; unset or invalid, it allows none. Both apps' Vercel projects run
in `fra1` (Frankfurt), so the bank data stays in the EU.

The Fio and MONETA jobs (`bankBackgroundJobs`) run apart from the app's other
jobs (`BankBackgroundJobs` in both apps), only while the device can reach the
banks: natively, or in a browser with the consent on. Turning the consent on
or off starts or stops them alone. In a browser they run in one tab per
account owner, which holds a Web Lock (`runBackgroundJobsHoldingLock`); the
next tab takes over when it closes.

## Alternatives considered

Keeping banks native-only, as moneta/0001 decided: a browser terminal would
keep confirming every bank transfer by hand.

A dynamic `/api/proxy/[service]` route, or a path in the URL: two static
endpoints keep clear of Vercel's dynamic segments and the app's catch-all
rewrite, and a path in the URL would write a Fio token into access logs.

A consent per bank: one consent, named generally, covers the services that
need the proxy now and later, and says which they are.

Authenticating the caller (an owner id, as `ai/0001` does) and a rate limit,
postponed: the fixed origins, the path allowlist and `GET` alone keep the
proxy from being a general relay, and a rate limit needs a store Vercel
functions do not keep.

## Consequences

The origin and CORS checks stop another website's page in a browser from
using the proxy, not a script: anyone can call it with a forged or missing
`Origin`. What such a caller gets is a call to Fio or MONETA with a token it
already holds, through Payky's server. Nothing tells callers apart or limits
them until authentication and a rate limit come.

With the consent on, every bank token of that browser's merchant and every
bank answer pass Payky's server. "Stores and logs nothing" covers Payky's
code; Vercel's own request logs see only `/api/proxy/<service>`, since the
upstream path travels in a header. Whether Vercel's observability records
the function's outbound call to Fio, whose path carries the token, is not
confirmed. A bank that blocks cloud addresses would break matching in the
browser alone.

The top-level `regions` in `apps/web-app/vercel.json` and
`apps/native-app/vercel.json` moves every function of both projects to
`fra1`, the AI proxy and donations included.

Local development (`bun run dev`, Expo web on `localhost:8081`) calls the
proxy cross-origin, so it needs an edge deployment that lists its origin in
`PAYKY_SERVICE_PROXY_ALLOWED_ORIGINS`; production sets none.

Each browser with the consent on is one more device spending MONETA's daily
call limit (moneta/0010), however many tabs it opens.

## Enforced by

- `packages/core/src/evolu/device-account.test.ts > isServiceProxyEnabled > reads a missing row, null and sqliteFalse as off`
- `packages/core/src/evolu/device-account.test.ts > isServiceProxyEnabled > is left out of the defaults seeding and onboarding write`
- `packages/core/src/integrations/service-proxy/service-proxy-services.test.ts > resolveServiceProxyUpstreamUrl > refuses a path that leaves the service's origin`
- `packages/core/src/integrations/service-proxy/service-proxy-services.test.ts > resolveServiceProxyUpstreamUrl > refuses paths outside the calls the client makes`
- `packages/core/src/integrations/service-proxy/service-proxy-fetch.test.ts > createServiceProxyFetch > asks isEnabled at each call and passes calls through while it is off`
- `packages/core/src/integrations/service-proxy/service-proxy-fetch.test.ts > createServiceProxyFetch > keeps the Fio token out of the URL, sending it in x-proxy-path`
- `packages/core/src/integrations/service-proxy/service-proxy-fetch.test.ts > createServiceProxyFetch > refuses to proxy anything but a GET`
- `packages/core/src/integrations/service-proxy/service-proxy-fetch.test.ts > createServiceProxyFetch > turns a proxy failure into a FetchError, never MonetaUnauthorizedError`
- `packages/core/src/integrations/service-proxy/service-proxy-fetch.test.ts > createServiceProxyFetch > turns an unmarked %s into a FetchError, never a MONETA answer`
- `packages/core/src/integrations/service-proxy/service-proxy-fetch.test.ts > createServiceProxyFetch > turns an unmarked %i into a FetchError, never a Fio HTTP error`
- `packages/core/src/integrations/service-proxy/service-proxy-fetch.test.ts > createServiceProxyFetch > returns the service's own failures as they are`
- `apps/web-app/src/server/service-proxy.test.ts > handleServiceProxyRequest origin checks > passes a same-origin request without an Origin header and sends no CORS headers`
- `apps/web-app/src/server/service-proxy.test.ts > handleServiceProxyRequest origin checks > refuses a foreign Origin with 421 without calling upstream`
- `apps/web-app/src/server/service-proxy.test.ts > handleServiceProxyRequest origin checks > refuses Sec-Fetch-Site %s without an allowed Origin`
- `apps/web-app/src/server/service-proxy.test.ts > handleServiceProxyRequest origin checks > answers an origin allowed by the env with its own ACAO and a vary on origin`
- `apps/web-app/src/server/service-proxy.test.ts > handleServiceProxyRequest origin checks > allows no foreign origin for %s in the env`
- `apps/web-app/src/server/service-proxy.test.ts > handleServiceProxyRequest upstream checks > refuses %s in x-proxy-path without calling upstream`
- `apps/web-app/src/server/service-proxy.test.ts > handleServiceProxyRequest upstream checks > refuses %s with 405 without calling upstream`
- `apps/web-app/src/server/service-proxy.test.ts > handleServiceProxyRequest upstream checks > forwards MONETA's accept and authorization and nothing else`
- `apps/web-app/src/server/service-proxy.test.ts > handleServiceProxyRequest upstream checks > forwards only accept to Fio, never an authorization or a cookie`
- `apps/web-app/src/server/service-proxy.test.ts > handleServiceProxyRequest upstream checks > streams upstream's %i back with its body and content-type, uncached`
- `apps/web-app/src/server/service-proxy.test.ts > handleServiceProxyRequest upstream checks > answers 502 instead of following an upstream redirect`
- `apps/web-app/src/server/service-proxy.test.ts > createServiceProxyFetch against handleServiceProxyRequest > passes MONETA's own 401 back as the service's answer`
- `apps/web-app/src/server/service-proxy-clients.test.ts > the bank clients through the service proxy > $name reaches the bank through the proxy exactly as it does directly`
- `apps/web-app/src/server/service-proxy-clients.test.ts > the bank clients through the service proxy > sends the Fio token to Fio in its path, never in a URL to the proxy`
- `apps/web-app/src/server/service-proxy-clients.test.ts > the bank clients through the service proxy > pages MONETA through the proxy with the bearer token and the account id encoded`
- `apps/web-app/src/platform/platform-deps.test.ts > createFetchDep on a native platform with the service proxy allowed > calls the bank directly, whatever the consent says`
- `apps/web-app/src/platform/platform-deps.test.ts > createFetchDep in a browser > reads the consent at each call, not when the dep is created`
- `apps/web-app/src/atoms/service-proxy.test.ts > serviceProxyConsentAtom > hands out one reader that reads the stored consent at each call`
- `apps/native-app/src/platform/native-deps.test.ts > createFetchDep and the service proxy > calls the banks directly in the APK, whatever the consent`
- `apps/native-app/src/platform/native-deps.test.ts > createFetchDep and the service proxy > reads the consent at each call in the web build, so a fetch handed out earlier follows it`
- `apps/native-app/src/platform/native-deps.test.ts > createFetchDep and the service proxy > proxies through the page's own origin in a deployed PWA, an alias whose origin is not the configured API included`
- `apps/native-app/src/platform/native-deps.test.ts > createFetchDep and the service proxy > proxies through the configured API from Expo's dev server, which has no /api of its own`
- `packages/core/src/background-jobs/background-jobs.test.ts > background job groups > keeps the Fio and MONETA jobs out of the app jobs, in a group of their own`
- `packages/core/src/background-jobs/background-jobs.test.ts > background job groups > runs the MONETA job in the CLI, which reaches the bank as the native app does`
- `packages/core/src/background-jobs/run-background-jobs.test.ts > runBackgroundJobsHoldingLock over $name > lets a second holder wait until the first is disposed`
- `packages/core/src/background-jobs/run-background-jobs.test.ts > runBackgroundJobsHoldingLock over $name > holds a lock of its own per account owner`
- `apps/web-app/src/components/app/app-background-jobs.test.tsx > AppBackgroundJobs, CashuBackgroundJobs and BankBackgroundJobs > in a browser, toggling the service proxy starts and stops the bank jobs alone, in one tab`
- `apps/web-app/src/components/app/app-background-jobs.test.tsx > AppBackgroundJobs, CashuBackgroundJobs and BankBackgroundJobs > in the native app, the bank jobs run without the lock and toggling the service proxy changes nothing`
- `apps/native-app/src/components/app/app-background-jobs.test.ts > app background jobs and the service proxy consent > in the PWA, turning the consent on and off starts and stops the bank jobs alone`
- `apps/native-app/src/components/app/app-background-jobs.test.ts > app background jobs and the service proxy consent > in the APK, the bank jobs run from the start and the consent changes nothing`
- `apps/web-app/e2e/settings-service-proxy.spec.ts > allowing the service proxy in privacy settings hides the Fio browser warning`
- `apps/web-app/e2e/settings-service-proxy.spec.ts > turning the service proxy on or off asks a Basic device for the owner PIN`
- `apps/native-app/src/features/settings/privacy/privacy-settings-page.test.ts > asks for the owner PIN before turning the service proxy on or off`

The region and the absence of logging are read from the two `vercel.json`
files and the handler; no test holds them.
