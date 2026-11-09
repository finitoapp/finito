# 0029 The guest's bank QR follows the page language

Status: accepted
Date: 2026-11-12

## Context

A guest's bank reads one of two QR standards: a Czech bank QR Platba, a
Slovak bank PAY by square. The guest page started on the format the owner
set on the bank account, with a toggle between the two above the QR. A
review on 2026-11-12 found a Slovak page starting on QR Platba, which a
Slovak bank does not read, and the toggle drawn like the payment method tabs
right above it, so it read as a second row of tabs with nothing saying
which bank needs which. The page knows the guest's language, from the phone
or picked on the page, and it is the best guess it has of where the guest
banks.

## Decision

The payment step shows one bank QR. A Slovak page starts on PAY by square,
a Czech page on QR Platba, and a page in any other language on the bank
account's format. Under the QR, a link names the other format by the
country whose banks read it, such as "Slovak bank? Show the PAY by square
code", and shows that format in its place. The PAY by square version still
follows table-self-pay/0017.

## Alternatives considered

The owner's format with a toggle, as before: a Slovak guest at a Czech
restaurant started on a code their bank cannot read, and the toggle named
two standards a guest does not know by name.

Both QR codes at once: twice the height above the bank details, and a guest
scanning the wrong one learns nothing from it.

## Consequences

A Czech guest who reads the page in English starts on the account's
format, QR Platba unless the owner set PAY by square. A guest whose bank reads the
other standard needs one tap more than one whose bank matches the language.
Changing the page language moves the QR to that language's format, unless
the guest already picked one with the link.

## Enforced by

- `apps/web-app/src/features/table-self-pay-guest/guest-bank-qr-format.test.ts > the guest's bank QR > is PAY by square on a Slovak page, also for an account set to %s`
- `apps/web-app/src/features/table-self-pay-guest/guest-bank-qr-format.test.ts > the guest's bank QR > is QR Platba on a Czech page, also for an account set to %s`
- `apps/web-app/src/features/table-self-pay-guest/guest-bank-qr-format.test.ts > the guest's bank QR > is the account's %s on an English page`
- `apps/web-app/e2e/table-self-pay.spec.ts > a guest paying at the table > the bank QR follows the page language, PAY by square in Slovak and QR Platba in Czech, each one tap from the other`
