export const enSettings = {
  "settings.about.app.title": "{appName}",
  "settings.about.description": "Version, terms and contact",
  "settings.about.github.description":
    "Join the development and follow the project",
  "settings.about.github.title": "Source code on GitHub",
  "settings.about.privacy.body":
    "{appName} - PRIVACY POLICY\n\n1. DATA COLLECTION\n{appName} does not sell personal data and is designed to keep application data local to your device. The app stores terminal settings, catalog data, payment records, and related operational data locally and synchronizes application data through Evolu.\n\n2. PAYMENT DATA\nPayment and terminal data may include amounts, timestamps, item names, payment status, Spark wallet information, device identifiers, and other records needed to operate a Bitcoin payment terminal. Keep your device, credentials, backups, and wallet access data, especially your recovery phrase, secure.\n\n3. NETWORK COMMUNICATIONS\nThe app may communicate with:\n- Evolu synchronization infrastructure to sync local-first application data\n- Spark operators and Spark service providers to run the Spark wallet and send or receive Bitcoin payments\n- Lightning or wallet services used to create or settle payments\n- Price or exchange-rate APIs when fiat conversion is enabled\n- Open Food Facts and Open Beauty Facts to look up scanned barcodes, if product lookup is enabled\n- {appName}'s server and its AI provider to answer the AI assistant, if it is enabled: your questions, the assistant's replies and, if you allowed it, the bills and payments it reads\n\nThese services may have their own privacy policies, logs, and retention rules.\n\n4. ANALYTICS AND ERROR REPORTING\n{appName} does not use analytics or tracking services. Optional error reporting through Sentry is available to help diagnose crashes and bugs. It is off by default and only activates if you turn it on in Settings > About > Data and privacy. When enabled, error reports may include device and app information, and error messages and stack traces; recovery phrases and bank account numbers are automatically redacted before being sent.\n\n5. SPARK NETWORK\nPayments through the Spark wallet are processed by Spark operators and Spark service providers, which may see transaction amounts, timing, wallet identifiers, and related metadata.\n\n6. BACKUPS AND SYNC\nIf synchronization or backup features are enabled, application data may be transmitted to synchronization infrastructure. Treat synced data as operational business data and protect every device that can access it.\n\n7. CONTACT\nPrivacy contact details will be published with the project documentation.\n\nLast updated: October 2026",
  "settings.about.privacy.description":
    "Application data is stored locally and synchronized through Evolu.",
  "settings.about.privacy.heading": "{appName} Privacy Policy",
  "settings.about.privacy.summary":
    "Adapted for a local-first Bitcoin payment terminal.",
  "settings.about.privacy.title": "Data and privacy",
  "settings.about.terms.body":
    '{appName} - TERMS OF SERVICE\n\n1. ACCEPTANCE\nBy using this payment terminal application, you agree to these terms.\n\n2. NATURE OF SERVICE\n{appName} is a local-first Bitcoin payment terminal using the Spark protocol for Bitcoin and Lightning payments and related payment infrastructure. You are responsible for how you configure the app, which services you use, and how you handle received funds.\n\n3. ACCESS AND RECOVERY\nKeep your device, credentials, backups, and any wallet access data, especially your recovery phrase, secure. {appName} cannot recover lost credentials, a lost recovery phrase, or funds sent to incorrect destinations.\n\n4. NO WARRANTY\nThis software is provided "as is" without warranty of any kind. Use it at your own risk.\n\n5. LIMITATION OF LIABILITY\nWe are not liable for any loss of funds, business interruption, payment failure, bugs, user error, or third-party network or service failure.\n\n6. SPARK WALLET\nThe Spark wallet is self-custodial: its keys are derived on your device from your recovery phrase. Transfers rely on Spark operators and Spark service providers, which may fail, become unavailable, or change their terms. Only keep balances you are prepared to lose.\n\n7. PRIVACY\n{appName} is designed to store application data locally and synchronize it through Evolu. Payments may still be processed through the Spark network, Lightning services, or other third-party infrastructure, which may have their own privacy policies and logs.\n\n8. UPDATES\nThese terms may be updated. Continued use of {appName} constitutes acceptance of the updated terms.\n\nLast updated: October 2026',
  "settings.about.terms.description":
    "Read the terms that apply when using {appName}.",
  "settings.about.terms.heading": "{appName} Terms of Service",
  "settings.about.terms.summary":
    "Adapted for a local-first Bitcoin payment terminal.",
  "settings.about.terms.title": "Terms of Service",
  "settings.about.title": "About",
  "settings.accountAndSync": "ACCOUNT & SYNC",
  "settings.accounts.add.title": "Add an account",
  "settings.accounts.elsewhere.title": "This account on another device",
  "settings.accounts.create.confirm.cancel": "Cancel",
  "settings.accounts.create.confirm.confirm": "Create account",
  "settings.accounts.create.confirm.description":
    "You'll switch away from {name} and set up a brand new account with its own recovery phrase.",
  "settings.accounts.create.confirm.title": "Create a new account?",
  "settings.accounts.list.active": "Active",
  "settings.accounts.list.createdAt": "Created",
  "settings.accounts.list.empty": "No accounts saved on this device.",
  "settings.accounts.list.remove": "Remove",
  "settings.accounts.list.switch": "Switch",
  "settings.accounts.list.title": "On this device",
  "settings.accounts.nav.description":
    "Choose which user account is active on this device",
  "settings.accounts.nav.title": "Switch User Account",
  "settings.accounts.remove.confirm.cancel": "Keep account",
  "settings.accounts.remove.confirm.confirm": "Remove account",
  "settings.accounts.remove.confirm.description":
    "This device forgets the account and its data. Only its recovery phrase can bring it back — without it, everything in the account is gone for good.",
  "settings.accounts.remove.confirm.title": "Remove {name}?",
  "settings.accounts.restore.failed":
    "Could not restore the account. Please try again.",
  "settings.accounts.restore.mnemonic.checksum":
    "The words are valid, but the phrase is not. Check the order and any typos.",
  "settings.accounts.restore.mnemonic.foreign":
    "This looks like a seed from another wallet. {appName} only restores its own 20-word phrases.",
  "settings.accounts.restore.mnemonic.invalid":
    "Enter 20 words from the {appName} recovery phrase.",
  "settings.accounts.restore.mnemonic.label": "Recovery phrase",
  "settings.accounts.restore.mnemonic.required": "Recovery phrase is required.",
  "settings.accounts.restore.mnemonic.wordCount":
    "The recovery phrase has 20 words.",
  "settings.accounts.title": "App Account",
  "settings.appVersion": "App version:",
  "settings.appVersionCode": "Version code:",
  "settings.appearance": "APPEARANCE & LANGUAGE",
  "settings.cashRegisterAccount.enabled.label": "Enable cash register",
  "settings.cardSwitchioAccount.enabled.label": "Enable card terminal",
  "settings.qerkoTerminal.advanced": "Additional options",
  "settings.qerkoTerminal.code.back": "Back",
  "settings.qerkoTerminal.code.confirm": "Confirm",
  "settings.qerkoTerminal.code.expired":
    "The code has expired. Request a new one.",
  "settings.qerkoTerminal.code.instructions":
    "Enter the 4-digit code that Qerko e-mailed to the owner of the company you entered. If the e-mail did not arrive, contact Qerko technical support.",
  "settings.qerkoTerminal.code.invalid":
    "That code is wrong. Attempts left: {count}.",
  "settings.qerkoTerminal.code.label": "Confirmation code",
  "settings.qerkoTerminal.code.maxAttempts":
    "Too many wrong codes. Request a new one.",
  "settings.qerkoTerminal.code.resend": "Send the code again",
  "settings.qerkoTerminal.code.resendIn":
    "You can send the code again in {time}.",
  "settings.qerkoTerminal.code.title": "Enter the code",
  "settings.qerkoTerminal.company.country.label": "Country",
  "settings.qerkoTerminal.company.identificationNumber.invalid":
    "Enter the company ID.",
  "settings.qerkoTerminal.company.identificationNumber.label": "Company ID",
  "settings.qerkoPayment.title": "Qerko payments",
  "settings.qerkoPayment.unpaired.description":
    "Connect your company's Qerko account so customers can pay by scanning the payment's QR code in the Qerko app. Qerko sends a confirmation code to the company's e-mail.",
  "settings.qerkoPayment.confirm.description":
    "Qerko payments go through one device of the account at a time, for every device. Keep it on with the app open while customers pay.",
  "settings.qerkoPayment.confirm.thisDevice":
    "This device accepts Qerko payments",
  "settings.qerkoPayment.confirm.finish": "Finish",
  "settings.qerkoPayment.paired.title": "Connected to Qerko",
  "settings.qerkoPayment.paired.description":
    "Customers pay by scanning the payment's QR code in the Qerko app.",
  "settings.qerkoPayment.paired.device": "Accepts payments",
  "settings.qerkoPayment.paired.connection": "Connection",
  "settings.qerkoPayment.device.none": "No device",
  "settings.qerkoPayment.device.this": "{name} (this device)",
  "settings.qerkoPayment.device.other": "Another device",
  "settings.qerkoPayment.acceptHere": "Accept on this device",
  "settings.qerkoPayment.stopHere": "Stop accepting here",
  "settings.qerkoPayment.sandbox": "Sandbox",
  "settings.qerkoPayment.connection.idle": "Not connected",
  "settings.qerkoPayment.connection.connecting": "Connecting…",
  "settings.qerkoPayment.connection.connected": "Connected",
  "settings.qerkoPayment.connection.reconnecting":
    "Connection lost, reconnecting…",
  "settings.qerkoPayment.connection.stolen":
    "Another connection took over Qerko payments. Choose this device again to take them back.",
  "settings.qerkoPayment.connection.unauthorized":
    "Qerko no longer accepts this connection. Unpair and pair again.",
  "settings.qerkoPayment.status.noDevice": "No device accepts Qerko payments",
  "settings.qerkoPayment.unpair.confirm.description":
    "Qerko payments stop on every device. Payments already taken stay as they are.",
  "settings.qerkoPayment.location.title": "Choose the location",
  "settings.qerkoPayment.location.description":
    "Qerko payments go to the location you choose here. To change it later, unpair and pair again.",
  "settings.qerkoPayment.location.label": "Location",
  "settings.qerkoPayment.location.empty":
    "Qerko lists no active location for this company.",
  "settings.qerkoPayment.location.failed":
    "The locations could not be loaded. Check the connection and try again.",
  "settings.qerkoPayment.location.keyRejected":
    "Qerko no longer accepts this connection. Unpair and pair again.",
  "settings.qerkoPayment.location.notFound":
    "Qerko no longer knows this location. Choose another one.",
  "settings.qerkoPayment.location.retry": "Try again",
  "settings.qerkoPayment.location.use": "Use this location",
  "settings.qerkoPayment.location.none": "No location chosen",
  "settings.qerkoPayment.paired.company": "Company",
  "settings.qerkoPayment.readiness.active": "Active",
  "settings.qerkoPayment.readiness.connecting": "Connecting…",
  "settings.qerkoPayment.readiness.notAccepting": "Not accepting payments",
  "settings.qerkoPayment.paired.enabled": "Method on",
  "settings.qerkoPayment.paired.success.title": "Qerko payments are on",
  "settings.qerkoPayment.paired.success.description":
    "Customers pay by scanning the QR code on the payment screen, in the Qerko tab.",
  "settings.qerkoPayment.paired.success.noDevice":
    "No device accepts them yet. Choose one below.",
  "settings.qerkoPayment.enabled.label": "Enable Qerko payments",
  "settings.qerkoPayment.status.notPaired": "Not paired with Qerko",
  "settings.qerkoTerminal.enabled.label": "Enable Qerko terminal",
  "settings.qerkoTerminal.environment.description":
    "The sandbox works with test data and charges no real card. Choose it only to try the connection.",
  "settings.qerkoTerminal.environment.label": "Qerko environment",
  "settings.qerkoTerminal.environment.production": "Production",
  "settings.qerkoTerminal.environment.sandbox": "Sandbox (testing)",
  "settings.qerkoTerminal.error.unreachable":
    "Qerko could not be reached. Check the connection and try again.",
  "settings.qerkoTerminal.paired.company": "Company",
  "settings.qerkoTerminal.paired.description":
    "Card payments on this device go to the terminal chosen below.",
  "settings.qerkoTerminal.paired.environmentReadOnly":
    "To change the environment, unpair and pair again.",
  "settings.qerkoTerminal.paired.keyName": "Connection name",
  "settings.qerkoTerminal.paired.title": "Connected to Qerko",
  "settings.qerkoTerminal.requestCode": "Send the code",
  "settings.qerkoTerminal.status.noTerminal":
    "No terminal chosen on this device",
  "settings.qerkoTerminal.status.notPaired": "Not paired with Qerko",
  "settings.cardSwitchioAccount.info.contract":
    "a signed contract with a payment solution provider, for example Comgate.",
  "settings.cardSwitchioAccount.info.description":
    "To accept payment card payments you need:",
  "settings.cardSwitchioAccount.info.softpos":
    "the Switchio SoftPOS app on this device,",
  "settings.cardSwitchioAccount.info.softposLink": "About Switchio SoftPOS",
  "settings.cardSwitchioAccount.info.title": "Payment card payments",
  "settings.cardSwitchioAccount.notInstalledWarning":
    "The Switchio SoftPOS app is not installed on this device.",
  "settings.cardSwitchioAccount.nativeRuntimeWarning":
    "The card terminal is available only in the native app.",
  "catalog.categories.add": "Add category",
  "catalog.categories.delete": "Delete category",
  "catalog.categories.delete.confirm.cancel": "Cancel",
  "catalog.categories.delete.confirm.confirm": "Delete",
  "catalog.categories.delete.confirm.description":
    "Items assigned to {name} will show up as uncategorized once it's deleted.",
  "catalog.categories.delete.confirm.title": "Delete {name}?",
  "catalog.categories.description": "Group your products and services",
  "catalog.categories.empty.description":
    "Add categories to group your products and services, then assign them from the item form.",
  "catalog.categories.empty.title": "No categories yet",
  "catalog.categories.emptySearch": "No categories match your search.",
  "catalog.categories.form.card.description":
    "Name shown when grouping items and filtering on the bill screen.",
  "catalog.categories.form.card.title": "Details",
  "catalog.categories.form.invalidId": "Invalid category id.",
  "catalog.categories.form.name.invalid": "Enter a name.",
  "catalog.categories.form.name.label": "Name",
  "catalog.categories.form.name.placeholder": "e.g. Drinks",
  "catalog.categories.form.notFound": "This category no longer exists.",
  "catalog.categories.form.save.create": "Add category",
  "catalog.categories.form.saved.create": "Category added.",
  "catalog.categories.form.title.create": "Add category",
  "catalog.categories.form.title.edit": "Edit category",
  "catalog.categories.search": "Search categories...",
  "catalog.categories.search.clear.aria": "Clear search",
  "catalog.categories.title": "Categories",
  "settings.cashuAccount.title": "Linky wallet",
  "settings.cashuAccount.wallet.title": "Wallet shared with Linky",
  "settings.cashuAccount.wallet.description":
    "Cashu payments go into the same ecash wallet your Linky app shows. Its balance includes money received in Linky.",
  "settings.cashuAccount.defaultMint": "Default mint",
  "settings.cashuAccount.syncing": "Syncing the wallet with Linky...",
  "settings.cashuAccount.empty": "The wallet holds no ecash yet.",
  "settings.cashuMints.title": "Mints",
  "settings.cashuMints.known": "Your mints",
  "settings.cashuMints.suggested": "Suggested mints",
  "settings.cashuMints.empty": "The wallet knows no mint yet.",
  "settings.cashuMints.default": "Default",
  "settings.cashuMints.add": "Add a mint",
  "settings.cashuMints.url": "Mint URL",
  "settings.cashuMints.addDescription":
    "The mint is checked before it is added. Adding it changes neither the default mint nor which tokens pay your payments.",
  "settings.cashuMints.addError.invalid": "This is not a mint URL.",
  "settings.cashuMints.addError.unreachable": "The mint did not answer.",
  "settings.cashuMints.addError.rejected":
    "The mint was refused: it did not load, or it lists another mint's keys.",
  "settings.cashuMints.invalid": "This mint URL is not valid.",
  "settings.cashuMints.infoUnavailable": "The mint did not answer.",
  "settings.cashuMints.balance": "Balance: {amount}",
  "settings.cashuMints.defaultWarning":
    "New Cashu payments will use this mint, in Linky too. Linky's Lightning address keeps paying into the old mint until you change the default in Linky.",
  "settings.cashuMints.setDefault": "Set as default",
  "settings.cashuMints.remove": "Remove the mint",
  "settings.cashuMints.removeError.inUse":
    "The mint still holds ecash, so it cannot be removed.",
  "settings.cashuMints.move.title": "Move funds",
  "settings.cashuMints.move.description":
    "Moves ecash from this mint to the default mint {mint} over Lightning.",
  "settings.cashuMints.move.amount": "Amount in sat",
  "settings.cashuMints.move.amountDescription":
    "Leave it empty to move everything.",
  "settings.cashuMints.move.estimate": "Estimate the cost",
  "settings.cashuMints.move.estimateResult":
    "{amount} arrives; at most {total} leaves this mint.",
  "settings.cashuMints.move.confirm": "Move",
  "settings.cashuMints.movePinDetail": "{amount} to {mint}",
  "settings.cashuMints.moveError.unreachable":
    "A mint did not answer. Try again later.",
  "settings.cashuMints.moveError.rejected": "A mint refused the move.",
  "settings.cashuMints.moveError.nothing": "There is nothing to move.",
  "settings.cashuMints.moveError.insufficient":
    "The balance does not cover this amount and the fees.",
  "settings.cashuMints.moveError.pending":
    "The move is on its way; it finishes on its own.",
  "settings.cashuAccount.mints": "Mints",
  "settings.cashuAccount.mintsDescription":
    "Default mint, balances, moving funds",
  "settings.cashuAccount.withdraw": "Withdraw funds",
  "settings.cashuAccount.withdrawDescription": "Send ecash out over Lightning",
  "settings.cashuAccount.enabled.label": "Accept Cashu",
  "settings.debugConsole.cashu.title": "Linky Cashu wallet (development)",
  "settings.debugConsole.cashu.activeShard": "Active shard: {index}",
  "settings.debugConsole.cashu.hydrated": "Hydrated: {hydrated}",
  "settings.debugConsole.cashu.noBalance": "No available proofs.",
  "settings.debugConsole.cashu.writeTestSetting":
    "Write a test setting for Linky",
  "settings.debugConsole.clear": "Clear",
  "settings.debugConsole.description": "Inspect captured app console output",
  "settings.debugConsole.empty": "No console entries captured yet.",
  "settings.debugConsole.history.title": "Console output history",
  "settings.debugConsole.pause": "Pause",
  "settings.debugConsole.resume": "Resume",
  "settings.debugConsole.title": "Debug Console",
  "settings.demoData.accountName": "Demo café",
  "settings.demoData.action": "Create demo account",
  "settings.demoData.action.pending": "Creating…",
  "settings.demoData.confirm.cancel": "Cancel",
  "settings.demoData.confirm.confirm": "Create and generate",
  "settings.demoData.confirm.description":
    "The app switches to a new demo account and fills it with fictional data. The only way back is removing the demo account.",
  "settings.demoData.confirm.title": "Create a demo account?",
  "settings.demoData.current.description":
    "Everything in it is fictional and it never syncs. Switch back to your real account under Accounts.",
  "settings.demoData.current.title": "You are in a demo account",
  "settings.demoData.description":
    "Fill a separate demo account with fictional sales",
  "settings.demoData.title": "Demo data",
  "settings.demoData.warning.duration":
    "Generating starts with today and goes back one day at a time. Three months take about half an hour, longer on a phone, but you can stop at any time: the day in progress is finished and the history so far stays.",
  "settings.demoData.warning.irreversible":
    "The demo account is irreversibly filled with up to three months of fictional catalog, tables, payments and refunds. They cannot be removed one by one, only together with the whole demo account.",
  "settings.demoData.warning.newAccount":
    "A new account, “{name}”, is created on this device and becomes the active one. Your current account and its data are not touched; switch back to it under Accounts.",
  "settings.demoData.warning.relays":
    "Sync relays are switched off for the demo account and cannot be switched on, so the fictional data never reaches a relay or another device.",
  "settings.demoData.warning.services":
    "Nothing is sent to the bank, the card terminal or the Lightning network: every outside service is simulated. EET stays off.",
  "settings.demoData.warning.title": "Read before you generate",
  "settings.developers": "DEVELOPERS",
  "settings.donations.amount.invalid": "Enter a positive whole number of sats.",
  "settings.donations.amount.range":
    "The amount is outside the allowed donation range.",
  "settings.donations.amount.required": "Enter a donation amount.",
  "settings.donations.create": "Create invoice",
  "settings.donations.create.pending": "Creating invoice...",
  "settings.donations.description": "Support {appName} development",
  "settings.donations.fiat.description":
    "Uses the currently selected fiat currency.",
  "settings.donations.fiat.label": "Amount",
  "settings.donations.form.description":
    "Enter either amount. The other field is calculated from the current BTC rate.",
  "settings.donations.form.title": "Donation amount",
  "settings.donations.history.amount": "{amount} sats",
  "settings.donations.history.empty.description":
    "Donations will appear here once received.",
  "settings.donations.history.empty.title": "No donations yet",
  "settings.donations.history.error": "Could not load donation history.",
  "settings.donations.history.more": "Show more",
  "settings.donations.history.retry": "Try again",
  "settings.donations.history.title": "Recent donations",
  "settings.donations.invoice.backToSettings": "Back to settings",
  "settings.donations.invoice.copied": "Invoice copied.",
  "settings.donations.invoice.copy": "Copy invoice",
  "settings.donations.invoice.copyFailed": "Could not copy invoice.",
  "settings.donations.invoice.description":
    "Scan this Lightning invoice to pay.",
  "settings.donations.invoice.error": "Could not create the donation invoice.",
  "settings.donations.invoice.missing": "The donation invoice is missing.",
  "settings.donations.invoice.openWallet": "Open in wallet",
  "settings.donations.invoice.title": "Lightning invoice",
  "settings.donations.invoice.verify.error": "Could not verify the payment.",
  "settings.donations.invoice.verify.paid": "Payment received",
  "settings.donations.invoice.verify.paid.description":
    "Thank you for supporting the development of this app.",
  "settings.donations.invoice.verify.waiting": "Waiting for payment...",
  "settings.donations.metadata.error":
    "Could not load the donation Lightning address.",
  "settings.donations.rate.error": "Could not load the BTC exchange rate.",
  "settings.donations.sats.description": "Whole sats only.",
  "settings.donations.sats.label": "Sats",
  "settings.donations.sats.range": "Allowed range: {min}-{max} sats.",
  "settings.donations.title": "Donations",
  "settings.eet.certificate.description":
    "The certificate CA EET issued for signing sales. The reporting EIČ comes from it, and {appName} does not keep its password.",
  "settings.eet.certificate.eic": "Reporting EIČ",
  "settings.eet.certificate.error.expired": "The certificate has expired.",
  "settings.eet.certificate.error.fileRequired": "Choose a certificate file.",
  "settings.eet.certificate.error.notYetValid":
    "The certificate is not valid yet.",
  "settings.eet.certificate.error.unreadable":
    "The file is not a readable cash-register certificate.",
  "settings.eet.certificate.error.withoutEic":
    "The certificate does not name an EIČ.",
  "settings.eet.certificate.error.withoutKey":
    "The file holds no private key for its certificate.",
  "settings.eet.certificate.error.wrongPassword": "The password is wrong.",
  "settings.eet.certificate.expired.description":
    "Sales cannot be reported until a new certificate is imported.",
  "settings.eet.certificate.expired.title": "The certificate has expired",
  "settings.eet.certificate.expiresSoon.description":
    "Renew it in the EET portal and import the new certificate.",
  "settings.eet.certificate.expiresSoon.title": "The certificate expires soon",
  "settings.eet.certificate.file.description":
    "The .p12 file downloaded from the EET portal.",
  "settings.eet.certificate.file.label": "Certificate file",
  "settings.eet.certificate.import": "Import certificate",
  "settings.eet.certificate.imported": "Certificate imported",
  "settings.eet.certificate.none": "No certificate imported yet.",
  "settings.eet.certificate.password.label": "Certificate password",
  "settings.eet.certificate.testBadge": "Test certificate",
  "settings.eet.certificate.title": "Cash-register certificate",
  "settings.eet.certificate.validTo": "Valid until {date}",
  "settings.eet.enabled.description":
    "Only payments received after you turn this on are reported.",
  "settings.eet.enabled.incomplete":
    "EET cannot be turned on until the certificate and the establishment number are set.",
  "settings.eet.enabled.label": "Report sales to EET",
  "settings.eet.enabled.missing": "To turn on EET, add {missing}.",
  "settings.eet.environment.description": "Where {appName} sends sales.",
  "settings.eet.environment.playground.description":
    "For trying EET out. Sales go to the EET test environment and are not reported.",
  "settings.eet.environment.playground.title": "Sandbox",
  "settings.eet.environment.production.description":
    "Sales are reported to the tax administrator.",
  "settings.eet.environment.production.title": "Production",
  "settings.eet.environment.productionUnavailable":
    "Production is not available in this version of {appName} yet.",
  "settings.eet.environment.sandboxConfirm.cancel": "Cancel",
  "settings.eet.environment.sandboxConfirm.confirm": "Use the sandbox",
  "settings.eet.environment.sandboxConfirm.description":
    "Sales will be sent only to the EET test environment. They will not be reported to the tax administrator.",
  "settings.eet.environment.sandboxConfirm.title": "Switch to the EET sandbox?",
  "settings.eet.environment.saved": "Environment saved",
  "settings.eet.environment.testCertificateBlocksProduction":
    "Import a production certificate before switching to production.",
  "settings.eet.environment.title": "Environment",
  "settings.eet.establishment.description":
    "The establishment number assigned in MOJE daně.",
  "settings.eet.establishment.invalid":
    "Enter a whole number without leading zeros.",
  "settings.eet.establishment.label": "Establishment number",
  "settings.eet.gap.certificate": "a cash-register certificate",
  "settings.eet.gap.certificateExpired": "a certificate that has not expired",
  "settings.eet.gap.establishment": "the establishment number",
  "settings.eet.nav.off": "Off",
  "settings.eet.nav.production": "On",
  "settings.eet.nav.sandbox": "Sandbox",
  "settings.eet.officialTest.description":
    "In the sandbox you can use one of the tax administrator's official test certificates instead of a file.",
  "settings.eet.officialTest.loading":
    "Downloading the official test certificates…",
  "settings.eet.officialTest.show": "Use an official test certificate",
  "settings.eet.officialTest.title": "Official test certificates",
  "settings.eet.officialTest.unavailable.description":
    "They could not be downloaded right now. Import a certificate file instead.",
  "settings.eet.officialTest.unavailable.title":
    "Official test certificates are unavailable",
  "settings.eet.officialTest.use": "Use test certificate {name}",
  "settings.eet.officialTest.useShort": "Use",
  "settings.eet.reporting.description":
    "Reports every payment received on this account to the Czech EET 2.0 system. A payment stays paid even when EET is unavailable.",
  "settings.eet.reporting.title": "Sales reporting",
  "settings.eet.test.connection": "Test connection",
  "settings.eet.test.description":
    "Checks the configuration without taking a payment. Nothing sent from here is recorded as a sale.",
  "settings.eet.test.errorCode": "Error {code}: {message}",
  "settings.eet.test.outcome.accepted": "EET confirmed the test sale.",
  "settings.eet.test.outcome.failed": "EET did not accept the message.",
  "settings.eet.test.outcome.verified": "EET accepted the test message.",
  "settings.eet.test.pok": "POK: {pok}",
  "settings.eet.test.rawRequest": "Request",
  "settings.eet.test.rawResponse": "Response",
  "settings.eet.test.sale": "Send test sale",
  "settings.eet.test.title": "Test",
  "settings.eet.test.unavailable":
    "Set up the certificate and the establishment number first.",
  "settings.eet.tip.business.description":
    "{appName} reports the whole payment, tip included.",
  "settings.eet.tip.business.title": "Tips belong to the business",
  "settings.eet.tip.description":
    "Whether a tip is part of the reported sale depends on who it belongs to. A tip that is the business's income must be reported by law. A tip that belongs to employees does not have to be. A change applies to payments received from then on.",
  "settings.eet.tip.employees.description":
    "{appName} reports the payment without the tip. The tip stays recorded on the payment.",
  "settings.eet.tip.employees.title": "Tips belong to employees",
  "settings.eet.tip.label": "Who tips belong to",
  "settings.eet.tip.note":
    "A compulsory cover charge or service charge is not a tip. Charge it as an ordinary item on the bill, and it is always part of the sale.",
  "settings.eet.tip.title": "Tips",
  "settings.eet.title": "EET",
  "settings.eet.unconfirmed.description": "Sales EET has not confirmed yet.",
  "settings.eet.unconfirmed.empty": "EET has confirmed every sale.",
  "settings.eet.unconfirmed.reversal": "Reversal {amount}",
  "settings.eet.unconfirmed.title": "Unconfirmed sales",
  "settings.evoluExport.action": "Export",
  "settings.evoluExport.action.pending": "Exporting...",
  "settings.evoluExport.confirm.description":
    "The export will be saved without redaction.",
  "settings.evoluExport.confirm.label":
    "I understand that the export may contain sensitive data.",
  "settings.evoluExport.database.app": "App database",
  "settings.evoluExport.description":
    "Export local Evolu databases for backup and support",
  "settings.evoluExport.destination.capacitor":
    "The file goes to the share sheet, where you choose where to send it.",
  "settings.evoluExport.destination.web":
    "Files will be downloaded by this browser.",
  "settings.evoluExport.format.description":
    "Each selected database is exported as a raw SQLite file.",
  "settings.evoluExport.format.sqlite": "SQLite",
  "settings.evoluExport.options.description":
    "Choose which local databases should be included.",
  "settings.evoluExport.options.format": "Format",
  "settings.evoluExport.options.title": "Export settings",
  "settings.evoluExport.status.createdAt": "Created at {createdAt}",
  "settings.evoluExport.status.error": "Export failed.",
  "settings.evoluExport.status.handedOff":
    "The share sheet was closed. Check that the file arrived before relying on this backup.",
  "settings.evoluExport.status.success": "Export completed.",
  "settings.evoluExport.status.title": "Export status",
  "settings.evoluExport.title": "Evolu Export",
  "settings.evoluExport.warning.businessData": "business data",
  "settings.evoluExport.warning.description":
    "Full database exports may contain data that grants access to funds, integrations, or private business history. Store exported files securely and share them only with trusted recipients.",
  "settings.evoluExport.warning.localConfiguration":
    "local app configuration and sync settings",
  "settings.evoluExport.warning.payments": "bills, payments, and transactions",
  "settings.evoluExport.warning.secrets":
    "wallet mnemonics, recovery phrases, and API tokens",
  "settings.evoluExport.warning.title": "Sensitive export",
  "settings.evoluExport.warning.walletMetadata": "wallet-related metadata",
  "settings.fiat.czk.title": "Czech koruna",
  "settings.fiat.eur.title": "Euro",
  "settings.fiat.usd.title": "US dollar",
  "settings.fiatBankAccount.advanced": "Advanced options",
  "settings.fiatBankAccount.currency.description":
    "Payments in this currency can use this bank account.",
  "settings.fiatBankAccount.currency.label": "Bank account currency",
  "settings.fiatBankAccount.enabled.label": "Enable fiat bank account",
  "settings.fiatBankAccount.form.description":
    "This app currently uses one deterministic fiat bank account.",
  "settings.fiatBankAccount.form.title": "Bank account details",
  "settings.fiatBankAccount.iban.description":
    "Enter a Czech account number such as 123456789/0100, or an IBAN. The saved value is normalized to IBAN.",
  "settings.fiatBankAccount.iban.format.bban": "Account number",
  "settings.fiatBankAccount.iban.format.iban": "IBAN",
  "settings.fiatBankAccount.iban.invalid":
    "Enter a valid IBAN or Czech account number.",
  "settings.fiatBankAccount.iban.label": "Account number or IBAN",
  "settings.fiatBankAccount.iban.required":
    "Enter your IBAN or account number, or turn bank transfer off.",
  "settings.fiatBankAccount.iban.unknownBank":
    "Unknown bank — we couldn't tell which bank this account belongs to",
  "settings.fiatBankAccount.qrFormat.description":
    "This format is shown first for bank QR payments.",
  "settings.fiatBankAccount.qrFormat.label": "Default QR format",
  "settings.fiatBankAccount.qrFormat.payBySquare1_0_0":
    "Pay by square 1.0 (Slovakia)",
  "settings.fiatBankAccount.qrFormat.payBySquare1_2_0":
    "Pay by square 1.2 (Slovakia)",
  "settings.fiatBankAccount.qrFormat.spayd": "SPAYD (Czechia)",
  "settings.fioPlugin.active.description":
    "When enabled, the plugin checks Fio Bank transactions for the fiat bank account.",
  "settings.fioPlugin.active.label": "Enable Fio plugin",
  "settings.fioPlugin.description":
    "Configure Fio Bank transaction sync tokens",
  "settings.fioPlugin.form.description":
    "The plugin currently uses the deterministic fiat bank account.",
  "settings.fioPlugin.form.title": "Basic settings",
  "settings.fioPlugin.interval.description":
    "Fio answers one token at most once every 30 seconds. The plugin uses the tokens in turn, so it checks this often divided by the number of tokens.",
  "settings.fioPlugin.interval.invalid":
    "Enter a whole number greater than zero.",
  "settings.fioPlugin.interval.label": "Seconds between uses of one token",
  "settings.fioPlugin.lastSyncedDate.description":
    "Local sync pointer. If no pointer exists yet, yesterday is used.",
  "settings.fioPlugin.lastSyncedDate.invalid": "Enter a valid date.",
  "settings.fioPlugin.lastSyncedDate.label": "Last synced date",
  "settings.fioPlugin.nativeRuntimeWarning.description":
    "This app is currently running in a regular browser/PWA environment, so automatic Fio payment checks will not run here.",
  "settings.fioPlugin.nativeRuntimeWarning.title":
    "Fio plugin is available only in the native app.",
  "settings.fioPlugin.syncLookbackDays.description":
    "How many days before the last local sync pointer should be checked again.",
  "settings.fioPlugin.syncLookbackDays.invalid":
    "Enter a whole number greater than zero.",
  "settings.fioPlugin.syncLookbackDays.label": "Sync lookback days",
  "settings.fioPlugin.notFioIbanWarning":
    "This IBAN is not a Fio banka account, so the plugin will not find its payments.",
  "settings.fioPlugin.title": "Fio Plugin",
  "settings.fioPlugin.token.description":
    "Leave empty to update only basic settings.",
  "settings.fioPlugin.token.invalid": "Enter a token up to 255 characters.",
  "settings.fioPlugin.token.label": "Fio API token",
  "settings.fioPlugin.token.required":
    "The first token is required when creating the plugin.",
  "settings.fioPlugin.tokens.active": "Active",
  "settings.fioPlugin.tokens.add.description":
    "Saved on its own, so the settings above can be changed without rewriting it. The sync job rotates through every saved token.",
  "settings.fioPlugin.tokens.add.saved": "Fio API token added.",
  "settings.fioPlugin.tokens.add.submit": "Add token",
  "settings.fioPlugin.tokens.add.title": "Add a token",
  "settings.fioPlugin.tokens.description":
    "Stored tokens are used when checking account transactions.",
  "settings.fioPlugin.tokens.empty": "No tokens saved.",
  "settings.fioPlugin.tokens.item": "Fio API token",
  "settings.fioPlugin.tokens.remove": "Remove",
  "settings.fioPlugin.tokens.title": "Tokens",
  "settings.monetaPlugin.title": "MONETA Plugin",
  "settings.monetaPlugin.description":
    "Confirm transfers to a MONETA Money Bank account automatically",
  "settings.monetaPlugin.status.on": "On",
  "settings.monetaPlugin.status.off": "Off",
  "settings.monetaPlugin.nativeRuntimeWarning.title":
    "The MONETA plugin works only in the mobile app.",
  "settings.monetaPlugin.nativeRuntimeWarning.description":
    "MONETA does not let a browser reach its API. Connect the token in the {appName} mobile app; this terminal then sees the confirmed payments as well.",
  "settings.monetaPlugin.notMonetaIbanWarning":
    "The fiat bank account is not a MONETA Money Bank account (bank code 0600), so there is nothing to connect.",
  "settings.monetaPlugin.connect.title": "Connect a token",
  "settings.monetaPlugin.connect.replaceTitle": "Connect another token",
  "settings.monetaPlugin.connect.description":
    'Create the token in MONETA Internet Banka under Nastavení › Správa API tokenů, with the rights "Pasivní – pouze náhled". {appName} checks with the bank that the token sees this account.',
  "settings.monetaPlugin.connect.submit": "Connect",
  "settings.monetaPlugin.connect.saved": "MONETA token connected.",
  "settings.monetaPlugin.connect.error.unauthorized":
    "The bank refused the token. Check that it is copied whole and has not been revoked.",
  "settings.monetaPlugin.connect.error.accountNotVisible":
    "The token works, but it does not see the account {iban}. Create it for that account.",
  "settings.monetaPlugin.connect.error.rateLimited":
    "The token has used up today's requests to the bank. Try again tomorrow.",
  "settings.monetaPlugin.connect.error.unreachable":
    "The bank is not answering. Check the connection and try again.",
  "settings.monetaPlugin.connect.error.unexpected":
    "The bank answered in an unexpected way. Try again later.",
  "settings.monetaPlugin.token.label": "MONETA API token",
  "settings.monetaPlugin.token.required":
    "Paste the token from Internet Banka.",
  "settings.monetaPlugin.connected.title": "Connected account",
  "settings.monetaPlugin.connected.iban": "Account",
  "settings.monetaPlugin.connected.token": "Token",
  "settings.monetaPlugin.connected.ibanMismatch":
    "The token was connected for the account {iban}, not the current fiat bank account. Connect a token for the current account.",
  "settings.monetaPlugin.active.label": "Confirm payments automatically",
  "settings.monetaPlugin.active.description":
    "Checks the account for incoming transfers in the background and while a payment waits.",
  "settings.monetaPlugin.interval.label": "Seconds between background checks",
  "settings.monetaPlugin.interval.description":
    "A waiting payment is checked every few seconds regardless of this.",
  "settings.monetaPlugin.interval.invalid":
    "Enter a whole number of at least 60.",
  "settings.monetaPlugin.interval.estimate":
    "About {calls} requests a day per device, of the {limit} the bank allows for all devices together.",
  "settings.monetaPlugin.lastSyncedDate.label": "Last synced date",
  "settings.monetaPlugin.lastSyncedDate.description":
    "Where the background sync continues from. Without it, the last two months are read.",
  "settings.monetaPlugin.lastSyncedDate.invalid": "Enter a valid date.",
  "settings.monetaPlugin.disconnect.action": "Disconnect",
  "settings.monetaPlugin.disconnect.confirm.title": "Disconnect MONETA?",
  "settings.monetaPlugin.disconnect.confirm.description":
    "{appName} stops using the token on every device and stops confirming transfers. Payments already confirmed stay as they are. The token stays in the encrypted sync history, so revoke it in MONETA Internet Banka as well.",
  "settings.monetaPlugin.disconnect.confirm.confirm": "Disconnect",
  "settings.monetaPlugin.disconnect.confirm.cancel": "Cancel",
  "settings.homeScreen.atLeastOneMode":
    "Keep at least one mode on — the home screen needs something to show.",
  "settings.homeScreen.modes.description":
    "Choose which views the home screen lets you switch between. With just one on, the switch disappears.",
  "settings.homeScreen.modes.title": "Modes",
  "settings.homeScreen.numpad.description":
    "Type an amount and charge it straight away.",
  "settings.homeScreen.pos.description":
    "Tables and open bills, charged from the catalog.",
  "settings.homeScreen.title": "Home screen",
  "catalog.items.add": "Add item",
  "catalog.items.category.all": "All",
  "catalog.items.category.uncategorized": "Uncategorized",
  "catalog.items.delete": "Delete item",
  "catalog.items.delete.confirm.cancel": "Cancel",
  "catalog.items.delete.confirm.confirm": "Delete",
  "catalog.items.delete.confirm.description":
    "Bills and payments that already used {name} keep their own copy, but it will no longer be available to add to new ones.",
  "catalog.items.delete.confirm.title": "Delete {name}?",
  "catalog.items.description": "Manage products and services you sell",
  "catalog.items.empty.description":
    "Add the products or services you sell so you can quickly add them to a bill.",
  "catalog.items.empty.title": "No items yet",
  "catalog.items.emptySearch": "No items match your search.",
  "catalog.items.form.card.description":
    "Name, price and optional description shown when adding this item to a bill.",
  "catalog.items.form.card.title": "Details",
  "catalog.items.form.category.label": "Category",
  "catalog.items.form.category.none": "No category",
  "catalog.items.form.currency.label": "Currency",
  "catalog.items.form.description.invalid":
    "Description is too long (255 characters max).",
  "catalog.items.form.description.label": "Description",
  "catalog.items.form.description.placeholder": "Optional",
  "catalog.items.form.inMenu.label": "In the menu",
  "catalog.items.form.internalDescription.invalid":
    "Internal description is too long (255 characters max).",
  "catalog.items.form.internalDescription.label": "Internal description",
  "catalog.items.form.internalDescription.placeholder":
    "Optional — visible only to staff",
  "catalog.items.form.internalName.hint":
    "Shown to staff instead of the public name. Customers still see the public name and description on the bill.",
  "catalog.items.form.internalName.invalid":
    "Internal name is too long (255 characters max).",
  "catalog.items.form.internalName.label": "Internal name",
  "catalog.items.form.internalName.placeholder":
    "Optional — shown to staff instead of the public name",
  "catalog.items.form.invalidId": "Invalid item id.",
  "catalog.items.form.menu.description":
    "Guests ordering at the table see the items in the menu, with their public name, description and price.",
  "catalog.items.form.menu.title": "Menu",
  "catalog.items.form.name.invalid": "Enter a name.",
  "catalog.items.form.name.label": "Name",
  "catalog.items.form.name.placeholder": "e.g. Coffee",
  "catalog.items.form.notFound": "This item no longer exists.",
  "catalog.items.form.price.invalid": "Enter a valid price.",
  "catalog.items.form.price.label": "Price",
  "catalog.items.form.save.create": "Add item",
  "catalog.items.form.saved.create": "Item added.",
  "catalog.items.form.scanCode.duplicate": "Already assigned to {name}.",
  "catalog.items.form.scanCode.invalid": "Enter a valid code.",
  "catalog.items.form.scanCode.label": "Scan code",
  "catalog.items.form.scanCode.placeholder": "e.g. 8594001234567",
  "catalog.items.form.scanCode.scan.aria": "Scan code",
  "catalog.items.form.sku.invalid": "SKU is too long (255 characters max).",
  "catalog.items.form.sku.label": "SKU",
  "catalog.items.form.sku.placeholder": "Optional",
  "catalog.items.form.soldOut.description":
    "Guests do not see it until it is available again. It stays in the menu.",
  "catalog.items.form.soldOut.label": "Sold out",
  "catalog.items.form.taxRate.description":
    "Applies to bills and payments once this item is used. Manage rates in Settings › Tax rates.",
  "catalog.items.form.taxRate.label": "Tax rate",
  "catalog.items.form.taxRate.none": "No tax rate",
  "catalog.items.form.title.create": "Add item",
  "catalog.items.form.title.edit": "Edit item",
  "catalog.items.inMenu": "In the menu",
  "catalog.items.search": "Search items...",
  "catalog.items.search.clear.aria": "Clear search",
  "catalog.items.soldOut": "Sold out",
  "catalog.items.title": "Items",
  "settings.language.locale.czech.title": "Czechia",
  "settings.language.locale.description":
    "Choose the regional format used for dates, numbers, and currencies.",
  "settings.language.locale.english.title": "United States",
  "settings.language.locale.slovak.title": "Slovakia",
  "settings.language.locale.title": "Regional format",
  "settings.language.mode.description":
    "Choose which language the app should use.",
  "settings.language.mode.title": "App language",
  "settings.language.title": "Language & Region",
  "settings.legalEntity.country.label": "Country",
  "settings.legalEntity.country.placeholder": "Select a country",
  "settings.legalEntity.currency.description":
    "The fiat currency used by default when creating payments.",
  "settings.legalEntity.currency.label": "Currency",
  "settings.legalEntity.description":
    "Your business's country, currency, and VAT status.",
  "settings.legalEntity.title": "Business",
  "settings.legalEntity.vatPayer.description":
    "Adds tax rates to catalog items.",
  "settings.legalEntity.vatPayer.label": "I am a VAT payer",
  "settings.paymentAccounts.default": "Default",
  "settings.paymentAccounts.experimental": "Experimental",
  "settings.paymentAccounts.method.cashRegister": "Cash",
  "settings.paymentAccounts.method.iban": "Bank transfer",
  "settings.paymentAccounts.method.cashu": "Cashu",
  "settings.paymentAccounts.method.cardSwitchio": "Payment card",
  "settings.paymentAccounts.method.qerkoPayment": "Qerko payment (QR)",
  "settings.paymentAccounts.method.qerkoTerminal": "Card terminal (Qerko)",
  "settings.paymentAccounts.method.spark": "Bitcoin",
  "settings.paymentAccounts.moveDown.aria": "Move {name} down",
  "settings.paymentAccounts.moveUp.aria": "Move {name} up",
  "settings.paymentAccounts.reorder.aria": "Reorder {name}",
  "settings.paymentAccounts.order.description":
    "Customers see payment methods in this order. The first available one opens automatically.",
  "settings.paymentAccounts.status.currencyMismatch":
    "Set up in {currency}, but the app uses {appCurrency}",
  "settings.paymentAccounts.status.unavailableHere":
    "Not available in this version of the app yet",
  "settings.paymentAccounts.status.missingIban":
    "Add a bank account to turn this on",
  "settings.paymentAccounts.title": "Payment methods",
  "settings.paymentNumberSeries.day.default.description":
    "Include the two-digit day in generated payment numbers",
  "settings.paymentNumberSeries.day.default.title": "Show day",
  "settings.paymentNumberSeries.day.hidden.description":
    "Do not include the day in generated payment numbers",
  "settings.paymentNumberSeries.day.hidden.title": "Hide day",
  "settings.paymentNumberSeries.day.label": "Day format",
  "settings.paymentNumberSeries.description":
    "Configure how payment numbers are generated",
  "settings.paymentNumberSeries.form.description":
    "These values define the deterministic payment number series used by the terminal.",
  "settings.paymentNumberSeries.form.title": "Number series format",
  "settings.paymentNumberSeries.lastNumber.date.description":
    "Anchor date used to decide whether the next payment continues or resets the series. Leave empty to reset on the next payment.",
  "settings.paymentNumberSeries.lastNumber.date.invalid": "Enter a valid date.",
  "settings.paymentNumberSeries.lastNumber.date.label": "Anchor date",
  "settings.paymentNumberSeries.lastNumber.description":
    "Override the last used serial number. The next generated payment number will continue from this value.",
  "settings.paymentNumberSeries.lastNumber.serialNumber.description":
    "Last used serial number. For example, enter 499 if the next payment should use 500.",
  "settings.paymentNumberSeries.lastNumber.serialNumber.invalid":
    "Enter zero or a positive whole number.",
  "settings.paymentNumberSeries.lastNumber.serialNumber.label":
    "Last serial number",
  "settings.paymentNumberSeries.lastNumber.title": "Last used number",
  "settings.paymentNumberSeries.month.default.description":
    "Include the two-digit month in generated payment numbers",
  "settings.paymentNumberSeries.month.default.title": "Show month",
  "settings.paymentNumberSeries.month.hidden.description":
    "Do not include the month in generated payment numbers",
  "settings.paymentNumberSeries.month.hidden.title": "Hide month",
  "settings.paymentNumberSeries.month.label": "Month format",
  "settings.paymentNumberSeries.prefix.description":
    "Optional prefix added before generated payment numbers.",
  "settings.paymentNumberSeries.prefix.invalid":
    "Enter a prefix up to 255 characters.",
  "settings.paymentNumberSeries.prefix.label": "Prefix",
  "settings.paymentNumberSeries.serialNumberDigits.description":
    "Minimum number of digits for the increasing serial part.",
  "settings.paymentNumberSeries.serialNumberDigits.invalid":
    "Enter a whole number greater than zero.",
  "settings.paymentNumberSeries.serialNumberDigits.label":
    "Serial number digits",
  "settings.paymentNumberSeries.title": "Payment Number Series",
  "settings.paymentNumberSeries.year.default.description":
    "Include the full four-digit year in generated payment numbers",
  "settings.paymentNumberSeries.year.default.title": "Full year",
  "settings.paymentNumberSeries.year.label": "Year format",
  "settings.paymentNumberSeries.year.short.description":
    "Include the short two-digit year in generated payment numbers",
  "settings.paymentNumberSeries.year.short.title": "Short year",
  "settings.payments": "PAYMENTS",
  "settings.privacy.errorReporting.description":
    "Send crash reports and error details to help fix bugs. Off by default — nothing is sent unless you turn this on.",
  "settings.privacy.errorReporting.disable": "Disable",
  "settings.privacy.errorReporting.disabled": "Disabled",
  "settings.privacy.errorReporting.enable": "Enable",
  "settings.privacy.errorReporting.enabled": "Enabled",
  "settings.privacy.errorReporting.title": "Error reporting",
  "settings.privacy.productLookup.description":
    "When you scan a barcode that isn't in your catalog, look the product up in Open Food Facts and Open Beauty Facts and prefill its name. The scanned code is sent to those services. Off by default.",
  "settings.privacy.productLookup.disable": "Disable",
  "settings.privacy.productLookup.disabled": "Disabled",
  "settings.privacy.productLookup.enable": "Enable",
  "settings.privacy.productLookup.enabled": "Enabled",
  "settings.privacy.productLookup.title": "Product lookup",
  "settings.privacy.aiAssistant.title": "AI assistant",
  "settings.privacy.aiAssistant.description":
    "The assistant answers through {appName}'s server and an AI provider, so what you ask and what it reads leaves this device. Off by default.",
  "settings.privacy.aiAssistant.off.title": "Off",
  "settings.privacy.aiAssistant.off.description":
    "The assistant is hidden and nothing is sent.",
  "settings.privacy.aiAssistant.public.title": "Documentation and code only",
  "settings.privacy.aiAssistant.public.description":
    "It reads {appName}'s public documentation and source code. Your bills and payments stay on this device.",
  "settings.privacy.aiAssistant.all.title": "Including my data",
  "settings.privacy.aiAssistant.all.description":
    "It also reads your bills and payments on this device and sends what it reads to the AI provider.",
  "settings.profile.description":
    "Your Nostr profile, the same one Linky shows for this recovery phrase.",
  "settings.profile.loadFailed":
    "Could not reach any Nostr relay to load your profile. Check your connection and try again.",
  "settings.profile.name.invalid": "The name is too long.",
  "settings.profile.name.label": "Name",
  "settings.profile.name.placeholder": "Your shop's name",
  "settings.profile.npub.copied": "Public key copied",
  "settings.profile.npub.copy": "Copy public key",
  "settings.profile.npub.copyFailed": "Could not copy the public key",
  "settings.profile.npub.label": "Public key",
  "settings.profile.picture.choose": "Choose picture",
  "settings.profile.picture.invalid":
    "This file is not an image the browser can read.",
  "settings.profile.picture.label": "Picture",
  "settings.profile.picture.remove": "Remove picture",
  "settings.profile.retry": "Try again",
  "settings.profile.saveFailed":
    "No Nostr relay accepted the profile. Try again later.",
  "settings.profile.setName": "Set your name",
  "settings.profile.title": "Profile",
  "settings.qerkoTerminal.terminal.change": "Change terminal",
  "settings.qerkoTerminal.terminal.choose": "Choose a terminal",
  "settings.qerkoTerminal.terminal.label": "Terminal on this device",
  "settings.qerkoTerminal.terminal.none": "No terminal chosen on this device",
  "settings.qerkoTerminal.terminals.choose": "Use this terminal",
  "settings.qerkoTerminal.terminals.description":
    "Every device pays on its own terminal. This choice applies to this device only.",
  "settings.qerkoTerminal.terminals.empty":
    "Qerko has no activated terminal for this company yet.",
  "settings.qerkoTerminal.terminals.empty.help":
    "Only Qerko support can set up the terminals available to your company. Contact them, ask them to activate a terminal, then come back and try again.",
  "settings.qerkoTerminal.terminals.failed":
    "The terminals could not be loaded.",
  "settings.qerkoTerminal.terminals.keyRejected":
    "Qerko no longer accepts this pairing. It may have been revoked in Qerko. Pair again to continue.",
  "settings.qerkoTerminal.terminals.keyRejected.action": "Pair again",
  "settings.qerkoTerminal.terminals.later": "Choose later",
  "settings.qerkoTerminal.terminals.platform.physical": "Terminal",
  "settings.qerkoTerminal.terminals.platform.softPos": "SoftPOS",
  "settings.qerkoTerminal.terminals.retry": "Try again",
  "settings.qerkoTerminal.terminals.title": "Choose a terminal",
  "settings.qerkoTerminal.test.action": "Test the connection",
  "settings.qerkoTerminal.test.bankUnreachable":
    "The terminal is connected but cannot reach the payment processor.",
  "settings.qerkoTerminal.test.busy":
    "The terminal is busy with another operation.",
  "settings.qerkoTerminal.test.connected": "The terminal is connected.",
  "settings.qerkoTerminal.test.notActivated":
    "The terminal is not activated in Qerko.",
  "settings.qerkoTerminal.test.notConnected": "The terminal is not connected.",
  "settings.qerkoTerminal.test.running": "Testing…",
  "settings.qerkoTerminal.test.unknownTerminal":
    "Qerko does not know this terminal. Choose it again.",
  "settings.qerkoTerminal.test.upstreamError":
    "Qerko could not reach the terminal.",
  "settings.qerkoTerminal.test.upstreamTimeout":
    "The terminal did not answer in time.",
  "settings.qerkoTerminal.title": "Qerko terminal",
  "settings.qerkoTerminal.unpair.action": "Unpair",
  "settings.qerkoTerminal.unpair.confirm.cancel": "Cancel",
  "settings.qerkoTerminal.unpair.confirm.confirm": "Unpair",
  "settings.qerkoTerminal.unpair.confirm.description":
    "Card payments on the Qerko terminal stop on every device. Payments already taken stay as they are.",
  "settings.qerkoTerminal.unpair.confirm.title": "Unpair from Qerko?",
  "settings.qerkoTerminal.unpaired.description":
    "Connect your company's Qerko account to take card payments on its payment terminals. Qerko sends a confirmation code to the company's e-mail.",
  "settings.qerkoTerminal.unpaired.title": "Pair with Qerko",
  "settings.security.description": "Manage sync transports and recovery access",
  "settings.security.mnemonic.copied": "Recovery phrase copied.",
  "settings.security.mnemonic.copy": "Copy",
  "settings.security.mnemonic.copyError": "Could not copy the recovery phrase.",
  "settings.security.mnemonic.description":
    "Read the recovery phrase for the active local account.",
  "settings.security.mnemonic.help":
    "Keep this phrase private. Anyone with it can restore the account.",
  "settings.security.mnemonic.label": "Recovery phrase",
  "settings.security.mnemonic.title": "Account recovery",
  "settings.security.mnemonic.warning":
    "If you lose this phrase, this account and its data can never be recovered — not even by us.",
  "settings.security.mnemonic.intro":
    "These 20 words are the only way to get this account back on another device or after losing this phone. Keep them in a password manager or on paper — not in a screenshot or a chat. Nobody, not even {appName}, can restore them for you.",
  "settings.security.mnemonic.nativeHint":
    "Write the words on paper in the order shown — do not photograph the screen. Then verify the backup.",
  "settings.security.mnemonic.savePasswords": "Save to passwords",
  "settings.security.mnemonic.savePasswords.saved":
    "Recovery phrase saved to your password manager.",
  "settings.security.mnemonic.savePasswords.unsupported":
    "This browser cannot save to a password manager. Copy the phrase or write it down.",
  "settings.security.mnemonic.savePasswords.failed":
    "Could not save to the password manager.",
  "settings.security.verify.action": "Verify backup",
  "settings.security.verify.title": "Verify your backup",
  "settings.security.verify.description":
    "Type the words {slots} from your written copy. This is optional and blocks nothing.",
  "settings.security.verify.wordLabel": "Word {index}",
  "settings.security.verify.submit": "Check",
  "settings.security.verify.cancel": "Cancel",
  "settings.security.verify.wrong":
    "Those words do not match your recovery phrase. Check your copy and try again.",
  "settings.security.verify.success": "Backup verified.",
  "settings.security.verify.status.verified": "Verified {date}",
  "settings.security.verify.status.unverified": "Not verified",
  "settings.security.backup.description":
    "Whether your recovery phrase is backed up and checked.",
  "settings.security.backup.open": "Back up",
  "settings.security.backup.view": "View backup",
  "settings.security.backup.start": "Show recovery phrase",
  "settings.security.backup.continue": "I wrote it down — verify",
  "settings.security.verify.skip": "Skip verification",
  "settings.security.selfPayRelays.add": "Add relay",
  "settings.security.selfPayRelays.default": "Default",
  "settings.security.selfPayRelays.description":
    "Tables publish their open bills to these Nostr relays, and guests read them from there.",
  "settings.security.selfPayRelays.footer":
    "A table sticker names the relays it reads from. After changing them, print the stickers again: an older sticker reads only the relays it names.",
  "settings.security.selfPayRelays.lastActive":
    "Keep at least one relay on, or guests cannot see their bill.",
  "settings.security.selfPayRelays.refused": "Refused the last publish",
  "settings.security.selfPayRelays.title": "Pay-at-the-table relays",
  "settings.security.selfPayRelays.toggle": "Publish through {url}",
  "settings.security.selfPayRelays.url.description":
    "Only secure WebSocket URLs starting with wss: are allowed.",
  "settings.security.selfPayRelays.url.invalid": "Enter a valid wss URL.",
  "settings.security.selfPayRelays.url.label": "Relay URL",
  "settings.security.title": "Security & Sync",
  "settings.security.transports.add": "Add transport",
  "settings.security.transports.demo":
    "This is a demo account: it never syncs, so its relays stay off.",
  "settings.security.transports.description":
    "Configure Evolu WebSocket sync endpoints for this device account.",
  "settings.security.transports.empty": "No transports saved.",
  "settings.security.transports.footer":
    "Inactive transports stay stored but are ignored when opening the app data.",
  "settings.security.transports.inactive": "Inactive",
  "settings.security.transports.saved": "Transport added.",
  "settings.security.transports.status.synced": "Synced",
  "settings.security.transports.status.syncing": "Syncing…",
  "settings.security.transports.status.connecting": "Connecting…",
  "settings.security.transports.status.offline": "Offline",
  "settings.security.transports.status.error": "Sync error",
  "settings.security.transports.status.errors.version":
    "The app and the relay use incompatible versions. Update the app.",
  "settings.security.transports.status.errors.writeKey":
    "The relay rejected this account's write key.",
  "settings.security.transports.status.errors.quota":
    "The relay's storage for this account is full.",
  "settings.security.transports.status.errors.decrypt":
    "Data from the relay could not be decrypted.",
  "settings.security.transports.status.errors.generic":
    "Syncing with this relay failed.",
  "settings.security.transports.status.lastSynced": "Last synced {time}",
  "settings.security.transports.status.firstSync": "First sync",
  "settings.security.transports.status.unreachable": "Can't reach the relay",
  "settings.security.transports.status.offlineSince": "Since {time}",
  "settings.security.transports.accountId": "account ID",
  "settings.security.transports.toggle": "Sync through {url}",
  "settings.security.transports.title": "Evolu transports",
  "settings.security.transports.url.description":
    "Only secure WebSocket URLs starting with wss: are accepted.",
  "settings.security.transports.url.invalid": "Enter a valid wss URL.",
  "settings.security.transports.url.label": "WebSocket URL",
  "settings.sparkAccount.enabled.label": "Enable Spark account",
  "settings.sparkAccount.advanced": "Advanced options",
  "settings.sparkAccount.form.customDescription":
    "{appName} receives Spark payments into your own wallet.",
  "settings.sparkAccount.form.description":
    "{appName} derives this Spark wallet from your account recovery key.",
  "settings.sparkAccount.form.title": "Spark account",
  "settings.sparkAccount.mnemonic.description":
    "Keep this mnemonic private. Anyone with it can access the Spark wallet.",
  "settings.sparkAccount.mnemonic.label": "Wallet mnemonic",
  "settings.sparkAccount.privacyMode.description":
    "Enables Spark wallet privacy mode for Lightning payments.",
  "settings.sparkAccount.privacyMode.label": "Enable privacy mode",
  "settings.sparkAccount.privacyMode.loadError":
    "Could not load the Spark privacy mode setting.",
  "settings.sparkAccount.privacyMode.loading": "Loading privacy mode...",
  "settings.sparkAccount.syncPointer.description":
    "Local sync pointer for the periodic history rescan. If no pointer exists yet, today is used; the rescan only looks back 72 hours from it.",
  "settings.sparkAccount.syncPointer.invalid": "Enter a valid date.",
  "settings.sparkAccount.syncPointer.label": "Last synced date",
  "settings.sparkAccount.wallet.cancel": "Cancel",
  "settings.sparkAccount.wallet.change": "Change wallet…",
  "settings.sparkAccount.wallet.changeDialog.current":
    "This wallet is already in use.",
  "settings.sparkAccount.wallet.changeDialog.description":
    "Choose the wallet new Spark payments go to.",
  "settings.sparkAccount.wallet.changeDialog.inUse": "In use now.",
  "settings.sparkAccount.wallet.changeDialog.invalid":
    "This is not a valid 12-word mnemonic.",
  "settings.sparkAccount.wallet.changeDialog.title": "Change wallet",
  "settings.sparkAccount.wallet.changeDialog.wordCount": "{value}/12 words",
  "settings.sparkAccount.wallet.custom.description":
    "A Spark wallet you bring by its 12-word mnemonic.",
  "settings.sparkAccount.wallet.custom.title": "Your own wallet",
  "settings.sparkAccount.wallet.label": "Wallet",
  "settings.sparkAccount.wallet.payky.description":
    "Derived from your account recovery key.",
  "settings.sparkAccount.wallet.payky.title": "{appName} wallet",
  "settings.sparkAccount.wallet.switch": "Switch",
  "settings.sparkAccount.wallet.warning.funds":
    "Its funds stay in the current wallet and are no longer shown here. Withdraw them first, or keep its mnemonic.",
  "settings.sparkAccount.wallet.warning.invoices":
    "Unpaid invoices from the current wallet will no longer be detected.",
  "settings.supportChat.teamUnavailable":
    "Support is unavailable right now. Check your connection and try again.",
  "settings.supportChat.inbox.unverified":
    "We could not check where support can reply to you, so they may not be able to answer yet.",
  "settings.supportChat.inbox.publishFailed":
    "Support cannot reply to you yet: the list of relays they reply to could not be published.",
  "settings.supportChat.inbox.publishAnyway": "Publish anyway",
  "settings.supportChat.inbox.confirm.title":
    "Publish the reply relays anyway?",
  "settings.supportChat.inbox.confirm.description":
    "If your account already has a list of relays for direct messages, for example from Linky, it will be replaced, and messages sent to the relays it named may stop reaching you there.",
  "settings.supportChat.inbox.confirm.confirm": "Publish",
  "settings.supportChat.inbox.confirm.cancel": "Cancel",
  "settings.supportChat.title": "Contact support",
  "settings.supportChat.description": "Chat with the {appName} team",
  "settings.supportChat.empty":
    "No messages yet. Describe what you need help with and the {appName} team will reply here.",
  "settings.supportChat.loadFailed":
    "Could not load the conversation. Check your connection and try again.",
  "settings.supportChat.retry": "Try again",
  "settings.supportChat.message.label": "Message",
  "settings.supportChat.message.placeholder": "Write a message…",
  "settings.supportChat.send": "Send",
  "settings.supportChat.sent": "Sent",
  "settings.supportChat.sending": "Sending…",
  "settings.supportChat.notDelivered": "Not delivered. Try again",
  "settings.assistant.title": "AI assistant",
  "settings.assistant.description":
    "Ask about your bills, payments and how {appName} works",
  "settings.assistant.empty":
    "Ask about your bills and payments, or how {appName} works. The assistant reads your data on this device and {appName}'s documentation, and answers through an AI provider.",
  "settings.assistant.emptyPublic":
    "Ask how {appName} works. The assistant reads {appName}'s documentation and code, not your data, and answers through an AI provider.",
  "settings.assistant.suggestion.openBills": "Which bills are still open?",
  "settings.assistant.suggestion.latestPayments": "What were my last payments?",
  "settings.assistant.suggestion.today": "How much did I take today?",
  "settings.assistant.suggestion.howSplit": "How does splitting a bill work?",
  "settings.assistant.suggestion.howRefund": "How do I refund a payment?",
  "settings.assistant.message.label": "Question",
  "settings.assistant.message.placeholder": "Ask a question…",
  "settings.assistant.send": "Send",
  "settings.assistant.stop": "Stop",
  "settings.assistant.thinking": "Thinking…",
  "settings.assistant.lookingUp.data": "Looking into your data…",
  "settings.assistant.lookingUp.docs": "Reading the documentation…",
  "settings.assistant.newConversation": "New conversation",
  "settings.chat.scrollToLatest": "Go to the latest message",
  "settings.assistant.stopped": "Stopped",
  "settings.assistant.failed": "Could not answer. Try again",
  "settings.support": "SUPPORT & INFO",
  "catalog.tables.add": "Add table",
  "catalog.tables.delete": "Delete table",
  "catalog.tables.delete.confirm.cancel": "Cancel",
  "catalog.tables.delete.confirm.confirm": "Delete",
  "catalog.tables.delete.confirm.description":
    "Closed bills keep {name} on record, but it will no longer be available to assign to new ones.",
  "catalog.tables.delete.confirm.title": "Delete {name}?",
  "catalog.tables.delete.hasOpenBills":
    "{name} still has an open bill. Close it or move it to another table first.",
  "catalog.tables.description": "Manage tables and seating",
  "catalog.tables.empty.description":
    "Add the tables in your venue so you can assign bills to them.",
  "catalog.tables.empty.title": "No tables yet",
  "catalog.tables.emptySearch": "No tables match your search.",
  "catalog.tables.form.card.description":
    "Name and seat count shown when assigning this table to a bill.",
  "catalog.tables.form.card.title": "Details",
  "catalog.tables.form.code.description":
    "Printed next to the table's QR code so staff can tell which table a sticker belongs to.",
  "catalog.tables.form.code.label": "Code",
  "catalog.tables.form.invalidId": "Invalid table id.",
  "catalog.tables.form.name.invalid": "Enter a name.",
  "catalog.tables.form.name.label": "Name",
  "catalog.tables.form.name.placeholder": "e.g. Table 5",
  "catalog.tables.form.notFound": "This table no longer exists.",
  "catalog.tables.form.save.create": "Add table",
  "catalog.tables.form.saved.create": "Table added.",
  "catalog.tables.form.seatCount.invalid": "Enter a valid seat count.",
  "catalog.tables.form.seatCount.label": "Seat count",
  "catalog.tables.form.seatCount.placeholder": "e.g. 4",
  "catalog.tables.form.title.create": "Add table",
  "catalog.tables.form.title.edit": "Edit table",
  "catalog.tables.search": "Search tables...",
  "catalog.tables.search.clear.aria": "Clear search",
  "catalog.tables.seatCount": "{value} seats",
  "catalog.tables.selfPay.bankNote":
    "Bank transfers are matched only while a device syncs the bank account: the Android app or the CLI.",
  "catalog.tables.selfPay.description":
    "Guests scan the table's QR code, see its open bill and pay all or part of it themselves, without waiting for staff.",
  "catalog.tables.selfPay.enabled": "Let guests pay at this table",
  "catalog.tables.selfPay.noPaymentMethod.description":
    "No payment method reaches them. Turn on bank sync with the Fio or MONETA plugin for the bank account, or add a Lightning wallet.",
  "catalog.tables.selfPay.noPaymentMethod.link": "Open payment accounts",
  "catalog.tables.selfPay.noPaymentMethod.title":
    "Guests cannot pay at this table yet",
  "catalog.tables.selfPay.noRelayAccepted.description":
    "No relay accepted its last publish.",
  "catalog.tables.selfPay.noRelayAccepted.retry": "Try again",
  "catalog.tables.selfPay.noRelayAccepted.title":
    "Guests cannot see this table's bill",
  "catalog.tables.selfPay.open": "Open as a guest",
  "catalog.tables.selfPay.print": "Print sticker",
  "catalog.tables.selfPay.print.failed":
    "Couldn't prepare the sticker. Try again.",
  "catalog.tables.selfPay.qr": "QR code for paying at {name}",
  "catalog.tables.selfPay.regenerate": "Regenerate QR code",
  "catalog.tables.selfPay.regenerate.confirm.cancel": "Cancel",
  "catalog.tables.selfPay.regenerate.confirm.confirm": "Regenerate",
  "catalog.tables.selfPay.regenerate.confirm.description":
    "Stickers printed so far stop showing this table's bills. Print the new one and replace them.",
  "catalog.tables.selfPay.regenerate.confirm.title":
    "Regenerate the QR code of {name}?",
  "catalog.tables.selfPay.title": "Pay at the table",
  "catalog.tables.selfPayGuestName.description":
    "Guests paying at the table see it as who they pay, on the page and in the payment QR. Leave it empty and they see no name.",
  "catalog.tables.selfPayGuestName.error": "Use at most 255 characters.",
  "catalog.tables.selfPayGuestName.label": "Name guests see",
  "catalog.tables.selfPayGuestName.placeholder": "Café on the Corner",
  "catalog.tables.selfPayOptions.menu.empty.description":
    "No item in the menu is available. Put items in the menu on their detail, or mark them available again.",
  "catalog.tables.selfPayOptions.menu.empty.title": "Guests cannot order",
  "catalog.tables.selfPayOptions.menu.leftOut":
    "Items that do not fit the menu: {count}. Guests do not see them.",
  "catalog.tables.selfPayOptions.menu.otherCurrency":
    "Items not priced in {currency}: {count}. Guests do not see them.",
  "catalog.tables.selfPayOptions.menu.visible":
    "Items guests can order: {count}",
  "catalog.tables.selfPayOptions.order": "Guests order from the menu",
  "catalog.tables.selfPayOptions.order.description":
    "Guests order the items in the menu and pay for them. Staff see the paid orders under To serve.",
  "catalog.tables.selfPayOptions.orderDevice.description":
    "It publishes the menu and records the paid orders, so keep it online.",
  "catalog.tables.selfPayOptions.orderDevice.label": "Device that takes orders",
  "catalog.tables.selfPayOptions.orderDevice.placeholder": "Choose a device",
  "catalog.tables.selfPayOptions.orderDevice.this": "{name} (this device)",
  "catalog.tables.selfPayOptions.payBill": "Guests pay the table's bill",
  "catalog.tables.selfPayOptions.written": "Guests write what they pay for",
  "catalog.tables.selfPayOptions.written.description":
    "A guest at a table writes one line and names the amount. {appName} checks only that the money arrived, and the line carries no tax rate.",
  "catalog.tables.selfPayOptions.title": "What guests can do",
  "catalog.tables.sticker.check": "Check a sticker",
  "catalog.tables.sticker.current": "This sticker belongs to {name}.",
  "catalog.tables.sticker.dismiss": "Dismiss",
  "catalog.tables.sticker.earlier":
    "This is an earlier QR code of {name}. It no longer shows the table's bills, so replace it.",
  "catalog.tables.sticker.foreign":
    "This sticker belongs to none of your tables. Remove it.",
  "catalog.tables.sticker.next": "Scan the next sticker",
  "catalog.tables.sticker.notTableCode": "This is not a table QR code.",
  "catalog.tables.sticker.relaysChanged":
    "This sticker belongs to {name}, but it names other relays than the tables publish to. Print it again.",
  "catalog.tables.title": "Tables",
  "settings.taxRates.activate": "Reactivate {name}",
  "settings.taxRates.activate.confirm.cancel": "Cancel",
  "settings.taxRates.activate.confirm.confirm": "Reactivate",
  "settings.taxRates.activate.confirm.description":
    "{name} will be available again when assigning tax rates to catalog items.",
  "settings.taxRates.activate.confirm.title": "Reactivate {name}?",
  "settings.taxRates.add": "Add tax rate",
  "settings.taxRates.add.title": "Add a tax rate",
  "settings.taxRates.archive": "Archive {name}",
  "settings.taxRates.archive.confirm.cancel": "Cancel",
  "settings.taxRates.archive.confirm.confirm": "Archive",
  "settings.taxRates.archive.confirm.description":
    "{name} will be hidden from new catalog items. Existing items keep it until changed. You can reactivate it later.",
  "settings.taxRates.archive.confirm.title": "Archive {name}?",
  "settings.taxRates.archived.title": "Archived",
  "settings.taxRates.default.set": "Make {name} the default",
  "settings.taxRates.default.unset": "Remove {name} as the default",
  "settings.taxRates.description":
    "Rates cannot be edited or deleted once created — archive a rate instead of changing its percentage, and add a new one if the rate itself changes.",
  "settings.taxRates.empty": "No tax rates yet.",
  "settings.taxRates.name.invalid": "Enter a name.",
  "settings.taxRates.name.label": "Name",
  "settings.taxRates.name.placeholder": "e.g. Standard rate",
  "settings.taxRates.rate.description":
    "The percentage, e.g. 21 or 12.5. This cannot be changed after saving.",
  "settings.taxRates.rate.invalid": "Enter a percentage between 0 and 100.",
  "settings.taxRates.rate.label": "Rate (%)",
  "settings.taxRates.rename": "Rename {name}",
  "settings.taxRates.rename.input": "New name for {name}",
  "settings.taxRates.title": "Tax rates",
  "settings.theme.dark.description": "Always use the dark interface",
  "settings.theme.dark.title": "Dark",
  "settings.theme.light.description": "Always use the light interface",
  "settings.theme.light.title": "Light",
  "settings.theme.mode.description":
    "Choose a fixed theme or follow your device setting.",
  "settings.theme.mode.title": "Appearance mode",
  "settings.theme.system.description": "Follow the operating system setting",
  "settings.theme.system.title": "Auto",
  "settings.theme.title": "Theme",
  "settings.tips.enabled.description": "Customers can add a tip while paying.",
  "settings.tips.enabled.label": "Enable tips",
  "settings.tips.fixedAmounts.add": "Add fixed amount",
  "settings.tips.fixedAmounts.description":
    "Customers can select these {currency} amounts when paying a bill.",
  "settings.tips.fixedAmounts.duplicate":
    "This fixed amount is already listed.",
  "settings.tips.fixedAmounts.invalid":
    "Enter a positive amount with up to two decimal places.",
  "settings.tips.fixedAmounts.label": "Fixed amount presets",
  "settings.tips.fixedAmounts.maximum":
    "You can add up to four fixed amount presets.",
  "settings.tips.fixedAmounts.placeholder": "e.g. 20.00",
  "settings.tips.form.description":
    "Configure the quick-select tip options shown when paying a bill.",
  "settings.tips.form.title": "Tip options",
  "settings.tips.percentages.add": "Add percentage",
  "settings.tips.percentages.description":
    "Customers can select these percentages when paying a bill.",
  "settings.tips.percentages.duplicate": "This percentage is already listed.",
  "settings.tips.percentages.invalid":
    "Enter a whole percentage from 1 to 100.",
  "settings.tips.percentages.label": "Percentage presets",
  "settings.tips.percentages.maximum":
    "You can add up to four percentage presets.",
  "settings.tips.percentages.placeholder": "e.g. 15",
  "settings.tips.percentages.value": "{value}%",
  "settings.tips.preset.remove": "Remove {value}",
  "settings.tips.reset": "Reset to defaults",
  "settings.tips.save": "Save tips",
  "settings.tips.saved": "Tip settings saved.",
  "settings.tips.title": "Tips",
  "settings.title": "Settings",
  "settings.withdrawals.description":
    "Send bitcoin from a Spark account on-chain or over Lightning",
  "settings.withdrawals.title": "Withdrawals",
  "settings.taxesGroup": "TAXES & DOCUMENTS",
  "settings.tips.nav.on": "On",
  "settings.tips.nav.off": "Off",
  "settings.paymentAccounts.nav.none": "None",
  "settings.taxRates.nav.description": "VAT rates for your items",
  "access.action.aiAccess": "Change AI data access",
  "access.action.cashuMints": "Change the Cashu mints",
  "access.action.moveCashuFunds": "Move funds between mints",
  "access.action.cancelPayment": "Cancel the payment",
  "access.action.changePin": "Change the PIN",
  "access.action.confirmClosedDespiteCancellation":
    "Mark the discarded bill as closed",
  "access.action.confirmPaidDespiteCancellation":
    "Mark the canceled payment as paid",
  "access.action.createItem": "Create a catalog item",
  "access.action.disable": "Turn access control off",
  "access.action.exportDatabase": "Export the app database",
  "access.action.revealRecoveryPhrase": "Reveal the recovery phrase",
  "access.action.discardBill": "Discard the bill",
  "access.action.enable": "Turn access control on with the current PIN",
  "access.action.markCashPaid": "Confirm the cash was received",
  "access.action.markIbanPaid": "Confirm the transfer arrived",
  "access.action.resolveOverpayment": "Resolve an overpayment",
  "access.action.removeAccount": "Remove the account from this device",
  "access.action.removeLines": "Remove items from the bill",
  "access.action.switchAccount": "Switch account",
  "access.action.unblock": "Unblock a device",
  "access.action.withdraw": "Withdraw funds",
  "access.attempts.continue": "Continue",
  "access.attempts.title":
    "Wrong PINs entered on this device since the last correct one: {count}",
  "access.cancel": "Cancel",
  "access.changePin": "Change PIN",
  "access.description":
    "One owner PIN locks settings and risky actions. Each device keeps the permissions you give it; the PIN unlocks everything else. This keeps staff and customers at the counter out — it is not protection against an attacker.",
  "access.device.adminWarning":
    "With Owner permissions this device needs no PIN for anything except changing the PIN, turning access control off and unblocking a device.",
  "access.device.blocked": "PIN blocked",
  "access.device.name": "Device name",
  "access.device.permissions": "Permissions",
  "access.device.permissions.description":
    "What this device may do without the PIN. Pick a preset, then adjust it.",
  "access.device.preset": "Permissions of {name}",
  "access.device.remove": "Remove",
  "access.device.remove.confirm": "Remove device",
  "access.device.remove.description":
    "Its permissions are cleared. If the device is still in use, it shows up again with no permissions.",
  "access.device.remove.title": "Remove {name}?",
  "access.device.rename": "Rename",
  "access.device.this": "This device",
  "access.device.unblock": "Unblock",
  "access.devices.add": "Add a device",
  "access.devices.description":
    "Devices of this account and what each may do without the PIN. A device appears once it has synced.",
  "access.devices.title": "Devices",
  "access.nav.description": "Owner PIN and device permissions",
  "access.newPin.description":
    "4–8 digits. Don't reuse a PIN from a bank card or phone: its hash is stored on every device of this account and in every database export.",
  "access.newPin.label": "New PIN",
  "access.newPin.mismatch": "The PINs don't match.",
  "access.newPin.repeat": "Repeat the PIN",
  "access.permission.activity": "History",
  "access.permission.activity.description":
    "Payment and bill history, payment detail, EET retries, the AI assistant",
  "access.permission.admin": "Administration",
  "access.permission.admin.description":
    "Payment accounts, accounts, profile, security, EET, data export, debug console, AI data access, access control",
  "access.permission.catalog": "Catalog",
  "access.permission.catalog.description":
    "Items, categories and tables, and creating an item from the bill",
  "access.permission.confirm": "Confirm payments",
  "access.permission.confirm.description":
    "Confirm by hand that cash or a bank transfer arrived",
  "access.permission.discard": "Discard",
  "access.permission.discard.description":
    "Discard a bill, remove items from it, cancel a payment",
  "access.permission.refund": "Refunds",
  "access.permission.refund.description":
    "Refunds and resolving an overpayment",
  "access.permission.sell": "Sell",
  "access.permission.sell.description":
    "Home screen, bills, splitting a bill, payments and tips",
  "access.permission.settings": "Settings",
  "access.permission.settings.description":
    "Business details, taxes, number series, tips, home screen, support chat",
  "access.permission.stats": "Statistics",
  "access.permission.stats.description":
    "Sales statistics: revenue, payment methods, top items, expected cash",
  "access.phrase.back": "Back to PIN",
  "access.phrase.description":
    "The account's recovery phrase unlocks everything on this device and clears its PIN block.",
  "access.phrase.label": "Recovery phrase",
  "access.phrase.setNewPin": "Set a new PIN",
  "access.phrase.submit": "Unlock",
  "access.phrase.warning":
    "Typing the recovery phrase at the counter can expose it to cameras and people around. It opens the whole account. Unblocking from another device in Settings → Access is the better way.",
  "access.phrase.wrong": "This is not the recovery phrase of this account.",
  "access.pin.blocked.description":
    "Too many wrong PINs. The owner can unblock this device from another device in Settings → Access, or with the recovery phrase here. Meanwhile the device keeps its own permissions.",
  "access.pin.blocked.title": "PIN entry is blocked on this device",
  "access.pin.cancel": "Cancel",
  "access.pin.entered": "Digits entered: {count}",
  "access.pin.erase": "Erase",
  "access.pin.forgot": "Forgot PIN",
  "access.pin.help":
    "Don't know the PIN? Ask the owner to enter it, or to allow {permission} on this device.",
  "access.pin.submit": "OK",
  "access.pin.title": "Enter the PIN",
  "access.pin.why.action": "{action} needs the PIN",
  "access.pin.why.route": "This screen needs {permission}",
  "access.pin.wrong":
    "Wrong PIN. Attempts left before this device blocks: {count}",
  "access.preset.basic": "Basic",
  "access.preset.custom": "Custom",
  "access.preset.manager": "Manager",
  "access.preset.none": "None",
  "access.preset.owner": "Owner",
  "access.preset.shiftLead": "Shift lead",
  "access.preset.staff": "Staff",
  "access.save": "Save",
  "access.status.off": "Access control is off",
  "access.status.on": "Access control is on",
  "access.title": "Access",
  "access.turnOff": "Turn off",
  "access.turnOn": "Turn on",
  "access.webWarning":
    "In a desktop browser this lock is cosmetic: anyone who opens the developer tools can get around it. It means something only in the Android app, ideally in kiosk mode.",
  "access.wizard.back": "Back",
  "access.wizard.devices.description":
    "What each device may do without the PIN. A device that has not synced yet is not listed and starts with no permissions.",
  "access.wizard.devices.title": "Device default permissions",
  "access.wizard.keepPin": "Use the current PIN",
  "access.wizard.next": "Next",
  "access.wizard.noPin": "Set a new PIN; there is no current one.",
  "access.wizard.pin.description":
    "The owner PIN unlocks everything. Only the owner should know it.",
  "access.wizard.pin.title": "Owner PIN",
  "settings.paymentAccounts.method.lightningAddress": "Lightning address",
  "settings.paymentAccounts.status.missingLightningAddress":
    "No Lightning address set",
  "settings.lightningAddress.enabled.label":
    "Accept payments to a Lightning address",
  "settings.lightningAddress.form.title": "Your own wallet",
  "settings.lightningAddress.form.description":
    "Payments go straight to the wallet behind the address. {appName} only asks it for an invoice and watches whether it is paid; it holds no keys and no money.",
  "settings.lightningAddress.address.label": "Lightning address",
  "settings.lightningAddress.address.placeholder": "name@wallet.com",
  "settings.lightningAddress.address.description":
    "The wallet must support LUD-21 verify and reveal the proof of payment (preimage). Otherwise {appName} cannot tell that a payment is paid.",
  "settings.lightningAddress.address.required": "Enter a Lightning address.",
  "settings.lightningAddress.address.invalid":
    "This is not a Lightning address. It looks like name@wallet.com.",
  "settings.lightningAddress.submit": "Check and save",
  "settings.lightningAddress.saved": "Saved.",
  "settings.lightningAddress.error.verifyUnsupported":
    "This wallet does not let {appName} check whether an invoice is paid (LUD-21 verify). Use another wallet.",
  "settings.lightningAddress.error.rejected":
    "The wallet refused the request. Check the address.",
  "settings.lightningAddress.error.unreachable":
    "The wallet could not be reached. Check the address and your connection.",
  "settings.lightningAddress.error.invalid":
    "The wallet answered with something {appName} cannot use.",
  "settings.paymentAccounts.method.bitcoin": "Bitcoin",
  "settings.bitcoin.enabled.label": "Accept Bitcoin",
  "settings.bitcoin.wallet.spark": "Spark",
  "settings.bitcoin.wallet.linky": "Linky wallet",
  "settings.salesGroup": "SALES",
  "catalog.items.form.category.new.placeholder": "New category",
  "settings.paymentAccounts.status.nativeOnly": "Only in the native app",
  "settings.cashuAccount.balance.switchUnit": "Switch the unit",
  "settings.fiat.czk.symbol": "Kč",
  "settings.fiat.eur.symbol": "€",
  "settings.fiat.usd.symbol": "$",
  "settings.profile.vatPayer": "VAT payer",
  "settings.bitcoin.mainMethod": "Main method",
  "settings.cashuAccount.qr.title": "Payment QR",
  "settings.cashuAccount.qr.both": "Both",
  "settings.cashuAccount.qr.cashu": "Cashu",
  "settings.cashuAccount.qr.lightning": "Lightning",
  "accountShare.title": "Account request",
  "accountShare.caller": "{caller} asks for this account",
  "accountShare.claimed": "The app calls itself “{claimed}”.",
  "accountShare.mismatch.title": "The names do not match",
  "accountShare.mismatch.description":
    "Android says this is {caller}, but the request claims to come from “{claimed}”. Approve only a request you started yourself, in an app you trust.",
  "accountShare.code.instructions": "Check that {caller} shows the same code:",
  "accountShare.account": "Account to share: {name}",
  "accountShare.warning.title": "Full access to the account",
  "accountShare.warning.description":
    "By approving, you give this app full access to the account and its money. {appName} support never asks you for this.",
  "accountShare.validFor": "Valid for {time}",
  "accountShare.approve": "Approve",
  "accountShare.reject": "Decline",
  "accountShare.expired":
    "The request has expired or was replaced by another one. Start it again in the app that asked.",
  "accountShare.none": "There is no account request to answer.",
  "settings.cardClosure.title": "Terminal closures",
  "settings.cardClosure.action": "Run the closure",
  "access.action.closeCardBatch": "Close the terminal",
  "settings.cardClosure.confirm.title": "Run the terminal closure?",
  "settings.cardClosure.confirm.description":
    "Card payments since the last closure will be sent for settlement.",
  "settings.cardClosure.confirm.cancel": "Cancel",
  "settings.cardClosure.thisTerminal.title": "Terminal on this phone",
  "settings.cardClosure.thisTerminal.description":
    "The closure sends the card payments taken on this phone for settlement. Run it every day after the end of the shift.",
  "settings.cardClosure.thisTerminal.last": "Last closure",
  "settings.cardClosure.thisTerminal.never": "Not yet run",
  "settings.cardClosure.result.title": "Summary",
  "settings.cardClosure.result.payments": "Payments (incl. tips)",
  "settings.cardClosure.result.refunds": "Refunded payments",
  "settings.cardClosure.result.adjustments": "Payment adjustments",
  "settings.cardClosure.result.countAndAmount": "{count}× · {amount}",
  "settings.cardClosure.result.batch": "Batch number",
  "settings.cardClosure.result.shift": "Shift number",
  "settings.cardClosure.result.terminalTime": "Time on the terminal",
  "settings.cardClosure.result.batchAndShift": "Batch {batch}, shift {shift}",
  "settings.cardClosure.terminals.title": "All terminals",
  "settings.cardClosure.terminals.description":
    "A terminal can only be closed on the phone it runs on.",
  "settings.cardClosure.terminals.notClosedToday": "Not closed today",
  "settings.cardClosure.terminals.closedToday": "Closed today",
  "settings.cardClosure.terminals.thisDevice": "This phone",
  "settings.cardClosure.terminals.unknownDevice": "Unknown device",
  "settings.cardClosure.terminals.empty": "No closure has been run yet.",
  "settings.cardClosure.detail.title": "Closure detail",
  "settings.cardClosure.detail.notFound": "The closure could not be found.",
  "settings.cardClosure.result.device": "Terminal",
  "settings.cardClosure.history.title": "Closure history",
  "settings.cardClosure.history.empty": "No closures yet",
  "settings.cardClosure.error.failed":
    "The closure did not go through. Try again, or check it in the SwitchioPay app.",
  "settings.cardClosure.error.busy":
    "The terminal is handling another operation. Finish it and try again.",
  "settings.cardClosure.error.demo":
    "A real terminal closure cannot be run in a demo account.",
  "settings.cardClosure.error.unavailable":
    "The SwitchioPay app is not available on this phone.",
  "settings.cardClosure.error.accountMissing":
    "Card payments are not turned on.",
  "settings.cardClosure.error.unknown":
    "We don't know whether the closure went through. Check it in the SwitchioPay app.",
  "settings.cardClosure.restored.closed": "The terminal closure is complete.",
  "settings.cardClosure.restored.unanswered":
    "A terminal closure got no answer from SwitchioPay. Check in the SwitchioPay app whether the batch was closed.",
  "settings.cardClosure.restored.unresolved":
    "The closure's result could not be read. Check it in the SwitchioPay app.",
  "settings.cardSwitchioAccount.closureLink": "Terminal closures",
} as const
