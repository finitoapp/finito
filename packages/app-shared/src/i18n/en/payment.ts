export const enPayment = {
  "payment.create.error": "Could not create the payment.",
  "payment.status.canceled": "Canceled",
  "payment.status.expired": "Expired",
  "payment.status.paid": "Paid",
  "payment.status.pending": "Pending",
  "paymentDetail.cashReceived": "Received in cash {amount}",
  "paymentDetail.eet.amount": "Amount sent",
  "paymentDetail.eet.cashRegister": "Cash register ID",
  "paymentDetail.eet.eic": "EIČ",
  "paymentDetail.eet.errorCode": "EET error {code}: {message}",
  "paymentDetail.eet.establishment": "Establishment",
  "paymentDetail.eet.extra.description":
    "Money that arrived after the first settlement, or above the payment amount, is reported as its own sale, and refunding it reverses only that sale.",
  "paymentDetail.eet.extra.title": "Extra money in EET {amount}",
  "paymentDetail.eet.lastError": "Last error",
  "paymentDetail.eet.overdue": "Not confirmed within 48 hours of the sale.",
  "paymentDetail.eet.pok": "POK",
  "paymentDetail.eet.receivedAt": "Received by EET",
  "paymentDetail.eet.retry": "Send to EET again",
  "paymentDetail.eet.retry.alreadyConfirmed":
    "EET has already confirmed this sale.",
  "paymentDetail.eet.retry.busy": "This sale is being sent right now.",
  "paymentDetail.eet.waitingForDevice":
    "Until {time}, only the device that took the payment sends it.",
  "paymentDetail.eet.retry.confirmed": "EET confirmed the sale.",
  "paymentDetail.eet.retry.failed": "The sale could not be sent.",
  "paymentDetail.eet.retry.noCertificate":
    "Import the cash-register certificate in EET settings first.",
  "paymentDetail.eet.retry.pending":
    "EET did not answer. The sale will be sent again automatically.",
  "paymentDetail.eet.retry.rejected": "EET rejected the sale again.",
  "paymentDetail.eet.retry.unsupported": "This sale cannot be reported to EET.",
  "paymentDetail.eet.reversal.retry.confirmed": "EET confirmed the reversal.",
  "paymentDetail.eet.reversal.retry.rejected":
    "EET rejected the reversal again.",
  "paymentDetail.eet.reversal.title": "EET reversal {amount}",
  "paymentDetail.eet.reversal.unsupported.disabled":
    "EET was switched off at the refund, so the reversal is not sent.",
  "paymentDetail.eet.reversal.unsupported.environment":
    "EET now runs in another environment than the sale, so the reversal is not sent.",
  "paymentDetail.eet.reversal.unsupported.taxpayer":
    "EET now reports for another taxpayer than the sale, so the reversal is not sent.",
  "paymentDetail.eet.reversal.waiting":
    "Waits until EET confirms the original sale.",
  "paymentDetail.eet.reversal.waitingForDevice":
    "Until {time}, only the device that recorded the refund sends it.",
  "paymentDetail.eet.saleAt": "Time of sale",
  "paymentDetail.eet.sequenceNumber": "Sale number",
  "paymentDetail.eet.test":
    "Sent to the EET test environment only. Not reported to the tax administrator.",
  "paymentDetail.eet.title": "EET",
  "paymentDetail.eet.transactionId": "EET transaction ID",
  "paymentDetail.eet.unsupported":
    "EET accepts sales in Czech crowns only, so this sale was not sent.",
  "paymentDetail.eet.warning": "EET warning {code}",
  "paymentDetail.number": "Payment #{number}",
  "paymentDetail.refunds.action": "Refund money",
  "paymentDetail.refunds.method.cashRegister": "From the cash register",
  "paymentDetail.refunds.method.outside": "Outside {appName}",
  "paymentDetail.refunds.method.qerkoPayment": "In Qerko",
  "paymentDetail.refunds.qerkoPaymentAction": "Refund in Qerko ({amount})",
  "refund.qerkoPayment.confirm.title": "Refund the payment in Qerko?",
  "refund.qerkoPayment.confirm.description":
    "Qerko returns the whole payment, {amount}, to how the customer paid. This cannot be undone.",
  "refund.qerkoPayment.confirm.confirm": "Refund",
  "refund.qerkoPayment.confirm.cancel": "Cancel",
  "refund.qerkoPayment.done": "Qerko refunded the payment.",
  "refund.qerkoPayment.error.notAvailable":
    "This payment cannot be refunded in Qerko: it was not paid there, or part of it is refunded already.",
  "refund.qerkoPayment.error.notCancelled":
    "Qerko did not refund the payment. Try again later.",
  "refund.qerkoPayment.error.unreachable":
    "Qerko could not be reached. Check the connection and try again.",
  "paymentDetail.refunds.method.qerkoTerminal": "To the card",
  "paymentDetail.refunds.method.cardSwitchio": "To the card",
  "paymentDetail.refunds.title": "Refunds",
  "paymentDetail.refunds.tipAction": "Refund the tip ({amount})",
  "paymentDetail.refunds.tip": "Tip",
  "paymentDetail.tipIncluded": "Includes {amount} tip",
  "paymentDetail.canceledAtValue": "Canceled {date}",
  "paymentDetail.expiresAt": "Expires at {time}",
  "paymentDetail.technical": "Technical details",
  "paymentDetail.id": "Payment ID",
  "paymentDetail.reconciliation.id": "Reconciliation ID",
  "paymentDetail.copy": "Copy {label}",
  "paymentDetail.copied": "Copied.",
  "paymentDetail.copyError": "Could not copy.",
  "paymentDetail.bill.noTable": "No table",
  "paymentDetail.bill.open": "Open bill",
  "paymentDetail.backToPayment": "Back to payment",
  "paymentDetail.bill.coverage.changesTitle": "Changes since this payment",
  "paymentDetail.bill.coverage.delta.overpaid":
    "Paid {amount} more than the bill is worth",
  "paymentDetail.bill.coverage.delta.underpaid": "Still missing {amount}",
  "paymentDetail.bill.coverage.expectedAmount": "Expected",
  "paymentDetail.bill.coverage.overpaid.fact":
    "This bill has been paid for more than it's currently worth.",
  "paymentDetail.bill.coverage.overpaid.factWithReason":
    "This bill has been paid for more than it's currently worth. {reason}",
  "paymentDetail.bill.coverage.overpaid.title": "Overpaid",
  "paymentDetail.bill.coverage.paidAmount": "Paid",
  "paymentDetail.bill.coverage.reason.billLinesChanged":
    "Another device likely changed the bill's items while this payment was already in progress.",
  "paymentDetail.bill.coverage.reason.multiplePayments":
    "This bill involves more than one payment — see the others below.",
  "paymentDetail.bill.coverage.underpaid.fact":
    "This bill isn't fully covered by confirmed payments yet.",
  "paymentDetail.bill.coverage.underpaid.factWithReason":
    "This bill isn't fully covered by confirmed payments yet. {reason}",
  "paymentDetail.bill.coverage.underpaid.title": "Not fully paid",
  "paymentDetail.bill.empty": "This bill has no items.",
  "paymentDetail.bill.table": "Table",
  "paymentDetail.bill.title": "Bill",
  "paymentDetail.bill.total": "Total",
  "paymentDetail.collision.description":
    "This payment was canceled, but a claim for it exists — the money still counts toward the bill. Resolve the collision below.",
  "paymentDetail.collision.markPaid": "Mark as paid",
  "paymentDetail.collision.markPaid.error":
    "Couldn't mark the payment as paid. Try again.",
  "paymentDetail.collision.refund": "Refund",
  "paymentDetail.collision.refund.comingSoon": "Refunds aren't supported yet.",
  "paymentDetail.collision.title": "Canceled, but money arrived",
  "paymentDetail.deviceId": "Device",
  "paymentDetail.emptyValue": "—",
  "paymentDetail.excessCollision.acknowledge": "Mark as resolved",
  "paymentDetail.excessCollision.acknowledge.error":
    "Couldn't mark the collision as resolved. Try again.",
  "paymentDetail.excessCollision.description":
    "This payment was settled more than once — likely two offline devices each confirmed a different payment method for it. Resolve the collision below.",
  "paymentDetail.excessCollision.title": "Paid more than once",
  "paymentDetail.invalidId": "Invalid payment id.",
  "paymentDetail.notFound": "Payment was not found.",
  "paymentDetail.paymentMethod.card": "Payment card",
  "paymentDetail.qerkoAttempts.title": "In Qerko",
  "paymentDetail.qerkoAttempts.state.started": "Started",
  "paymentDetail.qerkoAttempts.state.processing": "Being confirmed",
  "paymentDetail.qerkoAttempts.state.paid": "Paid",
  "paymentDetail.qerkoAttempts.state.failed": "Did not go through",
  "paymentDetail.qerkoProvider.card": "card",
  "paymentDetail.qerkoProvider.mealTicket": "meal voucher",
  "paymentDetail.qerkoProvider.voucher": "voucher",
  "paymentDetail.qerkoProvider.bankTransfer": "bank transfer",
  "paymentDetail.qerkoProvider.invoice": "invoice",
  "paymentDetail.paymentMethod.qerkoPayment": "Qerko",
  "paymentDetail.paymentMethod.qerkoTerminal": "Payment card (terminal)",
  "paymentDetail.paymentMethod.qerkoTerminalTid":
    "Payment card (terminal {tid})",
  "paymentDetail.paymentMethod.cashu": "Cashu",
  "paymentDetail.paymentMethod.cash": "Cash",
  "paymentDetail.paymentMethod.iban": "IBAN",
  "paymentDetail.paymentMethod.onchain": "On-chain",
  "paymentDetail.paymentMethod.spark": "Lightning",
  "paymentDetail.reconciliation.source.auto": "Auto",
  "paymentDetail.reconciliation.source.manual": "Manual",
  "paymentDetail.reconciliations": "Reconciliations",
  "paymentDetail.reconciliations.empty":
    "No transaction has been reconciled with this payment yet.",
  "paymentDetail.tipAmount": "Tip",
  "paymentDetail.title": "Payment detail",
  "paymentDetail.transaction.account": "Account",
  "paymentDetail.transaction.amount": "Transaction amount",
  "paymentDetail.transaction.bankReference": "Bank reference",
  "paymentDetail.transaction.id": "Transaction",
  "paymentDetail.transaction.note": "Note",
  "paymentDetail.transaction.occurredAt": "Occurred at",
  "paymentDetail.transaction.paymentHash": "Payment hash",
  "paymentDetail.transaction.recordedAt": "Recorded at",
  "paymentDetail.transaction.source": "Transaction source",
  "paymentDetail.transaction.sparkTransferId": "Spark transfer",
  "paymentDetail.transaction.variableSymbol": "Variable symbol",
  "paymentDetail.updatedAt": "Updated at",
  "paymentHistory.billOverpaid": "Bill overpaid",
  "paymentHistory.billUnderpaid": "Bill underpaid",
  "paymentHistory.empty.description":
    "Created payment requests will appear here.",
  "paymentHistory.empty.title": "No payments yet",
  "paymentHistory.payment": "Payment",
  "paymentHistory.paymentNumber": "Payment #{number}",
  "paymentHistory.tip": "incl. {amount} tip",
  "paymentHistory.title": "Payment history",
  "paymentTip.continue": "Continue to payment",
  "paymentTip.creating": "Creating payment...",
  "paymentTip.custom.actionDescription": "Enter amount",
  "paymentTip.custom.description":
    "Enter the amount the customer wants to add.",
  "paymentTip.custom.invalid":
    "Enter a positive amount with up to two decimal places.",
  "paymentTip.custom.label": "Custom tip",
  "paymentTip.custom.placeholder": "e.g. 20.00",
  "paymentTip.fixedAmounts": "Fixed amount tips",
  "paymentTip.invalidLink": "Invalid tip link.",
  "paymentTip.none": "No tip",
  "paymentTip.orderTotal": "Order total",
  "paymentTip.percentages": "Percentage tips",
  "paymentTip.title": "Would you like to add a tip?",
  "paymentWait.back": "Back to terminal",
  "paymentWait.boltCard.awaitingSettlement":
    "Card accepted, waiting for the payment...",
  "paymentWait.boltCard.disabled":
    "NFC is off. Turn it on to accept Bolt Cards.",
  "paymentWait.boltCard.enable": "Turn on NFC",
  "paymentWait.boltCard.error.amountOutOfRange":
    "The amount is outside this card's limit.",
  "paymentWait.boltCard.error.generic":
    "Could not pay with the card. Tap it again.",
  "paymentWait.boltCard.error.network":
    "Could not reach the card's service. Check the connection and tap again.",
  "paymentWait.boltCard.error.notPayable":
    "This payment can no longer be paid.",
  "paymentWait.boltCard.error.rejected": "The card was declined: {reason}",
  "paymentWait.boltCard.error.timeout":
    "The card did not pay in time. Tap it again or use another method.",
  "paymentWait.boltCard.error.unsupportedCard": "This card is not a Bolt Card.",
  "paymentWait.boltCard.processing": "Reading the card...",
  "paymentWait.boltCard.ready": "Or tap a Bolt Card",
  "paymentWait.cancel": "Cancel payment",
  "paymentWait.cancelError": "Could not cancel the payment.",
  "paymentWait.canceled": "This payment was canceled.",
  "paymentWait.cardPaid.action": "Pay with payment card",
  "paymentWait.cardPaid.error.declined":
    "Payment by payment card did not go through.",
  "paymentWait.cardPaid.error.generic":
    "Could not take payment by payment card.",
  "paymentWait.cardPaid.error.demo":
    "A real card payment cannot be taken in a demo account.",
  "paymentWait.cardPaid.error.unavailable":
    "The SwitchioPay terminal app is not available on this device.",
  "paymentWait.cardPaid.error.unreadable":
    "The terminal did not report a readable result. Check the transaction in SwitchioPay before trying again.",
  "paymentWait.cardPaid.error.notPayable":
    "This payment can no longer be paid by card.",
  "paymentWait.cardPaid.pending": "Waiting for the terminal...",
  "paymentWait.cardPaid.prompt": "Accept payment by payment card",
  "paymentWait.cardPaid.unavailable":
    "Card terminal is not attached to this payment.",
  "paymentWait.cardPaid.restored.paid":
    "Card payment settled after the app restarted.",
  "paymentWait.cardPaid.restored.unresolved":
    "A card payment result from before the app restarted could not be processed. Check the transaction in SwitchioPay.",
  "paymentWait.cardPaid.retryUnresolved.cancel": "Back",
  "paymentWait.cardPaid.retryUnresolved.confirm": "Charge again",
  "paymentWait.cardPaid.retryUnresolved.description":
    "The result of the last attempt ({transactionId}) is unknown and the card may already have been charged. Charge again only after checking in SwitchioPay that it did not go through.",
  "paymentWait.cardPaid.retryUnresolved.title": "Charge the card again?",
  "paymentWait.cardPaid.unresolved":
    "The result of the last attempt ({transactionId}) is unknown. Check the transaction in SwitchioPay before trying again.",
  "paymentWait.cashPaid.action": "Mark as paid",
  "paymentWait.cashPaid.difference": "Difference from the charge: {amount}",
  "paymentWait.cashPaid.error": "Could not mark the payment as paid.",
  "paymentWait.cashPaid.pending": "Marking paid...",
  "paymentWait.cashPaid.prompt": "Accept cash payment",
  "paymentWait.cashPaid.received": "Cash received",
  "paymentWait.cashPaid.receivedTooLow": "Enter at least {amount}.",
  "paymentWait.cashPaid.unavailable":
    "Cash register is not attached to this payment.",
  "paymentWait.copyQr": "Copy QR code content",
  "paymentWait.detail": "Payment detail",
  "paymentWait.eetSandbox": "Sent to the EET test environment only.",
  "paymentWait.ibanDetails.more": "More information",
  "paymentWait.ibanDetails.title": "Payment details",
  "paymentWait.bankWatch.waiting": "Waiting for payment…",
  "paymentWait.ibanDetails.account.label": "Account",
  "paymentWait.ibanDetails.recipient.label": "Recipient",
  "paymentWait.ibanDetails.hide": "Hide bank details",
  "paymentWait.ibanDetails.iban.copied": "IBAN copied.",
  "paymentWait.ibanDetails.iban.copy": "Copy IBAN",
  "paymentWait.ibanDetails.iban.copyError": "Could not copy the IBAN.",
  "paymentWait.ibanDetails.iban.label": "IBAN",
  "paymentWait.ibanDetails.show": "Show bank details",
  "paymentWait.ibanDetails.variableSymbol.copied": "Variable symbol copied.",
  "paymentWait.ibanDetails.variableSymbol.copy": "Copy variable symbol",
  "paymentWait.ibanDetails.variableSymbol.copyError":
    "Could not copy the variable symbol.",
  "paymentWait.ibanDetails.variableSymbol.label": "Variable symbol",
  "paymentWait.ibanPaid.action": "I received the transfer",
  "paymentWait.ibanPaid.error": "Could not confirm the transfer.",
  "paymentWait.ibanPaid.pending": "Confirming...",
  "paymentWait.invalidId": "Invalid payment id.",
  "paymentWait.method.cashu": "Cashu",
  "paymentWait.method.qerkoPayment": "Qerko",
  "paymentWait.preparing.qerkoPayment": "Preparing the Qerko payment…",
  "paymentWait.qerkoPayment.scan":
    "The customer scans the code in the Qerko app.",
  "paymentWait.qerkoPayment.started": "The customer is paying in Qerko…",
  "paymentWait.qerkoPayment.processing": "Qerko is confirming the payment…",
  "paymentWait.qerkoPayment.failed":
    "The payment in Qerko did not go through. The customer can try again.",
  "paymentWait.qerkoPayment.noDevice":
    "No device accepts Qerko payments. Choose one in the settings.",
  "paymentWait.qerkoPayment.disconnected":
    "This device is not connected to Qerko, so customers cannot pay yet.",
  "paymentWait.method.qerko": "Terminal",
  "paymentWait.preparing.cashu": "Preparing Cashu request...",
  "paymentWait.cashu.quoteExpired":
    "The mint's invoice expired before it was paid.",
  "paymentWait.cashu.arrival.receiving":
    "A token for {amount} sat arrived from {mint}. Receiving it...",
  "paymentWait.cashu.arrival.withFee":
    "A token for {amount} sat arrived from {mint}. The mint keeps {fee} sat as its fee.",
  "paymentWait.cashu.arrival.waitingForMint":
    "A token for {amount} sat arrived. Waiting for the mint {mint} to answer...",
  "paymentWait.cashu.arrival.untrustedMint":
    "A token for {amount} sat came from {mint}, which is not the default mint. It was not accepted and does not pay this payment.",
  "paymentWait.cashu.failure.mintUnreachable":
    "The mint did not answer. The token will be tried again.",
  "paymentWait.cashu.failure.mintRejected":
    "The mint refused the token. The payment stays unpaid.",
  "paymentWait.cashu.failure.locked":
    "The token is locked to someone else. The payment stays unpaid.",
  "paymentWait.cashu.failure.undecodable":
    "The token could not be read. The payment stays unpaid.",
  "paymentWait.cashu.failure.alreadyKnown":
    "The wallet already holds this token. The payment stays unpaid.",
  "paymentWait.cashu.failure.fee":
    "The mint's fee would take the whole token. The payment stays unpaid.",
  "paymentWait.cashu.failure.spent":
    "The token was already spent. The payment stays unpaid.",
  "paymentWait.cashu.newQuote": "New invoice",
  "paymentWait.method.card": "Payment card",
  "paymentWait.method.cash": "Cash",
  "paymentWait.method.iban": "Transfer",
  "paymentWait.method.lightning": "Bitcoin",
  "paymentWait.missingRequest":
    "This payment does not have a scannable request.",
  "paymentWait.notFound": "Payment was not found.",
  "paymentWait.paid": "Payment received",
  "paymentWait.pay": "Pay",
  "paymentWait.prepareError": "Could not prepare this payment method.",
  "paymentWait.prepareRetry": "Retry payment method",
  "paymentWait.preparing.card": "Preparing payment by payment card...",
  "paymentWait.preparing.cash": "Preparing cash payment...",
  "paymentWait.preparing.iban": "Preparing bank QR payment...",
  "paymentWait.preparing.qerko": "Preparing the terminal…",
  "paymentWait.preparing.spark": "Preparing Lightning request...",
  "paymentWait.qerko.action": "Pay on the terminal",
  "paymentWait.qerko.cancel": "Cancel on the terminal",
  "paymentWait.qerko.cancel.notCancellable":
    "The payment can no longer be cancelled.",
  "paymentWait.qerko.error.attemptRunning":
    "A payment is already running on the terminal.",
  "paymentWait.qerko.error.generic":
    "The payment could not be taken. Try again.",
  "paymentWait.qerko.error.keyRejected":
    "Qerko no longer accepts the pairing. Pair the terminal again in settings.",
  "paymentWait.qerko.error.keyRejected.link": "Open Qerko settings",
  "paymentWait.qerko.error.notPaired": "The Qerko terminal is not paired.",
  "paymentWait.qerko.error.notPayable": "This payment can no longer be paid.",
  "paymentWait.qerko.error.unreachable":
    "Qerko could not be reached. Check the connection.",
  "paymentWait.qerko.failed.cancelled":
    "The payment was cancelled on the terminal.",
  "paymentWait.qerko.failed.declined": "The card was declined.",
  "paymentWait.qerko.failed.reversed": "The payment was reversed.",
  "paymentWait.qerko.noTerminal": "This device has no terminal chosen.",
  "paymentWait.qerko.noTerminal.link": "Choose a terminal",
  "paymentWait.qerko.notStarted.busy":
    "The terminal is busy. Try again in a moment.",
  "paymentWait.qerko.notStarted.notActivated":
    "The terminal is not activated in Qerko.",
  "paymentWait.qerko.notStarted.notConnected": "The terminal is not connected.",
  "paymentWait.qerko.notStarted.timeout":
    "The terminal did not answer in time. Check it before trying again.",
  "paymentWait.qerko.notStarted.unknownTerminal":
    "Qerko does not know this terminal. Choose it again in the settings.",
  "paymentWait.qerko.retry": "Pay on the terminal again",
  "paymentWait.qerko.retryUnresolved.cancel": "Cancel",
  "paymentWait.qerko.retryUnresolved.confirm": "I have checked, pay again",
  "paymentWait.qerko.retryUnresolved.description":
    "The last attempt ended with an unknown result and the card may have been charged. Have you checked the terminal and Qerko?",
  "paymentWait.qerko.retryUnresolved.title": "Pay again?",
  "paymentWait.qerko.step.authorizing": "Authorizing the payment…",
  "paymentWait.qerko.step.connecting": "Connecting to the terminal…",
  "paymentWait.qerko.step.finishing": "Finishing the payment…",
  "paymentWait.qerko.step.waitingForCard": "Waiting for the card…",
  "paymentWait.qerko.step.waitingForCustomer": "Waiting for the customer…",
  "paymentWait.qerko.step.waitingForPin": "The customer is entering the PIN…",
  "paymentWait.qerko.unresolved":
    "The result of the last attempt is unknown, so the card may have been charged. Check the terminal and the payment history in Qerko before trying again.",
  "paymentWait.qrCopied": "QR code content copied.",
  "paymentWait.qrCopyFailed": "Could not copy QR code content.",
  "paymentWait.qrFormat.payBySquare1_0_0": "Pay by square 1.0 (Slovakia)",
  "paymentWait.qrFormat.payBySquare1_2_0": "Pay by square 1.2 (Slovakia)",
  "paymentWait.qrFormat.spayd": "SPAYD (Czechia)",
  "paymentWait.qrFormatShort.payBySquare1_0_0": "SK 1.0",
  "paymentWait.qrFormatShort.payBySquare1_2_0": "SK 1.2",
  "paymentWait.qrFormatShort.spayd": "CZ",
  "paymentWait.scanOrTap": "Scan and pay",
  "paymentWait.wakeLockUnsupported":
    "This browser cannot keep the screen awake automatically.",
  "refund.created": "Refund recorded.",
  "refund.dialog.method.qerkoTerminal": "Back to the card on the terminal",
  "refund.dialog.method.qerkoTerminalTid": "Back to the card on terminal {tid}",
  "refund.dialog.method.cardSwitchio": "Back to the card in SwitchioPay",
  "refund.switchio.hint":
    "The customer holds the card that paid to this phone.",
  "refund.switchio.done": "The money went back to the card.",
  "refund.switchio.pending": "Refunding to the card in SwitchioPay",
  "refund.switchio.pendingElsewhere":
    "Waiting for SwitchioPay on another phone. If that phone is gone, check SwitchioPay and dismiss the refund.",
  "refund.switchio.unresolved":
    "The refund's result is not known, so the card may have been refunded. Check SwitchioPay before refunding again.",
  "refund.switchio.failed": "The terminal declined the refund to the card.",
  "refund.switchio.check": "Ask SwitchioPay",
  "refund.switchio.dismissPending.title": "Dismiss the refund?",
  "refund.switchio.dismissPending.description":
    "The other phone may still report it. If the money went back, the refund is recorded then anyway.",
  "refund.switchio.dismissPending.confirm": "Dismiss",
  "refund.switchio.dismissPending.cancel": "Back",
  "refund.switchio.error.notAvailable":
    "This payment cannot be refunded to the card: the terminal did not give it the id a refund needs.",
  "refund.switchio.error.running":
    "Another refund of this payment to the card is not settled yet.",
  "refund.switchio.error.notStarted":
    "SwitchioPay is busy or not ready. Nothing was refunded; try again.",
  "refund.switchio.error.otherDevice":
    "Only the phone that started this refund can ask its SwitchioPay.",
  "refund.switchio.restored.unusable":
    "A refund result from before the app restarted could not be processed. Check the refund in SwitchioPay.",
  "paymentDetail.refunds.wholeAction": "Refund the whole payment ({amount})",
  "refund.switchio.whole.title": "Refund the whole payment?",
  "refund.switchio.whole.description":
    "{amount}, the tip included, goes back to the card that paid. The terminal first tries to take the payment back whole; if it no longer can, a refund to the card is offered, for which the customer holds the card to the phone.",
  "refund.switchio.whole.confirm": "Refund",
  "refund.switchio.whole.cancel": "Back",
  "refund.switchio.reversalDeclined.title":
    "The terminal can no longer take the payment back",
  "refund.switchio.reversalDeclined.description":
    "Its batch was most likely closed. Refund the money to the card instead? The customer holds the card that paid to this phone.",
  "refund.switchio.reversalDeclined.confirm": "Refund to the card",
  "refund.switchio.reversalDeclined.cancel": "Back",
  "refund.qerko.dismiss": "Dismiss",
  "refund.qerko.dismissUnresolved": "I have checked, dismiss",
  "refund.qerko.error.notAvailable":
    "This payment was not taken on the Qerko terminal, so it cannot be refunded to the card.",
  "refund.qerko.error.running":
    "Another refund of this payment to the card is still waiting for the terminal.",
  "refund.qerko.error.terminalNotActivated":
    "The terminal that took this payment is not activated in Qerko. A card refund can only go to that terminal, so ask Qerko support to activate it again.",
  "refund.qerko.error.terminalNotConnected":
    "The terminal that took this payment is not connected. A card refund can only go to that terminal, so connect it and try again.",
  "refund.qerko.error.unknownTerminal":
    "Qerko does not know the terminal that took this payment. A card refund can only go to that terminal, so contact Qerko support.",
  "refund.qerko.failed.cancelled":
    "The refund to the card was cancelled on the terminal.",
  "refund.qerko.failed.declined":
    "The terminal declined the refund to the card.",
  "refund.qerko.pending": "Refunding to the card",
  "refund.qerko.started": "The refund was sent to the terminal.",
  "refund.qerko.unresolved":
    "The result of the refund to the card is unknown, so the card may have been refunded. Check the terminal and Qerko before refunding again.",
  "refund.tipDialog.title": "Refund the tip",
  "refund.tipDialog.description":
    "Returns the whole tip of {amount}. A refund of goods never includes it.",
  "refund.tipCreated": "Tip refunded.",
  "refund.error.tip": "The tip of this payment is already refunded.",
  "refund.dialog.tipHint":
    "Leaves out the {amount} tip, which has its own refund.",
  "refund.dialog.amount.invalid": "Enter an amount up to {amount}.",
  "refund.dialog.amount.label": "Amount to refund",
  "refund.dialog.cancel": "Cancel",
  "refund.dialog.confirm": "Refund {amount}",
  "refund.dialog.confirmEmpty": "Refund",
  "refund.dialog.description":
    "A refund cannot be undone. The payment stays paid and its bill stays closed.",
  "refund.dialog.items.available": "Up to {quantity}",
  "refund.dialog.items.decrease": "Fewer {name}",
  "refund.dialog.items.increase": "More {name}",
  "refund.dialog.items.label": "Items to refund",
  "refund.dialog.method.cashRegister": "Cash from the register",
  "refund.dialog.method.label": "How the money goes back",
  "refund.dialog.method.outside":
    "Outside {appName}, for example on the card terminal",
  "refund.dialog.mode.amount": "Amount",
  "refund.dialog.mode.items": "Items",
  "refund.dialog.mode.label": "What to refund",
  "refund.dialog.title": "Refund money",
  "refund.error.amount": "The amount is more than what is left to refund.",
  "refund.error.cashRegister": "There is no cash register for this currency.",
  "refund.error.items": "These items can no longer be refunded.",
  "refund.error.notPaid": "Only a paid payment can be refunded.",
  "refund.state.full": "Refunded {amount}",
  "refund.state.partial": "Partly refunded {amount}",
  "paymentDetail.paymentMethod.lightningAddress": "Lightning address",
  "paymentWait.method.lightningAddress": "Lightning",
  "paymentWait.preparing.lightningAddress":
    "Asking your wallet for an invoice...",
  "paymentWait.lightningAddress.unverified":
    "Your wallet reports the invoice paid but sent no proof of payment. Check the wallet before you hand over the goods.",
  "paymentWait.monetaWatch.watching": "Checking the bank for the transfer…",
  "paymentWait.monetaWatch.unreachable":
    "The bank is not answering. {appName} keeps checking.",
  "paymentWait.monetaWatch.unauthorized":
    "The bank refused the MONETA token, so the transfer is not checked automatically.",
  "paymentWait.monetaWatch.openSettings": "MONETA settings",
  "paymentWait.monetaWatch.rateLimited":
    "Today's requests to the bank are used up. Confirm the transfer by hand.",
  "paymentDetail.transaction.preimage": "Proof of payment (preimage)",
  "paymentWait.method.bitcoin": "Bitcoin",
} as const
