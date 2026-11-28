# 0034 The bank QR names the business's public name

Status: accepted
Date: 2026-11-28

## Context

payment/0005 named the account's Nostr profile name as the bank QR's
recipient and read it from relays on the payment screen, showing the QR at
once and adding the name when it arrived. onboarding/0016 keeps that name in
the account as `legalEntity.publicName` and publishes the profile from it,
because the relay read held a slow terminal's JS thread for seconds.

## Decision

When the business has a public name, every bank QR names it as the
recipient: SPAYD writes it as `RN`, cut to the 35 characters the format
allows with `*` and `%` percent-encoded, and Pay by square writes it as the
beneficiary. Without one SPAYD carries no recipient and Pay by square falls
back to the payment method's name, as before.

The payment screen reads the name from the account and asks no relay. Only
an account with no stored name, paying by bank transfer, reads its published
profile, and the name found there is stored (onboarding/0016), so that read
happens once.

## Alternatives considered

Reading the profile from relays on every payment session (payment/0005): the
signature checks blocked the first charge for seconds on a PAX A920Pro, and
a QR scanned before the profile arrived carried no name.

## Consequences

The recipient is on the QR from its first frame, and a payment by card, cash
or bitcoin asks no relay for the business's profile. A name stored but not
yet published still reaches customers through the bank QR.

## Enforced by

- `packages/core/src/modules/payment/payment-iban-qr-payload-utils.test.ts > payment IBAN QR payload utils > recipient name > names the public name as the recipient`
- `packages/core/src/modules/payment/payment-iban-qr-payload-utils.test.ts > payment IBAN QR payload utils > recipient name > leaves SPAYD without a recipient and names the bank account in Pay by square when the business has no public name`
- `packages/core/src/modules/payment/payment-iban-qr-payload-utils.test.ts > payment IBAN QR payload utils > recipient name > keeps the SPAYD recipient to 35 characters and encodes the field separator`
