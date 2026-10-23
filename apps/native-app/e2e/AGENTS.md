# Native E2E (Maestro)

Conventions for `apps/native-app/e2e/`. The root `AGENTS.md` still applies.
These flows port `apps/web-app/e2e/*.spec.ts` to the native app; read the web
spec and its `support/` helpers before porting one, and keep the same business
assertions.

## Running

- `bun run test:e2e:native:web` / `bun run test:e2e:native:android` (root), or
  `bun run --cwd apps/native-app test:e2e -- --platform web|android [--build]
  [--dev] [e2e/flows/x/y.yaml ...]`. Not part of `bun run check`.
- Needs Maestro 2.11.0 (`curl -Ls https://get.maestro.mobile.dev |
  MAESTRO_VERSION=2.11.0 bash`, lands in `~/.maestro/bin`) and Java 17+.
- The runner builds the e2e app when it is missing or with `--build`, always
  with `EXPO_PUBLIC_PAYKY_E2E=1`: web is an `expo export` in
  `.generated/web` served on `127.0.0.1:8790`, Android a release APK for the
  device's ABI in `.generated/app-e2e.apk`. Rebuild after app changes.
- Android `--dev` is the quick loop: a debug APK (`.generated/app-e2e-debug.apk`,
  rebuilt only with `--build`, i.e. after native changes) loads its JS from an
  e2e Metro on port 8792 (8081 may be a developer's own Metro without the e2e
  switch), so a JS change needs no rebuild. The flows launch it through
  `subflows/launch.yaml` with a dev-client link that keeps the dev menu away;
  an emulator reaches Metro at `10.0.2.2`. Release builds stay the reference
  (CI); run them before calling a batch green.
- Android runs on an emulator only (the first `emulator-*` in `adb devices`)
  unless `ANDROID_SERIAL` names a device. The e2e APK replaces any installed
  `fit.finito.app` (`fit.finito.app.dev` with `--dev`, the debug build's own
  id from `plugins/with-debug-app-id.cjs`), a production Finito included, and
  its data — never point it at someone's phone without asking.
- JUnit and screenshots land in `.generated/report/` (gitignored).

## How a flow is built

- One flow per web test in `flows/<area>/<name>.yaml`, named after it. Header
  is always `appId: ${APP_ID}` plus `tags: [<area>]`; the runner sets
  `APP_ID`/`BASE_URL` per platform and, for web, wraps the body in a
  generated `url:` flow. A flow for one platform only adds `android-only`,
  `web-only` or `ios-only`; a step for one platform uses
  `runFlow: { when: { platform: Android }, ... }`.
- The first step is exactly one of `subflows/start.yaml` (fresh app, strings
  loaded) or `subflows/seed-onboarding.yaml` (web's `seededPage`: fresh app,
  onboarded by the bridge, English, on the terminal home). Never start twice
  in one flow: on web a second `clearState` with the page open hangs the app
  on its splash. Each web flow runs in its own Maestro invocation because
  `clearState` does not clear OPFS there.
- Copy comes from the translations: `${output.t["pay.request"]}`, templated
  strings `'${output.tv("bill.itemsCount", { value: 3 })}'` (quote it for
  YAML). `src/e2e/e2e-strings.test.ts` fails on a key `en` does not have.
  Text selectors are regexes that also match literally. Maestro leaves a
  `${}` holding a literal `$` unevaluated, so an amount spells it `\u0024`
  in single quotes: `'${output.tv("overpayment.title", { amount: "\u00245.00" })}'`.
