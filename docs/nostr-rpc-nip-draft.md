NIP-XX
======

RPC over Encrypted Nostr Events (Project-Local Draft)
-----------------------------------------------------

`draft` `optional` `unofficial`

This document is a project-local draft written in a NIP-like style. It is not an assigned NIP number and is based on the behavior implemented in `lib/nostr-message-bus.ts`.

## Abstract

This NIP defines a lightweight request/response RPC transport over encrypted Nostr events.

The protocol specifies:

- a JSON message envelope for requests, results, and errors,
- correlation via request identifiers (`reqId`),
- namespace isolation,
- optional fire-and-forget requests,
- expected client and server behavior.

The protocol is designed for peer-to-peer application RPC where both peers already operate Nostr identities and can exchange encrypted messages.

## Motivation

Nostr applications frequently need direct peer-to-peer interactions that are more structured than plain event streams, for example:

- requesting a resource or state snapshot,
- invoking an action and waiting for completion/failure,
- sending typed application events using the same transport,
- correlating asynchronous replies to specific requests.

This NIP provides a minimal RPC pattern while preserving Nostr-native transport properties:

- event publication,
- tag-based filtering,
- end-to-end encrypted payloads.

## Conventions

The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" in this document are to be interpreted as described in RFC 2119.

## Message Model

RPC messages are JSON objects encoded as UTF-8 JSON strings and encrypted before publication.

All messages MUST include:

- `version` (integer, currently `1`)
- `namespace` (string)
- `type` (string discriminator)
- `reqId` (string request identifier)

### Request Message

A request message has:

- `type: "rpc_request"`
- `method` (string)
- `payload` (JSON value)
- optional `ignoreResponse: true`

Example:

```json
{
  "version": 1,
  "namespace": "tableRequest",
  "type": "rpc_request",
  "reqId": "01952f5f-6f97-7c14-b2c8-7b61b1d9d28f",
  "method": "createPaymentFromSubscribedBill",
  "payload": {
    "subscriptionId": "01952f5e-f5c8-7ad0-8f2f-67dfbd6a4e9f",
    "payment": {
      "paymentId": "p-123"
    }
  }
}
```

### Result Message

A successful result message has:

- `type: "rpc_result"`
- `payload` (JSON value)

Example:

```json
{
  "version": 1,
  "namespace": "tableRequest",
  "type": "rpc_result",
  "reqId": "01952f5f-6f97-7c14-b2c8-7b61b1d9d28f",
  "payload": {
    "subscriptionId": "01952f5e-f5c8-7ad0-8f2f-67dfbd6a4e9f"
  }
}
```

### Error Message

A failed result message has:

- `type: "rpc_error"`
- `error` (string)

Example:

```json
{
  "version": 1,
  "namespace": "tableRequest",
  "type": "rpc_error",
  "reqId": "01952f5f-6f97-7c14-b2c8-7b61b1d9d28f",
  "error": "Unknown RPC method \"foo\""
}
```

## Event Transport

RPC messages are transported using Nostr events with encrypted `content`.

### Event Kind

Implementations using this draft SHOULD use a dedicated application-specific kind.

The reference implementation uses:

- `kind: 23195`

### Required Tags

The sending side MUST include:

- `["p", <recipient-pubkey>]` target peer
- `["d", <namespace>]` namespace discriminator
- `["q", <reqId>]` request correlation identifier

### Optional Tags

The sending side MAY include:

- `["m", <method>]` RPC method name (useful for inspection/debugging)

## Encryption

Message `content` MUST contain the encrypted JSON RPC message.

The reference implementation uses NIP-04 encryption between the sender and recipient pubkeys.

Implementations MAY use a different encryption scheme if both peers agree, but this draft assumes the sender can decrypt responses and the recipient can decrypt requests.

## Namespaces

`namespace` is an application-defined routing domain.

Implementations:

- MUST reject or ignore messages for unknown namespaces,
- SHOULD use distinct namespaces for distinct RPC surfaces,
- MAY reuse the same transport kind across namespaces.

## Client Behavior

### Sending a Request

For request/response calls, a client:

1. MUST generate a unique `reqId`.
2. MUST publish an `rpc_request`.
3. MUST correlate subsequent `rpc_result` / `rpc_error` by `reqId`.
4. SHOULD time out if no response is received within a local timeout.

