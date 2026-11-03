export const enOnboarding = {
  "accountRestore.action.addRelay": "Add sync server",
  "accountRestore.action.otherPhrase": "Use a different recovery phrase",
  "accountRestore.action.retry": "Try again",
  "accountRestore.action.setupNew": "Set up this account as new",
  "accountRestore.description":
    "Waiting for the account data to sync. This usually takes a few seconds.",
  "accountRestore.empty.description":
    "Every sync server finished syncing, but none of them holds data for this recovery phrase. The data may be on a server that isn't listed, or the phrase may belong to a different account.",
  "accountRestore.empty.title": "No account data found",
  "accountRestore.failed.description":
    "Some sync servers could not be synced with, so the account data may exist but hasn't arrived. Check the list and try again.",
  "accountRestore.failed.offline":
    "This device is offline. Connect to the internet and try again.",
  "accountRestore.failed.title": "Couldn't sync the account",
  "accountRestore.relays.title": "Sync servers",
  "accountRestore.setupNew.confirm.cancel": "Go back",
  "accountRestore.setupNew.confirm.confirm": "Set up as new",
  "accountRestore.setupNew.confirm.description":
    "The unreachable sync servers may still hold this account's data. If it syncs later, the settings you choose now will overwrite it.",
  "accountRestore.setupNew.confirm.title": "Set up without the account data?",
  "accountRestore.syncing": "Syncing account data…",
  "accountRestore.title": "Restoring account",
  "accountTransfer.cancel": "Cancel",
  "accountTransfer.close": "Close",
  "accountTransfer.done": "Done",
  "accountTransfer.settings.source.description":
    "Open this account on a phone or another computer without the recovery phrase. It lives in Settings → Access, next to the device permissions.",
  "accountTransfer.settings.source.title": "Add a device to this account",
  "accountTransfer.source.code.confirm": "Confirm and transfer",
  "accountTransfer.source.code.connected": "A device connected.",
  "accountTransfer.source.code.instructions":
    "Type the 6-digit code shown on the new device.",
  "accountTransfer.source.code.label": "Code from the new device",
  "accountTransfer.source.code.mismatch":
    "The code does not match. Check it and try again. Attempts left: {count}.",
  "accountTransfer.source.code.warning":
    "Only copy it from the screen of the device in your hand. If someone is reading a code to you, cancel.",
  "accountTransfer.source.done.acked":
    "The new device received the account. Finish on the new device. Nothing changes on this device.",
  "accountTransfer.source.done.sent": "Sent. Finish on the new device.",
  "accountTransfer.source.done.title": "Account sent",
  "accountTransfer.source.failed.cancelled":
    "The transfer was cancelled on the new device.",
  "accountTransfer.source.failed.codeMismatch":
    "The code didn't match three times.",
  "accountTransfer.source.failed.conflict":
    "More than one device answered the code, so the transfer was stopped for safety. If the other one wasn't yours, someone may have seen your screen.",
  "accountTransfer.source.failed.network":
    "Couldn't reach the transfer server. Check your internet connection.",
  "accountTransfer.source.failed.nothingSent": "Nothing was sent.",
  "accountTransfer.source.failed.timeout":
    "The new device didn't finish in time.",
  "accountTransfer.source.failed.title": "Transfer stopped",
  "accountTransfer.source.permissions":
    "The new device starts with no permissions. Set them in Settings → Access once it appears there.",
  "accountTransfer.source.qr.expired": "This code has expired.",
  "accountTransfer.source.qr.instructions":
    "On the new device open {appName}, choose “Transfer from another device” and scan this code.",
  "accountTransfer.source.qr.label": "QR code for the new device",
  "accountTransfer.source.qr.reassurance":
    "The code expires in two minutes and works for one device only.",
  "accountTransfer.source.qr.renew": "Create a new code",
  "accountTransfer.source.qr.validFor": "Valid for {time}",
  "accountTransfer.source.qr.waiting": "Waiting for the new device…",
  "accountTransfer.source.sending": "Sending the account…",
  "accountTransfer.source.start": "Show QR code",
  "accountTransfer.source.startAgain": "Start again",
  "accountTransfer.source.step.code": "Type the code from the new device here.",
  "accountTransfer.source.step.scan": "Scan the QR code with the new device.",
  "accountTransfer.source.step.transfer": "The account moves over, encrypted.",
  "accountTransfer.source.title": "Add a device",
  "accountTransfer.source.warning.description":
    "The new device gets full access to this account, including the money in the Bitcoin wallet. Only continue with a device you are holding. {appName} support will never ask you to do this.",
  "accountTransfer.source.warning.title": "Full access to the account",
  "accountTransfer.target.added":
    "Account “{name}” was added to this device and is now active. Loading your data…",
  "accountTransfer.target.alreadyAdded":
    "This account was already on this device; it is now active.",
  "accountTransfer.target.code.instructions":
    "Type this code on your other device.",
  "accountTransfer.target.code.waiting": "Waiting for confirmation…",
  "accountTransfer.target.code.warning":
    "The code confirms the account is going to this device. Don't share it with anyone.",
  "accountTransfer.target.confirm.cancel": "Cancel",
  "accountTransfer.target.confirm.confirm": "Add and switch",
  "accountTransfer.target.confirm.description":
    "Add account “{name}” to this device and switch to it? Payments you take will then go to this account.",
  "accountTransfer.target.confirm.title": "Add account “{name}”?",
  "accountTransfer.target.connecting": "Connecting to your other device…",
  "accountTransfer.target.description":
    "Scan a QR code on a device where you already use {appName}.",
  "accountTransfer.target.error.InvalidPaykyUri":
    "The code is damaged. Generate a new one.",
  "accountTransfer.target.error.NotPaykyUri": "This is not a {appName} code.",
  "accountTransfer.target.error.UnknownPaykyUriType":
    "This {appName} code is for something else, or for a newer {appName}. Update the app.",
  "accountTransfer.target.error.UnsupportedPaykyUriVersion":
    "This code was made by a newer {appName}. Update the app.",
  "accountTransfer.target.error.WrongPaykyUriType":
    "This {appName} code is for something else.",
  "accountTransfer.target.failed.cancelled":
    "The transfer was cancelled on the other device.",
  "accountTransfer.target.failed.codeMismatch":
    "The code was typed wrong three times on the other device.",
  "accountTransfer.target.failed.conflict":
    "More than one device answered the code, so the transfer was stopped for safety.",
  "accountTransfer.target.failed.invalid":
    "The other device sent data this device can't use. Nothing was added.",
  "accountTransfer.target.failed.network":
    "Couldn't reach the transfer server. Check your internet connection.",
  "accountTransfer.target.failed.timeout":
    "The other device didn't finish in time.",
  "accountTransfer.target.failed.title": "Transfer stopped",
  "accountTransfer.target.fallback":
    "Can't scan? Restore with your recovery phrase.",
  "accountTransfer.target.instructions":
    "On the device that has your account, open Settings → Access → Add a device, then scan the QR code it shows.",
  "accountTransfer.target.scanAgain": "Scan again",
  "accountTransfer.target.title": "Transfer from another device",
  "accountTransfer.target.warning.description":
    "Only scan a code from your own device that you are looking at right now. A code from someone else would put their account on this device, and payments you take would go to them.",
  "accountTransfer.target.warning.title": "Only your own device",
  "onboarding.accountChoice.description":
    "Create a new account or open one you already use.",
  "accountChoice.new.description":
    "Generate a new recovery phrase and start with an empty account.",
  "accountChoice.new.title": "Create a new account",
  "accountChoice.restore.description":
    "Use the 20 words from {appName} to open your existing account data.",
  "accountChoice.restore.title": "Restore an existing account",
  "accountChoice.transfer.description":
    "Scan a QR code on a device where you already use {appName}.",
  "accountChoice.transfer.title": "Transfer from another device",
  "onboarding.back": "Back",
  "onboarding.alreadyOnboarded": "This account is already set up.",
  "onboarding.cancelSetup": "Cancel account creation",
  "onboarding.cancelSetup.confirm.cancel": "Keep setting up",
  "onboarding.cancelSetup.confirm.confirm": "Cancel account creation",
  "onboarding.cancelSetup.confirm.description":
    "This new account will be discarded and you'll switch back to {name}.",
  "onboarding.cancelSetup.confirm.title": "Cancel account creation?",
  "onboarding.finishWithoutBankTransfer": "Start without bank transfers",
  "onboarding.businessName.placeholder": "Linden Café",
  "onboarding.businessName.label": "Business name (optional)",
  "onboarding.businessName.description":
    "The public name of your profile, shown as the recipient of bank payments.",
  "onboarding.businessName.publishFailed.title":
    "The name could not be published",
  "onboarding.businessName.publishFailed.description":
    "Your form is still filled in. Try again or continue without publishing the name.",
  "onboarding.businessName.retry": "Try again",
  "onboarding.businessName.continueWithoutPublishing":
    "Continue without publishing the name",
  "onboarding.finish": "Start using {appName}",
  "onboarding.language.title": "Choose language",
  "onboarding.payments.description":
    "You can change everything in settings at any time.",
  "onboarding.payments.iban.description":
    "Enter an account number or IBAN to accept payments with a QR code.",
  "onboarding.payments.iban.title": "Bank account (optional)",
  "onboarding.payments.title": "Business setup",
  "onboarding.restore.action": "Restore account",
  "onboarding.restore.counter": "{count}/{total} words",
  "onboarding.restore.description": "Enter the 20 words from {appName}",
  "onboarding.restore.paste": "Paste from clipboard",
  "onboarding.restore.pasteFailed":
    "Could not read the clipboard. Paste into the first field instead.",
  "onboarding.restore.showWords": "Show words",
  "onboarding.restore.subtitle":
    "The phrase from Settings → Security. A seed from another wallet (Spark, Trezor, 12 or 24 words) does not work here.",
  "onboarding.restore.suggestions": "Word suggestions",
  "onboarding.restore.title": "Restore existing account",
  "onboarding.restore.transferLink":
    "Have {appName} on another device? Transfer by scanning a QR code",
  "onboarding.restore.unknownWords": "Unknown word: {words}",
  "onboarding.restore.wordLabel": "Word {index}",
  "onboarding.setup.account.label": "Account number",
  "onboarding.setup.account.placeholder": "2000145399/0800",
  "onboarding.setup.name.hint":
    "Customers see it as the payment recipient's name.",
  "onboarding.setup.name.label": "Business name",
  "onboarding.setup.title": "Set up a business",
  "onboarding.title": "Welcome to {appName}",
  "onboarding.welcome.new": "New business",
  "onboarding.welcome.restore": "Restore existing",
  "onboarding.welcome.tagline":
    "A payment terminal for QR payments by bank, card or bitcoin.",
} as const
