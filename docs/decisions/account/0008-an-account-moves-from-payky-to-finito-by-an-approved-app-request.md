# 0008 An account moves from Payky to Finito by an approved app request

Status: accepted
Date: 2026-11-05

## Context

Finito (`fit.finito.app`) and Payky's Android shell (`me.payky`) open the
same account (brand/0001). A merchant with both on one phone had to type the
20 words into Finito, or run the QR transfer (account/0001), which wants two
devices and a Nostr relay. Android hands an activity result to the calling
activity alone, over the binder, and `getCallingPackage()` names the caller
as the system knows it, unforgeable, but only for a launch for a result.

The owner chose that any app may ask: no signature check, no package
allowlist. The risk of approving an impostor stays with the user.

## Decision

Finito sends an explicit intent (`me.payky.action.SHARE_ACCOUNT`,
package `me.payky`) for a result, carrying a version, a one-time 32-hex
`requestId`, a six-digit code drawn uniformly (rejection sampling) and the
name the requester gives itself (`packages/core/src/integrations/payky-app/account-share-protocol.ts`).
It shows the code before Payky opens.

Payky takes it in `AccountShareActivity`, a UI-less trampoline in the
requester's task (`MainActivity` is `singleTask`, and Android cancels a
for-result launch of such an activity from another task at once). A launch
not for a result has no calling package and is dropped without a word. The
trampoline holds one request in memory; a second one answers both `busy`,
and a request open two minutes answers `expired`. The approval page
(`/settings/accounts/share`, `admin`) shows the caller's label, icon and
package as Android reports them, the claimed name beside them with a
warning when the two differ, the code, the active account, and a warning
that approving gives full access to the account and its money. While it is
up other apps' overlays are hidden (`setHideOverlayWindows`, Android 12+)
and the WebView drops obscured touches.

Payky answers with the active account's `TransferPayload`, the same payload
the QR transfer sends (`createTransferPayload`), with the `requestId`, or
with a refusal: `rejected` (declined, or the page left — back, the PIN lock,
an account switch), `busy`, `expired`, `noAccount` (an account not set up),
`demo` (demo-data/0001), `unsupportedVersion`, `invalidRequest`. Finito
accepts an answer only for its latest `requestId` and adds the account the
way a QR transfer's is added, with `admin` and a confirmation on a device
that already has one. Nothing on either side stores or logs the answer.

Finito offers the transfer, as the first row of the chooser onboarding and
Settings → Accounts share (onboarding/0011), only when the exact intent resolves to an activity in
the installed Payky; it asks again whenever it comes back to the
foreground and after a launch that found no Payky. Off Android it is
never offered.

The code does not authenticate anything: the requester makes it and shows
it, so it always matches. It only ties the screen in Payky to the request
the user just started in Finito, against a second app firing its own
request at the same moment. account/0001 rejected "do they match? [Yes]"
because a click proves nothing about looking; that holds here too, which
is why the code is an aid and the caller's identity, as Android names it,
is the check.

## Alternatives considered

- The QR transfer on one phone: works, but needs a relay and a second
  screen to scan.
- A package allowlist, or pinning Finito's signing certificate: the owner
  ruled them out, so any app may ask; and a pinned certificate ties Payky's
  release to Finito's signing key.
- NIP-44 encrypting the payload to an ephemeral key of the requester: the
  for-result binder reaches the caller alone, and an impostor would make the
  key itself, so it closes no threat.
- Two explicit intents instead of one for a result: there would be no
  calling package to show and the answer would need encrypting.
- A second `BridgeActivity` in the requester's task: two Evolu instances over
  one store in one process without real mutual exclusion
  (`android-webview-locks.ts` only fakes the lock).

## Consequences

- An impostor app the user approves gets the account and its money. The page
  names the real caller, its package and any mismatch with the claimed name,
  but a label is the app's own choice.
- Without access control, anyone holding the unlocked phone can give the
  account away, as with account/0001.
- A result lost with Finito's process is lost; the user asks again.
- A Payky without `AccountShareActivity`, or no Payky, shows nothing in
  Finito: there is no "update Payky" prompt.
- Finito shows the name Payky here, as the source app (brand/0004).

## Enforced by

- `packages/core/src/integrations/payky-app/account-share-protocol.test.ts > account share result > an answer to another request is invalid`
- `packages/core/src/integrations/payky-app/account-share-protocol.test.ts > account share result > a refusal reads as %s`
- `packages/core/src/integrations/payky-app/account-share-protocol.test.ts > account share result > a result with no or an unknown error reads as cancelled`
- `packages/core/src/integrations/payky-app/account-share-protocol.test.ts > share code > draws again past the last whole million, so no code is favoured`
- `packages/core/src/integrations/nostr/nostr-account-transfer.test.ts > createTransferPayload > sends each wss transport once, at most eight, and nothing else`
- `apps/web-app/src/platform/account-share.test.ts > account share protocol in Payky's Android half > drops a launch that is not for a result`
- `apps/web-app/src/platform/account-share.test.ts > account share protocol in Payky's Android half > runs the trampoline in the requester's task and registers the plugin`
- `apps/web-app/src/atoms/account-share.test.ts > AccountShareRequestHost > refuses a request on %o without opening the page`
- `apps/web-app/src/atoms/account-share.test.ts > AccountShareSession > leaving the page unanswered refuses the request`
- `apps/web-app/e2e/account-share.spec.ts > a declined request, or one left, hands nothing over`
- `apps/web-app/e2e/account-share.spec.ts > with access control on, the request waits for the owner PIN`
- `apps/native-app/src/platform/payky-account-request.test.ts > account request protocol in Finito's Android module > stores no result`
- `apps/native-app/src/platform/payky-account-request.test.ts > detecting Payky > off Android the module is not asked`
- `apps/native-app/src/platform/payky-account-request.test.ts > detecting Payky > a launch that found no Payky asks the detection again`
- `apps/native-app/src/features/preview/preview-access.test.ts > requires current-account admin before adding a received account`
