# 0005 The bank QR names the account's profile as the recipient

Status: superseded by payment/0034
Date: 2026-10-13

## Context

A bank transfer QR carries the recipient's name beside the IBAN: SPAYD 1.0
as the optional `RN` field of at most 35 characters, Pay by square as the
beneficiary name, which its 1.2.0 release made required. The customer's
banking app shows that name on the confirmation screen, so it is what tells
them they are paying the right shop. Payky's SPAYD carried no name, and its
Pay by square carried the payment method's own name, the label the merchant
gave the bank account in settings, which is for them rather than for
customers. The account has a Nostr profile with a name the merchant sets
(`settings.profile.*`), the one place the merchant says who they are.

## Decision

When the account's profile has a name, every bank QR names it as the
recipient: SPAYD writes it as `RN`, cut to the 35 characters the format
allows with `*` and `%` percent-encoded, and Pay by square writes it as the
beneficiary. Without a profile name SPAYD carries no recipient, as before,
and Pay by square falls back to the payment method's name, since it must
carry one.

## Alternatives considered

Putting the payment method's name into SPAYD too. It is a label for the
merchant ("Slovak bank account"), not a name a customer would recognise.
Waiting for the profile to load before showing the QR. The profile comes
from relays, which can be slow or down, and a customer waiting at the
counter outranks a name on their confirmation screen; the QR therefore
shows at once and takes the name when it arrives.

## Consequences

The recipient a customer sees is the merchant's profile name, so the
profile settings now reach customers, not only support chat and the account
list. A QR scanned in the moment before the profile loads carries no name,
or the fallback. The profile is read on the payment screen, which asks the
relays for the active account's profile only, as account/0004 allows.

## Enforced by

- `packages/core/src/modules/payment/payment-iban-qr-payload-utils.test.ts > payment IBAN QR payload utils > recipient name > names the profile as the recipient`
- `packages/core/src/modules/payment/payment-iban-qr-payload-utils.test.ts > payment IBAN QR payload utils > recipient name > leaves SPAYD without a recipient and names the bank account in Pay by square when the profile has no name`
- `packages/core/src/modules/payment/payment-iban-qr-payload-utils.test.ts > payment IBAN QR payload utils > recipient name > keeps the SPAYD recipient to 35 characters and encodes the field separator`
