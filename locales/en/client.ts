const locale = {
  "bill": {
    "itemsTitle": "Bill items",
    "tipForStaff": "Tip for the staff",
    "empty": {
      "emptyBill": "There is currently an empty bill here.",
      "noBill": "There is currently no bill here."
    },
    "warning": {
      "pcsLeft": "{{count}} pcs left!"
    }
  },
  "home": {
    "scanHint": "Point your camera at the QR code to pay",
    "title": "Home",
    "actions": {
      "receive": "Receive",
      "send": "Send"
    }
  },
  "page": {
    "contacts": "Contacts",
    "scanQrCode": "Scan QR Code",
    "paymentDetail": "Payment detail",
    "paymentHistory": "Payment history",
    "sendPayment": "Send payment",
    "receivePayment": "Receive payment",
    "useExample": "Use example"
  },
  "contactsPage": {
    "empty": {
      "title": "You do not have any contacts yet",
      "description": "As soon as you add a contact to the system, it will appear here."
    },
    "filteredEmpty": {
      "title": "No matching contacts",
      "description": "Try a different name or label."
    }
  },
  "receiveAmountForm": {
    "title": "Enter amount to receive",
    "description": "Choose whether you enter a fiat amount or sats. The other field is recalculated automatically using the current rate.",
    "amountLabel": "Amount",
    "account": {
      "sparkWalletAccount": "Spark wallet account",
      "placeholder": "Select account",
      "empty": "No account available"
    },
    "source": {
      "label": "Source input",
      "fiat": "Entering fiat",
      "sats": "Entering sats",
      "description": "Focusing an input switches the active source automatically as well."
    },
    "fields": {
      "fiat": "Fiat amount",
      "sats": "Amount in sats",
      "noteForRecipientOptional": "Note for recipient (optional)"
    },
    "status": {
      "ready": "The converted value updates continuously as you type.",
      "loading": "Updating the conversion using the current rate.",
      "unavailable": "The exchange rate is unavailable right now."
    }
  },
  "transactionHistory": {
    "title": "Transaction history",
    "unknownCounterparty": "Unknown counterparty",
    "empty": {
      "title": "Your transaction history is empty",
      "description": "Your payment transactions will appear here once you make your first purchase or sale."
    }
  },
  "historyDetail": {
    "status": {
      "loading": "loading",
      "paid": "Paid",
      "unpaid": "Unpaid",
      "underpaid": "Underpaid",
      "overpaid": "Overpaid",
      "failed": "Failed",
      "inProgressOrExpired": "Still in progress or expired"
    },
    "fields": {
      "name": "Name",
      "phone": "Phone",
      "counterparty": "Counterparty",
      "status": "Status",
      "spending": "Spending",
      "date": "Date"
    },
    "metadata": {
      "title": "Payment metadata",
      "fields": {
        "lnZapInvoice": "LN Zap invoice",
        "lnZapWalletPubkey": "LN Zap wallet pubkey",
        "lnZapExpiration": "LN Zap expiration",
        "lnSparkInvoice": "LN Spark invoice",
        "lnSparkExpiration": "LN Spark expiration",
        "lnNwcInvoice": "LN NWC invoice",
        "lnNwcExpiration": "LN NWC expiration",
        "bankTransferIban": "Bank transfer IBAN",
        "bankTransferVariableSymbol": "Bank transfer variable symbol"
      }
    },
    "actions": {
      "downloadReceipt": "Download receipt"
    }
  },
  "paymentPage": {
    "methods": {
      "btcLightning": "BTC lightning",
      "bankTransfer": "Bank transfer"
    },
    "wallets": {
      "external": "External Wallet",
      "primal": "Primal Wallet",
      "bitlifi": "Bitlifi"
    },
    "actions": {
      "pay": "Pay",
      "refund": "Refund",
      "copyShowQrInvoice": "Copy & display QR invoice"
    },
    "loading": {
      "preparingPayment": "The payment is preparing",
      "loadingData": "Loading the data..."
    },
    "status": {
      "paymentSuccessful": "The payment is successfully paid",
      "waitingForPayment": "We are waiting for your payment",
      "waitingForRefund": "We are waiting for your refund"
    },
    "labels": {
      "rate": "rate"
    },
    "alerts": {
      "billClosed": "The bill is closed",
      "unknownQrCode": "Unknown QR code"
    },
    "menu": {
      "generatedAt": "Menu generated",
      "validity": {
        "sameDay": "Valid {{date}}, {{from}}–{{to}}",
        "fromTo": "Valid from {{from}} to {{to}}",
        "from": "Valid from {{from}}",
        "to": "Valid to {{to}}"
      }
    },
    "reservation": {
      "title": "Reservation form",
      "fields": {
        "date": "Date",
        "numberOfPeople": "Number of people",
        "slot": "Time",
        "email": "Email",
        "phone": "Phone",
        "note": "Note"
      },
      "placeholders": {
        "email": "you@example.com",
        "phone": "+420...",
        "note": "Optional reservation note"
      },
      "actions": {
        "submit": "Submit reservation"
      },
      "messages": {
        "peopleRange": "Allowed {{min}}-{{max}} people",
        "noSlotForSelection": "No available slot for the selected day/party size"
      },
      "labels": {
        "closed": "closed",
        "slotCount": "{{count}} slots",
        "slotPeopleRange": "{{min}}-{{max}} ppl",
        "required": "required",
        "optional": "optional"
      },
      "summary": {
        "generatedAt": "Data generated",
        "contactRequirements": "Contact: email {{emailRequirement}}, phone {{phoneRequirement}}",
        "noteEnabled": "Note is enabled.",
        "noteEnabledWithMax": "Note is enabled (max {{max}} characters)."
      }
    }
  }
} as const;

export default locale;
