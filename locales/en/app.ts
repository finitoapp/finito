const locale = {
  "error": {
    "generic": {
      "title": "Something went wrong!",
      "description": "Try the action again. If the problem persists, reload the app or come back later."
    },
    "sharedWorkerUnsupported": {
      "title": "This browser is not supported",
      "description": "Finito requires SharedWorker support to run. Open the app in a compatible modern browser."
    }
  },
  "buildUpdate": {
    "available": {
      "title": "A new app version is available",
      "description": "Reload to switch to the latest build.",
      "reload": "Reload",
      "later": "Later"
    }
  },
  "loading": {
    "preparingWorkspace": "Preparing workspace"
  },
  "onboarding": {
    "title": "Account preparation",
    "welcome": "Welcome to",
    "description": "Choose whether to create a new account or restore an existing one from your seed phrase.",
    "options": {
      "new": {
        "title": "Create a new account",
        "description": "Generate a fresh seed phrase and continue with a new empty account."
      },
      "restore": {
        "title": "Restore an existing account",
        "description": "Paste your existing 24-word seed phrase to continue."
      }
    },
    "actions": {
      "back": "Back"
    },
    "restore": {
      "title": "Restore from seed",
      "description": "Paste your 24-word seed phrase.",
      "seedPlaceholder": "Paste your seed phrase here",
      "submit": "Restore account",
      "errors": {
        "wordCount": "Seed phrase must have exactly 24 words.",
        "invalid": "Seed phrase is not valid."
      }
    },
    "new": {
      "title": "Back up your seed phrase",
      "description": "Store this seed phrase safely. You will need it to restore your account.",
      "settings": {
        "title": "Basic setup",
        "description": "Set your account name, default currency, and timezone.",
        "submit": "Create account"
      },
      "security": {
        "intro": "Your seed phrase is the only key to your account and funds.",
        "recoveryNote": "Use this phrase to recover your account on a new device or after losing access.",
        "rules": {
          "neverShare": "Never share or send your seed phrase to anyone.",
          "storeOffline": "Do not store it in screenshots, cloud notes, or chat apps. Prefer paper backup or a trusted offline password manager.",
          "keepWordOrder": "Write down all 24 words in the exact order.",
          "makeBackupCopy": "Keep at least one secure backup copy in a separate location."
        }
      },
      "backupConfirmation": "I have safely backed up this seed phrase.",
      "submit": "Continue"
    }
  }
} as const;

export default locale;
