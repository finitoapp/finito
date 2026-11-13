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
    "{appName} on the SwitchioPay card terminal: payment, reversal, refund, closure",
  "landing.terminal.meta.description":
    "How {appName} takes card payments on a NEXGO terminal through SwitchioPay: turning it on, a payment, a reversal, a refund to the card, the closure, edge cases and testing in Comgate's environment.",
  "landing.terminal.hero.eyebrow": "Card terminal",
  "landing.terminal.hero.title": "{appName} on the SwitchioPay card terminal",
  "landing.terminal.hero.body":
    "{appName} runs right on the NEXGO N92 payment terminal, next to the SwitchioPay app. For a card payment it hands the amount over to SwitchioPay on the same terminal and never sees the card's data. SwitchioPay prints the receipts on the terminal's printer, as its configuration says.",
  "landing.terminal.hero.note":
    "Every screenshot on this page comes from the app itself. Where SwitchioPay takes over, a grey placeholder stands in for its screen.",
  "landing.terminal.toc.title": "On this page",
  "landing.terminal.switchioPay.name": "SwitchioPay",

  "landing.terminal.switchioPay.cardTap": "The customer taps the card",
  "landing.terminal.switchioPay.reversal": "Reversing the payment",
  "landing.terminal.switchioPay.refund": "Refunding to the card",
  "landing.terminal.switchioPay.closure": "Closing the batch",

  "landing.terminal.requirements.eyebrow": "Before you start",
  "landing.terminal.requirements.title": "What you need",
  "landing.terminal.requirements.terminal":
    "A NEXGO payment terminal from Comgate with SwitchioPay, and a contract with Comgate.",
  "landing.terminal.requirements.install":
    "{appName} installed on the terminal from the Switchio Store, signed by Comgate.",
  "landing.terminal.requirements.onboarding":
    "Onboarding completed in {appName}: it creates the business's account in a minute.",
  "landing.terminal.requirements.permissions.title": "Who may do what",
  "landing.terminal.requirements.permissions.body":
    "Once the owner sets a PIN, each action needs its permission:",
  "landing.terminal.requirements.permissions.activation":
    "Turning card payments on",
  "landing.terminal.requirements.permissions.refund":
    "Reversals and refunds to the card",
  "landing.terminal.requirements.permissions.closure": "The closure",
  "landing.terminal.requirements.tester.title": "For Comgate's tester",
  "landing.terminal.requirements.tester.body":
    "{appName} has no login and no test account to hand over. Install the APK, go through onboarding without setting a PIN, so whoever holds the terminal may do everything, and turn card payments on as described below.",

  "landing.terminal.activation.eyebrow": "Turning it on",
  "landing.terminal.activation.title": "Turn card payments on",
  "landing.terminal.activation.body":
    "Once per business, in the settings. The switch applies to every device of the business.",
  "landing.terminal.activation.step.settings":
    "Open the settings and the payment methods.",
  "landing.terminal.activation.step.off":
    "Card payments stay off until you turn them on. If SwitchioPay is missing on the terminal, the row says so.",
  "landing.terminal.activation.step.on":
    "Turn the switch on. The payment screen opens on the first method in the list, marked as the default; drag the rows to change the order.",
  "landing.terminal.activation.step.card":
    "The row leads to what card payments need and to the terminal closures.",

  "landing.terminal.payment.eyebrow": "Payment",
  "landing.terminal.payment.title": "Take a card payment",
  "landing.terminal.payment.body":
    "{appName} sends SwitchioPay the amount, the tip on its own, the currency and the payment's number as the invoice number.",
  "landing.terminal.payment.step.amount":
    "Type the amount on the keypad and go on to the payment. A bill from the tables or the catalog is paid the same way.",
  "landing.terminal.payment.step.tip":
    "If tips are on, the customer picks one. SwitchioPay gets the tip apart from the amount.",
  "landing.terminal.payment.step.cardTab":
    "On the payment card tab, start the payment.",
  "landing.terminal.payment.step.waiting":
    "{appName} waits while SwitchioPay has the screen.",
  "landing.terminal.payment.step.switchioPay":
    "SwitchioPay takes over: the customer taps the card and enters the PIN if the terminal asks for it.",
  "landing.terminal.payment.step.received":
    "Back in the app, the payment is received.",
  "landing.terminal.payment.step.detail":
    "The payment's detail shows the masked card number, the card brand, the authorization code, the terminal's transaction ID and the terminal ID.",
  "landing.terminal.payment.note":
    "With an approved payment {appName} keeps what its refund needs: the transaction ID, the ID SwitchioPay refunds it by, the device that took it and when.",

  "landing.terminal.reversal.eyebrow": "Reversal",
  "landing.terminal.reversal.title": "Reverse a payment before the closure",
  "landing.terminal.reversal.body":
    "A reversal takes the whole payment back on the terminal, and the card is not needed for it. {appName} chooses it by itself whenever all of these hold:",
  "landing.terminal.reversal.rule.whole":
    "the whole payment goes back, the tip included;",
  "landing.terminal.reversal.rule.first":
    "nothing of the payment was refunded before;",
  "landing.terminal.reversal.rule.sameTerminal":
    "you are on the terminal that took the payment;",
  "landing.terminal.reversal.rule.noClosure":
    "that terminal has run no closure in {appName} since.",
  "landing.terminal.reversal.step.button":
    "Open the payment in the activity and start the refund.",
  "landing.terminal.reversal.step.choose":
    "Choose the whole payment. The method says the terminal takes the whole payment back and the card is not needed.",
  "landing.terminal.reversal.step.running":
    "Confirm the refund. {appName} waits while SwitchioPay reverses the payment.",
  "landing.terminal.reversal.step.switchioPay":
    "SwitchioPay reverses the transaction {appName} names by its ID.",
  "landing.terminal.reversal.step.detail":
    "The refund's detail shows the payment reversed on the terminal, with the terminal's transaction ID, the authorization code and the sequence number.",

  "landing.terminal.refund.eyebrow": "Refund",
  "landing.terminal.refund.title": "Refund to the card after the closure",
  "landing.terminal.refund.body":
    "Whenever a reversal is not possible, {appName} refunds to the card the customer paid with: after a closure, for part of the payment or the tip alone, after an earlier refund, or on another terminal than the one that took the payment.",
  "landing.terminal.refund.step.referral":
    "After a closure the same screen offers the refund: the money goes back to the card the customer paid with.",
  "landing.terminal.refund.step.partial":
    "Part of the payment: type the amount, or pick the items.",
  "landing.terminal.refund.step.tip": "The tip alone has a refund of its own.",
  "landing.terminal.refund.step.switchioPay":
    "SwitchioPay refunds the money to the card; follow the terminal.",
  "landing.terminal.refund.step.detail":
    "The refund's detail shows it refunded to the card, with what the terminal answered.",
  "landing.terminal.refund.step.declined":
    "If the batch was closed outside {appName}, the terminal declines the reversal. {appName} asks SwitchioPay whether the payment was reversed after all, and if not, offers to refund it to the card instead.",

  "landing.terminal.closure.eyebrow": "Closure",
  "landing.terminal.closure.title": "Close the batch after every shift",
  "landing.terminal.closure.body":
    "The closure sends the terminal's card payments for settlement. Run it every day after the shift, on each terminal separately.",
  "landing.terminal.closure.step.row":
    "In the settings, open the terminal closures. The row is there once card payments are on.",
  "landing.terminal.closure.step.page":
    "The screen shows this terminal's last closure. Start the closure.",
  "landing.terminal.closure.step.confirm":
    "Confirm: the card payments since the last closure go for settlement.",
  "landing.terminal.closure.step.switchioPay": "SwitchioPay closes the batch.",
  "landing.terminal.closure.step.detail":
    "{appName} records the summary (payments with tips, refunds, adjustments) with the batch and shift numbers. The history and the overview of all the business's terminals show it on every device.",
  "landing.terminal.closure.note.perTerminal":
    "Each terminal closes its own batch, and only on itself.",
  "landing.terminal.closure.note.outside":
    "A closure run directly in SwitchioPay, or by SwitchioPay itself, is not known to {appName}.",
  "landing.terminal.closure.note.reconciliation":
    "{appName} does not yet match a closure's totals with its own payments.",

  "landing.terminal.edge.eyebrow": "Edge cases",
  "landing.terminal.edge.title": "When something goes differently",
  "landing.terminal.edge.body":
    "What you see, what to do, and what {appName} records. It counts a payment as paid only when SwitchioPay approved it, and after an unclear result it asks you to check before charging the card again.",
  "landing.terminal.edge.column.situation": "Situation",
  "landing.terminal.edge.column.see": "What you see",
  "landing.terminal.edge.column.do": "What to do",
  "landing.terminal.edge.column.records": "What {appName} records",
  "landing.terminal.edge.declined.situation":
    "The card is declined, or the customer's bank refuses the payment.",
  "landing.terminal.edge.declined.see": "A message on the card tab:",
  "landing.terminal.edge.declined.do":
    "Charge again, or let the customer pay another way.",
  "landing.terminal.edge.declined.records":
    "Nothing: the payment stays unpaid.",
  "landing.terminal.edge.canceled.situation":
    "The payment is cancelled on the terminal.",
  "landing.terminal.edge.canceled.see":
    "Depending on what SwitchioPay reports, the payment did not go through or its result is unknown. This is being verified on Comgate's development terminal.",
  "landing.terminal.edge.canceled.do":
    "Charge again; with an unknown result, check SwitchioPay first.",
  "landing.terminal.edge.canceled.records":
    "No payment, unless SwitchioPay reports an approval.",
  "landing.terminal.edge.unknown.situation":
    "SwitchioPay gives no readable result, for instance because it crashed or Android closed it.",
  "landing.terminal.edge.unknown.see":
    "That the result is unknown. {appName} then asks SwitchioPay about the transaction by itself.",
  "landing.terminal.edge.unknown.do":
    "Wait for the answer. If SwitchioPay does not confirm an approval, check the transaction in SwitchioPay.",
  "landing.terminal.edge.unknown.records":
    "The payment as paid only once SwitchioPay confirms the approval; any other answer leaves the result unknown.",
  "landing.terminal.edge.chargeAgain.situation":
    "You charge again while the last result is still unknown.",
  "landing.terminal.edge.chargeAgain.see":
    "A confirmation warning that the card may already have been charged:",
  "landing.terminal.edge.chargeAgain.do":
    "Confirm only after checking in SwitchioPay that the last attempt did not go through.",
  "landing.terminal.edge.chargeAgain.records":
    "A new attempt with a new transaction ID.",
  "landing.terminal.edge.busy.situation":
    "SwitchioPay is busy with something else, or refuses to start.",
  "landing.terminal.edge.busy.see": "That SwitchioPay is busy; try again.",
  "landing.terminal.edge.busy.do":
    "Finish what is open in SwitchioPay and start the payment again.",
  "landing.terminal.edge.busy.records": "Nothing: the terminal never started.",
  "landing.terminal.edge.notInstalled.situation":
    "SwitchioPay is not installed on the terminal.",
  "landing.terminal.edge.notInstalled.see":
    "A warning on the payment card row in the settings, and on payment:",
  "landing.terminal.edge.notInstalled.do":
    "Have SwitchioPay installed and set up on the terminal.",
  "landing.terminal.edge.notInstalled.records": "Nothing.",
  "landing.terminal.edge.restored.situation":
    "Android closes {appName} while SwitchioPay has the screen.",
  "landing.terminal.edge.restored.see": "Once the app is back:",
  "landing.terminal.edge.restored.do":
    "Nothing: the terminal's result waits for the app and is settled when it comes back.",
  "landing.terminal.edge.restored.records":
    "The payment as SwitchioPay reported it.",
  "landing.terminal.edge.otherAccount.situation":
    "The kept result belongs to another account on the terminal.",
  "landing.terminal.edge.otherAccount.see":
    "Nothing until that account is active again.",
  "landing.terminal.edge.otherAccount.do":
    "Switch to the account the payment was taken in. Until then the terminal starts no other payment.",
  "landing.terminal.edge.otherAccount.records":
    "The result in its own account only.",
  "landing.terminal.edge.canceledButPaid.situation":
    "A payment cancelled on another device is paid by card.",
  "landing.terminal.edge.canceledButPaid.see": "In the payment's detail:",
  "landing.terminal.edge.canceledButPaid.do":
    "Mark the payment as paid, or refund it.",
  "landing.terminal.edge.canceledButPaid.records":
    "The card payment: the card was charged, so the money counts.",
  "landing.terminal.edge.reversalDeclined.situation":
    "A reversal after a closure run outside {appName}.",
  "landing.terminal.edge.reversalDeclined.see": "On the refund screen:",
  "landing.terminal.edge.reversalDeclined.do": "Refund to the card instead.",
  "landing.terminal.edge.reversalDeclined.records":
    "The refund once the terminal approves it; nothing twice if the payment was reversed already.",
  "landing.terminal.edge.refundUnknown.situation":
    "A refund's result is unknown.",
  "landing.terminal.edge.refundUnknown.see": "In the payment's refunds:",
  "landing.terminal.edge.refundUnknown.do":
    "Let {appName} ask SwitchioPay, or check SwitchioPay yourself and dismiss the refund.",
  "landing.terminal.edge.refundUnknown.records":
    "The refund only once SwitchioPay confirms the approval. Until then no other refund of the payment starts.",
  "landing.terminal.edge.refundElsewhere.situation":
    "A refund waits for SwitchioPay on another device.",
  "landing.terminal.edge.refundElsewhere.see": "In the payment's refunds:",
  "landing.terminal.edge.refundElsewhere.do":
    "Wait. If that device is gone, check SwitchioPay and dismiss the refund.",
  "landing.terminal.edge.refundElsewhere.records":
    "Whatever that device's SwitchioPay approves, even after a dismissal.",
  "landing.terminal.edge.closureUnknown.situation":
    "The closure's result is unknown.",
  "landing.terminal.edge.closureUnknown.see": "On the closure screen:",
  "landing.terminal.edge.closureUnknown.do":
    "Check in SwitchioPay whether the batch was closed.",
  "landing.terminal.edge.closureUnknown.records":
    "Nothing: only a closure with readable totals is recorded.",
  "landing.terminal.edge.demo.situation": "A demo account.",
  "landing.terminal.edge.demo.see": "On payment:",
  "landing.terminal.edge.demo.do": "Take card payments in a real account.",
  "landing.terminal.edge.demo.records":
    "Nothing: a demo account never starts SwitchioPay.",
  "landing.terminal.edge.offline.situation":
    "The terminal has no internet connection.",
  "landing.terminal.edge.offline.see":
    "{appName} works on: it talks to SwitchioPay on the terminal itself. SwitchioPay needs the connection to authorize the card.",
  "landing.terminal.edge.offline.do": "Restore the connection.",
  "landing.terminal.edge.offline.records":
    "Everything on the terminal; the business's other devices see it once it is online.",

  "landing.terminal.testing.eyebrow": "Testing",
  "landing.terminal.testing.title": "Testing in Comgate's environment",
  "landing.terminal.testing.body":
    "Comgate's test environment decides the outcome by the amount and accepts contactless payments only. Type these amounts on the keypad:",
  "landing.terminal.testing.column.amount": "Amount",
  "landing.terminal.testing.column.simulator": "The simulator answers",
  "landing.terminal.testing.column.app": "{appName} shows",
  "landing.terminal.testing.approved.amount": "CZK 1.01",
  "landing.terminal.testing.approved.simulator": "Approved",
  "landing.terminal.testing.approved.app": "The payment is received and paid.",
  "landing.terminal.testing.partial.amount": "CZK 2.01",
  "landing.terminal.testing.partial.simulator": "Approved – partially",
  "landing.terminal.testing.partial.app":
    "Being verified on the development terminal; {appName} does not ask for partial approvals.",
  "landing.terminal.testing.duplicate.amount": "CZK 1.10",
  "landing.terminal.testing.duplicate.simulator": "Duplicate transaction",
  "landing.terminal.testing.insufficientFunds.amount": "CZK 6.02",
  "landing.terminal.testing.insufficientFunds.simulator": "Insufficient funds",
  "landing.terminal.testing.expiredCard.amount": "CZK 6.05",
  "landing.terminal.testing.expiredCard.simulator": "Expired card",
  "landing.terminal.testing.authorizationTimeout.amount": "CZK 7.09",
  "landing.terminal.testing.authorizationTimeout.simulator":
    "Authorization timeout",
  "landing.terminal.testing.cardTimeout.amount": "CZK 31.09",
  "landing.terminal.testing.cardTimeout.simulator": "Card detection timeout",
  "landing.terminal.testing.other.amount": "Any other amount",
  "landing.terminal.testing.other.simulator": "Approved",
  "landing.terminal.testing.declined":
    "The payment stays unpaid and can be charged again.",
  "landing.terminal.testing.operations":
    "Reversal, refund to the card and closure are tested as described above: approve a payment of 1.01 and reverse it; then approve another payment, run the closure and refund that payment to the card.",
  "landing.terminal.testing.source":
    "The amounts are those of Comgate's simulator documentation, checked on 13 November 2026.",
  "landing.terminal.testing.sourceLink": "apidoc.comgate.cz",

  "landing.terminal.limits.eyebrow": "Limits",
  "landing.terminal.limits.title": "What {appName} does not do",
  "landing.terminal.limits.receipts":
    "It prints no receipts: SwitchioPay prints them on the terminal's printer, as its configuration says.",
  "landing.terminal.limits.operations":
    "It has no pre-authorizations, MOTO payments or cashback.",
  "landing.terminal.limits.unlinkedRefund":
    "It makes no refund without the original payment: every refund to the card goes back to a payment taken in the app.",
  "landing.terminal.limits.autoClosure":
    "It runs no closure by itself: someone has to start it.",
  "landing.terminal.limits.reconciliation":
    "It does not yet match a closure's totals with its own payments.",

  "landing.terminal.faq.otherTerminal.question":
    "Can I refund a payment taken on another terminal?",
  "landing.terminal.faq.otherTerminal.answer":
    "Yes, to the card. Only the terminal that took a payment can reverse it, so on any other terminal of the business {appName} refunds it to the card the customer paid with.",
  "landing.terminal.faq.forgotClosure.question":
    "What if I forget the closure?",
  "landing.terminal.faq.forgotClosure.answer":
    "Run it as soon as you notice: the batch holds every card payment since the last closure. If SwitchioPay closes the batch on its own, {appName} does not know about it; a reversal the terminal then declines is offered as a refund to the card.",
  "landing.terminal.faq.cardNumber.question":
    "Does {appName} see the card number?",
  "landing.terminal.faq.cardNumber.answer":
    "No. SwitchioPay reads the card. {appName} gets back only the masked card number, the card brand, the authorization code and the transaction IDs, and keeps them with the payment.",
  "landing.terminal.faq.receipts.question": "Who prints the receipt?",
  "landing.terminal.faq.receipts.answer":
    "SwitchioPay, on the terminal's printer, as its configuration says. {appName} prints nothing.",
  "landing.terminal.faq.login.question":
    "Do I need an account or a login to test it?",
  "landing.terminal.faq.login.answer":
    "No. {appName} has no login: install it, go through onboarding and turn card payments on. Without a PIN, whoever holds the terminal may do everything.",

  "landing.terminal.shot.settings-payments.alt":
    "{appName}'s settings with the payment methods under Payments",
  "landing.terminal.shot.payment-methods-off.alt":
    "The payment methods with payment card turned off",
  "landing.terminal.shot.payment-methods-on.alt":
    "The payment methods with payment card turned on and marked as the default",
  "landing.terminal.shot.card-settings.alt":
    "The payment card's settings with a link to the terminal closures",
  "landing.terminal.shot.pay-amount.alt":
    "The keypad with an amount typed in and the Pay button",
  "landing.terminal.shot.pay-tip.alt": "The tip step of the payment",
  "landing.terminal.shot.pay-card-tab.alt":
    "The payment screen on the payment card tab",
  "landing.terminal.shot.pay-waiting.alt":
    "The payment card tab waiting for the terminal",
  "landing.terminal.shot.pay-received.alt": "The payment received",
  "landing.terminal.shot.pay-detail.alt":
    "The detail of a card payment with the masked card number, the authorization code and the terminal's IDs",
  "landing.terminal.shot.refund-button.alt":
    "A card payment's detail with the Refund money button",
  "landing.terminal.shot.refund-reversal.alt":
    "The refund screen with the whole payment going back to the card through SwitchioPay as a reversal",
  "landing.terminal.shot.refund-running.alt":
    "The refund screen waiting for SwitchioPay",
  "landing.terminal.shot.refund-reversed-detail.alt":
    "The detail of a refund reversed on the terminal",
  "landing.terminal.shot.refund-referral.alt":
    "The refund screen offering a refund to the card after a closure",
  "landing.terminal.shot.refund-partial.alt":
    "The refund screen with part of the payment",
  "landing.terminal.shot.refund-tip-only.alt":
    "The refund screen with the tip alone",
  "landing.terminal.shot.refund-referral-detail.alt":
    "The detail of a refund to the card",
  "landing.terminal.shot.reversal-declined.alt":
    "The terminal declining a reversal and the offer to refund to the card",
  "landing.terminal.shot.closure-row.alt":
    "The settings with the terminal closures",
  "landing.terminal.shot.closure-page.alt":
    "The terminal closures with this terminal's last closure",
  "landing.terminal.shot.closure-confirm.alt":
    "The confirmation of the terminal closure",
  "landing.terminal.shot.closure-detail.alt":
    "The detail of a closure with the summary and the batch and shift numbers",
  "landing.terminal.shot.edge-declined.alt":
    "The payment card tab after a declined card",
  "landing.terminal.shot.edge-unknown.alt":
    "The payment card tab with an unknown result",
  "landing.terminal.shot.edge-unknown-resolved.alt":
    "The payment received after {appName} asked SwitchioPay",
  "landing.terminal.shot.edge-charge-again.alt":
    "The confirmation before charging the card again",
  "landing.terminal.shot.edge-busy.alt":
    "The payment card tab with SwitchioPay busy",
  "landing.terminal.shot.edge-not-installed.alt":
    "The warning that SwitchioPay is not installed",
  "landing.terminal.shot.edge-restored.alt":
    "The message that a card payment was settled after the app restarted",
  "landing.terminal.shot.edge-canceled-but-paid.alt":
    "A cancelled payment paid by card, with the choice to mark it paid or refund it",
  "landing.terminal.shot.edge-refund-unknown.alt":
    "A refund with an unknown result and the button to ask SwitchioPay",
  "landing.terminal.shot.edge-closure-unknown.alt":
    "The terminal closures with a closure of unknown result",
  "landing.terminal.shot.edge-demo.alt":
    "The message that a demo account takes no real card payments",
} as const
