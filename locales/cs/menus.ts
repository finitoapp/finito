const locale = {
  "page": {
    "newMenu": "Nová nabídka",
    "editMenu": "Upravit nabídku",
    "menuDetail": "Detail nabídky"
  },
  "table": {
    "menus": "Nabídky",
    "listOfMenus": "Seznam menu nabídek",
    "actions": {
      "new-menu": "Nová nabídka"
    },
    "columns": {
      "name": "Název",
      "status": "Stav",
      "publishedAt": "Publikováno od",
      "visible": "Veřejně viditelné"
    },
    "search": {
      "placeholder": {
        "by-name": "Hledat podle názvu..."
      }
    }
  },
  "form": {
    "fields": {
      "name": "Název",
      "status": "Stav",
      "validFrom": "Platné od",
      "validTo": "Platné do",
      "publishedAt": "Publikováno od",
      "availabilityStatus": "Dostupnost"
    },
    "availabilityStatus": {
      "available": "Dostupné",
      "soldOut": "Vyprodané",
      "hidden": "Skryté"
    },
    "sections": {
      "categories": "Kategorie",
      "items": "Položky"
    },
    "actions": {
      "addCategory": "Přidat kategorii",
      "addItem": "Přidat položku",
      "save": "Uložit nabídku"
    },
    "placeholder": {
      "categoryName": "Název kategorie",
      "selectItem": "Vyberte položku"
    }
  },
  "status": {
    "draft": "Koncept",
    "published": "Publikováno"
  },
  "detail": {
    "actions": {
      "downloadPdf": "Stáhnout PDF",
      "downloadingPdf": "Generuji PDF...",
      "publish": "Publikovat",
      "moveToDraft": "Přesunout do konceptu",
      "duplicate": "Duplikovat",
      "edit": "Upravit",
      "delete": "Smazat"
    },
    "stats": {
      "categories": "Kategorie",
      "items": "Položky",
      "visibility": "Viditelnost"
    }
  },
  "pdf": {
    "validity": "Platnost"
  },
  "common": {
    "yes": "Ano",
    "no": "Ne",
    "always": "Neustále",
    "never": "Nikdy",
    "none": "-"
  }
} as const;

export default locale;
