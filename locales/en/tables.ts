const locale = {
  "form": {
    "codes": {
      "addRowLabel": "Add QR code",
      "columns": {
        "id": "ID"
      },
      "fields": {
        "code": {
          "label": "Code"
        }
      }
    },
    "fields": {
      "label": {
        "label": "Label"
      },
      "numberOfSeats": {
        "label": "Number of Seats"
      }
    },
    "table-form": {
      "placeholder": {
        "0": "0"
      }
    }
  },
  "page": {
    "editTable": "Edit table",
    "newTable": "New table"
  },
  "detail": {
    "sections": {
      "codesAndScanning": "QR access and scanning",
      "codesAndScanningDescription": "Manage table QR code and customer access link.",
      "metadata": "Metadata"
    },
    "fields": {
      "qrCode": "QR code",
      "accessUrl": "Access URL",
      "primaryCode": "Primary code",
      "codesCount": "QR codes",
      "recordId": "Record ID",
      "added": "Added",
      "updated": "Last updated",
      "deviceId": "Device ID"
    },
    "actions": {
      "copyRecordId": "Copy record ID",
      "open": "Open",
      "delete": "Delete",
      "cancel": "Cancel"
    },
    "deleteDialog": {
      "title": "Delete table?",
      "description": "This action cannot be undone."
    },
    "empty": {
      "primaryCode": "Add a QR code to this table.",
      "accessUrl": "Access URL will appear after adding a QR code.",
      "qrCode": "QR preview will appear here after adding a QR code."
    }
  },
  "table": {
    "actions": {
      "new-table": "New table"
    },
    "columns": {
      "label": "Label",
      "number-of-seats": "Number of seats",
      "codes": "Codes"
    },
    "listOfYourTables": "List of your tables",
    "search": {
      "placeholder": {
        "by-label": "Search by label..."
      }
    },
    "tables": "Tables"
  }
} as const;

export default locale;
