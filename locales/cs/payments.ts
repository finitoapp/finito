const locale = {
  "page": {
    "payment": "Platba"
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
      "download-qr-code": "Stáhnout QR kód"
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
      "cash-payment-enabled-no-cash-register-account": "Hotovostní platba je povolena, ale není nakonfigurován pokladní účet."
    },
    "tabs": {
      "web-payment": "Webová platba",
      "btc-ln-payment": "BTC LN platba",
      "cz-qr-payment": "CZ QR platba",
      "cash": "Hotovost"
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
        "payment-method": "Způsob platby"
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
        "the-customer-will-be-redirected-to-this-url-when-they-complete-the-payment-via-t": "Zákazník bude po dokončení platby přes webové rozhraní přesměrován na tuto URL."
      },
      "save-label": {
        "create-invoice": "Vytvořit fakturu"
      }
    }
  }
} as const;

export default locale;
