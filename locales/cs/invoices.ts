const locale = {
  "form": {
    "editBillingInformation": "Upravit fakturační údaje",
    "billing-info-form": {
      "label": {
        "company-name": "Název společnosti",
        "label": "Štítek",
        "email": "E-mail",
        "street": "Ulice",
        "city": "Město",
        "postal-code": "PSČ",
        "descriptive-number": "Číslo popisné",
        "country-code": "Kód země",
        "identification-number": "IČO",
        "vat-number": "DIČ"
      },
      "description": {
        "your-private-name-for-internal-purposes": "Váš interní název pro soukromé použití"
      }
    },
    "invoice-form": {
      "label": {
        "customer": "Odběratel",
        "supplier": "Dodavatel",
        "invoice-number": "Číslo faktury",
        "issue-date": "Datum vystavení",
        "due-date": "Datum splatnosti",
        "currency": "Měna",
        "payment-method": "Způsob platby",
        "label": "Štítek",
        "price": "Cena",
        "quantity": "Množství",
        "uom": "MJ"
      },
      "payment-method": {
        "bank-transfer": "Bankovní převod",
        "payment-card": "Platební karta",
        "cash": "Hotovost"
      },
      "title": {
        "invoice-info": "Informace o faktuře",
        "advanced-options": "Pokročilé možnosti",
        "items": "Položky",
        "id": "ID",
        "label": "Štítek",
        "price": "Cena",
        "quantity": "Množství",
        "uom": "MJ"
      },
      "placeholder": {
        "0": "0",
        "1": "1"
      }
    }
  },
  "page": {
    "pdfInvoicePreview": "PDF náhled faktury"
  },
  "pdf": {
    "cz": {
      "celkemKUhrade": "Celkem k úhradě",
      "cisloUctu": "Číslo účtu:",
      "datumSplatnosti": "Datum splatnosti:",
      "datumVystaveni": "Datum vystavení:",
      "dekujemeVamZaSpolupraci": "Děkujeme vám za spolupráci!",
      "dodavatel": "Dodavatel",
      "faktura": "Faktura",
      "iban": "IBAN:",
      "mj": "M.J.",
      "neplatceDph": "Neplátce DPH",
      "odberatel": "Odběratel",
      "poznamka": "Poznámka",
      "variabilniSymbol": "Variabilní symbol:",
      "zpusobUhrady": "Způsob úhrady:"
    }
  },
  "table": {
    "actions": {
      "new-invoice": "Nová faktura"
    },
    "columns": {
      "invoice-number": "Číslo faktury",
      "customer-name": "Název zákazníka",
      "issue-date": "Datum vystavení",
      "due-date": "Datum splatnosti",
      "amount": "Částka",
      "status": "Stav"
    },
    "invoices": "Faktury",
    "listOfYourInvoices": "Seznam vašich faktur"
  }
} as const;

export default locale;
