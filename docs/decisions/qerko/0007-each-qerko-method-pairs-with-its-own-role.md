# 0007 Each Qerko payment method pairs with its own role

Status: accepted
Date: 2026-11-05

## Context

Qerko issues an API key for the roles a pairing asks for: `terminalPayments`
drives the card terminal, `standard` serves Qerko payments over the POS
websocket and the REST calls beside it. A merchant may use one of the two
methods or both, and may try one in the sandbox while the other runs in
production.

A freshly issued `standard` key is paired with no location, and Qerko refuses
the rest of its API until it is: `who-am-i`, the websocket and the payment
calls alike. `get-locations` answers before that and lists the key's company
and its locations, with the one the key is paired with, if any.
`pair-location` pairs it; pairing another location later moves the key and
closes its connections.

## Decision

Each method pairs on its own, with its own role, and keeps its own
`qerkoPlugin` row with its key and environment (`qerkoPluginIdByRole`). The
terminal's row keeps the id it had before roles existed, so no migration is
needed; its `role` column is null and it reads as `terminalPayments`.

Pairing a `standard` key ends with a location:

- right after `confirm-pairing`, `get-locations` proves the key and names the
  company, its id and country, so the country typed in the wizard is not
  needed;
- the merchant chooses a location, the only one or the one the key is already
  paired with preselected, and `pair-location` pairs it;
- the location's id is the restaurant Qerko payments' QR codes name, kept as
  `qerkoPlugin.restaurantId` with its name; `who-am-i` is not used.

A key without a location is paired but not ready: the method cannot be turned
on, the payment screen does not offer it and no device connects. The location
is not changed afterwards; another one means unpairing and pairing again.

## Alternatives considered

One key with both roles: unpairing or moving one method to the sandbox would
take the other with it.

Proving a `standard` key with `who-am-i`, which a key without a location
cannot call. Changing the location from the settings: it would close the
connection and leave the open payments' QR codes naming a location the key no
longer serves.

## Consequences

The wizard is the same for both up to the code; its last step differs. Every
call that needs a key names its role (`loadQerkoCredentials(role)`).

`get-locations` and `pair-location` are on the sandbox first; production
pairing of Qerko payments works once Qerko deploys them there. A changed
location reconnects the device holding the connection, as its `restaurantId`
is part of what it connects with.

## Enforced by

- `packages/core/src/modules/qerko-plugin/qerko-plugin-actions.test.ts > completeQerkoPairing > each role keeps its own key and environment`
- `packages/core/src/modules/qerko-plugin/qerko-plugin-actions.test.ts > completeQerkoPairing > a row written before roles existed reads as the terminal`
- `packages/core/src/modules/qerko-plugin/qerko-plugin-actions.test.ts > completeQerkoPairing > a fresh standard key is proven by get-locations and waits for its location`
- `packages/core/src/modules/qerko-plugin/qerko-plugin-actions.test.ts > completeQerkoPairing > a standard key already paired keeps its location`
- `packages/core/src/modules/qerko-plugin/qerko-plugin-actions.test.ts > pairQerkoPaymentLocation > pairs the key with the location and keeps it as the restaurant`
- `packages/core/src/modules/qerko-plugin/qerko-plugin-actions.test.ts > pairQerkoPaymentLocation > writes nothing when Qerko does not know the location`
- `packages/core/src/background-jobs/jobs/qerko-payment-connection-job.test.ts > qerko payment connection job > connects only once the key is paired with a location`
- `packages/core/src/integrations/qerko/qerko-rpc.test.ts > Qerko URLs > the websocket follows the environment, the QR host does not`