- Subflows (env in brackets) replace web's `support/` helpers:
  `goto` (`ROUTE`, `TEXT`) is `gotoPage`; `e2e-action` (`ACTION`, `QUERY`)
  runs a bridge action and waits for `E2E OK`; `complete-onboarding` is
  `completeOnboarding` through the real UI; `scroll-to-label` (`LABEL`/`PATTERN`) scrolls to what `tap-label` taps; `tap-label` (`LABEL`) taps a
  kit Button or icon button by its label (or a regex `PATTERN`, "Bill #\\d+");
  `tap-input`, `clear-input`,
  `fill-input` (`LABEL`, `VALUE`) work an input by its field label
  (`type-input` types into an empty one: `clear-input` reads a placeholder
  as text); `assert-label` (`LABEL`) waits for a control by its label;
  `fill-inline` is `fillInlineField` (type, Save, wait for "Saved"); `tap-id`
  taps a control by testID; `relaunch` (`TEXT`) is `reloadPage`;
  `reopen` (`ROUTE`, `TEXT`) is `relaunch` then `goto`, to check a change survived;
  `turn-on-access` (`PIN`, `PRESET`, `KEEP`, `IN_APP`) is `turnOnAccessControl` (it restarts the app to end the PIN session unless `KEEP: "true"`), `type-pin` (`PIN`, 4 digits) is `typePin`, `wrong-pins` five wrong ones, `open-settings-entry` (`TITLE`, `FROM_HOME`) is `openSettingsEntry`, `assert-prompt` (`ACTION`) waits for the one-shot PIN prompt, `open-menu-tab` (`TAB`) is `openMenuTabFromHome` (Home → hamburger → the menu tab), `open-sales` opens the Sales tab in-app (Home → hamburger → Sales), `open-locked-catalog` reaches the PIN screen for the catalog in-app (Settings → Items), `read-phrase` keeps the recovery phrase as `output.phrase`; `enter-amount` (`AMOUNT`, `<` = backspace) is `enterAmount`;
  `assert-checked` (`LABEL`, `CHECKED`) checks a switch, on Android only;
  `add-catalog-item`, `add-table` are web's `addCatalogItem`, `addTable`
  (there is no `add-category`: a category is typed on the item,
  navigation/0003); `enable-table-self-pay` (`TABLE`) is
  `enableTableSelfPay` and waits for the table's QR; `open-table-bill`
  (`TABLE`) is `openTableBill` up to its items; `pizza-and-beer-bill`
  (`TABLE`) is table-self-pay's `seedPizzaAndBeerBill`, keeping the bill's id
  as `output.billId`; `start-new-bill` is `startNewBill`,
  `new-bill` the same from the tables home; `charge-cash` pays the open bill
  in cash and returns home; `read-ids` is web's `new URL(page.url())` for
  ids: the newest bill's and payment's ids as `output.billId` and
  `output.paymentId` (it leaves the app on the bridge page, so `goto` next);
  `add-tax-rate` is `addTaxRate`; `park-cart` is tables-overview's
  `parkCart`; `merge-scenario` is bill-split's `setupMergeScenario`;
  `to-tip-step` enters 5.9 and opens the tip step; `mark-cash-paid` is
  `markCashPaid`; `collision-bill` is `startCollisionBill` (a $5 bill
  canceled behind its pending cash payment, which is then confirmed); `inject-scan` (`CODE`) is `injectScanCode`, the camera
  decoding a code: it opens the newest unfinished bill (a new cart when none
  has a row yet) with the code, as the home screen's hardware scan does, so
  scan mode need not be on and no `E2E OK` is waited for — assert the bill's
  outcome after it. It does not reach the item form or list, whose scans
  come from hardware keys only. `enable-cashu` (`MODE`) puts the Cashu wallet on the
  in-app fake mint, turns Bitcoin on and makes Cashu its main method on
  the Bitcoin screen, where it ends (see the bridge's `fake`);
  `fund-cashu-wallet` takes a Cashu payment and walks to a new Cashu
  withdrawal, by taps only.
  `open-spark-wallet-dialog`, `type-spark-mnemonic`
  (`MNEMONIC`, into the dialog's masked field, not the page's twin behind it),
  `assert-spark-phrase` (`PHRASE`, restarts and reveals the wallet's phrase) and
  `assert-spark-switch-disabled` (Android only) are settings-spark-wallet's
  helpers; `read-invoice` (`EXPIRY`) keeps a fresh 1 000-sat Lightning invoice (the
  `lightningInvoice` action) as `output.invoice`, leaving the app on the
  bridge page; `EXPIRY` (seconds, default an hour) stands in for web's
  `page.clock` by letting it expire for real — the app refuses an invoice a
  minute before its expiry. `next=/withdraw/new?destination=<invoice>`
  (URL-encoded) opens the form with it filled in, sparing the slow typing. The funded fake Spark wallet: open
  `${BASE_URL}e2e/fake?spark=funded&next=/` and wait for home (`next=`
  replaces the bridge, so there is no `E2E OK`); a later link reloads web
  and drops it, so take links (ids, invoices) before it.
  `save-lightning-address` (`ADDRESS`) is web's `saveAddress`, leaving the
  probe's outcome to the caller; `lightning-address-payment` (`ADDRESS`) is
  `setUpPayment`: saved, a 5.90 payment, its Lightning address tab with the QR.
  `allow-assistant` (`OPTION`, the access option's title) is the
  assistant spec's `allowAssistant`, in-app from home (Settings > About >
  Data and privacy, then back to Settings), and `open-assistant` opens the
  assistant from Settings.
- EET (web's `support/eet.ts`): `eet-mock` (`PATH`) calls the EET mock's
  control and fails unless it answers 200 — `/__mock/eet/reset` first in
  every EET flow, `connection?mode=refusing|hanging|answering`,
  `answer-next?answer=<url-encoded FakeEetAnswer>`, `official?available=false`,
  `unanswered`, and
  `expect?env=production|playground&payment=&count=&amounts=&first=&pokl=&lastNegates=`,
  which waits up to 20 s for the requests to match (web's `expect.poll` on
  `fakeEet.requests`); `enable-eet` is `enableEetWithGeneratedCertificate`;
  `import-eet-certificate` (`PASSWORD`) is `importEetCertificate`;
  `select-eet-sandbox` (`CONFIRM`) is `selectEetSandbox`;
  `take-cash-payment` (`AMOUNT`) is `takeCashPayment`, leaving
  `output.paymentId`; `eet-pay-with-tip` is the refund tests' `payWithTip`
  (5.90 + 10 %, 7 cash).
- Optional env: `fill-input`/`fill-inline`/`clear-input` take `PLACEHOLDER`
  (an emptied input with one shows it as its text), `fill-input`/
  `fill-inline`/`tap-input` take `BUTTONS: "true"` for an inline field that
  opens already editing (its Save/Discard cover the input's right end),
  `assert-checked` takes `BY_TEXT: "true"` for a toggle-group option (no
  testID). An optional value passed on to another subflow uses `""` for none.

## The bridge

- Maestro cannot call into the app, so web's `window.__e2e*` functions are
  actions in `src/e2e/e2e-actions.ts`, run by opening `/e2e/<action>?<params>`
  (`app/e2e/[action].tsx`, `free` in `route-access.ts`). The page prints
  `E2E OK <action> [value]` or `E2E FAIL <action>: <message>` in
  `testID="e2e-result"`. Without `EXPO_PUBLIC_PAYKY_E2E` it redirects home.
- Port a web bridge function as an action with its doc comment; params are
  strings, parsed with zod. Opening the same action URL twice in a row is
  not guaranteed to rerun it — navigate elsewhere in between. `next=<path>`
  moves on to that screen in-app after a successful action (web reloads on
  every link, losing in-memory state). `during=<path>` moves on to it as the
  action starts, which then finishes behind that screen and prints nothing:
  the flow waits for what the screen shows of it (guest money arriving on
  the open bill).
- `fake` swaps in outside services until the app restarts, so run it after
  `seed-onboarding` and, on web, move on with `next=`: `spark=funded`
  (`e2e-spark-presets.ts`), `cashu=manual|autopay` (`e2e-cashu-mint.ts`, web's
  `__e2eCashuMint`: an in-app fake mint and no Linky sync; set it before the
  Cashu wallet first starts). `cashuPayQuotes` is web's
  `__e2eCashuPayQuotes` and prints how many quotes it paid; a web link
  reloads the page and loses the mint, so flows use `cashu=autopay` instead,
  which pays open quotes every 4 s by itself.
- `offline` is web's `context.setOffline(true)` for the restore sync screen
  only (`e2e-network.ts`: that screen reads the device as offline, requests
  still go out) until the app restarts, so move on with `next=`;
  `unregisteredMnemonic` prints a fresh phrase no relay knows (web's
  `createUnregisteredMnemonic`). `subflows/restore-offline.yaml` combines
  them into web's offline restore up to "Couldn't sync".

## Mock server

- `scripts/mock-server.ts` answers the outside HTTP services, one handler per
  service in `scripts/mocks/` (the runner starts it and points
  `EXPO_PUBLIC_PAYKY_API_BASE_URL` at it). Services on an https host the app
  cannot be re-pointed at (LNURL: the host comes from a Lightning address)
  are listed in `src/e2e/e2e-fetch.ts`; the fetch dep sends them to
  `/__host/<host>/<path>` on the mock server.
- A flow cannot read back what the app sent, so these mocks decide by the
  request itself (the EET mock has control endpoints instead, below): `mocks/assistant.ts` answers by the last
  question and 400s when the tools, roles or bearer token are not what web's
  spec asserted; `mocks/donation.ts` settles an invoice some seconds after
  creating it, so a flow asserts "waiting" first, then "paid";
  `mocks/lightning-address.ts` is the merchant's wallet on
  `wallet.e2e.test`, deciding by the address: `shop@` pays an invoice some
  seconds after issuing it, with the preimage, `nopreimage@` without one,
  `noverify@` issues invoices without a verify URL;
  `mocks/nostr.ts` is the only nostr relay of an e2e build (`/nostr`,
  websocket) and decides by the business name: "Café Skip" is refused,
  "Café Retry" refused once, a profile that is not the trimmed name refused.
  It keeps every event it accepts and answers a `REQ` by its `kinds`,
  `authors` and `#d`. The build's default self-pay relays lead to it too
  (`src/e2e/e2e-self-pay-relays.ts`, web's `routeFakeNostrRelays`), so table
  views and guest selections never leave the machine.
- `mocks/open-facts.ts` answers every Open Food Facts lookup with web's
  Coca-Cola product and counts them: `open-facts-mock` (`PATH`) calls
  `/__mock/open-facts/reset` or `.../expect?count=N` (web's `lookedUpUrls`)
  and fails unless it answers 200.
- The EET mock (`e2e/scripts/mocks/eet.ts`) answers as EET production and,
  through `EXPO_PUBLIC_PAYKY_EET_PLAYGROUND_URL`, as the sandbox; an e2e
  build's certificate picker skips the document chooser and hands over the
  mock's `CZ1234567890.p12` (password `generated-e2e-password`). Its state
  is shared, so flows tagged `eet` run one at a time on web.
- Migrations (web's `support/migrations.ts`): `seedLegacyFioPlugin` writes
  the pre-singleton Fio plugin rows `fioPluginFixedIdMigration` moves at the
  next start; `holdMigrations` arms the `e2e-hold` migration
  (`src/e2e/e2e-hold-migration.ts`) in the kv store, so it survives the
  restart (`relaunch`) whose migrations it holds, popup up and running;
  `releaseMigrations` lets it finish and disarms it (web's
  `releaseMigrations` + `stopHoldingMigrations`). The popup covers the bridge
  page, so open the release link and wait for the popup's success, not
  `E2E OK`.
- `seedEetSaleFromAnotherDevice` (`paymentId`, `minutes`) records the
  payment's EET sale as another device's, `minutes` ago, printing
  `pokl=<cash register id>`.
- Self-pay (web's `support/self-pay.ts`): `seedActiveFioPlugin` is web's.
  `receiveGuestBankTransfer` (`billId`) is `receiveShownBankTransfer` with
  the guest page's part done in-app (`src/e2e/e2e-self-pay-guest.ts`): it
  reads the table's view from the relays until it shows the bill as the till
  has it, picks a share, publishes that selection, then receives the
  transfer naming its pointer and reconciles it. The share is
  `lines=Beer:1/1,Pizza:1/5` (a fraction of each line, by name),
  `people=<n>` (an equal share) or, with neither, the rest of the bill;
  `amount` (minor units) and `message` replace what the transfer carries.
- Menu (web's `__e2eSeedMenu`): `seedMenu` (`items=name:amount[:internalName],...`,
  `billsHidden`) switches ordering on with this device taking orders and
  puts the items in the menu.
  `receiveMenuOrder` (`table`, `items=name:quantity,...`, `note`, `amount`)
  is web's `__e2eReceiveMenuOrder`: it publishes the order to the self-pay
  relays (the mock relay) and receives the bank transfer naming it, as the
  order device's FIO sync would.

## Selectors

1. Visible translated text.
2. An accessibility label (icon-only buttons): text on Android, but `id:` on
   web (Maestro's web driver reads `aria-label` as an id, not as text), so
   branch on the platform. A missing label is an app bug — fix the app.
3. `id:` = `testID`, only where web uses `data-testid` (same string), or where
   there is no stable text. Every web `data-testid` whose screen native has
   is already mirrored (native-e2e.md, 3.3). On web `id:` reads an element's
   aria-label before its testID, so a testID only works there on an element
   without a label (`table-tile` sits on the unlabeled wrapper, as on web).
   A kit component's Tamagui `name` (Card, Badge) hides its testID the same
   way, so `order-to-serve` sits on an unnamed wrapper.

4. Inputs: `tap-input`/`fill-input`. A kit input's field label is also its
   aria-label and testID, so `id: <label>` finds it on both platforms (a text
   selector on Android also hits the FieldLabel above it). A kit select
   trigger is named the same way: open it with `tap-id`.

`id:` selectors are regexes with no literal fallback: wrap copy in
`output.re(...)` ("Bank account (optional)"). Text selectors fall back to a
literal match, but `output.re` does no harm there either. On Android a text
selector matches `text`, the hint and the content-desc alike.

Never coordinates, index-only selectors, or sleeps; wait with
`extendedWaitUntil` on something visible.

## Gotchas

- The PIN pad's OK is disabled until four digits are typed and Maestro does not see it; wait for the lock's heading (`access.pin.why.route`) instead. A PIN or recovery phrase input hides its text, so `fill-input`'s check-back fails: `tap-input` + `inputText`.

- Typing into inputs: `eraseText` deletes backwards from the cursor on both
  platforms, so `tap-input` taps near the input's right end; typing right
  after an erase on Android races React Native's controlled value, so
  `clear-input` waits for the field to be empty. Use `fill-input`, not a bare
  `eraseText` + `inputText`.
- After typing on Android the keyboard is up, and the next tap elsewhere may
  only close it: put `hideKeyboard` (in an Android-only `runFlow`) first —
  but only where the keyboard is surely up: without one, `hideKeyboard`
  presses Back and leaves the screen.
- With no input focused, `inputText` and `pressKey` (`Backspace`, `Enter`)
  are hardware keys, which the home keypad types. Maestro sets no pace
  between them, so a flow never drives a scan's key burst: scans go through
  `inject-scan`.
- Maestro has no "within": a tile or row's own text is told apart by
  position (`below:`/`above:`/`leftOf:`/`rightOf:` a neighbouring label), or
  by deterministic names (bills are numbered #1, #2, ... in creation order).
- Maestro's web driver ignores opacity and `aria-hidden`, and reports no
  checked state; such checks run on Android only (`when: platform: Android`),
  next to a web-visible assertion where there is one.
- `checked:` and `point:` take no `${}` values; branch with `when: true:`.
- A subflow's own header `env:` overrides what the caller passes, so optional
  env gets no header default: read it as `${typeof X === "undefined" ? ... : X}`.
  Quote a value holding `: ` (YAML), and run a changed flow once: a parse
  error fails the whole Maestro run before any flow starts.
- Text and ids match screens mounted under the current one too (Android
  keeps them): kit inputs, switches and checkboxes take their name as
  testID, so `tap-id`/`tap-input` hit only them.
- `seed-onboarding` relaunches after seeding: the bridge opened over
  onboarding leaves onboarding mounted underneath, and it sends the app home
  on every later settings write.
- RN maps `aria-label` only on View-based components: RN's `Switch` needs
  `accessibilityLabel` (`ui/switch.tsx`).
- Maestro's web driver scrolls only `window` and re-finds the focused input
  through an index-less XPath; in an e2e build `src/e2e/e2e-setup.web.ts`
  makes both work with React Native Web (an inner ScrollView, sibling inputs
  sharing classes). Its native twin mutes LogBox.
- `childOf` does not work on Android for a view with a testID: UIAutomator
  lists its children under another parent.
- A Save button sharing its copy with the page title ("Add item"): select it
  with `below:` the last input.
- Tamagui 3 on web drops `accessibilityLabel`/`accessibilityRole` into the DOM
  as dead attributes; use `aria-label`/`role`/`aria-*` in app code so web gets
  them too.
