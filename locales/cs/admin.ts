const locale = {
  "layout": {
    "title": {
      "dashboard": "Přehled",
      "payments": "Platby",
      "pointOfSale": "Pokladna",
      "invoices": "Faktury",
      "items": "Položky",
      "categories": "Kategorie",
      "tables": "Stoly",
      "reservations": "Rezervace",
      "clients": "Klienti",
      "accounts": "Účty",
      "settings": "Nastavení",
      "debug": "Debug"
    }
  },
  "dashboard": {
    "applicationInformation": "Informace o aplikaci",
    "home": {
      "subtitle": "Decentralizovaná platební platforma a pokladní systém",
      "status": {
        "underDevelopment": "ve vývoji",
        "planned": "plánováno"
      },
      "cards": {
        "payments": {
          "title": "Platby",
          "description": "Vytvářejte jednorázové platby, které lze zaplatit i bez vaší online přítomnosti."
        },
        "pos": {
          "title": "Pokladní systém",
          "description": "Mějte přehled o otevřených účtech a zpracovávejte platby. Robustní řešení pro malé obchody, bistra, kavárny apod."
        },
        "invoicing": {
          "title": "Fakturace",
          "description": "Vystavujte faktury svým zákazníkům pohodlně a bezpečně. Nezanechávejte data o sobě ani zákaznících na veřejných cloudech."
        },
        "itemManagement": {
          "title": "Správa položek",
          "description": "Neztrácejte čas opakovaným zadáváním položek při vytváření plateb. Připravte si prodejní položky předem."
        },
        "orderPayments": {
          "description": "Přijímejte platby od zákazníků podle vybraných položek. Ideální řešení pro prodejní stánky."
        },
        "paymentWidgetsPaywalls": {
          "description": "Integrujte platební prvky přímo do webu. Může jít o tlačítka i uzamčené sekce dostupné po zaplacení."
        },
        "reservations": {
          "description": "Využijte kapacitu svého podniku naplno. Nabídněte zákazníkům rezervaci online i telefonicky."
        }
      }
    },
    "nostrRelays": "Nostr relé",
    "nostrUnpublishedEvents": "Nostr Nepublikované události",
    "orderPayments": "Platby objednávek",
    "paymentWidgetsPaywalls": "Platební widgety a Paywally",
    "randomDataGenerator": "Generátor náhodných dat",
    "reservations": "Rezervace",
    "sqliteData": "data SQLite",
    "storageData": "Data úložiště"
  },
  "debug": {
    "application": {
      "version": "Verze",
      "unknown": "neznámé"
    },
    "common": {
      "download": "Stáhnout",
      "import": "Importovat",
      "generate": "Generovat"
    },
    "sqlite": {
      "explorerTitle": "Průzkumník SQLite"
    },
    "storage": {
      "import": {
        "noCsvInArchive": "V nahraném ZIP archivu nebyly nalezeny žádné CSV soubory.",
        "success": "Importováno {{importedRows}} řádků z {{importedTables}} tabulek.",
        "failed": "Import se nezdařil.",
        "failedWithReason": "Import se nezdařil: {{message}}"
      }
    },
    "exportWarning": "Pozor. Export dat může obsahovat citlivé informace, včetně přístupů k peněženkovým účtům a dalších údajů."
  }
} as const;

export default locale;
