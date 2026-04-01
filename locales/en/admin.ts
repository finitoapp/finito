const locale = {
  "layout": {
    "title": {
      "dashboard": "Dashboard",
      "payments": "Payments",
      "pointOfSale": "Point of Sale",
      "invoices": "Invoices",
      "catalog": "Catalog",
      "items": "Items",
      "aiAssistant": "AI Assistant",
      "menus": "Menus",
      "categories": "Categories",
      "devices": "Devices",
      "venue": "Venue",
      "tables": "Tables",
      "reservations": "Reservations",
      "clients": "Clients",
      "contacts": "Contacts",
      "accounts": "Accounts",
      "transactions": "Transactions",
      "settings": "Settings",
      "debug": "Debug"
    }
  },
  "dashboard": {
    "applicationInformation": "Application information",
    "home": {
      "subtitle": "Decentralized payment platform and point of sale system",
      "status": {
        "underDevelopment": "under development",
        "planned": "planned"
      },
      "cards": {
        "payments": {
          "title": "Payments",
          "description": "Create one-time payments that can be made without having to be online."
        },
        "pos": {
          "title": "Point of sale system",
          "description": "Keep track of open bills and process payments. This is a robust solution for small shops, bistros, cafes, etc."
        },
        "invoicing": {
          "title": "Invoicing",
          "description": "Issue invoices to your customers conveniently and yet securely. Leave no trace of yourself or your customers on public clouds."
        },
        "itemManagement": {
          "title": "Item management",
          "description": "Don't waste time entering items over and over again while creating payments. Specify your sales items in advance."
        },
        "menuManagement": {
          "title": "Menu management",
          "description": "Create and manage lunch and permanent menus. Build menu offers from existing items and keep them ready for publishing."
        },
        "orderPayments": {
          "description": "Accept money from customers based on their selection of items. It's an ideal solution for sales stands."
        },
        "paymentWidgetsPaywalls": {
          "description": "Integrate payment elements directly into your website. It can be both payment buttons and locked sections hidden behind a payment wall."
        },
        "reservations": {
          "description": "Utilize the full capacity of your venue. Offer your customers the option of booking a place either online or by phone."
        }
      }
    },
    "nostrRelays": "Nostr Relays",
    "nostrUnpublishedEvents": "Nostr Unpublished events",
    "orderPayments": "Order payments",
    "paymentWidgetsPaywalls": "Payment widgets & Paywalls",
    "randomDataGenerator": "Random data generator",
    "reservations": "Reservations",
    "sqliteData": "SQLite data",
    "storageData": "Storage data"
  },
  "debug": {
    "application": {
      "version": "Version",
      "unknown": "unknown"
    },
    "common": {
      "download": "Download",
      "import": "Import",
      "generate": "Generate"
    },
    "sqlite": {
      "explorerTitle": "SQLite explorer"
    },
    "storage": {
      "import": {
        "noCsvInArchive": "No CSV files were found in the uploaded ZIP archive.",
        "success": "Imported {{importedRows}} rows from {{importedTables}} tables.",
        "failed": "Import failed.",
        "failedWithReason": "Import failed: {{message}}"
      }
    },
    "exportWarning": "Be careful. Exporting data may contain sensitive information, including wallet account accesses and more."
  }
} as const;

export default locale;
