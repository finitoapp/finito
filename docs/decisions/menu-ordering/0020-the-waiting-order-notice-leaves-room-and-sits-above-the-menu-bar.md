# 0020 The waiting-order notice leaves room on every screen and sits above the menu bar

Status: accepted
Date: 2026-11-12

## Context

The notice of a waiting order stays at the bottom of every screen but "To
serve" until staff accept or reject the order (`menu-ordering/0014`), which
accepted that it covers the bottom of those screens. On a phone it covered
what staff need there: home's Charge, the bill's Charge and Split, the end
of a payment detail and of the lists, and the menu bar of a tab's root
screen. Room under the notice was left on some screens only, and at a fixed
height, so a notice that wraps onto more lines covered them again.

## Decision

While the notice shows, every screen of the till leaves room under its
content as tall as the notice is, on both apps, so everything on it sits or
scrolls above the notice. On a screen with the phone's menu bar the notice
sits above the bar, and the screen leaves room for both. Other messages of
the till sit above the bar too.

## Alternatives considered

- Keeping the notice over the screen (`menu-ordering/0014`). Staff could not
  charge a sale while an order waited.
- A fixed room under every screen. A written order's notice carries the
  guest's text and wraps, and a one-line notice would leave a gap.
- The notice at the top of the screen. It would cover the header and Back
  instead.

## Consequences

While an order waits, each screen is shorter by the notice, and one that
fills the screen scrolls. The notice moves up when the menu bar shows and
down when it goes.

## Enforced by

- `apps/web-app/e2e/menu-orders.spec.ts > a paid order is announced, listed to serve and served`
- `apps/native-app/src/atoms/toast.test.ts > the waiting-orders notice's room > is the notice and the gap under it while it shows, and nothing once it leaves`
