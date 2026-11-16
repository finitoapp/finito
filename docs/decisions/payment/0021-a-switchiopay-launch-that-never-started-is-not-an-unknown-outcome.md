# 0021 A SwitchioPay launch that never started is not an unknown outcome

Status: accepted
Date: 2026-11-16

## Context

Before Finito hands an intent to SwitchioPay, its native module stores the
attempt and keeps the launch's promise. Only an `ActivityNotFoundException`
put the two back. A launch could also throw for other reasons: no activity to
launch from (`MissingActivity`), or a `SecurityException` from Android. In
that case the attempt and the promise stayed as they were, although
SwitchioPay never opened. The payment then read as an unknown outcome
(payment/0006). Every later launch of the same kind was refused as still
waiting (payment/0020) until the app restarted. A lookup left hanging this
way blocked every refund, and a closure left hanging this way warned about a
closure that never ran. Payky's Capacitor plugin likewise reported any such
throw as an unknown outcome.

A payment that the terminal never reached also cleared its marker instead of
putting back the row it had overwritten. This happened for a missing
SwitchioPay too, so it dropped the marker of an earlier attempt whose outcome
was still unknown.

## Decision

`startActivityForResult` throws before anything starts. A launch that threw
therefore reached no terminal, whatever it threw. Every SwitchioPay launch
(payment, closure, refund, lookup) goes through one helper in the Kotlin
module. When the launch throws, the helper puts the promise and the store
back as they were before the launch. A missing SwitchioPay still rejects with
`SWITCHIO_NOT_INSTALLED`, and any other throw rejects with
`SWITCHIO_LAUNCH_FAILED`. Payky's plugin rejects with the same codes. Both
apps read the new code as `SwitchioUnavailable` with the reason
`launchFailed`, the error for a terminal that was never reached.

A card payment treats every `SwitchioUnavailable` the way payment/0020 treats
a refused launch. It puts its row back as it was before the attempt,
including the previous attempt's request id and unresolved marker. A refund
to the card leaves no attempt behind, as it already did for a terminal that
never started it (refund/0007). A closure writes nothing.

## Alternatives considered

A new error, `SwitchioLaunchFailed`. `SwitchioUnavailable` already means "the
terminal was never reached" to every caller and screen, so a second error
with the same meaning would only add cases to handle. Catching `Throwable`
in Kotlin. An `Error` such as running out of memory leaves nothing worth
putting back.

## Consequences

A missing SwitchioPay no longer drops an earlier attempt's unresolved marker.
Staff see the "not available" message for a failed launch and can try again
without confirming a retry. The fake module that end-to-end tests use does
not simulate a failed launch. Unit tests read the module's source instead,
as they do for its other rules.

## Enforced by

- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > card payment attempts > a launch that never reached SwitchioPay (payment/0021) > leaves no unknown outcome behind, so the next attempt needs no confirmation`
- `packages/core/src/modules/payment/payment-actions.test.ts > payment actions > card payment attempts > a launch that never reached SwitchioPay (payment/0021) > puts back the earlier attempt whose outcome is unknown, so it still needs confirmation`
- `packages/core/src/modules/refund/refund-switchio-actions.test.ts > refund to the card through SwitchioPay > a refund the terminal never started leaves nothing behind`
- `apps/native-app/src/platform/switchio-restore.test.ts > a launch that never reached SwitchioPay (payment/0021) > reads the Kotlin module's failed launch as unavailable for a payment, a closure and a refund`
- `apps/native-app/src/platform/switchio.test.ts > uses the same launch-failed rejection code on both sides`
- `apps/native-app/src/platform/switchio.test.ts > launches SwitchioPay only through startSwitchio, which puts a launch that threw back as it was`
- `apps/web-app/src/platform/switchio.test.ts > a launch that never reached SwitchioPay in Payky (payment/0021) > uses the same rejection codes in the plugin and in JS`
- `apps/web-app/src/platform/switchio.test.ts > a launch that never reached SwitchioPay in Payky (payment/0021) > rejects any launch that threw, not only a missing SwitchioPay`
- `apps/web-app/src/platform/switchio.test.ts > a launch that never reached SwitchioPay in Payky (payment/0021) > reads the plugin's failed launch as unavailable, not as an unknown outcome`
