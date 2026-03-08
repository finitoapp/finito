const locale = {
  "form": {
    "editBillingInformation": "Edit billing information",
    "billing-info-form": {
      "label": {
        "company-name": "Company name",
        "label": "Label",
        "email": "Email",
        "street": "Street",
        "city": "City",
        "postal-code": "Postal Code",
        "descriptive-number": "Descriptive Number",
        "country-code": "Country code",
        "identification-number": "Identification Number",
        "vat-number": "VAT Number"
      },
      "description": {
        "your-private-name-for-internal-purposes": "Your private name for internal purposes"
      }
    },
    "invoice-form": {
      "label": {
        "customer": "Customer",
        "supplier": "Supplier",
        "invoice-number": "Invoice number",
        "issue-date": "Issue date",
        "due-date": "Due date",
        "currency": "Currency",
        "payment-method": "Payment method",
        "label": "Label",
        "price": "Price",
        "quantity": "Quantity",
        "uom": "UOM"
      },
      "payment-method": {
        "bank-transfer": "Bank transfer",
        "payment-card": "Payment card",
        "cash": "Cash"
      },
      "title": {
        "invoice-info": "Invoice info",
        "advanced-options": "Advanced options",
        "items": "Items",
        "id": "ID",
        "label": "Label",
        "price": "Price",
        "quantity": "Quantity",
        "uom": "UOM"
      },
      "placeholder": {
        "0": "0",
        "1": "1"
      }
    }
  },
  "page": {
    "pdfInvoicePreview": "PDF invoice preview"
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
      "new-invoice": "New invoice"
    },
    "columns": {
      "invoice-number": "Invoice number",
      "customer-name": "Customer name",
      "issue-date": "Issue date",
      "due-date": "Due date",
      "amount": "Amount",
      "status": "Status"
    },
    "invoices": "Invoices",
    "listOfYourInvoices": "List of your invoices"
  }
} as const;

export default locale;
