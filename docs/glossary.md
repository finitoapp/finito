# Glossary

The words this codebase uses for its domain, and the pairs that are easy to
mix up. Use these names in code, translation keys and docs. A term links to
where it is specified; the specification wins over this page.

## Brands

- **Brand** (`Brand`, `packages/app-shared/src/brand.ts`) — the name an app
  ships under, with the forms Czech and Slovak decline it into
  (`docs/decisions/brand/`). Copy names it only through `{appName}` and its
  case placeholders.
- **Payky** / **Finito** — the two brands: Payky is the web app and its
  Capacitor shell, Finito the native app and its web export. One account,
  data and protocol behind both; `@payky/*`, `payky:` URIs and the Evolu
  names are internal identifiers, not the brand.

## App shell

- **Terminal** — the app shell: the `_terminal` layout route that wraps
  settings, activity, bills and payments alike (hence `useTerminalHomeMode`,
  `useCreateTerminalPayment`). Not a card terminal; that is **Switchio** or
  **Qerko**.
- **Home** — the index screen inside the terminal (`_terminal.index.tsx`, the
  `home.*` keys).
- **Pos** / **numpad** — the two modes home toggles between: `nav.pos`
  ("Sales", the table grid, `PosOverviewPage`) and `nav.numpad` ("Keypad",
  `TerminalPaymentKeypad`). Neither is another name for the terminal. In
  Finito home is the keypad alone and Sales is the catalog tab's only
  screen (`docs/decisions/navigation/0003`).
- **Menu** — the section behind home's hamburger (`nav.menu`,
  `docs/decisions/navigation/0001`): Home, then the tabs Activity (its
  statistics a sub-tab), Catalog and Settings, switched by a bottom bar on a phone and a
  sidebar on a large monitor. A route joins it through `staticData.menu`.
  Not the café's menu of dishes; that is the **catalog**.
- **Catalog** (tab) — the menu tab holding the catalog items, categories
  and tables under `/catalog`, behind the `catalog` permission
  (`docs/decisions/access/0010`). In Finito the tab is Sales alone and the
  items and tables are set up under `/settings`
  (`docs/decisions/navigation/0003`).

## Selling

- **Catalog item** (`catalog-item`) — a product in the catalog: price, SKU,
  scan code, category, sort order. Editable; editing it never changes past
  sales.
- **Item** (`item`) — an immutable snapshot of what was sold (name, price,
  tax rate) that bill lines point at. Its `catalogItemId` is null for a
  manual amount or a tip.
- **Bill** (`bill`) — the tab: lines, an optional table, a total. Its status
  (`open`/`closed`/`canceled`) is derived, never stored
  (`docs/bill-payment-states.md`). In the UI a canceled bill is
  **discarded** (`bill.discard`).
- **Bill line** (`bill-line`) — an append-only ledger entry on a bill, `kind`
  `add` or `remove`. A bill's total is adds minus removes; a line is never
  edited in place.
- **Table** (`table`) — a table in the venue, with a seat count; a bill can be
  assigned to one, and the pos grid shows them.

## Collecting money

- **Payment** (`payment`) — one attempt to collect money: for a bill, or with
  no bill at all from the keypad. A bill has zero or more payments. Status
  (`pending`/`paid`/`canceled`/`expired`) is derived
  (`docs/bill-payment-states.md`). For EET a payment, not a bill, is the sale
  (`docs/decisions/eet/0001`).
- **Payment line** (`payment-line`) — a frozen snapshot of the bill's net lines
  at the moment a payment was created, so later bill edits show as a diff.
  Not the same as a bill line.
- **Account transaction** (`account-transaction`) — money that actually moved
  on an account: a bank transfer from FIO, a Spark transfer, cash taken, a
  withdrawal. A payment says money is expected; a transaction says it came.
- **Reconciliation claim** (`reconciliation-claim`) — the link that says this
  transaction pays that payment, written by the sync jobs (`source: "auto"`)
  or by hand (`"manual"`). A payment is paid because a claim exists
  (`docs/payment-sync.md`).
- **Coverage** — `paid`/`underpaid`/`overpaid`, derived for a **bill** only
  by comparing its claimed money with its total. A payment has no coverage.
- **Refund** (`refund`) — its own record against one payment, never an edit of
  it (`docs/decisions/refund/0001`); its `refund-line`s point at payment lines.
- **Withdrawal** (`withdraw`) — money sent out of a Spark wallet. Its record is
  written before money leaves and its state is derived
  (`docs/decisions/withdraw/`).
- **Payment number** (`payment-number`) — a payment's serial number and date.
  **Payment number series** (`payment-number-series`) is the format it is
  printed in (prefix, digits, which date parts show).

## Accounts, devices, owners

The word "account" means two unrelated things here.

- **Account** (`packages/core/src/modules/account`, app database) — a place money goes
  to: `iban`, `spark`, `cashRegister` or `cardSwitchio`. The UI calls these
  payment methods (`settings.paymentAccounts.*`).
