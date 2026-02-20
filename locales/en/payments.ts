const locale = {
  "page": {
    "payment": "Payment"
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
