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
  "receiveAmountForm": {
    "title": "Zadat částku k přijetí",
    "description": "Vyberte, jestli zadáváte fiat částku nebo sats. Druhé pole se automaticky dopočítá podle aktuálního kurzu.",
    "amountLabel": "Částka",
    "account": {
      "placeholder": "Vyberte účet",
      "empty": "Není dostupný žádný účet"
    },
    "source": {
      "label": "Zdrojový vstup",
      "fiat": "Zadávám fiat",
      "sats": "Zadávám sats",
      "description": "Kliknutí do pole přepne aktivní vstup také automaticky."
    },
    "fields": {
      "fiat": "Fiat částka",
      "sats": "Částka v sats"
    },
    "status": {
      "ready": "Přepočet probíhá průběžně po zadání částky.",
      "loading": "Počítám přepočet podle aktuálního kurzu.",
      "unavailable": "Kurz teď není dostupný."
    }
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
    },
    "menu": {
      "generatedAt": "Menu vygenerováno",
      "validity": {
        "sameDay": "Platí {{date}}, {{from}}–{{to}}",
        "fromTo": "Platí od {{from}} do {{to}}",
        "from": "Platí od {{from}}",
        "to": "Platí do {{to}}"
      }
    },
    "reservation": {
      "title": "Rezervační formulář",
      "fields": {
        "date": "Datum",
        "numberOfPeople": "Počet osob",
        "slot": "Čas",
        "email": "E-mail",
        "phone": "Telefon",
        "note": "Poznámka"
      },
      "placeholders": {
        "email": "vas@email.cz",
        "phone": "+420...",
        "note": "Volitelná poznámka k rezervaci"
      },
      "actions": {
        "submit": "Odeslat rezervaci"
      },
      "messages": {
        "peopleRange": "Povoleno {{min}}-{{max}} osob",
        "noSlotForSelection": "Pro zvolený den/počet osob není volný slot"
      },
      "labels": {
        "closed": "zavřeno",
        "slotCount": "{{count}} slotů",
        "slotPeopleRange": "{{min}}-{{max}} os.",
        "required": "povinný",
        "optional": "volitelný"
      },
      "summary": {
        "generatedAt": "Data vygenerována",
        "contactRequirements": "Kontakt: e-mail {{emailRequirement}}, telefon {{phoneRequirement}}",
        "noteEnabled": "Poznámka je povolená.",
        "noteEnabledWithMax": "Poznámka je povolená (max {{max}} znaků)."
      }
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
