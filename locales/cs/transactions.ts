const locale = {
  "page": {
    "newTransaction": "Nová transakce",
    "editTransaction": "Upravit transakci",
    "detail": "Detail transakce"
  },
  "table": {
    "transactions": "Transakce",
    "description": {
      "list-of-transactions": "Seznam transakcí na vašich peněžních účtech"
    },
    "actions": {
      "new-transaction": "Nová transakce"
    },
    "columns": {
      "occurred-at": "Datum transakce",
      "created-at": "Zapsáno",
      "account": "Účet",
      "type": "Typ",
      "amount": "Částka",
      "note": "Poznámka"
    },
    "search": {
      "placeholder": {
        "by-account": "Hledat podle účtu..."
      }
    }
  },
  "form": {
    "transaction-form": {
      "label": {
        "account": "Peněžní účet",
        "occurred-at": "Datum transakce",
        "amount": "Částka",
        "note": "Poznámka",
        "internal-transfer-group-id": "ID skupiny interního převodu",
        "source-type": "Typ zdroje",
        "source-id": "ID zdroje",
        "variable-symbol": "Variabilní symbol",
        "constant-symbol": "Konstantní symbol",
        "specific-symbol": "Specifický symbol",
        "bank-reference": "Bankovní reference",
        "ln-invoice": "LN invoice",
        "pre-image": "Pre-image",
        "payment-hash": "Payment hash",
        "spark-transfer-id": "Spark transfer ID",
        "nwc-event-id": "NWC event ID",
        "nwc-request-id": "NWC request ID"
      },
      "placeholder": {
        "select-account": "Vyber účet",
        "select-source-type": "Vyber typ zdroje"
      },
      "option": {
        "source-type": {
          "payment": "Platba",
          "invoice": "Faktura"
        }
      },
      "title": {
        "iban-details": "Detaily bankovní transakce",
        "lud16-details": "LUD16 detaily",
        "spark-details": "Spark detaily",
        "nwc-details": "NWC detaily"
      },
      "tag": {
        "account-iban": "Bankovní účet (IBAN)",
        "account-lud16": "BTC peněženka (LUD16)",
        "account-spark": "Spark Bitcoin L2",
        "account-nwc": "NWC protokol",
        "account-cash-register": "Pokladna"
      }
    }
  },
  "detail": {
    "labels": {
      "account": "Účet",
      "type": "Typ",
      "amount": "Částka",
      "occurred-at": "Datum transakce",
      "created-at": "Zapsáno",
      "note": "Poznámka",
      "internal-transfer-group-id": "ID skupiny interního převodu"
    },
    "actions": {
      "edit": "Upravit",
      "delete": "Smazat"
    },
    "confirm-delete": {
      "title": "Smazat transakci?",
      "description": "Tuto akci nelze vrátit zpět.",
      "confirm": "Smazat",
      "cancel": "Zrušit"
    }
  }
} as const;

export default locale;
