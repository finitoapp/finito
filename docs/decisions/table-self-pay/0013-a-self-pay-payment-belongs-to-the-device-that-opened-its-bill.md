# 0013 A self-pay payment belongs to the device that opened its bill

Status: accepted
Date: 2026-10-15

## Context

A guest's money reaches the account through whichever device syncs it, and
every merchant device that sees the arrival records the same payment
(`table-self-pay/0005`). EET reports each sale from one
recording device, under that device's cash register identifier (eet/0009).

## Decision

A self-pay payment names the device that opened its bill, and its claim
names no device. Money naming a bill that has no device stays unmatched for
staff.

## Alternatives considered

None recorded.

## Consequences

The sale is reported from the till the bill was opened on, whichever device
matched the money.

## Enforced by

- `packages/core/src/modules/table-self-pay/table-self-pay-eet.test.ts > self-pay in EET > two devices recording one arrival yield one sale, reported by the device that opened the bill`
- `packages/core/src/modules/table-self-pay/table-self-pay-reconciliation.test.ts > self-pay by bank transfer > does not offer a bill whose device is unknown`
