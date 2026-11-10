# Qerko

Two payment methods go through Qerko, each paired on its own (`qerko/0007`):
the **Qerko terminal**, a card terminal Qerko drives over HTTP, and the
**Qerko payment**, a QR code the customer pays in the Qerko app (see
["Qerko payment (QR)"](#qerko-payment-qr) below).

## Qerko card terminal

Qerko (`/api/v4/pos`, <https://qerko.com>) drives a card payment terminal
remotely over HTTP: start a payment, poll it, cancel it, refund it. Its CORS is
open, so unlike SwitchioPay (Android intents) it works in the PWA as well. The
contract is the OpenAPI document at `<base URL>/openapi.json`; the sandbox is
`https://sandbox.qerko.com/api/v4/pos`.

Decisions: [`docs/decisions/qerko/`](decisions/qerko/).

### Pieces

| What | Where |
| --- | --- |
| HTTP client (config dep + Tasks) | `packages/core/src/integrations/qerko/qerko-client.ts` |
| Pairing, the key (`qerkoPlugin`) | `packages/core/src/modules/qerko-plugin/` |
| The terminal a device pays on | `packages/core/src/evolu/device-qerko.ts` (device database) |
| Account kind `qerkoTerminal`, `paymentQerkoTerminal` | `modules/account/`, `modules/payment/payment.ts` |
| Start, poll, cancel a payment | `modules/payment/payment-qerko-actions.ts` |
| Refund to the card | `modules/refund/refund-qerko-actions.ts` |
| Background polling | `background-jobs/jobs/qerko-terminal-sync-job.ts` |

### Pairing

1. `request-pairing` with the company's id and country (CZ, SK, DE, AT, HU)
   makes Qerko e-mail a four-digit code to the company; it answers a
   `pairingRequestId` and how long until the code may be sent again.
2. `confirm-pairing` with the code answers `ok` (the API key), `invalidCode`
   (with the attempts left), `codeExpired` or `maxAttemptsReached`.
3. `get-terminals` with the key names the company and lists locations and
   terminals; only activated ones are offered. The choice is saved on the
   device.

Neither pairing call carries a key, only the `Pos-Id` header; every other call
sends `Pos-Id` and the key as a bearer token. The environment (production or
sandbox) is chosen under "Additional options" when pairing and stored with the
key.

### A payment

`startQerkoTerminalPayment` stores a fresh UUID as the pending attempt, then
calls `create-terminal-payment` with the total (tip included), the tip and the
payment number as `referenceId`. `syncQerkoTerminalPayment` polls
`get-terminal-payment-status` for the pending attempt:

| Qerko says | Payky does |
| --- | --- |
| `pending` + a step | shows the step; Cancel while the card is not yet being authorized |
| `approved` | records the money (`chargedAmount`), keeps the receipt fields, clears the attempt |
| `failed` (declined, cancelled, reversed) | clears the attempt, keeps the reason on the payment's row |
| `unknown` | moves the attempt to unresolved: a confirmed retry is needed |
| `unknownTransaction` | ends the attempt without money, after a grace period |

`create-terminal-payment` answering anything but `started` (busy, terminal not
connected, ...) clears the attempt; an upstream timeout makes it unresolved.

### A refund to the card

`create-terminal-refund` takes the `refundId` from the payment's receipt. The
attempt lives in `qerkoTerminalRefundAttempt` until the terminal approves it;
see `qerko/0004`.

### Running against the sandbox

`VITE_PAYKY_QERKO_POS_ID` (web), `EXPO_PUBLIC_PAYKY_QERKO_POS_ID` (native) and
`PAYKY_QERKO_POS_ID` (CLI) set the `Pos-Id` header; the sandbox accepts any value. Pair with a test
company, choose "Sandbox" under "Additional options", and the terminal is the
sandbox's.

## Qerko payment (QR)

The customer scans the payment's QR code, Qerko opens and they pay there
(card, Apple/Google Pay, meal vouchers). Qerko calls the POS over its POS
websocket (`wss://qerko.com/api/v2/pos/ws`, sandbox
`wss://sandbox.qerko.com/api/v2/pos/ws`; REST stays v4) and the POS answers;
the only REST calls are `get-locations` and `pair-location` when pairing,
`get-payment` and `cancel-payment`. The key is a pairing with the `standard`
role, with its own
environment.

Payky and Finito (`apps/native-app`) both offer it, with the same settings,
payment tab and refund, and both run the connection and sync jobs. On Android
the connection is held only while the app is in the foreground: there is no
background service, so the device chosen to accept Qerko payments must keep
Finito open.

### Pieces

| What | Where |
| --- | --- |
| Websocket envelope, auth, keepalive, close codes | `packages/core/src/integrations/qerko/qerko-rpc.ts` |
| The socket (service dep over the global `WebSocket`) | `packages/core/src/integrations/qerko/qerko-socket.ts` |
| This device's connection state, for the UI | `packages/core/src/integrations/qerko/qerko-connection-status.ts` |
| `get-locations`, `pair-location`, `get-payment`, `cancel-payment`, URLs, QR | `packages/core/src/integrations/qerko/qerko-client.ts` |
| Account kind `qerkoPayment`, `accountQerkoPayment.connectionDeviceId` | `modules/account/` |
| `paymentQerkoPayment`, `qerkoPaymentAttempt` | `modules/payment/payment.ts` |
| What Payky answers Qerko, and settling | `modules/payment/payment-qerko-payment-actions.ts` |
| The connection, on the chosen device | `background-jobs/jobs/qerko-payment-connection-job.ts` |
| `get-payment` when `paymentClosed` never came | `background-jobs/jobs/qerko-payment-sync-job.ts` |
| The refund | `modules/refund/refund-qerko-payment-actions.ts` |

### Pairing

The same wizard as the terminal's up to the code (`request-pairing` with the
`standard` role, `confirm-pairing`). A freshly issued key is paired with no
location, and Qerko refuses the rest of its API until it is (`qerko/0007`):

1. `get-locations` with the key answers before that: the company (name, id,
   country) and its locations, and `pairedLocationId` when the key is paired
   already. The key is saved then, without a location unless it has one.
2. The merchant chooses a location; the only one, or the paired one, starts
   chosen. `pair-location` pairs it, and its id becomes `restaurantId`, the
   restaurant the QR codes name, with its name beside it.
3. The method is turned on and, when asked, this device accepts the payments.

`who-am-i` is not used. A key without a location is paired but not ready: the
method cannot be turned on, the payment screen does not offer it and no
device connects; the settings show its location chooser. The location is
never changed afterwards, since moving the key closes its connections and
orphans open payments' QR codes: another location means unpairing and pairing
again. `get-locations` and `pair-location` reach production after the
sandbox; until then only sandbox keys can be paired.

### The connection

One device of the account, `accountQerkoPayment.connectionDeviceId`, holds the
websocket and serves every device's payments (`qerko/0011`). It sends
`auth-request` at once and waits up to 30 s for `auth-response` (the sandbox
refuses a bad key only after about 15 s), sends a `noop` once authorized and
expects its answer within 5 s, and reconnects after 60 s without any message
(Qerko calls `noop` after 45 s of quiet).

| Close code | Payky does |
| --- | --- |
| `1001` | reconnects at once |
| `4503` | reconnects after 2 minutes |
| `4401` | stops: unpair and pair again |
| `4409` | stops: another connection took it; choosing this device again takes it back |
| anything else | reconnects with backoff, 1 s doubling to a minute |

### A payment

The QR code is `https://qerko.com/~qr/pos/<restaurant id>~<payment id>`, on
production's host in the sandbox too. Qerko hands the part after `~` to
`searchBills`; the bill is one line with the whole payment (`qerko/0009`).

| Qerko calls | Payky does |
| --- | --- |
| `searchBills(qr)`, `getBill(id)` | the payment's bill; `BILL_CLOSED` once it no longer waits; no bill (or `BILL_NOT_FOUND`) for a payment not offered through Qerko |
| `paymentStart(Payment)` | checks it against the bill (`INVALID_DATA`), refuses while another attempt runs (`BILL_LOCKED`), records the attempt |
| `paymentProcessed(id)` | marks the attempt processing, answers the receipt (Qerko cancels without one) |
| `paymentClosed(id, PAID)` | reads the `Payment` with `get-payment`, records the money, closes the attempt as paid |
| `paymentClosed(id, other)` | closes the attempt as failed, no money (`qerko/0008`) |
| table and order calls | answered empty or `NO_SUCH_METHOD` |

An attempt still open 30 s after it started is asked about with `get-payment`
by every device's sync job and by the payment screen (`qerko/0012`). Every
writer reaches the same `qerkoPaymentAttempt` row and fills only what it does
not know yet (`qerko/0013`).

### A refund

`cancel-payment` refunds all of the Qerko payment; it is recorded once Qerko
says `CANCELLED` (`qerko/0010`).

### Running against the sandbox

Pair a test company with "Sandbox" under "Additional options", choose its
location, keep "This device accepts Qerko payments" on, and pay the QR with the
Qerko app in sandbox mode. Choosing a location shows only with a freshly issued
key; a key paired before starts on its location.
