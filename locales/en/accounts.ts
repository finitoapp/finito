const locale = {
  "page": {
    "editAccount": "Edit account",
    "newAccount": "New account"
  },
  "table": {
    "accounts": "Accounts",
    "description": {
      "list-of-your-accounts": "List of your accounts (bank accounts, wallets, etc.)"
    },
    "actions": {
      "new-account": "New account"
    },
    "columns": {
      "name": "Name",
      "type": "Type",
      "address": "Address",
      "currency": "Currency"
    },
    "search": {
      "placeholder": {
        "by-name": "Search by name..."
      }
    }
  },
  "form": {
    "account-form": {
      "label": {
        "name": "Name",
        "protocol": "Protocol",
        "iban": "IBAN",
        "currency": "Currency",
        "lud16": "LUD16",
        "credentials": "Credentials",
        "seed": "Seed",
        "mnemonic": "Mnemonic"
      },
      "tag": {
        "account-iban": "Bank account (IBAN)",
        "account-lud16": "BTC wallet (LUD16)",
        "account-nwc": "NWC protocol (Nostr Wallet Connect)",
        "account-spark": "Spark Bitcoin L2",
        "account-cash-register": "Cash register"
      },
      "seed-option": {
        "new": "Generate new random seed",
        "manual": "Use existing seed"
      }
    }
  }
} as const;

export default locale;
