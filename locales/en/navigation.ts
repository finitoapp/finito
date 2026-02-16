const locale = {
  "account": {
    "accounts": "Accounts",
    "currentAccount": "Current account",
    "initials": "CN",
    "unknown": "unknown",
    "actions": {
      "label": "Actions",
      "addAccount": "Add account",
      "logout": "Logout",
      "cancel": "Cancel",
      "install": "Install"
    },
    "confirmLogout": {
      "title": "Logout current account?",
      "description": "The current account will be removed from this device. You can restore it later with your seed phrase."
    }
  },
  "main": {
    "settings": "Settings",
    "links": {
      "dashboard": "Dashboard",
      "payments": "Payments",
      "pointOfSale": "Point of Sale",
      "invoices": "Invoices",
      "items": "Items",
      "categories": "Categories",
      "tables": "Tables",
      "reservations": "Reservations",
      "clients": "Clients",
      "moneyAccounts": "Money Accounts"
    }
  },
  "settings": {
    "links": {
      "billingInformation": "Billing information",
      "billingSettings": "Billing settings",
      "invoiceNumberSeries": "Invoice number series",
      "account": "Account",
      "fioPlugin": "Fio plugin",
      "emailPlugin": "Email plugin",
      "credentials": "Credentials",
      "debug": "Debug"
    }
  }
} as const;

export default locale;
