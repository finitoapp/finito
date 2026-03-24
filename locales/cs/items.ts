const locale = {
  "page": {
    "editItem": "Upravit položku",
    "newItem": "Nová položka"
  },
  "detail": {
    "sections": {
      "codesAndScanning": "Kódy a skenování",
      "codesAndScanningDescription": "Čárový kód, SKU a identifikační údaje položky na jednom místě.",
      "metadata": "Metadata"
    },
    "fields": {
      "barcode": "Čárový kód",
      "recordId": "ID záznamu",
      "added": "Přidáno",
      "updated": "Naposledy upraveno",
      "deviceId": "ID zařízení"
    },
    "actions": {
      "copyRecordId": "Zkopírovat ID záznamu",
      "delete": "Smazat",
      "cancel": "Zrušit"
    },
    "deleteDialog": {
      "title": "Smazat položku?",
      "description": "Tuto akci už nepůjde vrátit zpět."
    },
    "empty": {
      "category": "Přidat kategorii",
      "barcode": "Po doplnění kódu produktu se tady zobrazí čárový kód."
    }
  },
  "table": {
    "items": "Položky",
    "listOfYourSalesItems": "Seznam vašich prodejních položek",
    "actions": {
      "new-item": "Nová položka"
    },
    "columns": {
      "label": "Štítek",
      "category": "Kategorie",
      "amount": "Částka"
    },
    "search": {
      "placeholder": {
        "by-label": "Hledat podle štítku..."
      }
    }
  },
  "form": {
    "item-form": {
      "label": {
        "label": "Štítek",
        "price": "Cena",
        "currency": "Měna",
        "unit-of-measure-uom-optional": "Měrná jednotka (MJ) (volitelné)",
        "category-optional": "Kategorie (volitelné)",
        "product-code-optional": "Kód produktu (volitelné)",
        "type": "Typ",
        "internal-code-sku-optional": "Interní kód (SKU) (volitelné)"
      },
      "placeholder": {
        "0": "0",
        "select-a-category": "Vyberte kategorii"
      }
    }
  }
} as const;

export default locale;
