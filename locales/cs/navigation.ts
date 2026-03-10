const locale = {
  "account": {
    "accounts": "Účty",
    "currentAccount": "Aktuální účet",
    "initials": "CN",
    "unknown": "neznámý",
    "actions": {
      "label": "Akce",
      "addAccount": "Přidat účet",
      "logout": "Odhlásit",
      "cancel": "Zrušit",
      "install": "Nainstalovat"
    },
    "confirmLogout": {
      "title": "Odhlásit aktuální účet?",
      "description": "Aktuální účet bude z tohoto zařízení odstraněn. Později ho můžete obnovit pomocí seed fráze."
    }
  },
  "main": {
    "settings": "Nastavení",
    "links": {
      "dashboard": "Přehled",
      "payments": "Platby",
      "pointOfSale": "Pokladna",
      "invoices": "Faktury",
      "items": "Položky",
      "menus": "Nabídky",
      "categories": "Kategorie",
      "tables": "Stoly",
      "reservations": "Rezervace",
      "clients": "Klienti",
      "contacts": "Kontakty",
      "moneyAccounts": "Peněžní účty",
      "transactions": "Transakce"
    }
  },
  "settings": {
    "links": {
      "billingInformation": "Fakturační údaje",
      "billingSettings": "Fakturační nastavení",
      "invoiceNumberSeries": "Číselná řada faktur",
      "account": "Účet",
      "fioPlugin": "Fio plugin",
      "emailPlugin": "Email plugin",
      "credentials": "Přihlašovací údaje",
      "debug": "Debug"
    }
  }
} as const;

export default locale;
