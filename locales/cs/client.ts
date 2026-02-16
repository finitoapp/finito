const locale = {
  "bill": {
    "itemsTitle": "Fakturovat položky",
    "tipForStaff": "Tip pro personál",
    "empty": {
      "emptyBill": "Momentálně je zde prázdný účet.",
      "noBill": "Momentálně zde není žádný účet."
    },
    "warning": {
      "pcsLeft": "Zbývá {{count}} ks!"
    }
  },
  "home": {
    "scanHint": "Chcete-li zaplatit, namiřte fotoaparát na QR kód",
    "title": "Domov",
    "actions": {
      "receive": "Přijmout",
      "send": "Odeslat"
    }
  },
  "page": {
    "scanQrCode": "Naskenovat QR kód",
    "paymentDetail": "Detail platby",
    "paymentHistory": "Historie plateb",
    "receivePayment": "Přijmout platbu",
    "useExample": "Použít ukázku"
  },
  "transactionHistory": {
    "title": "Historie transakcí",
    "unknownMerchant": "Neznámý obchodník",
    "empty": {
      "title": "Vaše historie transakcí je prázdná",
      "description": "Vaše platební transakce se zde zobrazí, jakmile provedete první nákup nebo prodej."
    }
  },
  "historyDetail": {
    "status": {
      "loading": "načítání",
      "paid": "Zaplaceno",
      "failed": "Selhalo",
      "inProgressOrExpired": "Stále probíhá nebo vypršelo"
    },
    "fields": {
      "name": "Název",
      "phone": "Telefon",
      "spending": "Útrata",
      "date": "Datum"
    },
    "actions": {
      "downloadReceipt": "Stáhnout účtenku"
    }
  },
  "paymentPage": {
    "methods": {
      "btcLightning": "BTC Lightning",
      "bankTransfer": "Bankovní převod"
    },
    "wallets": {
      "external": "Externí peněženka",
      "primal": "Primal Wallet",
      "bitlifi": "Bitlifi"
    },
    "actions": {
      "pay": "Zaplatit",
      "refund": "Vrátit",
      "copyShowQrInvoice": "Kopírovat a zobrazit QR fakturu"
    },
    "loading": {
      "preparingPayment": "Platba se připravuje",
      "loadingData": "Načítání dat..."
    },
    "status": {
      "paymentSuccessful": "Platba byla úspěšně zaplacena",
      "waitingForPayment": "Čekáme na vaši platbu",
      "waitingForRefund": "Čekáme na vrácení platby"
    },
    "labels": {
      "rate": "kurz"
    },
    "alerts": {
      "billClosed": "Účet je uzavřen",
      "unknownQrCode": "Neznámý QR kód"
    }
  },
  "form": {
    "payment-form": {
      "label": {
        "lud16-wallet-address-with-lightning-zaps-support": "Adresa lud16 peněženky s podporou Lightning Zapů",
        "spark-wallet-account": "Spark peněženka",
        "price-in-btc": "Cena v BTC",
        "note-for-recipient-optional": "Poznámka pro příjemce (volitelné)"
      },
      "placeholder": {
        "0": "0"
      }
    }
  }
} as const;

export default locale;
