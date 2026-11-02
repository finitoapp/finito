# 0001 The MONETA token syncs and is offered for bank code 0600

Status: accepted
Date: 2026-11-01

## Context

MONETA Money Bank gives its business clients a VIP API token for their own
accounts: the merchant creates it in the internet bank (Nastavení › Správa
API tokenů, rights "Pasivní – pouze náhled"), it renews itself while the
merchant keeps signing in, and it is sent as `Authorization: Bearer` without
a PSD2 licence. `api.moneta.cz` answers a browser's preflight with a SOAP
fault and no CORS headers (found in linky-fit/linky#649), as Fio's API does.

## Decision

The token is saved in the synced `monetaPlugin` singleton next to the fiat
bank account, as the Fio token is, so every device of the account confirms
transfers once one device connected it. The integration is offered for a CZ
IBAN with bank code `0600` only. Connecting asks the bank which accounts the
token sees and refuses a token that does not see the account's IBAN; the
plugin keeps that IBAN and the bank's id of the account, and syncs only while
the fiat bank account still has that IBAN. The bank is called only from the
native app and the CLI.

## Alternatives considered

A PSD2 (TPP) connection, which needs a licence Payky does not have. Relaying
the calls through Payky's own `/api`, which would let the web app sync too,
but would send every merchant's token through Payky's server.

## Consequences

The token is stored in plain text in the synced database. Disconnecting wipes
it from the row. A web or PWA terminal cannot connect a token and does not
sync; the settings screen says so. Moving the fiat bank account to another
IBAN leaves the plugin idle until a token is connected for the new one.

## Enforced by

- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > connectMonetaPlugin > connects the token to the account the bank lists with its IBAN`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > connectMonetaPlugin > refuses a token that sees another account`
- `packages/core/src/modules/moneta-plugin/moneta-plugin-actions.test.ts > syncMonetaTransactions > reports no plugin when it is off, disconnected or its IBAN is gone`
- `packages/core/src/modules/shared/iban-utils.test.ts > IBAN utilities > recognizes MONETA Money Bank IBANs by bank code`
- `packages/core/src/background-jobs/background-jobs.test.ts > getBackgroundJobsForRuntime > does not schedule the Fio or MONETA jobs in a regular web runtime`
