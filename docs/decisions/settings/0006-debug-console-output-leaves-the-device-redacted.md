# 0006 Debug console output leaves the device redacted

Status: accepted
Date: 2026-11-24

## Context

The Debug Console (`/settings/debug-console`) shows the app's captured
console output, which can hold an IBAN, a recovery phrase, a Cashu token or a
hex secret logged by a background job. Copying, exporting or sending that
output to support puts it on the clipboard, in a file or in a chat, places
the device no longer controls. Error reports already pass a redaction policy
(`packages/app-shared/src/error-scrubbing.ts`) before they leave the device.

## Decision

Copied, exported and sent debug console output passes the same redaction as
error reports (`scrubText`, which now also covers Cashu tokens, for error
reports too). On screen it is not redacted: the screen stays on the device
and is where a developer reads the real values.

Export holds every buffered entry; copy holds what is shown, after the
filters, and the frozen list while the console is paused. The console is not
kept across restarts.

## Alternatives considered

- Redacting on screen too: hides the very values someone debugging on the
  device needs, and protects nothing that has not left it.
- Copying every buffered entry: copy follows what the user is looking at, so
  a filtered view can be pasted as seen; the full buffer is what export is
  for.

## Consequences

A log line that happens to match a pattern (eleven lowercase words in a row,
a 32-hex id) is redacted in the copy too, the same over-redaction error
reports accept. Both apps format through `formatConsoleEntry` and
`formatConsoleLog` in `packages/app-shared/src/console-history.ts`, so the
redaction cannot differ between them.

## Enforced by

- `packages/app-shared/src/console-history.test.ts > formatConsoleEntry > redacts an IBAN, a recovery phrase and a cashu token`
- `packages/app-shared/src/console-history.test.ts > formatConsoleLog > puts the header first, then the entries oldest first, redacted`
- `packages/app-shared/src/console-history.test.ts > formatConsoleLog > redacts a recovery phrase in an entry`
- `packages/app-shared/src/error-scrubbing.test.ts > sentry scrubbing > redacts a cashu token whole, in events too`
- `apps/web-app/e2e/settings-debug-console.spec.ts > capture unhandled errors, then filter, copy and export the log`
