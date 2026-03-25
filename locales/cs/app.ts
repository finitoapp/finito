const locale = {
  "error": {
    "generic": "Něco se pokazilo!"
  },
  "buildUpdate": {
    "available": {
      "title": "Je dostupná nová verze aplikace",
      "description": "Pro přechod na nejnovější build aplikaci obnovte.",
      "reload": "Obnovit",
      "later": "Později"
    }
  },
  "loading": {
    "preparingWorkspace": "Příprava pracovního prostoru"
  },
  "onboarding": {
    "title": "Nastavení účtu",
    "description": "Vyberte, jestli chcete založit nový účet, nebo obnovit existující pomocí seed fráze.",
    "options": {
      "new": {
        "title": "Založit nový účet",
        "description": "Vygeneruje se nový seed a budete pokračovat s prázdným účtem."
      },
      "restore": {
        "title": "Obnovit existující účet",
        "description": "Vložte svou existující 24slovnou seed frázi."
      }
    },
    "actions": {
      "back": "Zpět"
    },
    "restore": {
      "title": "Obnova ze seedu",
      "description": "Vložte svou 24slovnou seed frázi.",
      "seedPlaceholder": "Vložte seed frázi",
      "submit": "Obnovit účet",
      "errors": {
        "wordCount": "Seed fráze musí mít přesně 24 slov.",
        "invalid": "Seed fráze není platná."
      }
    },
    "new": {
      "title": "Zazálohujte seed frázi",
      "description": "Uložte seed frázi na bezpečné místo. Budete ji potřebovat pro obnovu účtu.",
      "security": {
        "intro": "Seed fráze je jediný klíč k vašemu účtu a prostředkům.",
        "recoveryNote": "Pomocí této fráze obnovíte účet na jiném zařízení nebo po ztrátě přístupu.",
        "rules": {
          "neverShare": "Seed nikdy nikomu neposílejte ani nesdílejte.",
          "storeOffline": "Neukládejte seed do screenshotů, cloudu ani chatu. Ideálně ho napište na papír nebo uložte do důvěryhodného offline password manageru.",
          "keepWordOrder": "Zapište všech 24 slov přesně ve správném pořadí.",
          "makeBackupCopy": "Mějte alespoň jednu bezpečnou záložní kopii na jiném místě."
        }
      },
      "backupConfirmation": "Seed frázi jsem si bezpečně zazálohoval(a).",
      "submit": "Pokračovat"
    }
  }
} as const;

export default locale;
