const locale = {
  "page": {
    "payment": "Payment"
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
      "download-qr-code": "Download QR code"
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
      "cash-payment-enabled-no-cash-register-account": "Cash payment is enabled, but no cash register account is configured."
    },
    "tabs": {
      "web-payment": "Web payment",
      "btc-ln-payment": "BTC LN payment",
      "cz-qr-payment": "CZ QR Payment",
      "cash": "Cash"
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
        "payment-method": "Payment method"
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
        "the-customer-will-be-redirected-to-this-url-when-they-complete-the-payment-via-t": "The customer will be redirected to this URL when they complete the payment via the web interface."
      },
      "save-label": {
        "create-invoice": "Create invoice"
      }
    }
  }
} as const;

export default locale;
