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
    "scanQrCode": "Scan QR Code",
    "paymentDetail": "Payment detail",
    "paymentHistory": "Payment history",
    "receivePayment": "Receive payment",
    "useExample": "Use example"
  },
  "transactionHistory": {
    "title": "Transaction history",
    "unknownMerchant": "Unknown merchant",
    "empty": {
      "title": "Your transaction history is empty",
      "description": "Your payment transactions will appear here once you make your first purchase or sale."
    }
  },
  "historyDetail": {
    "status": {
      "loading": "loading",
      "paid": "Paid",
      "failed": "Failed",
      "inProgressOrExpired": "Still in progress or expired"
    },
    "fields": {
      "name": "Name",
      "phone": "Phone",
      "spending": "Spending",
      "date": "Date"
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
    }
  },
  "form": {
    "payment-form": {
      "label": {
        "lud16-wallet-address-with-lightning-zaps-support": "lud16 wallet address with `Lightning Zaps` support",
        "spark-wallet-account": "Spark wallet account",
        "price-in-btc": "Price in BTC",
        "note-for-recipient-optional": "Note for recipient (optional)"
      },
      "placeholder": {
        "0": "0"
      }
    }
  }
} as const;

export default locale;
