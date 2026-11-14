# 0010 The native app keeps the recovery phrase out of screen capture, and nothing else

Status: accepted
Date: 2026-11-14

## Context

The recovery phrase restores the whole account, wallets included
(account/0009). On Android, `FLAG_SECURE` on the window turns the screen
black in screenshots, screen recordings, screen sharing and the recents
thumbnail. Only a native app can set it; a browser has no equivalent.

Finito set it through expo-screen-capture, and only while the backup showed
the words (account/0006, restated by account/0009). That module also did
something Finito never asked for: as soon as it was created, which happens
while the JS bundle loads, it registered Android 14's screenshot detection
callback for the app's only activity. Android then shows "Finito detected
this screenshot" after every screenshot on every screen, and without
`DETECT_SCREEN_CAPTURE` the registration throws, which crashed v26.11.5 and
v26.11.6 at start on every Android 14+ phone (fixed in v26.11.7 by allowing
the permission again).

The other place the phrase appears, the restore form (onboarding and
Settings › Accounts), was not protected: its words can be shown, and the
unknown words and completions under the grid list them even when hidden.

## Decision

- **Protected: wherever the phrase is shown or typed, and only there.**
  That is the backup while it shows the words and runs the verification
  (`RevealedPhrase`), and the restore form for as long as it is open
  (`RestoreAccountStep`), whether its words are shown or not. The component
  that holds the phrase calls `usePreventScreenCapture()`, not the page or
  route around it, so the backup's introduction stays capturable.
- **Everything else stays capturable**: payment QR codes, the account
  transfer QR (a short-lived session that still needs the six-digit code
  typed on this device, account/0001), stats, receipts, settings. Merchants
  screenshot QR codes and takings, and support asks for screenshots and
  screen sharing; a black screen there protects nothing.
- **FLAG_SECURE is all Finito does.** The local module
  `modules/payky-secure-screen` sets and clears it on the window, and its
  JS side counts holds so overlapping protected components release the
  window only together. Finito never detects screenshots:
  `DETECT_SCREEN_CAPTURE` is blocked in `app.config.ts`, and
  expo-screen-capture is no longer a dependency.

## Alternatives considered

- Keeping expo-screen-capture with the permission allowed (v26.11.7): the
  screenshot notice on every screen stays, and a native side effect at
  start sits outside the app's control.
- Patching expo-screen-capture to register its callback only when a
  listener is added: a patch to carry over every Expo upgrade, for a module
  of which Finito uses two lines.
- Protecting the whole app, or every screen with anything about the
  account: it blocks the screenshots and screen sharing merchants and
  support depend on, and a camera can photograph any screen anyway.
- Protecting the restore form only while its words are shown: the unknown
  words and the completions show them regardless, and a phrase typed field
  by field passes through the screen and the recents thumbnail.

## Consequences

The restore form is black in screenshots and screen sharing, so guided
support can't watch someone type a phrase, which is as intended. Maestro
screenshots of the two protected components come out black on Android; the
documentation screenshots come from the web export, which protects nothing.
The PWA protects nothing either: the module is absent there and
`holdSecureScreen` does nothing. A binary built before the module existed
protects nothing until it is updated. The module is ours to keep building
across Expo upgrades, like `payky-nfc` and the others.

## Enforced by

- `apps/native-app/src/platform/secure-screen.test.ts > keeps the recovery phrase out of screen capture wherever it is shown or typed`
- `apps/native-app/src/platform/secure-screen.test.ts > only sets FLAG_SECURE: no screenshot detection and no permission`
- `apps/native-app/src/platform/secure-screen.test.ts > holdSecureScreen > protects the window until the last hold is released`
- `apps/native-app/src/core/android-permissions.test.ts > blocks screenshot detection and leaves out the module that needs it`
