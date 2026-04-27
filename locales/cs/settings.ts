const locale = {
  "page": {
    "settings": "Nastavení",
    "accountSettings": "Nastavení účtu",
    "billingInformation": "Fakturační údaje",
    "credentialsSettings": "Nastavení přihlašovacích údajů",
    "aiAssistant": "AI asistent",
    "aiAssistantDescription": "Chatujte s modelem a nechte ho vykonávat lokální akce v aplikaci.",
    "aiAssistantSettings": "Nastavení AI asistenta",
    "aiAssistantTabsSections": "Sekce",
    "emailSendingSettingsSmtpConfiguration": "Nastavení odesílání e-mailů (konfigurace SMTP)",
    "fioBankPlugin": "Plugin Fio banky",
    "invoiceNumberSeries": "Číselná řada faktury",
    "lastInvoiceNumber": "Číslo poslední faktury",
    "receiptNumberSeries": "Číselná řada účtenek",
    "lastReceiptNumber": "Číslo poslední účtenky",
    "lastReceiptNumberDescription": "Tyto hodnoty se používají při výpočtu následujícího čísla účtenky",
    "orUseExistingAccount": "Nebo použijte svůj existující účet",
    "plugins": "Pluginy",
    "externalLinks": "Externí odkazy",
    "appVersion": "Verze aplikace",
    "install": "Nainstalovat",
    "unknown": "neznámé",
    "navigation": {
      "connectedWallets": "Připojené peněženky",
      "account": "Účet",
      "credentials": "Přihlašovací údaje",
      "theme": "Motiv",
      "language": "Jazyk",
      "switchAccount": "Přepnout účet"
    },
    "links": {
      "followUsOnX": "Sledujte nás na X",
      "checkCodeOnGitHub": "Podívejte se na náš kód na GitHubu"
    },
    "switchAccount": "Přepnout účet",
    "weAreOpensource": "Jsme OpenSource"
  },
  "wallets": {
    "page": {
      "connectWallet": "Připojit peněženku",
      "noWalletPaired": "Momentálně nemáte spárovanou žádnou peněženku."
    },
    "dialog": {
      "deleteTitle": "Smazat peněženku?",
      "deleteDescription": "Tuto akci nelze vrátit zpět.",
      "deleteConfirmText": "Smazat",
      "deleteCancelText": "Zrušit"
    }
  },
  "form": {
    "account-form": {
      "label": {
        "name": "Název",
        "display-name": "Zobrazované jméno",
        "website": "Web",
        "about": "O mně",
        "bio": "Bio",
        "lud16-address": "lud16 adresa"
      }
    },
    "billing-settings-form": {
      "title": {
        "general-settings": "Obecná nastavení",
        "invoice-default-settings": "Výchozí nastavení faktury",
        "payment-default-settings": "Výchozí nastavení plateb",
        "invoice-email": "E-mail faktury",
        "tax-rates": "Daňové sazby",
        "id": "ID",
        "name": "Název",
        "rate": "Sazba"
      },
      "label": {
        "own-contact": "Vlastní kontakt",
        "default-invoice-due-date": "Výchozí splatnost faktury",
        "default-currency": "Výchozí měna",
        "timezone": "Časové pásmo",
        "default-invoice-payment-method": "Výchozí způsob úhrady faktury",
        "default-bank-account": "Výchozí bankovní účet",
        "default-payment-method": "Výchozí způsob platby",
        "default-ln-zap-wallet": "Výchozí LN Zap peněženka",
        "default-ln-spark-wallet": "Výchozí LN Spark peněženka",
        "enable-invoice-emails": "Povolit e-maily faktur",
        "email-subject": "Předmět e-mailu",
        "email-body": "Tělo e-mailu"
      },
      "description": {
        "in-days": "Ve dnech"
      },
      "addRowLabel": {
        "add-rate": "Přidat sazbu"
      },
      "placeholder": {
        "0": "0"
      },
      "payment-method": {
        "bank-transfer": "Bankovní převod",
        "payment-card": "Platební karta",
        "cash": "Hotovost"
      },
      "default-payment-method": {
        "cash": "Hotovost",
        "ln-zap": "LN Zap",
        "ln-spark": "LN Spark",
        "bank-transfer-cz": "Bankovní převod (CZ)"
      }
    },
    "credentials-form": {
      "label": {
        "seed": "Seed",
        "websocket-url": "Websocket URL",
        "active": "Aktivní",
        "npub": "Npub",
        "nsec": "Nsec",
        "relay-url": "URL relaye"
      },
      "title": {
        "evolu-transports": "Evolu transporty",
        "id": "ID",
        "type": "Typ",
        "websocket-url": "Websocket URL",
        "active": "Aktivní",
        "nostr-account": "Nostr účet",
        "nostr-relays": "Nostr relaye",
        "url": "URL"
      },
      "addRowLabel": {
        "add-transport": "Přidat transport",
        "add-relay": "Přidat relay"
      }
    },
    "ai-assistant-form": {
      "label": {
        "google-api-key": "Google API klíč"
      },
      "description": {
        "google-api-key": "Klíč je uložen lokálně v Evolu a používá se přímo z prohlížeče."
      }
    },
    "fio-plugin-form": {
      "label": {
        "api-url": "API URL",
        "active": "Aktivní",
        "interval-between-payment-checks": "Interval mezi kontrolami plateb",
        "api-token": "API token"
      },
      "end-addon": {
        "seconds": "sekund"
      },
      "description": {
        "we-recommend-using-a-number-calculated-as-30-number-of-tokens": "Doporučujeme použít hodnotu vypočítanou jako „30 / počet tokenů“."
      },
      "title": {
        "tokens": "Tokeny",
        "id": "ID",
        "token": "Token"
      }
    },
    "invoice-last-number-form": {
      "label": {
        "last-invoice-serial-number": "Poslední pořadové číslo faktury",
        "last-invoice-date": "Datum poslední faktury"
      }
    },
    "invoice-number-series-form": {
      "label": {
        "number-of-digits": "Počet číslic",
        "year-format": "Formát roku",
        "month-format": "Formát měsíce",
        "day-format": "Formát dne",
        "invoice-number-prefix": "Prefix čísla faktury"
      },
      "option": {
        "default": "výchozí",
        "short": "zkrácený",
        "hidden": "skrytý"
      },
      "description": {
        "if-you-dont-issue-more-than-9999-invoices-per-time-period-number-4-will-be-optim": "Pokud nevystavíte více než 9 999 faktur za dané období, hodnota 4 bude optimální."
      }
    },
    "receipt-last-number-form": {
      "label": {
        "last-receipt-serial-number": "Poslední pořadové číslo účtenky",
        "last-receipt-date": "Datum poslední účtenky"
      }
    },
    "receipt-number-series-form": {
      "label": {
        "number-of-digits": "Počet číslic",
        "year-format": "Formát roku",
        "month-format": "Formát měsíce",
        "day-format": "Formát dne",
        "receipt-number-prefix": "Prefix čísla účtenky"
      },
      "option": {
        "default": "výchozí",
        "short": "zkrácený",
        "hidden": "skrytý"
      },
      "description": {
        "if-you-dont-issue-more-than-9999-receipts-per-time-period-number-4-will-be-opt": "Pokud nevystavíte více než 9 999 účtenek za dané období, hodnota 4 bude optimální."
      }
    },
    "smtp-form": {
      "label": {
        "server": "Server",
        "port": "Port",
        "username": "Uživatelské jméno",
        "password": "Heslo",
        "your-e-mail": "Váš e-mail",
        "your-email-name": "Název odesílatele e-mailu"
      }
    },
    "switch-account-form": {
      "placeholder": {
        "paste-your-seed": "vložit seed"
      },
      "save-label": {
        "use-seed": "Použít seed"
      }
    },
    "new-account-form": {
      "save-label": {
        "generate-a-new-account": "Vygenerovat nový účet"
      }
    }
  }
} as const;

export default locale;
