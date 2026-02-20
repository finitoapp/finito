const locale = {
  "page": {
    "payment": "Platba"
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
