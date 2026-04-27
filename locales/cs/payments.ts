const locale = {
  "page": {
    "payment": "Platba",
    "settings": "Nastavení plateb",
    "settings-description": "Nastavte, které platební varianty se mají automaticky generovat pro každou novou platbu."
  },
  "detail": {
    "actions": {
      "pay-in-cash": "Zaplatit v hotovosti",
      "cancel": "Zrušit",
      "show-fullscreen-qr-payment": "Zobrazit QR platbu na celou obrazovku",
      "stop-watching": "Přerušit sledování",
      "resume-watching": "Obnovit sledování",
      "delete": "Smazat",
      "open": "Otevřít",
      "open-in-btc-wallet": "Otevřít v BTC peněžence",
      "share-qr-code": "Sdílet QR kód",
      "download-qr-code": "Stáhnout QR kód",
      "issue-receipt": "Vystavit účtenku",
      "download-receipt": "Stáhnout účtenku",
      "preparing-receipt": "Připravuji účtenku"
    },
    "confirm": {
      "pay-in-cash": {
        "title": "Zaplatit v hotovosti?",
        "description": "Tímto se vytvoří hotovostní transakce a propojí se s touto platbou."
      },
      "delete-payment": {
        "title": "Smazat platbu?",
        "description": "Tuto akci nelze vrátit zpět."
      }
    },
    "messages": {
      "payment-successfully-paid": "Platba byla úspěšně zaplacena",
      "share-qr-description": "Sdílejte tento QR kód ve své bankovní aplikaci",
      "no-cash-register-account-configured": "Pro tuto platbu není nakonfigurován pokladní účet.",
      "cash-payment-enabled-no-cash-register-account": "Hotovostní platba je povolena, ale není nakonfigurován pokladní účet.",
      "ln-invoice-copied-to-clipboard": "LN faktura byla úspěšně zkopírována do schránky",
      "receipt-can-be-issued-after-settlement": "Účtenku lze vystavit až po zaúčtování platby.",
      "receipt-issued": "Účtenka {{receiptNumber}} byla vystavena {{issuedAt}}.",
      "receipt-errors": {
        "payment-not-found": "Platbu se nepodařilo najít.",
        "unsupported-direction": "Účtenku lze vystavit jen pro příchozí platby.",
        "payment-not-settled": "Účtenku lze vystavit jen pro zaúčtovanou platbu.",
        "supplier-not-configured": "Fakturační údaje firmy nejsou nastavené.",
        "supplier-billing-info-missing": "Fakturační údaje firmy nejsou kompletní."
      }
    },
    "tabs": {
      "web-payment": "Webová platba",
      "btc-ln-payment": "BTC LN platba",
      "cz-qr-payment": "CZ QR platba",
      "cash": "Hotovost"
    },
    "sections": {
      "sections": "Sekce detailu",
      "overview": "Přehled",
      "items": "Položky",
      "messages": "Zprávy",
      "timeline": "Historie",
      "reconciliation": "Párování"
    },
    "empty": {
      "items": "Pro tuto platbu nebyly nalezeny žádné položky."
    },
    "items": {
      "columns": {
        "item": "Položka",
        "quantity": "Množství",
        "total": "Celkem"
      }
    },
    "reconciliation": {
      "title": "Záznamy párování",
      "description": "Claimy z tabulky reconciliationClaim pro tuto platbu.",
      "empty": "Pro tuto platbu nebyly nalezeny žádné claimy.",
      "columns": {
        "created-at": "Vytvořeno",
        "id": "ID claimu",
        "device-id": "ID zařízení",
        "source-type": "Typ zdroje",
        "source-id": "ID zdroje",
        "rule": "Pravidlo",
        "confidence": "Důvěra",
        "created-by": "Vytvořil"
      }
    },
    "labels": {
      "price": "Cena",
      "created-at": "Vytvořeno",
      "expire-at": "Vyprší",
      "status": "Stav",
      "merchant-name": "Název obchodníka",
      "redirect": "Přesměrování",
      "tip": "Spropitné"
    },
    "status": {
      "paid": "Zaplaceno",
      "unpaid": "Nezaplaceno",
      "underpaid": "Nedoplatek",
      "overpaid": "Přeplatek",
      "waiting": "Čeká na zaplacení",
      "unknown": "Neznámý"
    },
    "values": {
      "yes": "ano",
      "no": "ne"
    },
    "help": {
      "redirect": "Zákazník bude po úspěšné platbě přesměrován na tuto adresu, pokud platí přes webovou aplikaci.",
      "tip": "Statické platby nepodporují spropitné"
    }
  },
  "receipt": {
    "line": {
      "tip": "Spropitné",
      "payment": "Platba",
      "settlement-adjustment": "Rozdíl úhrady"
    },
    "pdf": {
      "title": "Účtenka",
      "receiptNumber": "Číslo účtenky",
      "issuedAt": "Vystaveno:",
      "paymentDate": "Datum platby:",
      "supplier": "Dodavatel",
      "identificationNumber": "IČO:",
      "vatNumber": "DIČ:",
      "amountReceived": "Přijatá částka",
      "itemCount": "Počet řádků",
      "total": "Celkem",
      "columns": {
        "label": "Položka",
        "quantity": "Množství",
        "unit": "MJ",
        "unitPrice": "Cena za MJ",
        "total": "Celkem"
      },
      "country": {
        "cz": "Česká republika"
      }
    }
  },
  "table": {
    "paymentMessages": "Platební zprávy",
    "description": {
      "decrypted-payment-data": "Dešifrovaná platební data z přímých zpráv Nostr NIP-04"
    },
    "actions": {
      "new-payment": "Nová platba"
    },
    "columns": {
      "created-at": "Vytvořeno",
      "amount": "Částka",
      "status": "Stav",
      "description": "Popis"
    }
  },
  "form": {
    "payment-form": {
      "title": {
        "payment-info": "Platební informace",
        "advanced-options": "Pokročilé možnosti",
        "items": "Položky",
        "label": "Štítek",
        "price": "Cena",
        "quantity": "Množství",
        "payment-method": "Způsob platby",
        "generated-payment-methods": "Generované platební metody"
      },
      "label": {
        "merchant-name": "Název obchodníka",
        "currency": "Měna",
        "redirect-url": "URL přesměrování",
        "label": "Štítek",
        "price": "Cena",
        "quantity": "Množství",
        "total-amount": "Celková částka",
        "expected-tip-amount": "Očekávané spropitné",
        "price-in-btc": "Cena v BTC",
        "lud16-wallet-address-with-lightning-zaps-support": "Adresa lud16 peněženky s podporou Lightning Zapů",
        "spark-wallet-account": "Spark peněženka",
        "cash-register-account": "Pokladní účet",
        "note-for-recipient-optional": "Poznámka pro příjemce (volitelné)"
      },
      "placeholder": {
        "0": "0",
        "1": "1",
        "https": "https://"
      },
      "description": {
        "the-customer-will-be-redirected-to-this-url-when-they-complete-the-payment-via-t": "Zákazník bude po dokončení platby přes webové rozhraní přesměrován na tuto URL.",
        "generated-payment-methods": "Tyto platební metody se automaticky vytvoří podle nastavení v sekci Platby."
      },
      "message": {
        "no-active-payment-methods": "Není nastavena žádná aktivní platební metoda. Tato platba se vytvoří bez platebních variant.",
        "ignored-invalid-payment-methods": "Některé aktivní platební metody jsou ignorovány, protože jejich cílový účet už není k dispozici."
      },
      "generated-payment-method": {
        "cash": "Hotovost: {{account}}",
        "bank-transfer-cz": "Bankovní převod CZ: {{account}}",
        "btc-ln": "BTC LN ({{provider}}): {{account}}"
      },
      "save-label": {
        "create-invoice": "Vytvořit fakturu"
      }
    },
    "payment-default-methods-form": {
      "title": {
        "default-payment-methods": "Výchozí platební metody",
        "type": "Typ",
        "account": "Účet",
        "status": "Stav"
      },
      "description": {
        "default-payment-methods": "Každá nová platba vytvoří tyto platební varianty v nastaveném pořadí."
      },
      "label": {
        "type": "Typ",
        "account": "Účet",
        "status": "Stav"
      },
      "type": {
        "cash": "Hotovost",
        "btc-ln": "BTC LN",
        "bank-transfer-cz": "Bankovní převod (CZ)"
      },
      "status": {
        "active": "Aktivní",
        "paused": "Pozastaveno"
      },
      "placeholder": {
        "select-type": "Vyberte typ",
        "select-type-first": "Nejdřív vyberte typ",
        "select-account": "Vyberte účet"
      },
      "value": {
        "missing-account": "Chybějící účet: {{id}}"
      }
    }
  }
} as const;

export default locale;
