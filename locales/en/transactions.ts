const locale = {
  "page": {
    "newTransaction": "New transaction",
    "editTransaction": "Edit transaction",
    "detail": "Transaction detail"
  },
  "table": {
    "transactions": "Transactions",
    "description": {
      "list-of-transactions": "List of transactions on your money accounts"
    },
    "actions": {
      "new-transaction": "New transaction"
    },
    "columns": {
      "occurred-at": "Occurred at",
      "created-at": "Created at",
      "account": "Account",
      "type": "Type",
      "amount": "Amount",
      "note": "Note"
    },
    "search": {
      "placeholder": {
        "by-account": "Search by account..."
      }
    }
  },
  "form": {
    "transaction-form": {
      "label": {
        "account": "Money account",
        "occurred-at": "Occurred at",
        "amount": "Amount",
        "note": "Note",
        "internal-transfer-group-id": "Internal transfer group ID",
        "source-type": "Source type",
        "source-id": "Source ID",
        "variable-symbol": "Variable symbol",
        "constant-symbol": "Constant symbol",
        "specific-symbol": "Specific symbol",
        "bank-reference": "Bank reference",
        "ln-invoice": "LN invoice",
        "pre-image": "Pre-image",
        "payment-hash": "Payment hash",
        "spark-transfer-id": "Spark transfer ID",
        "nwc-event-id": "NWC event ID",
        "nwc-request-id": "NWC request ID"
      },
      "placeholder": {
        "select-account": "Select account",
        "select-source-type": "Select source type"
      },
      "option": {
        "source-type": {
          "payment": "Payment",
          "invoice": "Invoice"
        }
      },
      "title": {
        "iban-details": "Bank transfer details",
        "lud16-details": "LUD16 details",
        "spark-details": "Spark details",
        "nwc-details": "NWC details"
      },
      "tag": {
        "account-iban": "Bank account (IBAN)",
        "account-lud16": "BTC wallet (LUD16)",
        "account-spark": "Spark Bitcoin L2",
        "account-nwc": "NWC protocol",
        "account-cash-register": "Cash register"
      }
    }
  },
  "detail": {
    "labels": {
      "account": "Account",
      "type": "Type",
      "amount": "Amount",
      "occurred-at": "Occurred at",
      "created-at": "Created at",
      "note": "Note",
      "internal-transfer-group-id": "Internal transfer group ID"
    },
    "actions": {
      "edit": "Edit",
      "delete": "Delete"
    },
    "confirm-delete": {
      "title": "Delete transaction?",
      "description": "This action cannot be undone.",
      "confirm": "Delete",
      "cancel": "Cancel"
    }
  }
} as const;

export default locale;
