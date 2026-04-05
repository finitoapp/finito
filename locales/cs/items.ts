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
      "history": "Historie",
      "analytics": "Statistiky"
    },
    "header": {
      "productNamePlaceholder": "Název produktu"
    },
    "history": {
      "title": "Historie revizí položky",
      "description": "Přehled všech uložených revizí položky z tabulky item.",
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
    "analytics": {
      "cards": {
        "orders": "Počet objednávek",
        "units": "Prodané množství",
        "revenue": "Tržba",
        "averageOrder": "Průměr na objednávku",
        "lastSale": "Poslední prodej"
      },
      "charts": {
        "salesTrend": {
          "title": "Trend prodejů",
          "description": "Počet objednávek a prodané množství za posledních {{days}} dní."
        },
        "revenueTrend": {
          "title": "Trend tržby",
          "description": "Denní tržba položky za posledních {{days}} dní."
        }
      },
      "legend": {
        "orders": "Objednávky",
        "units": "Množství",
        "revenue": "Tržba"
      },
      "empty": {
        "title": "Zatím bez prodejů",
        "description": "Jakmile se tato položka začne prodávat, grafy i statistiky se zobrazí tady.",
        "noSales": "Žádná data"
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
