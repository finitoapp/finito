const locale = {
  "page": {
    "editAccount": "Upravit účet",
    "newAccount": "Nový účet",
    "tabsSections": "Sekce"
  },
  "table": {
    "accounts": "Účty",
    "description": {
      "list-of-your-accounts": "Seznam vašich účtů (bankovní účty, peněženky apod.)"
    },
    "actions": {
      "new-account": "Nový účet"
    },
    "columns": {
      "name": "Název",
      "type": "Typ",
      "address": "Adresa",
      "currency": "Měna"
    },
    "search": {
      "placeholder": {
        "by-name": "Hledat podle názvu..."
      }
    }
  },
  "form": {
    "account-form": {
      "label": {
        "name": "Název",
        "protocol": "Protokol",
        "iban": "IBAN",
        "currency": "Měna",
        "lud16": "LUD16",
        "credentials": "Přihlašovací údaje",
        "seed": "Seed",
        "mnemonic": "Mnemonická fráze"
      },
      "tag": {
        "account-iban": "Bankovní účet (IBAN)",
        "account-lud16": "BTC peněženka (LUD16)",
        "account-nwc": "NWC (Nostr Wallet Connect)",
        "account-spark": "Spark Bitcoin L2",
        "account-cash-register": "Pokladna"
      },
      "seed-option": {
        "new": "Vygenerovat nový náhodný seed",
        "manual": "Použít existující seed"
      }
    }
  },
  "detail": {
    "tabs": {
      "sections": "Sekce",
      "detail": "Detail"
    },
    "fields": {
      "type": "Typ",
      "address": "Adresa"
    },
    "actions": {
      "edit": "Upravit",
      "delete": "Smazat"
    },
    "deleteDialog": {
      "title": "Smazat účet?",
      "description": "Tuto akci nelze vrátit zpět.",
      "confirm": "Smazat",
      "cancel": "Zrušit"
    }
  }
} as const;

export default locale;