- **Device account** (`account` in the device database,
  `packages/core/src/evolu/device-account.ts`) — one merchant's whole synced dataset
  held on this device, identified by its master key. The UI calls it the app
  account (`settings.accounts.*`). A **demo account** is a device account
  that never syncs (`docs/decisions/demo-data/0001`).
- **Device database** vs **app database** — the device database is local to
  one device and does not sync (its accounts, settings, PIN attempts). The app
  database is the active device account's synced data. Both have a `device`
  table; the app one is what other devices see of this one.
- **Legal entity** (`legal-entity`) — the merchant's country and VAT-payer
  status; one row per account.
- **Owner** — in access control, the person holding the account's one owner
  PIN (`docs/decisions/access/0001`) and the `owner` preset. Unrelated to an
  Evolu owner (`evoluOwner`), which is the dataset's sync identity.
- **Recovery phrase** — the 20 SLIP-39 words derived from an account's master
  key (`seed` in Linky): the only way to restore the account elsewhere.
  **Verified** means the merchant typed three random words of it back
  (`appSettings.recoveryPhraseVerifiedAt`, `account/0007`); it is the account's
  own fact and syncs, unlike a device's PIN session.
- **Linky owner** — the Evolu identity of Linky, the owner's personal wallet
  app, derived from the same master key next to Payky's own owner
  (`deriveLinkyAppOwnerSecret`). Its app owner holds `shardPointer` and
  `setting`; the shard owners `["cashu", i]` hold the shared Cashu wallet
  (`cashu.md` §2). Payky's own owner never holds a Linky row.
- **`setting`** vs **`appSettings`** — `setting` is Linky's synced key/value
  table under the Linky owner (`defaultMint`, ...), read and written only
  through the Cashu shard store; `appSettings` is Payky's own.
- **Permission** / **preset** — a permission (`sell`, `refund`, ...) gates a
  route or an action; a preset is a named set of them, copied onto a device
  when chosen and never linked afterward (`access-types.ts`).
- **Transport** vs **relay** — a transport is a WebSocket URL a device account
  syncs its Evolu data through; a relay is a nostr server the support chat and
  the contact form talk to.

## Outside services

- **Spark** — the Bitcoin/Lightning wallet SDK behind `spark` accounts.
- **Cashu** — ecash behind `cashu` accounts, in the wallet Payky shares with
  Linky (`cashu.md`). A **mint** issues and redeems the ecash, named by its
  normalised URL (`normalizeMintUrl`); a **proof** (`cashuProof`) is one
  piece of ecash at one mint, worth `amount` sats. A **token** is proofs
  encoded as text (`cashuA…`/`cashuB…`) to hand over; a customer sends one
  over NIP-17 to pay. The **known mints** are those proofs or operations
  name, plus those this device saw or added (`loadKnownCashuMints`); being
  known says nothing about trust. **The payment's mint** is
  `paymentCashu.mintUrl`, the mint its request and topup quote name. Payky
  receives tokens only from the **default mint** (Linky's synced
  `defaultMint`); a received token pays whatever its mint (`cashu/0011`).
- **Lightning address account** — a `lightningAddress` account: the
  merchant's own wallet, reached through its Lightning address (LUD-16).
  Payky asks it for an invoice per payment and watches the invoice's LUD-21
  verify URL; it holds no keys, no balance and offers no withdrawal
  (`lightning-address/0001`). Not the same as **Spark**, whose wallet Payky
  holds, nor as the Lightning address a withdrawal or a donation pays to.
- **FIO** — the Czech bank whose API the IBAN sync job reads.
- **MONETA** — MONETA Money Bank (bank code `0600`), whose VIP API the
  MONETA sync reads with one merchant token (`monetaPlugin`,
  `docs/decisions/moneta/`). Same role as **FIO** for its own accounts.
- **EET** — Czech electronic registration of sales (`docs/eet.md`).
- **Switchio** — the SwitchioPay card terminal app, driven through Android
  intents (`apps/web-app/src/platform/switchio.ts`).
- **Qerko** — the service behind two payment methods, each paired on its own
  (`docs/qerko.md`). Not the same as **Switchio**: Qerko needs no Android
  intent.
  - **Qerko terminal** — a card payment terminal Qerko drives remotely over
    HTTP, so it works in the PWA as well. Its account kind is
    `qerkoTerminal`, its pairing the `qerkoPlugin` of the `terminalPayments`
    role, and the terminal a device pays on `qerkoTerminalSelection` in the
    device database.
  - **Qerko payment** — a QR code the customer pays in the Qerko app, served
    over Qerko's POS websocket by the one device of the account chosen for it
    (`connectionDeviceId`). Its account kind is `qerkoPayment`, its pairing
    the `qerkoPlugin` of the `standard` role, and each Qerko payment of a
    payment a **Qerko attempt** (`qerkoPaymentAttempt`).
