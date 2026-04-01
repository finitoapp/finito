const locale = {
  "form": {
    "codes": {
      "addRowLabel": "Přidat QR kód",
      "columns": {
        "id": "ID"
      },
      "fields": {
        "code": {
          "label": "Kód"
        }
      }
    },
    "fields": {
      "label": {
        "label": "Název"
      },
      "numberOfSeats": {
        "label": "Počet míst"
      }
    },
    "table-form": {
      "placeholder": {
        "0": "0"
      }
    }
  },
  "page": {
    "editTable": "Upravit tabulku",
    "newTable": "Nový stůl"
  },
  "detail": {
    "sections": {
      "codesAndScanning": "QR přístup a skenování",
      "codesAndScanningDescription": "Správa QR kódu stolu a zákaznického přístupového odkazu.",
      "metadata": "Metadata"
    },
    "fields": {
      "qrCode": "QR kód",
      "accessUrl": "Přístupová URL",
      "primaryCode": "Primární kód",
      "codesCount": "QR kódy",
      "recordId": "ID záznamu",
      "added": "Přidáno",
      "updated": "Naposledy upraveno",
      "deviceId": "ID zařízení"
    },
    "actions": {
      "copyRecordId": "Zkopírovat ID záznamu",
      "open": "Otevřít",
      "delete": "Smazat",
      "cancel": "Zrušit"
    },
    "deleteDialog": {
      "title": "Smazat stůl?",
      "description": "Tuto akci nelze vrátit zpět."
    },
    "empty": {
      "primaryCode": "Přidejte ke stolu QR kód.",
      "accessUrl": "Přístupová URL se zobrazí po přidání QR kódu.",
      "qrCode": "Náhled QR kódu se zobrazí po přidání QR kódu."
    }
  },
  "table": {
    "actions": {
      "new-table": "Nový stůl"
    },
    "columns": {
      "label": "Název",
      "device-name": "Zařízení",
      "number-of-seats": "Počet míst",
      "codes": "Kódy"
    },
    "listOfYourTables": "Seznam vašich stolů",
    "search": {
      "placeholder": {
        "by-label": "Hledat podle názvu..."
      }
    },
    "tables": "Tabulky"
  }
} as const;

export default locale;
