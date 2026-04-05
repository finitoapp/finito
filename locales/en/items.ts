const locale = {
  "page": {
    "editItem": "Edit item",
    "newItem": "New item"
  },
  "detail": {
    "sections": {
      "codesAndScanning": "Codes and scanning",
      "codesAndScanningDescription": "Barcode, SKU, and identification details in one place.",
      "metadata": "Metadata"
    },
    "tabs": {
      "sections": "Sections",
      "detail": "Detail",
      "inventory": "Inventory",
      "history": "History",
      "analytics": "Analytics"
    },
    "header": {
      "productNamePlaceholder": "Product name"
    },
    "history": {
      "title": "Item revision history",
      "description": "Overview of all saved item revisions from the item table.",
      "columns": {
        "changedAt": "Changed at",
        "unitOfMeasure": "UOM",
        "internalCode": "Internal code",
        "productCode": "Product code",
        "actions": "Actions"
      },
      "actions": {
        "viewChanges": "View changes"
      },
      "diff": {
        "title": "Compare item state",
        "description": "Comparison against revision from {{changedAt}}.",
        "current": "Current item",
        "revision": "Selected revision"
      }
    },
    "analytics": {
      "cards": {
        "orders": "Orders",
        "units": "Units sold",
        "revenue": "Revenue",
        "averageOrder": "Average per order",
        "lastSale": "Last sale"
      },
      "charts": {
        "salesTrend": {
          "title": "Sales trend",
          "description": "Order count and sold units in the last {{days}} days."
        },
        "revenueTrend": {
          "title": "Revenue trend",
          "description": "Daily item revenue in the last {{days}} days."
        }
      },
      "legend": {
        "orders": "Orders",
        "units": "Units",
        "revenue": "Revenue"
      },
      "empty": {
        "title": "No sales yet",
        "description": "Charts and stats will appear here as soon as this item starts selling.",
        "noSales": "No data"
      }
    },
    "fields": {
      "barcode": "Barcode",
      "recordId": "Record ID",
      "added": "Added",
      "updated": "Last updated",
      "deviceId": "Device ID"
    },
    "actions": {
      "copyRecordId": "Copy record ID",
      "delete": "Delete",
      "cancel": "Cancel"
    },
    "deleteDialog": {
      "title": "Delete item?",
      "description": "This action cannot be undone."
    },
    "empty": {
      "category": "Add category",
      "barcode": "The barcode preview will appear here after adding a product code."
    }
  },
  "table": {
    "items": "Items",
    "listOfYourSalesItems": "List of your sales items",
    "actions": {
      "new-item": "New item"
    },
    "columns": {
      "label": "Label",
      "category": "Category",
      "amount": "Amount"
    },
    "search": {
      "placeholder": {
        "by-label": "Search by label..."
      }
    }
  },
  "form": {
    "item-form": {
      "label": {
        "label": "Label",
        "price": "Price",
        "currency": "Currency",
        "unit-of-measure-uom-optional": "Unit of Measure (UOM) (optional)",
        "category-optional": "Category (optional)",
        "product-code-optional": "Product code (optional)",
        "type": "Type",
        "internal-code-sku-optional": "Internal code (SKU) (optional)"
      },
      "placeholder": {
        "0": "0",
        "select-a-category": "Select a category"
      }
    }
  }
} as const;

export default locale;
