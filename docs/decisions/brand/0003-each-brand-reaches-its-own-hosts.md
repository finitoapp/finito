# 0003 Each brand reaches its own hosts

Status: accepted
Date: 2026-11-01

## Context

Payky and Finito share an account and its services (brand/0001), but a
Finito user should not meet payky.me: not as the API the native app calls,
not as the donation address, not as the live relay in the sync settings.
The API is one codebase deployed for each brand, on payky.me and on
app.finito.fit.

## Decision

A brand names its hosts: `apiBaseUrl`, `donateLightningAddress` and
`liveRelayHost` in `packages/app-shared/src/brand.ts`. Each app defaults its
API origin, its donation address and the transports of a new account from its
own brand; env variables still override the first two.

- **Live relay.** A new account starts on `live-relay.payky.me` in Payky and
  on `live-relay.finito.fit` in Finito. Both hosts reach the one relay, so
  the room (the app owner id) is shared. The transport is stored per device
  and does not sync, and an account brought from another device keeps the
  transports it came with.
- **Donations.** Both brands pay into the one donation wallet. Finito's
  address is `donate@finito.fit`: the landing on finito.fit forwards the
  LNURL request to the API on app.finito.fit, whose deployment sets
  `PAYKY_DONATE_IDENTIFIER` to that address, as the request's own host is
  app.finito.fit.
- **API.** A deployment serves the brand `PAYKY_BRAND` names (Payky when
  unset) and writes that app's name into what it sends out: the LNURL
  description and the contact form's chat subject. A value naming no brand
  answers the request as not configured.
- **Error reports.** Both apps report to one Sentry project, every event
  tagged with `brand`.

## Alternatives considered

Finito on payky.me's API and relay: rejected, its users would see the other
brand's host in settings and wallets. A relay per brand: rejected, devices of
the two apps on one account would sync only through Linky's plain relay.

## Consequences

The hosts need DNS and TLS before Finito ships: `live-relay.finito.fit` on the
relay's server, and `app.finito.fit` with the API deployed.

## Enforced by

- `apps/web-app/src/server/server-brand.test.ts > server brand > names each brand as the brand itself does`
- `apps/web-app/src/server/server-brand.test.ts > server brand > serves the brand PAYKY_BRAND names, Payky when unset`
- `apps/web-app/api/lnurlp/donate.test.ts > LNURL-pay description > asks for a donation to the app this deployment serves`
- `apps/web-app/api/contact.test.ts > handleContactRequest > names the app the deployment serves in the subject`
- `packages/core/src/evolu/device-account.test.ts > createDefaultEvoluTransportUrls > puts the live relay under the host the app names`
- `apps/native-app/src/core/app-brand.test.ts > the native app's code shows no Payky`
