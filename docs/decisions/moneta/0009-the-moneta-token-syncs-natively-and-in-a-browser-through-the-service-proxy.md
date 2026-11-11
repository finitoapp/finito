# 0009 The MONETA token syncs natively, and in a browser through the service proxy

Status: accepted
Date: 2026-11-11

## Context

MONETA Money Bank gives its business clients a VIP API token for their own
accounts: the merchant creates it in the internet bank (Nastavení › Správa
API tokenů, rights "Pasivní – pouze náhled"), it renews itself while the
merchant keeps signing in, and it is sent as `Authorization: Bearer` without
a PSD2 licence. `api.moneta.cz` answers a browser's preflight with a SOAP
fault and no CORS headers (found in linky-fit/linky#649), as Fio's API does.

moneta/0001 therefore called the bank only from the native app and the CLI,
and rejected relaying the calls through Payky's own `/api`. Payky's web app
and Finito's PWA could neither connect a token nor sync. A browser now
reaches the bank through the app's own proxy once the device allows it
(service-proxy/0001).

## Decision

The token is saved in the synced `monetaPlugin` singleton next to the fiat
bank account, as the Fio token is, so every device of the account confirms
transfers once one device connected it. The integration is offered for a CZ
IBAN with bank code `0600` only. Connecting asks the bank which accounts the
token sees and refuses a token that does not see the account's IBAN; the
plugin keeps that IBAN and the bank's id of the account, and syncs only while
the fiat bank account still has that IBAN.

The bank is called directly from the native app and the CLI, and from a
browser (Payky's web app, Finito's PWA) through the service proxy, only while
that device allows it (service-proxy/0001). Connecting, the background sync
and the payment-wait screen's check all go the same way.

## Alternatives considered

A PSD2 (TPP) connection, which needs a licence Payky does not have.

Keeping the browser out, as moneta/0001 did, so that no token passes
Payky's server. Relaying is now accepted, but only behind a consent each
device gives, off by default, through a proxy that passes on only MONETA's
own calls and stores nothing (service-proxy/0001).

## Consequences

The token is stored in plain text in the synced database. Disconnecting wipes
it from the row. With the consent on, the token and the bank's answers pass
Payky's server in Frankfurt. A browser without the consent cannot connect a
token and does not sync; the settings screen says so and leads to the
privacy settings. Moving the fiat bank account to another IBAN leaves the
plugin idle until a token is connected for the new one.

## Enforced by

- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > connectMonetaPlugin > connects the token to the account the bank lists with its IBAN`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > connectMonetaPlugin > refuses a token that sees another account`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > reports no plugin when it is off, disconnected or its IBAN is gone`
- `packages/core/src/modules/shared/iban-utils.test.ts > IBAN utilities > recognizes MONETA Money Bank IBANs by bank code`
- `packages/core/src/background-jobs/background-jobs.test.ts > background job groups > keeps the Fio and MONETA jobs out of the app jobs, in a group of their own`
- `packages/core/src/background-jobs/background-jobs.test.ts > background job groups > runs the MONETA job in the CLI, which reaches the bank as the native app does`
- `packages/core/src/integrations/service-proxy/service-proxy-services.test.ts > resolveServiceProxyUpstreamUrl > resolves every call the MONETA client makes`
- `apps/web-app/src/platform/platform-deps.test.ts > createFetchDep in a browser > reads the consent at each call, not when the dep is created`
- `apps/web-app/src/components/app/app-background-jobs.test.tsx > AppBackgroundJobs, CashuBackgroundJobs and BankBackgroundJobs > in a browser, toggling the service proxy starts and stops the bank jobs alone`
- `apps/native-app/src/components/app/app-background-jobs.test.ts > app background jobs and the service proxy consent > in the PWA, turning the consent on and off starts and stops the bank jobs alone`
