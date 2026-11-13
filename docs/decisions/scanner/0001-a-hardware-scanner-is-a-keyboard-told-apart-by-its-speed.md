# 0001 A hardware scanner is a keyboard, told apart by its speed

Status: accepted
Date: 2026-10-02

## Context

Staff want to add goods to a bill with an external barcode scanner, not
only with the camera in scan mode. USB and Bluetooth scanners act as a
keyboard (HID): they type the code and press Enter. That needs nothing
from the app, but nothing marks those key presses as coming from a
scanner. Payky also listens to the keyboard itself: on the home keypad,
digits followed by Enter charge an amount, so a scanned EAN typed there
would become a charge of billions. Built-in terminal scanners that send
codes as an Android broadcast intent would need a native plugin.

## Decision

Payky supports only scanners that act as a keyboard. A scan is at least
four printable characters, each no more than 50 ms after the one before,
closed by Enter. No setting turns it on or off. The closing Enter is
swallowed before any other handler sees it, so a scan never charges the
keypad and never submits a form.

A scan adds goods to a bill wherever one can take them. On the bill it does
what a camera scan does. On the home screen, in either mode, it opens a new
bill without a table and adds the item there. In the item settings it fills
in or saves the scan code, or opens the item it identifies.

## Alternatives considered

Supporting broadcast-intent scanners with a Capacitor plugin, which was
rejected until a terminal needs it. Most of them can be switched to
keyboard output in their own settings.

A setting to turn the scanner on, which was rejected because a person
cannot type at that pace and an Android soft keyboard does not report the
keys at all, so detection needs no opt-in.

Ignoring a scan on the home screen instead of starting a bill, which was
rejected because a scan there means a customer is buying the item.

## Consequences

The characters of a code still reach whatever has focus, because the
first one arrives before anything marks it as a scan. The bill search
removes them again; any other focused field keeps them. A scanner that
types slower than 50 ms per key, ends with Tab or adds a prefix is not
recognised. A scan while the page is still loading is lost. The global `d`
theme hotkey can fire on a `d` inside an alphanumeric code (Code 128/39)
when no text field has focus; EAN and UPC codes are digits only.

## Enforced by

- `packages/app-shared/src/hardware-scan.test.ts > readScanKey > a fast burst closed by Enter is a scan`
- `packages/app-shared/src/hardware-scan.test.ts > readScanKey > typing at human speed is not a scan`
- `packages/app-shared/src/hardware-scan.test.ts > readScanKey > a burst shorter than the minimum is not a scan`
- `packages/app-shared/src/hardware-scan.test.ts > readScanKey > Enter after a pause is not a scan`
- `apps/native-app/src/features/shared/keypad-keyboard.test.ts > readKeypadKey > undoes a scan burst instead of charging it`
- `apps/web-app/e2e/hardware-scanner.spec.ts > a hardware scan adds the item to the bill outside scan mode`
- `apps/web-app/e2e/hardware-scanner.spec.ts > a hardware scan on the home keypad opens a new bill instead of charging`
- `apps/web-app/e2e/hardware-scanner.spec.ts > a hardware scan on the home screen with an unknown code offers to create the item`
- `apps/web-app/e2e/hardware-scanner.spec.ts > a hardware scan fills the item form and finds items from the list`