### Fire-and-Forget Requests

If `ignoreResponse: true` is set:

- the client MUST NOT wait for a response,
- the server MAY omit all responses, including errors.

This mode is appropriate for notification-like semantics.

### Response Validation

A client:

- MUST verify `namespace`,
- MUST verify the response sender is the expected peer,
- MUST ignore unrelated `reqId` values,
- SHOULD ignore malformed JSON or invalid message envelopes.

## Server Behavior

### Subscription Filtering

A server SHOULD subscribe to:

- the chosen RPC event kind,
- events tagged with `#p` matching the server's pubkey,
- events tagged with `#d` matching the namespace.

### Request Handling

Upon receiving an event, a server:

1. MUST decrypt `content`.
2. MUST parse the decrypted content as JSON.
3. MUST validate the message envelope.
4. MUST ignore messages that are not `rpc_request`.
5. MUST route by `method`.
6. MUST return either `rpc_result` or `rpc_error`, unless `ignoreResponse: true`.

### Unknown Methods

If a method is unknown:

- the server MUST return `rpc_error`, unless `ignoreResponse: true`,
- the server MAY silently ignore it when `ignoreResponse: true`.

### Handler Failures

If a handler fails:

- the server SHOULD log the failure,
- the server MUST return `rpc_error`, unless `ignoreResponse: true`.

### Payload Constraints

Handler outputs MUST be JSON values if returned as `rpc_result`.

If a handler produces a non-JSON value, the server MUST treat this as an internal handler error and return `rpc_error` (unless `ignoreResponse: true`).

## Deduplication and Idempotency

Relays or clients MAY deliver duplicate events. Implementations SHOULD assume duplicate delivery is possible.

The reference implementation performs in-memory deduplication of request IDs to avoid re-processing the same request during a single process lifetime.

This does NOT provide persistent exactly-once semantics.

Applications requiring stronger guarantees SHOULD implement domain-level idempotency, for example via:

- request IDs stored in durable storage,
- business object IDs,
- state transition guards.

## Timeouts and Readiness

This draft does not mandate specific timeout values.

Implementations SHOULD define:

- listener readiness behavior (e.g. waiting for EOSE),
- request timeout behavior,
- retry policy (if any).

The reference implementation treats listeners as ready after `EOSE` and applies local request timeouts.

## Error Semantics

`rpc_error.error` is a human-readable string.

This draft does not define structured error codes. Implementations MAY extend `rpc_error` in a future version, but such extensions MUST preserve backward compatibility or negotiate a new `version`.

## Security Considerations

### Sender Authentication

The sender identity is derived from the Nostr event pubkey. Implementations SHOULD verify that responses originate from the expected peer pubkey.

### Confidentiality

RPC payloads may contain sensitive application state. Implementations SHOULD encrypt payloads end-to-end. The reference implementation uses NIP-04.

### Replay and Duplicate Delivery

Nostr relays may replay or duplicate events. Implementations SHOULD:

- deduplicate requests when possible,
- design handlers to be idempotent,
- avoid destructive side effects without idempotency guards.

### Resource Exhaustion

Implementations SHOULD enforce local limits for:

- pending request count,
- request timeout duration,
- deduplication cache size,
- payload size (if applicable).

## Rationale

### Why JSON payloads?

JSON is portable, easy to inspect, and already matches common Nostr client tooling and application payload formats.

### Why `namespace` if tags already exist?

The JSON envelope keeps routing context inside the signed/encrypted payload while tags provide relay-side filtering and debugging convenience.

### Why `ignoreResponse`?

Many application messages are notifications, not true RPC calls. `ignoreResponse` avoids unnecessary subscriptions, pending state, and response traffic.

## Reference Implementation Notes (Non-Normative)

The implementation in `lib/nostr-message-bus.ts` includes the following behaviors:

- event kind `23195`,
- NIP-04 encrypted content,
- listener readiness based on `EOSE`,
- response correlation via `reqId`,
- in-memory request deduplication (bounded cache),
- optional fire-and-forget mode using `ignoreResponse: true`.

## Example Application Namespaces (Non-Normative)

In this project, `lib/table-message-bus.ts` defines two namespaces:

- `tableRequest` for request/response operations
- `tableEvent` for event-like notifications

This demonstrates that multiple RPC surfaces can share one transport pattern while remaining isolated by namespace.
