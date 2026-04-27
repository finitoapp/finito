const locale = {
  "page": {
    "settings": "Settings",
    "accountSettings": "Account settings",
    "billingInformation": "Billing information",
    "credentialsSettings": "Credentials settings",
    "aiAssistant": "AI Assistant",
    "aiAssistantDescription": "Chat with the model and let it execute local actions in the app.",
    "aiAssistantSettings": "AI Assistant settings",
    "aiAssistantTabsSections": "Sections",
    "emailSendingSettingsSmtpConfiguration": "Email sending settings (SMTP configuration)",
    "fioBankPlugin": "Fio bank plugin",
    "invoiceNumberSeries": "Invoice number series",
    "lastInvoiceNumber": "Last invoice number",
    "receiptNumberSeries": "Receipt number series",
    "lastReceiptNumber": "Last receipt number",
    "lastReceiptNumberDescription": "The values are used when calculating the subsequent receipt number",
    "orUseExistingAccount": "Or use your existing account",
    "plugins": "Plugins",
    "externalLinks": "External links",
    "appVersion": "App version",
    "install": "Install",
    "unknown": "unknown",
    "navigation": {
      "connectedWallets": "Connected wallets",
      "account": "Account",
      "credentials": "Credentials",
      "theme": "Theme",
      "language": "Language",
      "switchAccount": "Switch account"
    },
    "links": {
      "followUsOnX": "Follow us on X",
      "checkCodeOnGitHub": "Check out our code on GitHub"
    },
    "switchAccount": "Switch account",
    "weAreOpensource": "We are OpenSource"
  },
  "wallets": {
    "page": {
      "connectWallet": "Connect a wallet",
      "noWalletPaired": "You currently have no wallet paired."
    },
    "dialog": {
      "deleteTitle": "Delete wallet?",
      "deleteDescription": "This action cannot be undone.",
      "deleteConfirmText": "Delete",
      "deleteCancelText": "Cancel"
    }
  },
  "form": {
    "account-form": {
      "label": {
        "name": "Name",
        "display-name": "Display name",
        "website": "Website",
        "about": "About",
        "bio": "Bio",
        "lud16-address": "lud16 address"
      }
    },
    "billing-settings-form": {
      "title": {
        "general-settings": "General settings",
        "invoice-default-settings": "Invoice default settings",
        "payment-default-settings": "Payment default settings",
        "invoice-email": "Invoice email",
        "tax-rates": "Tax rates",
        "id": "ID",
        "name": "Name",
        "rate": "Rate"
      },
      "label": {
        "own-contact": "Own contact",
        "default-invoice-due-date": "Default invoice due date",
        "default-currency": "Default currency",
        "timezone": "Timezone",
        "default-invoice-payment-method": "Default invoice payment method",
        "default-bank-account": "Default bank account",
        "default-payment-method": "Default payment method",
        "default-ln-zap-wallet": "Default LN Zap wallet",
        "default-ln-spark-wallet": "Default LN Spark wallet",
        "enable-invoice-emails": "Enable invoice emails",
        "email-subject": "Email subject",
        "email-body": "Email body"
      },
      "description": {
        "in-days": "In days"
      },
      "addRowLabel": {
        "add-rate": "Add rate"
      },
      "placeholder": {
        "0": "0"
      },
      "payment-method": {
        "bank-transfer": "Bank transfer",
        "payment-card": "Payment card",
        "cash": "Cash"
      },
      "default-payment-method": {
        "cash": "Cash",
        "ln-zap": "LN Zap",
        "ln-spark": "LN Spark",
        "bank-transfer-cz": "Bank transfer (CZ)"
      }
    },
    "credentials-form": {
      "label": {
        "seed": "Seed",
        "websocket-url": "Websocket URL",
        "active": "Active",
        "npub": "Npub",
        "nsec": "Nsec",
        "relay-url": "Relay URL"
      },
      "title": {
        "evolu-transports": "Evolu Transports",
        "id": "ID",
        "type": "Type",
        "websocket-url": "Websocket URL",
        "active": "Active",
        "nostr-account": "Nostr account",
        "nostr-relays": "Nostr Relays",
        "url": "URL"
      },
      "addRowLabel": {
        "add-transport": "Add transport",
        "add-relay": "Add relay"
      }
    },
    "ai-assistant-form": {
      "label": {
        "google-api-key": "Google API key"
      },
      "description": {
        "google-api-key": "Saved locally in Evolu and used directly from the browser."
      }
    },
    "fio-plugin-form": {
      "label": {
        "api-url": "API URL",
        "active": "Active",
        "interval-between-payment-checks": "Interval between payment checks",
        "api-token": "API Token"
      },
      "end-addon": {
        "seconds": "Seconds"
      },
      "description": {
        "we-recommend-using-a-number-calculated-as-30-number-of-tokens": "We recommend using a number calculated as '30 / number of tokens'"
      },
      "title": {
        "tokens": "Tokens",
        "id": "ID",
        "token": "Token"
      }
    },
    "invoice-last-number-form": {
      "label": {
        "last-invoice-serial-number": "Last invoice serial number",
        "last-invoice-date": "Last invoice date"
      }
    },
    "invoice-number-series-form": {
      "label": {
        "number-of-digits": "Number of digits",
        "year-format": "Year format",
        "month-format": "Month format",
        "day-format": "Day format",
        "invoice-number-prefix": "Invoice number prefix"
      },
      "option": {
        "default": "default",
        "short": "short",
        "hidden": "hidden"
      },
      "description": {
        "if-you-dont-issue-more-than-9999-invoices-per-time-period-number-4-will-be-optim": "If you don't issue more than 9999 invoices per time period, number 4 will be optimal for you."
      }
    },
    "receipt-last-number-form": {
      "label": {
        "last-receipt-serial-number": "Last receipt serial number",
        "last-receipt-date": "Last receipt date"
      }
    },
    "receipt-number-series-form": {
      "label": {
        "number-of-digits": "Number of digits",
        "year-format": "Year format",
        "month-format": "Month format",
        "day-format": "Day format",
        "receipt-number-prefix": "Receipt number prefix"
      },
      "option": {
        "default": "default",
        "short": "short",
        "hidden": "hidden"
      },
      "description": {
        "if-you-dont-issue-more-than-9999-receipts-per-time-period-number-4-will-be-opt": "If you don't issue more than 9999 receipts per time period, number 4 will be optimal for you."
      }
    },
    "smtp-form": {
      "label": {
        "server": "Server",
        "port": "Port",
        "username": "Username",
        "password": "Password",
        "your-e-mail": "Your E-mail",
        "your-email-name": "Your email name"
      }
    },
    "switch-account-form": {
      "placeholder": {
        "paste-your-seed": "paste your seed"
      },
      "save-label": {
        "use-seed": "Use seed"
      }
    },
    "new-account-form": {
      "save-label": {
        "generate-a-new-account": "Generate a new account"
      }
    }
  }
} as const;

export default locale;
