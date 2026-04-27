const locale = {
  "page": {
    "payment": "Payment",
    "settings": "Payment settings",
    "settings-description": "Configure which payment variants are generated automatically for each new payment."
  },
  "detail": {
    "actions": {
      "pay-in-cash": "Pay in cash",
      "cancel": "Cancel",
      "show-fullscreen-qr-payment": "Show fullscreen QR payment",
      "stop-watching": "Stop watching",
      "resume-watching": "Resume watching",
      "delete": "Delete",
      "open": "Open",
      "open-in-btc-wallet": "Open in BTC wallet",
      "share-qr-code": "Share QR code",
      "download-qr-code": "Download QR code",
      "issue-receipt": "Issue receipt",
      "download-receipt": "Download receipt",
      "preparing-receipt": "Preparing receipt"
    },
    "confirm": {
      "pay-in-cash": {
        "title": "Pay in cash?",
        "description": "This creates a cash transaction and links it to this payment."
      },
      "delete-payment": {
        "title": "Delete payment?",
        "description": "This action cannot be undone."
      }
    },
    "messages": {
      "payment-successfully-paid": "The payment is successfully paid",
      "share-qr-description": "Share this QR code in your banking app",
      "no-cash-register-account-configured": "No cash register account is configured for this payment.",
      "cash-payment-enabled-no-cash-register-account": "Cash payment is enabled, but no cash register account is configured.",
      "ln-invoice-copied-to-clipboard": "LN invoice successfully copied to clipboard",
      "receipt-can-be-issued-after-settlement": "A receipt can be issued after the payment has been settled.",
      "receipt-issued": "Receipt {{receiptNumber}} was issued on {{issuedAt}}.",
      "receipt-errors": {
        "payment-not-found": "The payment could not be found.",
        "unsupported-direction": "A receipt can only be issued for incoming payments.",
        "payment-not-settled": "A receipt can only be issued for a settled payment.",
        "supplier-not-configured": "Billing information for your business is not configured.",
        "supplier-billing-info-missing": "Your business billing information is incomplete."
      }
    },
    "tabs": {
      "web-payment": "Web payment",
      "btc-ln-payment": "BTC LN payment",
      "cz-qr-payment": "CZ QR Payment",
      "cash": "Cash"
    },
    "sections": {
      "sections": "Detail sections",
      "overview": "Overview",
      "items": "Items",
      "messages": "Messages",
      "timeline": "Timeline",
      "reconciliation": "Reconciliation"
    },
    "empty": {
      "items": "No items found for this payment."
    },
    "items": {
      "columns": {
        "item": "Item",
        "quantity": "Quantity",
        "total": "Total"
      }
    },
    "reconciliation": {
      "title": "Reconciliation claims",
      "description": "Claims from reconciliationClaim table for this payment.",
      "empty": "No claims found for this payment.",
      "columns": {
        "created-at": "Created at",
        "id": "Claim ID",
        "device-id": "Device ID",
        "source-type": "Source type",
        "source-id": "Source ID",
        "rule": "Rule",
        "confidence": "Confidence",
        "created-by": "Created by"
      }
    },
    "labels": {
      "price": "Price",
      "created-at": "Created at",
      "expire-at": "Expire at",
      "status": "Status",
      "merchant-name": "Merchant name",
      "redirect": "Redirect",
      "tip": "Tip"
    },
    "status": {
      "paid": "Paid",
      "unpaid": "Unpaid",
      "underpaid": "Underpaid",
      "overpaid": "Overpaid",
      "waiting": "Waiting",
      "unknown": "Unknown"
    },
    "values": {
      "yes": "yes",
      "no": "no"
    },
    "help": {
      "redirect": "The customer will be redirected to this address after successful payment if they use payment via the web application.",
      "tip": "Static payments do not support tips"
    }
  },
  "receipt": {
    "line": {
      "tip": "Tip",
      "payment": "Payment",
      "settlement-adjustment": "Settlement adjustment"
    },
    "pdf": {
      "title": "Receipt",
      "receiptNumber": "Receipt no.",
      "issuedAt": "Issued at:",
      "paymentDate": "Payment date:",
      "supplier": "Supplier",
      "identificationNumber": "ID:",
      "vatNumber": "VAT ID:",
      "amountReceived": "Amount received",
      "itemCount": "Line count",
      "total": "Total",
      "columns": {
        "label": "Item",
        "quantity": "Qty",
        "unit": "Unit",
        "unitPrice": "Unit price",
        "total": "Total"
      },
      "country": {
        "cz": "Czech Republic"
      }
    }
  },
  "table": {
    "paymentMessages": "Payment Messages",
    "description": {
      "decrypted-payment-data": "Decrypted payment data from Nostr NIP-04 direct messages"
    },
    "actions": {
      "new-payment": "New payment"
    },
    "columns": {
      "created-at": "Created at",
      "amount": "Amount",
      "status": "Status",
      "description": "Description"
    }
  },
  "form": {
    "payment-form": {
      "title": {
        "payment-info": "Payment info",
        "advanced-options": "Advanced options",
        "items": "Items",
        "label": "Label",
        "price": "Price",
        "quantity": "Quantity",
        "payment-method": "Payment method",
        "generated-payment-methods": "Generated payment methods"
      },
      "label": {
        "merchant-name": "Merchant name",
        "currency": "Currency",
        "redirect-url": "Redirect URL",
        "label": "Label",
        "price": "Price",
        "quantity": "Quantity",
        "total-amount": "Total amount",
        "expected-tip-amount": "Expected tip amount",
        "price-in-btc": "Price in BTC",
        "lud16-wallet-address-with-lightning-zaps-support": "lud16 wallet address with `Lightning Zaps` support",
        "spark-wallet-account": "Spark wallet account",
        "cash-register-account": "Cash register account",
        "note-for-recipient-optional": "Note for recipient (optional)"
      },
      "placeholder": {
        "0": "0",
        "1": "1",
        "https": "https://"
      },
      "description": {
        "the-customer-will-be-redirected-to-this-url-when-they-complete-the-payment-via-t": "The customer will be redirected to this URL when they complete the payment via the web interface.",
        "generated-payment-methods": "These payment methods are created automatically from Payments settings."
      },
      "message": {
        "no-active-payment-methods": "No active payment methods are configured. This payment will be created without payment variants.",
        "ignored-invalid-payment-methods": "Some active payment methods are ignored because their target account is no longer available."
      },
      "generated-payment-method": {
        "cash": "Cash: {{account}}",
        "bank-transfer-cz": "CZ bank transfer: {{account}}",
        "btc-ln": "BTC LN ({{provider}}): {{account}}"
      },
      "save-label": {
        "create-invoice": "Create invoice"
      }
    },
    "payment-default-methods-form": {
      "title": {
        "default-payment-methods": "Default payment methods",
        "type": "Type",
        "account": "Account",
        "status": "Status"
      },
      "description": {
        "default-payment-methods": "Each new payment will generate these payment variants in the configured order."
      },
      "label": {
        "type": "Type",
        "account": "Account",
        "status": "Status"
      },
      "type": {
        "cash": "Cash",
        "btc-ln": "BTC LN",
        "bank-transfer-cz": "Bank transfer (CZ)"
      },
      "status": {
        "active": "Active",
        "paused": "Paused"
      },
      "placeholder": {
        "select-type": "Select type",
        "select-type-first": "Select type first",
        "select-account": "Select account"
      },
      "value": {
        "missing-account": "Missing account: {{id}}"
      }
    }
  }
} as const;

export default locale;
