import type { enOnboarding } from "../en/onboarding.ts"

export const csOnboarding = {
  "accountRestore.action.addRelay": "Přidat synchronizační server",
  "accountRestore.action.otherPhrase": "Použít jinou obnovovací frázi",
  "accountRestore.action.retry": "Zkusit znovu",
  "accountRestore.action.setupNew": "Nastavit tento účet jako nový",
  "accountRestore.description":
    "Čekáme na synchronizaci dat účtu. Obvykle to trvá pár sekund.",
  "accountRestore.empty.description":
    "Všechny synchronizační servery dokončily synchronizaci, ale žádný z nich nemá data pro tuto obnovovací frázi. Data mohou být na serveru, který v seznamu není, nebo fráze patří k jinému účtu.",
  "accountRestore.empty.title": "Data účtu nenalezena",
  "accountRestore.failed.description":
    "S některými synchronizačními servery se nepodařilo synchronizovat, takže data účtu mohou existovat, jen zatím nedorazila. Zkontrolujte seznam a zkuste to znovu.",
  "accountRestore.failed.offline":
    "Zařízení je offline. Připojte se k internetu a zkuste to znovu.",
  "accountRestore.failed.title": "Účet se nepodařilo synchronizovat",
  "accountRestore.relays.title": "Synchronizační servery",
  "accountRestore.setupNew.confirm.cancel": "Zpět",
  "accountRestore.setupNew.confirm.confirm": "Nastavit jako nový",
  "accountRestore.setupNew.confirm.description":
    "Nedostupné synchronizační servery mohou data tohoto účtu stále mít. Pokud se později synchronizují, nastavení, které zvolíte teď, je přepíše.",
  "accountRestore.setupNew.confirm.title": "Nastavit bez dat účtu?",
  "accountRestore.syncing": "Synchronizace dat účtu…",
  "accountRestore.title": "Obnovování účtu",
  "accountTransfer.cancel": "Zrušit",
  "accountTransfer.close": "Zavřít",
  "accountTransfer.done": "Hotovo",
  "accountTransfer.settings.source.description":
    "Otevřete tento účet na telefonu nebo jiném počítači bez obnovovací fráze. Najdete to v Nastavení → Přístup, vedle oprávnění zařízení.",
  "accountTransfer.settings.source.title": "Přidat zařízení k tomuto účtu",
  "accountTransfer.source.code.confirm": "Potvrdit a přenést",
  "accountTransfer.source.code.connected": "Připojilo se zařízení.",
  "accountTransfer.source.code.instructions":
    "Opište šestimístný kód, který teď vidíte na novém zařízení.",
  "accountTransfer.source.code.label": "Kód z nového zařízení",
  "accountTransfer.source.code.mismatch":
    "Kód nesouhlasí. Zkontrolujte ho a zkuste to znovu. Zbývající pokusy: {count}.",
  "accountTransfer.source.code.warning":
    "Opisujte ho jen z displeje zařízení, které držíte v ruce. Pokud vám kód někdo diktuje, přenos zrušte.",
  "accountTransfer.source.done.acked":
    "Nové zařízení účet přijalo. Dokončete přenos na novém zařízení. Na tomto zařízení se nic nemění.",
  "accountTransfer.source.done.sent":
    "Odesláno. Dokončete přenos na novém zařízení.",
  "accountTransfer.source.done.title": "Účet odeslán",
  "accountTransfer.source.failed.cancelled":
    "Přenos byl zrušen na novém zařízení.",
  "accountTransfer.source.failed.codeMismatch": "Kód třikrát nesouhlasil.",
  "accountTransfer.source.failed.conflict":
    "Na kód odpovědělo víc zařízení, a proto byl přenos z bezpečnostních důvodů zastaven. Pokud to druhé nebylo vaše, mohl někdo vidět vaši obrazovku.",
  "accountTransfer.source.failed.network":
    "Nepodařilo se spojit s přenosovým serverem. Zkontrolujte připojení k internetu.",
  "accountTransfer.source.failed.nothingSent": "Nic nebylo odesláno.",
  "accountTransfer.source.failed.timeout":
    "Nové zařízení nestihlo přenos dokončit.",
  "accountTransfer.source.failed.title": "Přenos zastaven",
  "accountTransfer.source.permissions":
    "Nové zařízení začne bez oprávnění. Nastavte mu je v Nastavení → Přístup, jakmile se tam objeví.",
  "accountTransfer.source.qr.expired": "Platnost kódu vypršela.",
  "accountTransfer.source.qr.instructions":
    "Na novém zařízení otevřete {appName}, zvolte „Přenést z jiného zařízení“ a naskenujte tento kód.",
  "accountTransfer.source.qr.label": "QR kód pro nové zařízení",
  "accountTransfer.source.qr.reassurance":
    "Kód platí dvě minuty a jen pro jedno zařízení.",
  "accountTransfer.source.qr.renew": "Vytvořit nový kód",
  "accountTransfer.source.qr.validFor": "Platí ještě {time}",
  "accountTransfer.source.qr.waiting": "Čekám na nové zařízení…",
  "accountTransfer.source.sending": "Odesílám účet…",
  "accountTransfer.source.start": "Zobrazit QR kód",
  "accountTransfer.source.startAgain": "Začít znovu",
  "accountTransfer.source.step.code": "Kód z nového zařízení opíšete sem.",
  "accountTransfer.source.step.scan": "Novým zařízením naskenujete QR kód.",
  "accountTransfer.source.step.transfer": "Účet se šifrovaně přenese.",
  "accountTransfer.source.title": "Přidat zařízení",
  "accountTransfer.source.warning.description":
    "Nové zařízení získá plný přístup k účtu včetně peněz v bitcoinové peněžence. Pokračujte jen se zařízením, které máte u sebe. Podpora {appNameGen} vás o to nikdy nežádá.",
  "accountTransfer.source.warning.title": "Plný přístup k účtu",
  "accountTransfer.target.added":
    "Účet „{name}“ byl přidán do tohoto zařízení a je nyní aktivní. Načítám data…",
  "accountTransfer.target.alreadyAdded":
    "Tento účet už na zařízení byl; nyní je aktivní.",
  "accountTransfer.target.code.instructions":
    "Opište tento kód na původním zařízení.",
  "accountTransfer.target.code.waiting": "Čekám na potvrzení…",
  "accountTransfer.target.code.warning":
    "Kód potvrzuje, že se účet přenáší právě do tohoto zařízení. Nikomu ho nesdělujte.",
  "accountTransfer.target.confirm.cancel": "Zrušit",
  "accountTransfer.target.confirm.confirm": "Přidat a přepnout",
  "accountTransfer.target.confirm.description":
    "Přidat účet „{name}“ do tohoto zařízení a přepnout na něj? Přijaté platby pak půjdou na tento účet.",
  "accountTransfer.target.confirm.title": "Přidat účet „{name}“?",
  "accountTransfer.target.connecting": "Připojuji se k původnímu zařízení…",
  "accountTransfer.target.description":
    "Naskenujte QR kód na zařízení, kde už {appName} používáte.",
  "accountTransfer.target.error.InvalidPaykyUri":
    "Kód je poškozený. Vytvořte nový.",
  "accountTransfer.target.error.NotPaykyUri": "Tohle není kód {appNameGen}.",
  "accountTransfer.target.error.UnknownPaykyUriType":
    "Tento kód {appNameGen} slouží k něčemu jinému, nebo je z novější verze. Aktualizujte aplikaci.",
  "accountTransfer.target.error.UnsupportedPaykyUriVersion":
    "Kód vytvořila novější verze {appNameGen}. Aktualizujte aplikaci.",
  "accountTransfer.target.error.WrongPaykyUriType":
    "Tento kód {appNameGen} slouží k něčemu jinému.",
  "accountTransfer.target.failed.cancelled":
    "Přenos byl zrušen na původním zařízení.",
  "accountTransfer.target.failed.codeMismatch":
    "Kód byl na původním zařízení třikrát opsán špatně.",
  "accountTransfer.target.failed.conflict":
    "Na kód odpovědělo víc zařízení, a proto byl přenos z bezpečnostních důvodů zastaven.",
  "accountTransfer.target.failed.invalid":
    "Původní zařízení poslalo data, která tu nelze použít. Nic nebylo přidáno.",
  "accountTransfer.target.failed.network":
    "Nepodařilo se spojit s přenosovým serverem. Zkontrolujte připojení k internetu.",
  "accountTransfer.target.failed.timeout":
    "Původní zařízení nestihlo přenos dokončit.",
  "accountTransfer.target.failed.title": "Přenos zastaven",
  "accountTransfer.target.fallback":
    "Nejde to naskenovat? Obnovte účet obnovovací frází.",
  "accountTransfer.target.instructions":
    "Na zařízení, kde účet máte, otevřete Nastavení → Přístup → Přidat zařízení a naskenujte zobrazený QR kód.",
  "accountTransfer.target.scanAgain": "Skenovat znovu",
  "accountTransfer.target.title": "Přenést z jiného zařízení",
  "accountTransfer.target.warning.description":
    "Skenujte jen kód z vlastního zařízení, které máte právě před sebou. Kód od někoho jiného by sem přidal jeho účet a přijaté platby by šly jemu.",
  "accountTransfer.target.warning.title": "Jen vlastní zařízení",
  "onboarding.accountChoice.description":
    "Založte nový účet nebo otevřete ten, který už používáte.",
  "accountChoice.new.description":
    "Vygenerujte novou recovery phrase a začněte s prázdným účtem.",
  "accountChoice.new.title": "Založit nový účet",
  "accountChoice.restore.description":
    "Pomocí 20 slov z {appNameGen} otevřete data svého existujícího účtu.",
  "accountChoice.restore.title": "Obnovit existující účet",
  "accountChoice.transfer.description":
    "Naskenujte QR kód na zařízení, kde už {appName} používáte.",
  "accountChoice.transfer.title": "Přenést z jiného zařízení",
  "onboarding.back": "Zpět",
  "onboarding.alreadyOnboarded": "Tento účet už je nastavený.",
  "onboarding.cancelSetup": "Zrušit vytváření účtu",
  "onboarding.cancelSetup.confirm.cancel": "Pokračovat v nastavení",
  "onboarding.cancelSetup.confirm.confirm": "Zrušit vytváření účtu",
  "onboarding.cancelSetup.confirm.description":
    "Tento nový účet bude zahozen a přepnete se zpět na {name}.",
  "onboarding.cancelSetup.confirm.title": "Zrušit vytváření účtu?",
  "onboarding.finishWithoutBankTransfer": "Začít bez bankovních převodů",
  "onboarding.businessName.placeholder": "Kavárna U Lípy",
  "onboarding.businessName.label": "Název podniku (volitelné)",
  "onboarding.businessName.description":
    "Veřejný název vašeho profilu, který se bude zobrazovat jako příjemce bankovních plateb.",
  "onboarding.businessName.publishFailed.title":
    "Název se nepodařilo zveřejnit",
  "onboarding.businessName.publishFailed.description":
    "Formulář zůstal vyplněný. Zkuste to znovu nebo pokračujte bez zveřejnění názvu.",
  "onboarding.businessName.retry": "Zkusit znovu",
  "onboarding.businessName.continueWithoutPublishing":
    "Pokračovat bez zveřejnění názvu",
  "onboarding.finish": "Začít používat {appName}",
  "onboarding.language.title": "Výběr jazyka",
  "onboarding.payments.description": "Vše můžete kdykoliv změnit v nastavení.",
  "onboarding.payments.iban.description":
    "Zadejte číslo účtu nebo IBAN pro příjem plateb pomocí QR kódu.",
  "onboarding.payments.iban.title": "Bankovní účet (volitelné)",
  "onboarding.payments.title": "Nastavení podniku",
  "onboarding.restore.action": "Obnovit účet",
  "onboarding.restore.counter": "{count}/{total} slov",
  "onboarding.restore.description": "Zadejte 20 slov z {appNameGen}",
  "onboarding.restore.paste": "Vložit ze schránky",
  "onboarding.restore.pasteFailed":
    "Schránku se nepodařilo přečíst. Vložte frázi přímo do prvního políčka.",
  "onboarding.restore.showWords": "Zobrazit slova",
  "onboarding.restore.subtitle":
    "Fráze ze Settings → Security. Seed z jiné peněženky (Spark, Trezor, 12 nebo 24 slov) tady nefunguje.",
  "onboarding.restore.suggestions": "Návrhy slov",
  "onboarding.restore.title": "Obnovení existujícího účtu",
  "onboarding.restore.transferLink":
    "Máte {appName} na jiném zařízení? Přenést naskenováním QR",
  "onboarding.restore.unknownWords": "Neznámé slovo: {words}",
  "onboarding.restore.wordLabel": "Slovo {index}",
  "onboarding.title": "{appName} vás vítá",
} satisfies Record<keyof typeof enOnboarding, string>
