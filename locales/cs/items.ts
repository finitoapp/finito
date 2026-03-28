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
    "tabs": {
      "sections": "Sekce",
      "detail": "Detail",
      "inventory": "Sklad",
      "history": "Historie"
    },
    "header": {
      "productNamePlaceholder": "Název produktu"
    },
    "history": {
      "title": "Historie revizí položky",
      "description": "Přehled všech uložených revizí položky z tabulky itemRevision.",
      "columns": {
        "changedAt": "Změněno",
        "unitOfMeasure": "MJ",
        "internalCode": "Interní kód",
        "productCode": "Kód produktu",
        "actions": "Akce"
      },
      "actions": {
        "viewChanges": "Zobrazit změny"
      },
      "diff": {
        "title": "Porovnání stavu položky",
        "description": "Porovnání vůči revizi z {{changedAt}}.",
        "current": "Aktuální položka",
        "revision": "Vybraná revize"
      }
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
