export const enWithdraw = {
  "withdraw.all.description": "Send the entire available balance.",
  "withdraw.all.label": "Withdraw all",
  "withdraw.all.unavailableInvoice": "The invoice sets the amount.",
  "withdraw.amount.available": "Available: {amount} sats",
  "withdraw.amount.fromInvoice": "The invoice sets the amount.",
  "withdraw.amount.invalid": "Enter an amount greater than 0.",
  "withdraw.amount.label": "Amount",
  "withdraw.amount.onchainMinimum":
    "On-chain withdrawals start at {amount} sats.",
  "withdraw.amount.placeholder": "Amount in sats",
  "withdraw.amount.placeholderFiat": "Amount in {currency}",
  "withdraw.amount.range": "From {min} to {max} sats.",
  "withdraw.amount.unit": "Amount unit",
  "withdraw.amount.unitSats": "sats",
  "withdraw.cashu.destinationPlaceholder":
    "Linky name, npub, Lightning address or invoice",
  "withdraw.cashu.error.address":
    "The Lightning address did not answer as expected.",
  "withdraw.cashu.error.amountlessInvoice":
    "The invoice has no amount. Ask for one with an amount, or use a Lightning address.",
  "withdraw.cashu.error.destination":
    "Enter a Lightning invoice or a Lightning address.",
  "withdraw.cashu.error.expired": "The invoice has expired.",
  "withdraw.cashu.error.insufficient":
    "The mint's balance does not cover the amount and the fees.",
  "withdraw.cashu.error.onchain":
    "This wallet can only withdraw over Lightning: enter a Lightning invoice or address.",
  "withdraw.cashu.error.rejected":
    "The mint refused the payment. Nothing left the wallet.",
  "withdraw.cashu.error.toSelf": "This is one of your own payment invoices.",
  "withdraw.cashu.error.unreachable":
    "The mint did not answer. Nothing was sent.",
  "withdraw.cashu.form.description":
    "Enter a Lightning address, invoice, or Linky name/profile.",
  "withdraw.cashu.mint": "From which mint",
  "withdraw.cashu.noAccount.description":
    "Turn on Bitcoin in Payment accounts before withdrawing.",
  "withdraw.cashu.noAccount.title": "Bitcoin is off",
  "withdraw.cashu.noFunds": "The wallet has no available funds.",
  "withdraw.cashu.review.feeReserve": "Mint's fee reserve",
  "withdraw.cashu.review.inputFee": "Mint's input fee",
  "withdraw.cashu.review.remainder":
    "Whatever the reserve doesn't use comes back to the mint's balance.",
  "withdraw.cashu.title": "Withdraw funds",
  "withdraw.clipboard.use": "Use from clipboard: {value}",
  "withdraw.comment.hint": "Only you see it, in the withdrawal history.",
  "withdraw.comment.label": "Note for you",
  "withdraw.continue": "Continue",
  "withdraw.destination.checkingAddress": "Checking the Lightning address…",
  "withdraw.destination.invalid":
    "Enter a Bitcoin address, a Lightning invoice or a Lightning address.",
  "withdraw.destination.kind.lightningAddress": "Lightning address",
  "withdraw.destination.kind.lightningInvoice": "Lightning invoice",
  "withdraw.destination.kind.onchain": "Bitcoin address (on-chain)",
  "withdraw.destination.label": "Send to",
  "withdraw.destination.paste": "Paste",
  "withdraw.destination.pasteError": "Couldn't read the clipboard.",
  "withdraw.destination.placeholder":
    "Address, Lightning invoice or name@domain",
  "withdraw.destination.scan": "Scan",
  "withdraw.detail.amount": "Amount",
  "withdraw.detail.balanceNow":
    "The wallet holds {balance} sats now; this withdrawal would deduct {amount} sats.",
  "withdraw.detail.cancel": "Cancel",
  "withdraw.detail.cashuQuoteId": "Melt quote ID",
  "withdraw.detail.comment": "Note",
  "withdraw.detail.copied": "Copied",
  "withdraw.detail.copy": "Copy",
  "withdraw.detail.copyError": "Couldn't copy.",
  "withdraw.detail.date": "Date",
  "withdraw.detail.destination": "Destination",
  "withdraw.detail.device": "Device",
  "withdraw.detail.failed.manual": "The money did not leave.",
  "withdraw.detail.failed.notCreated": "The payment did not leave.",
  "withdraw.detail.failed.notCreatedHint":
    "Check your balance. If the money is still in the wallet, start a new withdrawal from the withdrawal history.",
  "withdraw.detail.failed.rejected": "The money did not leave.",
  "withdraw.detail.failed.returned": "The money returned to the wallet.",
  "withdraw.detail.fee": "Fee",
  "withdraw.detail.invoice": "Invoice",
  "withdraw.detail.invoiceRenewHint":
    "A Lightning invoice can be paid only once. Ask the recipient for a new one.",
  "withdraw.detail.manualConfirmed":
    "Confirmed by hand; the transaction was not traced.",
  "withdraw.detail.markNotSent": "The money did not leave",
  "withdraw.detail.markNotSent.description":
    "Do this only if the wallet balance still includes {amount} sats.",
  "withdraw.detail.markNotSent.title": "Mark the withdrawal as not sent?",
  "withdraw.detail.markSent": "The money left",
  "withdraw.detail.markSent.description":
    "This records {amount} sats leaving the wallet.",
  "withdraw.detail.markSent.title": "Mark the withdrawal as sent?",
  "withdraw.detail.maxFee": "Maximum fee",
  "withdraw.detail.mint": "Mint",
  "withdraw.detail.movementDeleted": "The account transaction was deleted.",
  "withdraw.detail.newWithdrawal": "New withdrawal",
  "withdraw.detail.notFound": "This withdrawal could not be found.",
  "withdraw.detail.onchainUncertain":
    "The result is not certain. Check your balance.",
  "withdraw.detail.pending.cashu":
    "The withdrawal was sent; the mint has not confirmed it yet. It settles on its own.",
  "withdraw.detail.pending.otherDevice":
    "Waiting for the result. Device {device} started this withdrawal; if the payment doesn't leave, it is marked as not sent within 24 hours.",
  "withdraw.detail.pending.ownDevice":
    "Waiting for the result. If the payment doesn't leave within 10 minutes, the withdrawal marks itself as not sent.",
  "withdraw.detail.pending.processing":
    "The payment is still being processed. It is waiting to complete, or for the recipient to claim it.",
  "withdraw.detail.pending.unknown":
    "The result could not be determined. Check your balance and the account transactions.",
  "withdraw.detail.pending.unknownDevice":
    "Waiting for the result. Another device started this withdrawal; if the payment doesn't leave, it is marked as not sent within 24 hours.",
  "withdraw.detail.preimage": "Preimage",
  "withdraw.detail.sparkTransferId": "Spark transfer ID",
  "withdraw.detail.technical": "Technical details",
  "withdraw.detail.title": "Withdrawal",
  "withdraw.detail.total": "Total deducted",
  "withdraw.detail.txid": "Transaction ID",
  "withdraw.detail.txidError": "The transaction could not be loaded.",
  "withdraw.detail.txidPending": "The transaction is not on the network yet.",
  "withdraw.detail.type": "Type",
  "withdraw.detail.viewOnExplorer": "View on mempool.space",
  "withdraw.error.accountNotFound": "The Spark account could not be found.",
  "withdraw.error.amountOutOfRange":
    "This Lightning address accepts {min} to {max} sats.",
  "withdraw.error.belowMinimum":
    "An on-chain withdrawal must be at least {amount} sats.",
  "withdraw.error.insufficientBalance":
    "This amount exceeds your available balance.",
  "withdraw.error.insufficientBalanceMax":
    "This amount and the fee exceed your balance. You can send at most {amount} sats.",
  "withdraw.error.lightningAddressMismatch":
    "The Lightning address returned an invoice that doesn't match. Nothing was paid.",
  "withdraw.error.lightningAddressUnavailable":
    "Couldn't reach the Lightning address. Check it and try again.",
  "withdraw.error.lightningInvoiceExpired":
    "The invoice has expired. Get a new estimate, or ask the recipient for a new invoice.",
  "withdraw.error.lightningInvoiceWrongNetwork":
    "This invoice is not for the Bitcoin mainnet.",
  "withdraw.error.lnurlNotSupported":
    "Use a Lightning address (name@domain) or an invoice.",
  "withdraw.error.quoteExpired":
    "The fee estimate has expired. Get a new estimate.",
  "withdraw.error.selfWithdrawal":
    "This would send the money back to this wallet.",
  "withdraw.error.sparkDestinationNotSupported":
    "Ask the recipient for a Lightning invoice or a Lightning address.",
  "withdraw.form.description":
    "Send bitcoin from your Spark wallet to an on-chain address, a Lightning invoice or a Lightning address.",
  "withdraw.form.title": "New withdrawal",
  "withdraw.history.balance": "Balance: {amount} sats",
  "withdraw.history.empty": "No withdrawals yet.",
  "withdraw.history.new": "New withdrawal",
  "withdraw.history.olderNote":
    "Older withdrawals are in the Spark account's transactions.",
  "withdraw.history.title": "Withdrawals",
  "withdraw.history.transactionsLink": "Account transactions",
  "withdraw.kind.cashu": "Lightning (Cashu)",
  "withdraw.kind.lightning": "Lightning",
  "withdraw.kind.onchain": "On-chain",
  "withdraw.noAccount.action": "Go to payment accounts",
  "withdraw.noAccount.description":
    "Set up a Spark wallet in Payment accounts before withdrawing.",
  "withdraw.noAccount.title": "No Spark account configured",
  "withdraw.options.label": "More options",
  "withdraw.quoteError.generic": "Couldn't fetch a fee estimate. Try again.",
  "withdraw.quotePending": "Fetching fee estimate...",
  "withdraw.recipientComment.hint":
    "The recipient will see it. At most {max} characters.",
  "withdraw.recipientComment.label": "Message for the recipient",
  "withdraw.review.amount": "Withdrawal amount",
  "withdraw.review.back": "Back",
  "withdraw.review.comment": "Note",
  "withdraw.review.confirm": "Confirm withdrawal",
  "withdraw.review.confirming": "Sending...",
  "withdraw.review.destination": "Destination",
  "withdraw.review.error.generic":
    "The withdrawal could not be started. Try again.",
  "withdraw.review.error.interrupted":
    "The withdrawal was interrupted before it completed. Try again.",
  "withdraw.review.error.uncertain":
    "The withdrawal may or may not have been sent. Check the withdrawals list before trying again; do not send it again until you know.",
  "withdraw.review.expiresIn": "Invoice valid for",
  "withdraw.review.fee": "Estimated network fee",
  "withdraw.review.feeEstimate": "~{estimate} sats (at most {max} sats)",
  "withdraw.review.invoiceDescription": "Invoice description",
  "withdraw.review.lightningFee": "Fee",
  "withdraw.review.maxFeeSpark":
    "Usually free (over Spark), at most {amount} sats",
  "withdraw.review.maxTotal": "At most deducted",
  "withdraw.review.newQuote": "New estimate",
  "withdraw.review.pinDetail": "{amount} sats → {destination}",
  "withdraw.review.recipientComment": "Message for the recipient",
  "withdraw.review.recipientText": "Text from the recipient",
  "withdraw.review.remainder":
    "Whatever the fee doesn't use stays in your wallet.",
  "withdraw.review.showInvoice": "Show invoice",
  "withdraw.review.speed.fast": "Fast",
  "withdraw.review.speed.fast.hint": "Highest priority",
  "withdraw.review.speed.medium": "Medium",
  "withdraw.review.speed.medium.hint": "Balanced",
  "withdraw.review.speed.slow": "Slow",
  "withdraw.review.speed.slow.hint": "Lowest fee",
  "withdraw.review.title": "Review withdrawal",
  "withdraw.review.total": "Total amount deducted",
  "withdraw.review.warning":
    "Bitcoin transactions cannot be reversed. Double-check the destination before confirming.",
  "withdraw.sats": "{amount} sats",
  "withdraw.scan.title": "Scan destination",
  "withdraw.status.done": "Completed",
  "withdraw.status.failed": "Failed",
  "withdraw.status.pending": "In progress",
  "withdraw.status.sent": "Sent",
  "withdraw.transactions.empty": "No transactions yet.",
  "withdraw.transactions.kind.spark": "Spark",
  "withdraw.transactions.title": "Account transactions",
  "withdraw.destination.kind.linkyContact": "Linky contact",
  "withdraw.contact.checking": "Looking up the Linky contact…",
  "withdraw.contact.notFound": "Nobody in Linky is named {address}.",
  "withdraw.contact.unreachable":
    "Linky could not be reached. Check your connection.",
  "withdraw.kind.cashuSend": "Payment to a Linky contact",
  "withdraw.cashu.send.error.notDelivered":
    "The token could not be handed over. Nothing left the wallet.",
  "withdraw.cashu.send.error.consumedByFee":
    "The amount would not cover the mint's fee.",
  "withdraw.cashu.send.review.fee": "Mint's fee, at most",
  "withdraw.cashu.send.review.note":
    "The payment appears in the recipient's Linky automatically.",
  "withdraw.detail.pending.cashuSend":
    "The token is on its way to the recipient.",
  "withdraw.detail.cashuOperationId": "Wallet operation",
} as const
