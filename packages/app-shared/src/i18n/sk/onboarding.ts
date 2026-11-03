import type { enOnboarding } from "../en/onboarding.ts"

export const skOnboarding = {
  "accountRestore.action.addRelay": "Pridať synchronizačný server",
  "accountRestore.action.otherPhrase": "Použiť inú obnovovaciu frázu",
  "accountRestore.action.retry": "Skúsiť znova",
  "accountRestore.action.setupNew": "Nastaviť tento účet ako nový",
  "accountRestore.description":
    "Čakáme na synchronizáciu údajov účtu. Zvyčajne to trvá pár sekúnd.",
  "accountRestore.empty.description":
    "Všetky synchronizačné servery dokončili synchronizáciu, ale žiadny z nich nemá údaje pre túto obnovovaciu frázu. Údaje môžu byť na serveri, ktorý v zozname nie je, alebo fráza patrí k inému účtu.",
  "accountRestore.empty.title": "Údaje účtu sa nenašli",
  "accountRestore.failed.description":
    "S niektorými synchronizačnými servermi sa nepodarilo synchronizovať, takže údaje účtu môžu existovať, len zatiaľ nedorazili. Skontrolujte zoznam a skúste to znova.",
  "accountRestore.failed.offline":
    "Zariadenie je offline. Pripojte sa na internet a skúste to znova.",
  "accountRestore.failed.title": "Účet sa nepodarilo synchronizovať",
  "accountRestore.relays.title": "Synchronizačné servery",
  "accountRestore.setupNew.confirm.cancel": "Späť",
  "accountRestore.setupNew.confirm.confirm": "Nastaviť ako nový",
  "accountRestore.setupNew.confirm.description":
    "Nedostupné synchronizačné servery môžu údaje tohto účtu stále mať. Ak sa neskôr synchronizujú, nastavenia, ktoré zvolíte teraz, ich prepíšu.",
  "accountRestore.setupNew.confirm.title": "Nastaviť bez údajov účtu?",
  "accountRestore.syncing": "Synchronizácia údajov účtu…",
  "accountRestore.title": "Obnovovanie účtu",
  "accountTransfer.cancel": "Zrušiť",
  "accountTransfer.close": "Zavrieť",
  "accountTransfer.done": "Hotovo",
  "accountTransfer.settings.source.description":
    "Otvorte tento účet na telefóne alebo inom počítači bez obnovovacej frázy. Nájdete to v Nastavenia → Prístup, vedľa oprávnení zariadení.",
  "accountTransfer.settings.source.title": "Pridať zariadenie k tomuto účtu",
  "accountTransfer.source.code.confirm": "Potvrdiť a preniesť",
  "accountTransfer.source.code.connected": "Pripojilo sa zariadenie.",
  "accountTransfer.source.code.instructions":
    "Opíšte šesťmiestny kód, ktorý teraz vidíte na novom zariadení.",
  "accountTransfer.source.code.label": "Kód z nového zariadenia",
  "accountTransfer.source.code.mismatch":
    "Kód nesedí. Skontrolujte ho a skúste to znova. Zostávajúce pokusy: {count}.",
  "accountTransfer.source.code.warning":
    "Opisujte ho len z displeja zariadenia, ktoré držíte v ruke. Ak vám kód niekto diktuje, prenos zrušte.",
  "accountTransfer.source.done.acked":
    "Nové zariadenie účet prijalo. Dokončite prenos na novom zariadení. Na tomto zariadení sa nič nemení.",
  "accountTransfer.source.done.sent":
    "Odoslané. Dokončite prenos na novom zariadení.",
  "accountTransfer.source.done.title": "Účet odoslaný",
  "accountTransfer.source.failed.cancelled":
    "Prenos bol zrušený na novom zariadení.",
  "accountTransfer.source.failed.codeMismatch": "Kód trikrát nesedel.",
  "accountTransfer.source.failed.conflict":
    "Na kód odpovedalo viac zariadení, a preto bol prenos z bezpečnostných dôvodov zastavený. Ak to druhé nebolo vaše, mohol niekto vidieť vašu obrazovku.",
  "accountTransfer.source.failed.network":
    "Nepodarilo sa spojiť s prenosovým serverom. Skontrolujte pripojenie na internet.",
  "accountTransfer.source.failed.nothingSent": "Nič nebolo odoslané.",
  "accountTransfer.source.failed.timeout":
    "Nové zariadenie nestihlo prenos dokončiť.",
  "accountTransfer.source.failed.title": "Prenos zastavený",
  "accountTransfer.source.permissions":
    "Nové zariadenie začne bez oprávnení. Nastavte mu ich v Nastavenia → Prístup, keď sa tam objaví.",
  "accountTransfer.source.qr.expired": "Platnosť kódu vypršala.",
  "accountTransfer.source.qr.instructions":
    "Na novom zariadení otvorte {appName}, zvoľte „Preniesť z iného zariadenia“ a naskenujte tento kód.",
  "accountTransfer.source.qr.label": "QR kód pre nové zariadenie",
  "accountTransfer.source.qr.reassurance":
    "Kód platí dve minúty a len pre jedno zariadenie.",
  "accountTransfer.source.qr.renew": "Vytvoriť nový kód",
  "accountTransfer.source.qr.validFor": "Platí ešte {time}",
  "accountTransfer.source.qr.waiting": "Čakám na nové zariadenie…",
  "accountTransfer.source.sending": "Odosielam účet…",
  "accountTransfer.source.start": "Zobraziť QR kód",
  "accountTransfer.source.startAgain": "Začať znova",
  "accountTransfer.source.step.code": "Kód z nového zariadenia opíšete sem.",
  "accountTransfer.source.step.scan": "Novým zariadením naskenujete QR kód.",
  "accountTransfer.source.step.transfer": "Účet sa šifrovane prenesie.",
  "accountTransfer.source.title": "Pridať zariadenie",
  "accountTransfer.source.warning.description":
    "Nové zariadenie získa plný prístup k účtu vrátane peňazí v bitcoinovej peňaženke. Pokračujte len so zariadením, ktoré máte pri sebe. Podpora {appNameGen} vás o to nikdy nežiada.",
  "accountTransfer.source.warning.title": "Plný prístup k účtu",
  "accountTransfer.target.added":
    "Účet „{name}“ bol pridaný do tohto zariadenia a je teraz aktívny. Načítavam dáta…",
  "accountTransfer.target.alreadyAdded":
    "Tento účet už na zariadení bol; teraz je aktívny.",
  "accountTransfer.target.code.instructions":
    "Opíšte tento kód na pôvodnom zariadení.",
  "accountTransfer.target.code.waiting": "Čakám na potvrdenie…",
  "accountTransfer.target.code.warning":
    "Kód potvrdzuje, že sa účet prenáša práve do tohto zariadenia. Nikomu ho neprezrádzajte.",
  "accountTransfer.target.confirm.cancel": "Zrušiť",
  "accountTransfer.target.confirm.confirm": "Pridať a prepnúť",
  "accountTransfer.target.confirm.description":
    "Pridať účet „{name}“ do tohto zariadenia a prepnúť naň? Prijaté platby potom pôjdu na tento účet.",
  "accountTransfer.target.confirm.title": "Pridať účet „{name}“?",
  "accountTransfer.target.connecting": "Pripájam sa k pôvodnému zariadeniu…",
  "accountTransfer.target.description":
    "Naskenujte QR kód na zariadení, kde už {appName} používate.",
  "accountTransfer.target.error.InvalidPaykyUri":
    "Kód je poškodený. Vytvorte nový.",
  "accountTransfer.target.error.NotPaykyUri": "Toto nie je kód {appNameGen}.",
  "accountTransfer.target.error.UnknownPaykyUriType":
    "Tento kód {appNameGen} slúži na niečo iné, alebo je z novšej verzie. Aktualizujte aplikáciu.",
  "accountTransfer.target.error.UnsupportedPaykyUriVersion":
    "Kód vytvorila novšia verzia {appNameGen}. Aktualizujte aplikáciu.",
  "accountTransfer.target.error.WrongPaykyUriType":
    "Tento kód {appNameGen} slúži na niečo iné.",
  "accountTransfer.target.failed.cancelled":
    "Prenos bol zrušený na pôvodnom zariadení.",
  "accountTransfer.target.failed.codeMismatch":
    "Kód bol na pôvodnom zariadení trikrát opísaný nesprávne.",
  "accountTransfer.target.failed.conflict":
    "Na kód odpovedalo viac zariadení, a preto bol prenos z bezpečnostných dôvodov zastavený.",
  "accountTransfer.target.failed.invalid":
    "Pôvodné zariadenie poslalo dáta, ktoré tu nemožno použiť. Nič nebolo pridané.",
  "accountTransfer.target.failed.network":
    "Nepodarilo sa spojiť s prenosovým serverom. Skontrolujte pripojenie na internet.",
  "accountTransfer.target.failed.timeout":
    "Pôvodné zariadenie nestihlo prenos dokončiť.",
  "accountTransfer.target.failed.title": "Prenos zastavený",
  "accountTransfer.target.fallback":
    "Nedá sa to naskenovať? Obnovte účet obnovovacou frázou.",
  "accountTransfer.target.instructions":
    "Na zariadení, kde účet máte, otvorte Nastavenia → Prístup → Pridať zariadenie a naskenujte zobrazený QR kód.",
  "accountTransfer.target.scanAgain": "Skenovať znova",
  "accountTransfer.target.title": "Preniesť z iného zariadenia",
  "accountTransfer.target.warning.description":
    "Skenujte len kód z vlastného zariadenia, ktoré máte práve pred sebou. Kód od niekoho iného by sem pridal jeho účet a prijaté platby by išli jemu.",
  "accountTransfer.target.warning.title": "Len vlastné zariadenie",
  "onboarding.accountChoice.description":
    "Vytvorte nový účet alebo otvorte ten, ktorý už používate.",
  "accountChoice.new.description":
    "Vygenerujte novú recovery phrase a začnite s prázdnym účtom.",
  "accountChoice.new.title": "Vytvoriť nový účet",
  "accountChoice.restore.description":
    "Pomocou 20 slov z {appNameGen} otvorte dáta svojho existujúceho účtu.",
  "accountChoice.restore.title": "Obnoviť existujúci účet",
  "accountChoice.transfer.description":
    "Naskenujte QR kód na zariadení, kde už {appName} používate.",
  "accountChoice.transfer.title": "Preniesť z iného zariadenia",
  "onboarding.back": "Späť",
  "onboarding.alreadyOnboarded": "Tento účet je už nastavený.",
  "onboarding.cancelSetup": "Zrušiť vytváranie účtu",
  "onboarding.cancelSetup.confirm.cancel": "Pokračovať v nastavení",
  "onboarding.cancelSetup.confirm.confirm": "Zrušiť vytváranie účtu",
  "onboarding.cancelSetup.confirm.description":
    "Tento nový účet bude zahodený a prepnete sa späť na {name}.",
  "onboarding.cancelSetup.confirm.title": "Zrušiť vytváranie účtu?",
  "onboarding.finishWithoutBankTransfer": "Začať bez bankových prevodov",
  "onboarding.businessName.placeholder": "Kaviareň U Lipy",
  "onboarding.businessName.label": "Názov podniku (voliteľné)",
  "onboarding.businessName.description":
    "Verejný názov vášho profilu, ktorý sa bude zobrazovať ako príjemca bankových platieb.",
  "onboarding.businessName.publishFailed.title":
    "Názov sa nepodarilo zverejniť",
  "onboarding.businessName.publishFailed.description":
    "Formulár zostal vyplnený. Skúste to znova alebo pokračujte bez zverejnenia názvu.",
  "onboarding.businessName.retry": "Skúsiť znova",
  "onboarding.businessName.continueWithoutPublishing":
    "Pokračovať bez zverejnenia názvu",
  "onboarding.finish": "Začať používať {appName}",
  "onboarding.language.title": "Výber jazyka",
  "onboarding.payments.description":
    "Všetko môžete kedykoľvek zmeniť v nastaveniach.",
  "onboarding.payments.iban.description":
    "Zadajte číslo účtu alebo IBAN na prijímanie platieb pomocou QR kódu.",
  "onboarding.payments.iban.title": "Bankový účet (voliteľné)",
  "onboarding.payments.title": "Nastavenie podniku",
  "onboarding.restore.action": "Obnoviť účet",
  "onboarding.restore.counter": "{count}/{total} slov",
  "onboarding.restore.description": "Zadajte 20 slov z {appNameGen}",
  "onboarding.restore.paste": "Vložiť zo schránky",
  "onboarding.restore.pasteFailed":
    "Schránku sa nepodarilo prečítať. Vložte frázu priamo do prvého políčka.",
  "onboarding.restore.showWords": "Zobraziť slová",
  "onboarding.restore.subtitle":
    "Fráza zo Settings → Security. Seed z inej peňaženky (Spark, Trezor, 12 alebo 24 slov) tu nefunguje.",
  "onboarding.restore.suggestions": "Návrhy slov",
  "onboarding.restore.title": "Obnovenie existujúceho účtu",
  "onboarding.restore.transferLink":
    "Máte {appName} na inom zariadení? Preniesť naskenovaním QR",
  "onboarding.restore.unknownWords": "Neznáme slovo: {words}",
  "onboarding.restore.wordLabel": "Slovo {index}",
  "onboarding.setup.account.label": "Číslo účtu",
  "onboarding.setup.account.placeholder": "2000145399/0800",
  "onboarding.setup.name.hint": "Zákazník ho uvidí ako meno príjemcu platby.",
  "onboarding.setup.name.label": "Názov podniku",
  "onboarding.setup.title": "Založiť podnik",
  "onboarding.title": "{appName} vás víta",
  "onboarding.welcome.new": "Nový podnik",
  "onboarding.welcome.restore": "Obnoviť existujúci",
  "onboarding.welcome.tagline":
    "Platobný terminál pre QR platby bankou, kartou aj bitcoinom.",
} satisfies Record<keyof typeof enOnboarding, string>
