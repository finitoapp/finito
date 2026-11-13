import { enCommon } from "@payky/app-shared/i18n/en/common"
import { enPayment } from "@payky/app-shared/i18n/en/payment"
import { enSettings } from "@payky/app-shared/i18n/en/settings"
import { pickTerminalAppLabels } from "../terminal-app-labels.ts"

/**
 * The card terminal documentation (landing/0015), which only Finito's
 * landing shows. The app's labels it quotes come from the app's copy.
 */
export const enTerminal = {
  ...pickTerminalAppLabels({ ...enCommon, ...enPayment, ...enSettings }),
  "landing.terminal.meta.title":
    "{appName} with the SwitchioPay card terminal: payments, reversals, refunds and closures",
  "landing.terminal.meta.description":
    "How to take card payments with {appName} on a NEXGO terminal running SwitchioPay: setup, payments, reversals, refunds to the card, closures, unusual situations and testing with Comgate.",
  "landing.terminal.hero.eyebrow": "Card payments",
  "landing.terminal.hero.title": "{appName} with the SwitchioPay card terminal",
  "landing.terminal.hero.body":
    "{appName} runs directly on the NEXGO N92 payment terminal, alongside the SwitchioPay app. For a card payment it simply passes the amount to SwitchioPay and never handles any card data. SwitchioPay prints receipts on the terminal's printer, according to its own settings.",
  "landing.terminal.hero.note":
    "Every screenshot on this page is taken from the app itself. Steps that happen in the SwitchioPay app are shown as a grey placeholder with a caption.",
  "landing.terminal.toc.title": "Contents",
  "landing.terminal.switchioPay.name": "SwitchioPay",

  "landing.terminal.switchioPay.cardTap": "The customer taps their card",
  "landing.terminal.switchioPay.reversal": "Reversing the payment",
  "landing.terminal.switchioPay.refund": "Refunding to the card",
  "landing.terminal.switchioPay.closure": "Closing the batch",

  "landing.terminal.requirements.eyebrow": "Before you start",
  "landing.terminal.requirements.title": "What you'll need",
  "landing.terminal.requirements.terminal":
    "A NEXGO payment terminal with SwitchioPay, and a contract with Comgate.",
  "landing.terminal.requirements.install":
    "{appName} installed on the terminal from the Switchio Store (signed by Comgate).",
  "landing.terminal.requirements.onboarding":
    "The first-run setup completed, which creates the business's account in about a minute.",
  "landing.terminal.requirements.permissions.title": "Permissions",
  "landing.terminal.requirements.permissions.body":
    "Once the owner sets a PIN, each of these actions requires the matching permission:",
  "landing.terminal.requirements.permissions.activation":
    "Turning on card payments",
  "landing.terminal.requirements.permissions.refund":
    "Reversals and refunds to the card",
  "landing.terminal.requirements.permissions.closure": "Closures",
  "landing.terminal.requirements.tester.title": "For Comgate testers",
  "landing.terminal.requirements.tester.body":
    "No login details or test account are needed. Install the APK, go through the first-run setup without setting a PIN, so that staff can do everything, then turn on card payments as described below.",

  "landing.terminal.activation.eyebrow": "Setup",
  "landing.terminal.activation.title": "Turn on card payments",
  "landing.terminal.activation.body":
    "You only need to do this once, in the settings. It applies to all of the business's devices.",
  "landing.terminal.activation.step.settings":
    "Open Settings, then Payment methods.",
  "landing.terminal.activation.step.off":
    "Card payments are off by default. If SwitchioPay is missing from the terminal, a note next to the payment card says so.",
  "landing.terminal.activation.step.on":
    "Turn on the switch. When taking a payment, the method marked as default opens first; drag the methods to change their order.",
  "landing.terminal.activation.step.card":
    "Tap the payment card to see what card payments require and to find the link to terminal closures.",

  "landing.terminal.payment.eyebrow": "Payment",
  "landing.terminal.payment.title": "Taking a card payment",
  "landing.terminal.payment.body":
    "{appName} passes SwitchioPay the amount, the tip separately, the currency and the payment number as the invoice number.",
  "landing.terminal.payment.step.amount":
    "Enter the amount and tap Pay. A bill for a table or from the catalog is paid the same way.",
  "landing.terminal.payment.step.tip":
    "If tips are turned on, the customer chooses one. SwitchioPay receives the tip separately from the amount.",
  "landing.terminal.payment.step.cardTab":
    "On the Payment card tab, start the payment.",
  "landing.terminal.payment.step.waiting":
    "{appName} waits while SwitchioPay completes the payment.",
  "landing.terminal.payment.step.switchioPay":
    "SwitchioPay takes over: the customer taps their card and enters their PIN if the terminal asks for it.",
  "landing.terminal.payment.step.received":
    "Back in the app, the payment shows as received.",
  "landing.terminal.payment.step.detail":
    "The payment detail shows the masked card number, the card type, the authorization code, the transaction ID and the terminal ID.",
  "landing.terminal.payment.note":
    "For every approved payment, {appName} stores everything needed to refund it later: the transaction ID, the refund identifier, the device that took the payment and the time it was approved.",

  "landing.terminal.reversal.eyebrow": "Reversal",
  "landing.terminal.reversal.title": "Reversing a payment before the closure",
  "landing.terminal.reversal.body":
    "A reversal cancels the whole payment directly on the terminal, and the card isn't needed. {appName} uses it automatically when all of these conditions are met:",
  "landing.terminal.reversal.rule.whole":
    "you're refunding the whole payment, including the tip,",
  "landing.terminal.reversal.rule.first":
    "nothing has been refunded from the payment yet,",
  "landing.terminal.reversal.rule.sameTerminal":
    "you're on the terminal that took the payment,",
  "landing.terminal.reversal.rule.noClosure":
    "no closure has been run from {appName} on this terminal since the payment.",
  "landing.terminal.reversal.step.button":
    "In Activity, open the payment and tap Refund money.",
  "landing.terminal.reversal.step.choose":
    "Choose the whole payment. The refund method explains that the terminal takes the whole payment back and the card isn't needed.",
  "landing.terminal.reversal.step.running":
    "Confirm the refund. {appName} waits while SwitchioPay reverses the payment.",
  "landing.terminal.reversal.step.switchioPay":
    "SwitchioPay reverses exactly the transaction whose ID {appName} passes to it.",
  "landing.terminal.reversal.step.detail":
    "The refund detail shows that the payment was reversed on the terminal, together with the transaction ID, the authorization code and the sequence number.",

  "landing.terminal.refund.eyebrow": "Refund",
  "landing.terminal.refund.title": "Refunding to the card after the closure",
  "landing.terminal.refund.body":
    "When a reversal isn't possible, {appName} refunds the money to the card the customer paid with. This happens after a closure, when refunding only part of the payment or only the tip, when something has already been refunded, or when you refund on a different terminal from the one that took the payment.",
  "landing.terminal.refund.step.referral":
    "After a closure, the same screen offers a refund to the card the customer paid with.",
  "landing.terminal.refund.step.partial":
    "To refund part of the payment, enter the amount or select the items.",
  "landing.terminal.refund.step.tip":
    "The tip can also be refunded on its own.",
  "landing.terminal.refund.step.switchioPay":
    "SwitchioPay refunds the money to the card; follow the instructions on the terminal.",
  "landing.terminal.refund.step.detail":
    "The refund detail shows that the money went back to the card, along with the details the terminal returned.",
  "landing.terminal.refund.step.declined":
    "If the batch was closed outside {appName}, the terminal declines the reversal. The app then checks with SwitchioPay whether the payment was reversed after all and, if not, offers a refund to the card instead.",

  "landing.terminal.closure.eyebrow": "Closure",
  "landing.terminal.closure.title": "Closing the batch after every shift",
  "landing.terminal.closure.body":
    "A closure sends the terminal's card payments for settlement. Run one every day at the end of the shift, on each terminal separately.",
  "landing.terminal.closure.step.row":
    "In Settings, open Terminal closures. This item appears once card payments are turned on.",
  "landing.terminal.closure.step.page":
    "You'll see this terminal's last closure. Start a new one.",
  "landing.terminal.closure.step.confirm":
    "Confirm that the card payments since the last closure should be sent for settlement.",
  "landing.terminal.closure.step.switchioPay": "SwitchioPay closes the batch.",
  "landing.terminal.closure.step.detail":
    "{appName} saves the closure summary (payments including tips, refunds, adjustments) with the batch and shift numbers. The closure history and the overview of all the business's terminals are visible on every device.",
  "landing.terminal.closure.note.perTerminal":
    "Each terminal closes only its own batch, and only on that terminal.",
  "landing.terminal.closure.note.outside":
    "{appName} isn't aware of closures started directly in SwitchioPay or run automatically.",
  "landing.terminal.closure.note.reconciliation":
    "{appName} doesn't yet compare closure totals with its own payments.",

  "landing.terminal.edge.eyebrow": "Unusual situations",
  "landing.terminal.edge.title": "When things don't go to plan",
  "landing.terminal.edge.body":
    "What you'll see, what to do and what gets saved. A payment only counts as paid once SwitchioPay has approved it. If the outcome is unclear, the app asks you to check before trying the card again.",
  "landing.terminal.edge.column.situation": "Situation",
  "landing.terminal.edge.column.see": "What you'll see",
  "landing.terminal.edge.column.do": "What to do",
  "landing.terminal.edge.column.records": "What gets saved",
  "landing.terminal.edge.declined.situation":
    "The card is declined or the customer's bank refuses the payment.",
  "landing.terminal.edge.declined.see": "A message on the Payment card tab:",
  "landing.terminal.edge.declined.do":
    "Try the card again, or let the customer pay another way.",
  "landing.terminal.edge.declined.records":
    "Nothing; the payment stays unpaid.",
  "landing.terminal.edge.canceled.situation":
    "The payment is cancelled on the terminal.",
  "landing.terminal.edge.canceled.see":
    "Depending on SwitchioPay's response, the payment either didn't go through or its outcome is unknown. We're still verifying this on Comgate's development terminal.",
  "landing.terminal.edge.canceled.do":
    "Try again; if the outcome is unknown, check SwitchioPay first.",
  "landing.terminal.edge.canceled.records":
    "Nothing, unless SwitchioPay approves the payment.",
  "landing.terminal.edge.unknown.situation":
    "SwitchioPay doesn't return a usable result, for example because it crashed or Android closed it.",
  "landing.terminal.edge.unknown.see":
    "A note that the outcome is unknown. The app then asks SwitchioPay about the transaction on its own.",
  "landing.terminal.edge.unknown.do":
    "Wait for the answer. If SwitchioPay doesn't confirm the approval, check the transaction in SwitchioPay.",
  "landing.terminal.edge.unknown.records":
    "The payment as paid only once SwitchioPay confirms the approval. Any other answer leaves the outcome unknown.",
  "landing.terminal.edge.chargeAgain.situation":
    "You want to try the card again although the previous attempt's outcome is unknown.",
  "landing.terminal.edge.chargeAgain.see":
    "A confirmation warning that the card may already have been charged:",
  "landing.terminal.edge.chargeAgain.do":
    "Confirm only after checking in SwitchioPay that the previous attempt didn't go through.",
  "landing.terminal.edge.chargeAgain.records":
    "A new attempt with a new transaction ID.",
  "landing.terminal.edge.busy.situation":
    "SwitchioPay is busy with another operation or doesn't start.",
  "landing.terminal.edge.busy.see":
    "A note that SwitchioPay is busy and you should try again.",
  "landing.terminal.edge.busy.do":
    "Finish the operation in progress in SwitchioPay and start the payment again.",
  "landing.terminal.edge.busy.records": "Nothing; the terminal never started.",
  "landing.terminal.edge.notInstalled.situation":
    "SwitchioPay isn't installed on the terminal.",
  "landing.terminal.edge.notInstalled.see":
    "A warning next to the payment card in the settings and when taking a payment:",
  "landing.terminal.edge.notInstalled.do":
    "Have SwitchioPay installed and set up on the terminal.",
  "landing.terminal.edge.notInstalled.records": "Nothing.",
  "landing.terminal.edge.restored.situation":
    "Android closes {appName} while SwitchioPay is on screen.",
  "landing.terminal.edge.restored.see": "When you return to the app:",
  "landing.terminal.edge.restored.do":
    "Nothing. The terminal's result isn't lost and is processed as soon as the app opens again.",
  "landing.terminal.edge.restored.records":
    "The payment as reported by SwitchioPay.",
  "landing.terminal.edge.otherAccount.situation":
    "A saved result belongs to another account on this terminal.",
  "landing.terminal.edge.otherAccount.see":
    "Nothing until you switch to that account.",
  "landing.terminal.edge.otherAccount.do":
    "Switch to the account the payment was taken in. Until then, the terminal won't start another payment.",
  "landing.terminal.edge.otherAccount.records":
    "The result is saved only in the account it belongs to.",
  "landing.terminal.edge.canceledButPaid.situation":
    "A payment cancelled on another device was paid by card anyway.",
  "landing.terminal.edge.canceledButPaid.see": "In the payment detail:",
  "landing.terminal.edge.canceledButPaid.do":
    "Mark the payment as paid, or refund the money.",
  "landing.terminal.edge.canceledButPaid.records":
    "The card payment; the money left the card, so it counts.",
  "landing.terminal.edge.reversalDeclined.situation":
    "A reversal after a closure that was run outside {appName}.",
  "landing.terminal.edge.reversalDeclined.see": "On the refund screen:",
  "landing.terminal.edge.reversalDeclined.do": "Refund to the card instead.",
  "landing.terminal.edge.reversalDeclined.records":
    "The refund once the terminal approves it. If the payment was already reversed, nothing is saved twice.",
  "landing.terminal.edge.refundUnknown.situation":
    "The outcome of a refund to the card is unknown.",
  "landing.terminal.edge.refundUnknown.see":
    "Under refunds in the payment detail:",
  "landing.terminal.edge.refundUnknown.do":
    "Let the app ask SwitchioPay, or check the refund in SwitchioPay yourself and dismiss the notice.",
  "landing.terminal.edge.refundUnknown.records":
    "The refund only once SwitchioPay confirms it. Until then, nothing else can be refunded from this payment.",
  "landing.terminal.edge.refundElsewhere.situation":
    "A refund is waiting for SwitchioPay on another device.",
  "landing.terminal.edge.refundElsewhere.see":
    "Under refunds in the payment detail:",
  "landing.terminal.edge.refundElsewhere.do":
    "Wait. If that device is no longer available, check the refund in SwitchioPay and dismiss the notice.",
  "landing.terminal.edge.refundElsewhere.records":
    "Anything SwitchioPay approves on that device, even after the notice is dismissed.",
  "landing.terminal.edge.closureUnknown.situation":
    "The outcome of a closure is unknown.",
  "landing.terminal.edge.closureUnknown.see": "On the closures screen:",
  "landing.terminal.edge.closureUnknown.do":
    "Check in SwitchioPay whether the batch was closed.",
  "landing.terminal.edge.closureUnknown.records":
    "Nothing; only a closure with usable totals is saved.",
  "landing.terminal.edge.demo.situation": "A demo account.",
  "landing.terminal.edge.demo.see": "When taking a payment:",
  "landing.terminal.edge.demo.do": "Take card payments in a real account.",
  "landing.terminal.edge.demo.records":
    "Nothing; a demo account never starts SwitchioPay.",
  "landing.terminal.edge.offline.situation":
    "The terminal has no internet connection.",
  "landing.terminal.edge.offline.see":
    "{appName} keeps working, because it talks to SwitchioPay right on the terminal. SwitchioPay, however, needs the internet to authorize the card.",
  "landing.terminal.edge.offline.do": "Restore the connection.",
  "landing.terminal.edge.offline.records":
    "Everything is saved on the terminal, and the business's other devices see it once it's back online.",

  "landing.terminal.testing.eyebrow": "Testing",
  "landing.terminal.testing.title": "Testing with Comgate",
  "landing.terminal.testing.body":
    "In Comgate's test environment, the amount decides the outcome of a payment, and only contactless payments work. Enter these amounts on the keypad:",
  "landing.terminal.testing.column.amount": "Amount",
  "landing.terminal.testing.column.simulator": "Simulator response",
  "landing.terminal.testing.column.app": "What {appName} shows",
  "landing.terminal.testing.approved.amount": "CZK 1.01",
  "landing.terminal.testing.approved.simulator": "Approved",
  "landing.terminal.testing.approved.app": "The payment is received and paid.",
  "landing.terminal.testing.partial.amount": "CZK 2.01",
  "landing.terminal.testing.partial.simulator": "Partially approved",
  "landing.terminal.testing.partial.app":
    "Still being verified on the development terminal; {appName} doesn't request partial approvals.",
  "landing.terminal.testing.duplicate.amount": "CZK 1.10",
  "landing.terminal.testing.duplicate.simulator": "Duplicate transaction",
  "landing.terminal.testing.insufficientFunds.amount": "CZK 6.02",
  "landing.terminal.testing.insufficientFunds.simulator": "Insufficient funds",
  "landing.terminal.testing.expiredCard.amount": "CZK 6.05",
  "landing.terminal.testing.expiredCard.simulator": "Expired card",
  "landing.terminal.testing.authorizationTimeout.amount": "CZK 7.09",
  "landing.terminal.testing.authorizationTimeout.simulator":
    "Authorization timed out",
  "landing.terminal.testing.cardTimeout.amount": "CZK 31.09",
  "landing.terminal.testing.cardTimeout.simulator":
    "Timed out waiting for the card",
  "landing.terminal.testing.other.amount": "Any other amount",
  "landing.terminal.testing.other.simulator": "Approved",
  "landing.terminal.testing.declined":
    "The payment stays unpaid and you can try the card again.",
  "landing.terminal.testing.operations":
    "To test reversals, refunds and closures, follow the steps above: pay CZK 1.01 and reverse the payment, then make another payment, run a closure and refund that payment to the card.",
  "landing.terminal.testing.source":
    "Amounts taken from Comgate's simulator documentation, checked on 13 November 2026.",
  "landing.terminal.testing.sourceLink": "apidoc.comgate.cz",

  "landing.terminal.limits.eyebrow": "Limitations",
  "landing.terminal.limits.title": "What {appName} doesn't do",
  "landing.terminal.limits.receipts":
    "It doesn't print receipts; SwitchioPay prints them on the terminal's printer, according to its own settings.",
  "landing.terminal.limits.operations":
    "It doesn't support pre-authorizations, MOTO payments or cashback.",
  "landing.terminal.limits.unlinkedRefund":
    "It doesn't refund without an original payment; every refund to a card belongs to a payment taken in the app.",
  "landing.terminal.limits.autoClosure":
    "It doesn't run closures automatically; staff have to start them.",
  "landing.terminal.limits.reconciliation":
    "It doesn't yet compare closure totals with its own payments.",

  "landing.terminal.faq.otherTerminal.question":
    "Can I refund a payment that was taken on another terminal?",
  "landing.terminal.faq.otherTerminal.answer":
    "Yes, to the card. Only the terminal that took a payment can reverse it. On any other terminal of the business, {appName} refunds the money to the card the customer paid with.",
  "landing.terminal.faq.forgotClosure.question":
    "What if I forget to run the closure?",
  "landing.terminal.faq.forgotClosure.answer":
    "Run it as soon as you notice. The batch contains all card payments since the last closure. If SwitchioPay closes the batch by itself, {appName} isn't aware of it; a reversal that the terminal then declines is offered as a refund to the card.",
  "landing.terminal.faq.cardNumber.question":
    "Can {appName} see the card number?",
  "landing.terminal.faq.cardNumber.answer":
    "No. SwitchioPay reads the card, and {appName} only receives the masked card number, the card type, the authorization code and the transaction IDs, which it saves with the payment.",
  "landing.terminal.faq.receipts.question": "Who prints the receipt?",
  "landing.terminal.faq.receipts.answer":
    "SwitchioPay, on the terminal's printer, according to its own settings. {appName} doesn't print anything.",
  "landing.terminal.faq.login.question":
    "Do I need an account or login details for testing?",
  "landing.terminal.faq.login.answer":
    "No. {appName} has no login: install it, go through the first-run setup and turn on card payments. Without a PIN, staff can do everything.",

  "landing.terminal.shot.settings-payments.alt":
    "{appName} settings with Payment methods in the Payments section",
  "landing.terminal.shot.payment-methods-off.alt":
    "Payment methods with the payment card turned off",
  "landing.terminal.shot.payment-methods-on.alt":
    "Payment methods with the payment card turned on as the default method",
  "landing.terminal.shot.card-settings.alt":
    "Payment card settings with a link to terminal closures",
  "landing.terminal.shot.pay-amount.alt":
    "The keypad with an amount entered and the Pay button",
  "landing.terminal.shot.pay-tip.alt": "Choosing a tip",
  "landing.terminal.shot.pay-card-tab.alt":
    "The payment screen on the Payment card tab",
  "landing.terminal.shot.pay-waiting.alt": "Waiting for the terminal",
  "landing.terminal.shot.pay-received.alt": "A received payment",
  "landing.terminal.shot.pay-detail.alt":
    "Card payment detail with the masked card number, authorization code and terminal ID",
  "landing.terminal.shot.refund-button.alt":
    "Card payment detail with the Refund money button",
  "landing.terminal.shot.refund-reversal.alt":
    "Refunding the whole payment as a reversal in SwitchioPay",
  "landing.terminal.shot.refund-running.alt":
    "A refund waiting for SwitchioPay",
  "landing.terminal.shot.refund-reversed-detail.alt":
    "Detail of a refund reversed on the terminal",
  "landing.terminal.shot.refund-referral.alt":
    "After a closure, the app offers a refund to the card",
  "landing.terminal.shot.refund-partial.alt": "Refunding part of a payment",
  "landing.terminal.shot.refund-tip-only.alt": "Refunding only the tip",
  "landing.terminal.shot.refund-referral-detail.alt":
    "Detail of a refund to the card",
  "landing.terminal.shot.reversal-declined.alt":
    "The terminal declined the reversal and the app offers a refund to the card",
  "landing.terminal.shot.closure-row.alt":
    "Settings with the Terminal closures item",
  "landing.terminal.shot.closure-page.alt":
    "Terminal closures showing this terminal's last closure",
  "landing.terminal.shot.closure-confirm.alt": "Confirming the closure",
  "landing.terminal.shot.closure-detail.alt":
    "Closure detail with the summary, batch number and shift number",
  "landing.terminal.shot.edge-declined.alt":
    "The Payment card tab after a declined card",
  "landing.terminal.shot.edge-unknown.alt":
    "The Payment card tab with an unknown payment outcome",
  "landing.terminal.shot.edge-unknown-resolved.alt":
    "A received payment after SwitchioPay confirmed it later",
  "landing.terminal.shot.edge-charge-again.alt":
    "Confirmation before trying the card again",
  "landing.terminal.shot.edge-busy.alt":
    "The Payment card tab while SwitchioPay is busy",
  "landing.terminal.shot.edge-not-installed.alt":
    "A warning that SwitchioPay isn't installed",
  "landing.terminal.shot.edge-restored.alt":
    "A notice that a card payment was processed after the app restarted",
  "landing.terminal.shot.edge-canceled-but-paid.alt":
    "A cancelled payment paid by card, with options to mark it as paid or refund the money",
  "landing.terminal.shot.edge-refund-unknown.alt":
    "A refund with an unknown outcome and a button to ask SwitchioPay",
  "landing.terminal.shot.edge-closure-unknown.alt":
    "Terminal closures with a closure whose outcome is unknown",
  "landing.terminal.shot.edge-demo.alt":
    "A notice that a demo account can't take real card payments",
} as const
