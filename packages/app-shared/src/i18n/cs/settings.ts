import type { enSettings } from "../en/settings.ts"

export const csSettings = {
  "settings.about.app.title": "{appName}",
  "settings.about.description": "Verze, podmínky a kontakt",
  "settings.about.github.description": "Zapojte se do vývoje aplikace",
  "settings.about.github.title": "Zdrojový kód na GitHubu",
  "settings.about.privacy.body":
    "{appName} - ZÁSADY OCHRANY SOUKROMÍ\n\n1. SBĚR DAT\n{appName} neprodává osobní údaje a je navrženo tak, aby aplikační data zůstávala lokálně ve vašem zařízení. Aplikace ukládá nastavení terminálu, katalogová data, záznamy plateb a související provozní data lokálně a synchronizuje aplikační data přes Evolu.\n\n2. PLATEBNÍ DATA\nPlatební a terminálová data mohou obsahovat částky, časové údaje, názvy položek, stav platby, informace o Spark peněžence, identifikátory zařízení a další záznamy potřebné pro provoz bitcoinového platebního terminálu. Chraňte své zařízení, přihlašovací údaje, zálohy a přístupová data k peněžence, zejména obnovovací frázi.\n\n3. SÍŤOVÁ KOMUNIKACE\nAplikace může komunikovat s:\n- infrastrukturou Evolu pro synchronizaci lokálních-first aplikačních dat\n- Spark operátory a poskytovateli služeb Spark pro provoz Spark peněženky a odesílání či přijímání bitcoinových plateb\n- Lightning nebo peněženkovými službami používanými k vytvoření nebo vypořádání plateb\n- cenovými nebo kurzovými API, pokud je zapnutý fiat přepočet\n- Open Food Facts a Open Beauty Facts pro dohledání naskenovaných čárových kódů, pokud je zapnuté dohledání produktů\n- Server {appNameGen} a jeho poskytovatele AI pro odpovědi AI asistenta, pokud je zapnutý: vaše dotazy, odpovědi asistenta a, pokud to povolíte, účty a platby, které asistent čte\n\nTyto služby mohou mít vlastní zásady ochrany soukromí, logy a pravidla uchovávání dat.\n\n4. ANALYTIKA A HLÁŠENÍ CHYB\n{appName} nepoužívá analytické ani sledovací služby. K dispozici je volitelné hlášení chyb přes Sentry, které pomáhá diagnostikovat pády a chyby aplikace. Je ve výchozím stavu vypnuté a aktivuje se jen tehdy, když ho zapnete v Nastavení > O aplikaci > Data a soukromí. Po zapnutí mohou hlášení chyb obsahovat informace o zařízení a aplikaci a chybové zprávy a stack trace; obnovovací fráze a čísla bankovních účtů jsou před odesláním automaticky redigovány.\n\n5. SÍŤ SPARK\nPlatby přes Spark peněženku zpracovávají Spark operátoři a poskytovatelé služeb Spark, kteří mohou vidět částky transakcí, časování, identifikátory peněženky a související metadata.\n\n6. ZÁLOHY A SYNCHRONIZACE\nPokud jsou zapnuté synchronizační nebo zálohovací funkce, mohou být aplikační data přenášena do synchronizační infrastruktury. Se synchronizovanými daty zacházejte jako s provozními obchodními daty a chraňte každé zařízení, které k nim má přístup.\n\n7. KONTAKT\nKontaktní údaje pro otázky soukromí budou zveřejněny v dokumentaci projektu.\n\nPoslední aktualizace: říjen 2026",
  "settings.about.privacy.description":
    "Data aplikace se ukládají lokálně a synchronizují přes Evolu.",
  "settings.about.privacy.heading": "Zásady ochrany soukromí {appNameGen}",
  "settings.about.privacy.summary":
    "Přizpůsobeno pro lokální-first bitcoinový platební terminál.",
  "settings.about.privacy.title": "Data a soukromí",
  "settings.about.terms.body":
    '{appName} - PODMÍNKY POUŽÍVÁNÍ\n\n1. PŘIJETÍ\nPoužíváním této aplikace platebního terminálu souhlasíte s těmito podmínkami.\n\n2. POVAHA SLUŽBY\n{appName} je lokální-first bitcoinový platební terminál využívající protokol Spark pro bitcoinové a Lightning platby a související platební infrastrukturu. Odpovídáte za konfiguraci aplikace, výběr služeb i za nakládání s přijatými prostředky.\n\n3. PŘÍSTUP A OBNOVA\nChraňte své zařízení, přihlašovací údaje, zálohy a veškerá přístupová data k peněžence, zejména obnovovací frázi. {appName} nemůže obnovit ztracené přihlašovací údaje, ztracenou obnovovací frázi ani prostředky odeslané na nesprávné cíle.\n\n4. BEZ ZÁRUKY\nSoftware je poskytován "tak, jak je", bez jakékoli záruky. Používáte jej na vlastní riziko.\n\n5. OMEZENÍ ODPOVĚDNOSTI\nNeodpovídáme za ztrátu prostředků, přerušení podnikání, selhání platby, chyby v softwaru, chybu uživatele ani selhání sítě nebo služby třetí strany.\n\n6. SPARK PENĚŽENKA\nSpark peněženka je nekustodiální: její klíče se odvozují ve vašem zařízení z vaší obnovovací fráze. Převody závisí na Spark operátorech a poskytovatelích služeb Spark, kteří mohou selhat, být nedostupní nebo změnit své podmínky. Držte jen zůstatky, o které jste připraveni přijít.\n\n7. SOUKROMÍ\n{appName} je navrženo tak, aby ukládalo aplikační data lokálně a synchronizovalo je přes Evolu. Platby však mohou být zpracovávány přes síť Spark, Lightning služby nebo jinou infrastrukturu třetích stran, které mohou mít vlastní zásady ochrany soukromí a logy.\n\n8. AKTUALIZACE\nTyto podmínky mohou být aktualizovány. Další používání {appNameGen} znamená přijetí aktualizovaných podmínek.\n\nPoslední aktualizace: říjen 2026',
  "settings.about.terms.description":
    "Přečtěte si podmínky platné pro používání {appNameGen}.",
  "settings.about.terms.heading": "Podmínky používání {appNameGen}",
  "settings.about.terms.summary":
    "Přizpůsobeno pro lokální-first bitcoinový platební terminál.",
  "settings.about.terms.title": "Podmínky používání",
  "settings.about.title": "O aplikaci",
  "settings.accountAndSync": "ÚČET A SYNCHRONIZACE",
  "settings.accounts.add.title": "Přidat účet",
  "settings.accounts.elsewhere.title": "Tento účet na jiném zařízení",
  "settings.accounts.create.confirm.cancel": "Zrušit",
  "settings.accounts.create.confirm.confirm": "Vytvořit účet",
  "settings.accounts.create.confirm.description":
    "Přepnete se z účtu {name} a založíte úplně nový účet s vlastní recovery phrase.",
  "settings.accounts.create.confirm.title": "Vytvořit nový účet?",
  "settings.accounts.list.active": "Aktivní",
  "settings.accounts.list.createdAt": "Vytvořeno",
  "settings.accounts.list.empty": "Na tomto zařízení nejsou uložené účty.",
  "settings.accounts.list.remove": "Odebrat",
  "settings.accounts.list.switch": "Přepnout",
  "settings.accounts.list.title": "V tomto zařízení",
  "settings.accounts.nav.description":
    "Vyberte, který uživatelský účet je na tomto zařízení aktivní",
  "settings.accounts.nav.title": "Přepnutí uživatelského účtu",
  "settings.accounts.remove.confirm.cancel": "Ponechat účet",
  "settings.accounts.remove.confirm.confirm": "Odebrat účet",
  "settings.accounts.remove.confirm.description":
    "Zařízení tento účet i jeho data zapomene. Vrátit ho zpět jde jen pomocí jeho recovery phrase — bez ní je vše v účtu nadobro ztracené.",
  "settings.accounts.remove.confirm.title": "Odebrat účet {name}?",
  "settings.accounts.restore.failed":
    "Účet se nepodařilo obnovit. Zkuste to prosím znovu.",
  "settings.accounts.restore.mnemonic.checksum":
    "Slova jsou platná, ale fráze nesedí. Zkontrolujte pořadí a překlepy.",
  "settings.accounts.restore.mnemonic.foreign":
    "Tohle vypadá jako seed z jiné peněženky. {appName} obnovuje jen své 20slovné fráze.",
  "settings.accounts.restore.mnemonic.invalid":
    "Zadejte 20 slov z recovery phrase {appNameGen}.",
  "settings.accounts.restore.mnemonic.label": "Recovery phrase",
  "settings.accounts.restore.mnemonic.required": "Recovery phrase je povinná.",
  "settings.accounts.restore.mnemonic.wordCount": "Recovery phrase má 20 slov.",
  "settings.accounts.title": "Účet aplikace",
  "settings.appVersion": "Verze aplikace:",
  "settings.appVersionCode": "Kód verze:",
  "settings.appearance": "VZHLED A JAZYK",
  "settings.cashRegisterAccount.enabled.label": "Povolit pokladnu",
  "settings.cardSwitchioAccount.enabled.label": "Zapnout platební terminál",
  "settings.qerkoTerminal.advanced": "Další možnosti",
  "settings.qerkoTerminal.code.back": "Zpět",
  "settings.qerkoTerminal.code.confirm": "Potvrdit",
  "settings.qerkoTerminal.code.expired": "Kód vypršel. Vyžádejte si nový.",
  "settings.qerkoTerminal.code.instructions":
    "Zadejte čtyřmístný kód, který Qerko poslalo e-mailem vlastníkovi zadané firmy. Pokud e-mail nedorazil, kontaktujte technickou podporu Qerko.",
  "settings.qerkoTerminal.code.invalid":
    "Kód není správný. Zbývající pokusy: {count}.",
  "settings.qerkoTerminal.code.label": "Potvrzovací kód",
  "settings.qerkoTerminal.code.maxAttempts":
    "Příliš mnoho chybných kódů. Vyžádejte si nový.",
  "settings.qerkoTerminal.code.resend": "Poslat kód znovu",
  "settings.qerkoTerminal.code.resendIn": "Kód můžete poslat znovu za {time}.",
  "settings.qerkoTerminal.code.title": "Zadejte kód",
  "settings.qerkoTerminal.company.country.label": "Země",
  "settings.qerkoTerminal.company.identificationNumber.invalid":
    "Zadejte IČO firmy.",
  "settings.qerkoTerminal.company.identificationNumber.label": "IČO",
  "settings.qerkoTerminal.enabled.label": "Zapnout terminál Qerko",
  "settings.qerkoTerminal.environment.description":
    "Sandbox pracuje s testovacími daty a nestrhává peníze z žádné skutečné karty. Vyberte ho jen pro vyzkoušení propojení.",
  "settings.qerkoTerminal.environment.label": "Prostředí Qerko",
  "settings.qerkoTerminal.environment.production": "Produkce",
  "settings.qerkoTerminal.environment.sandbox": "Sandbox (testování)",
  "settings.qerkoTerminal.error.unreachable":
    "Qerko se nepodařilo zastihnout. Zkontrolujte připojení a zkuste to znovu.",
  "settings.qerkoTerminal.paired.company": "Firma",
  "settings.qerkoTerminal.paired.description":
    "Platby kartou na tomto zařízení půjdou na terminál vybraný níže.",
  "settings.qerkoTerminal.paired.environmentReadOnly":
    "Chcete-li prostředí změnit, zrušte párování a spárujte znovu.",
  "settings.qerkoTerminal.paired.keyName": "Název propojení",
  "settings.qerkoTerminal.paired.title": "Propojeno s Qerkem",
  "settings.qerkoTerminal.requestCode": "Poslat kód",
  "settings.qerkoTerminal.status.noTerminal":
    "Na tomto zařízení není vybraný terminál",
  "settings.qerkoTerminal.status.notPaired": "Nespárováno s Qerkem",
  "settings.cardSwitchioAccount.info.contract":
    "uzavřenou smlouvu s poskytovatelem platebního řešení, například Comgate.",
  "settings.cardSwitchioAccount.info.description":
    "Pro přijímání plateb platební kartou potřebujete:",
  "settings.cardSwitchioAccount.info.softpos":
    "aplikaci Switchio SoftPOS na tomto zařízení,",
  "settings.cardSwitchioAccount.info.softposLink":
    "O aplikaci Switchio SoftPOS",
  "settings.cardSwitchioAccount.info.title": "Platby platební kartou",
  "settings.cardSwitchioAccount.notInstalledWarning":
    "Aplikace Switchio SoftPOS není na tomto zařízení nainstalovaná.",
  "settings.cardSwitchioAccount.nativeRuntimeWarning":
    "Platební terminál je dostupný jen v nativní aplikaci.",
  "catalog.categories.add": "Přidat kategorii",
  "catalog.categories.delete": "Smazat kategorii",
  "catalog.categories.delete.confirm.cancel": "Zrušit",
  "catalog.categories.delete.confirm.confirm": "Smazat",
  "catalog.categories.delete.confirm.description":
    "Položky přiřazené ke kategorii {name} se po smazání zobrazí jako nekategorizované.",
  "catalog.categories.delete.confirm.title": "Smazat kategorii {name}?",
  "catalog.categories.description": "Seskupte své produkty a služby",
  "catalog.categories.empty.description":
    "Přidejte kategorie pro seskupení produktů a služeb, poté je přiřaďte ve formuláři položky.",
  "catalog.categories.empty.title": "Zatím žádné kategorie",
  "catalog.categories.emptySearch": "Hledání nenašlo žádné kategorie.",
  "catalog.categories.form.card.description":
    "Název zobrazený při seskupování položek a filtrování na účtu.",
  "catalog.categories.form.card.title": "Detaily",
  "catalog.categories.form.invalidId": "Neplatné ID kategorie.",
  "catalog.categories.form.name.invalid": "Zadejte název.",
  "catalog.categories.form.name.label": "Název",
  "catalog.categories.form.name.placeholder": "např. Nápoje",
  "catalog.categories.form.notFound": "Tato kategorie už neexistuje.",
  "catalog.categories.form.save.create": "Přidat kategorii",
  "catalog.categories.form.saved.create": "Kategorie přidána.",
  "catalog.categories.form.title.create": "Přidat kategorii",
  "catalog.categories.form.title.edit": "Upravit kategorii",
  "catalog.categories.search": "Hledat kategorie...",
  "catalog.categories.search.clear.aria": "Vymazat hledání",
  "catalog.categories.title": "Kategorie",
  "settings.cashuAccount.title": "Peněženka Linky",
  "settings.cashuAccount.wallet.title": "Peněženka sdílená s Linky",
  "settings.cashuAccount.wallet.description":
    "Platby Cashu jdou do stejné ecash peněženky, kterou ukazuje vaše aplikace Linky. Její zůstatek zahrnuje i peníze přijaté v Linky.",
  "settings.cashuAccount.defaultMint": "Výchozí mint",
  "settings.cashuAccount.syncing": "Synchronizuji peněženku s Linky...",
  "settings.cashuAccount.empty": "Peněženka zatím nemá žádný ecash.",
  "settings.cashuMints.title": "Minty",
  "settings.cashuMints.known": "Vaše minty",
  "settings.cashuMints.suggested": "Doporučené minty",
  "settings.cashuMints.empty": "Peněženka zatím nezná žádný mint.",
  "settings.cashuMints.default": "Výchozí",
  "settings.cashuMints.add": "Přidat mint",
  "settings.cashuMints.url": "Adresa mintu",
  "settings.cashuMints.addDescription":
    "Mint se před přidáním ověří. Přidání nemění výchozí mint ani to, které tokeny platí vaše platby.",
  "settings.cashuMints.addError.invalid": "Tohle není adresa mintu.",
  "settings.cashuMints.addError.unreachable": "Mint neodpověděl.",
  "settings.cashuMints.addError.rejected":
    "Mint byl odmítnut: nenačetl se, nebo uvádí klíče jiného mintu.",
  "settings.cashuMints.invalid": "Tato adresa mintu není platná.",
  "settings.cashuMints.infoUnavailable": "Mint neodpověděl.",
  "settings.cashuMints.balance": "Zůstatek: {amount}",
  "settings.cashuMints.defaultWarning":
    "Nové platby Cashu použijí tento mint, i v Linky. Lightning adresa v Linky bude dál platit do starého mintu, dokud výchozí mint nezměníte v Linky.",
  "settings.cashuMints.setDefault": "Nastavit jako výchozí",
  "settings.cashuMints.remove": "Odebrat mint",
  "settings.cashuMints.removeError.inUse":
    "Mint ještě drží ecash, proto ho nelze odebrat.",
  "settings.cashuMints.move.title": "Přesunout prostředky",
  "settings.cashuMints.move.description":
    "Přesune ecash z tohoto mintu do výchozího mintu {mint} přes Lightning.",
  "settings.cashuMints.move.amount": "Částka v sat",
  "settings.cashuMints.move.amountDescription":
    "Nechte prázdné, pokud chcete přesunout vše.",
  "settings.cashuMints.move.estimate": "Odhadnout náklady",
  "settings.cashuMints.move.estimateResult":
    "Dorazí {amount}; z tohoto mintu odejde nejvýš {total}.",
  "settings.cashuMints.move.confirm": "Přesunout",
  "settings.cashuMints.movePinDetail": "{amount} do {mint}",
  "settings.cashuMints.moveError.unreachable":
    "Některý mint neodpověděl. Zkuste to později.",
  "settings.cashuMints.moveError.rejected": "Mint přesun odmítl.",
  "settings.cashuMints.moveError.nothing": "Není co přesunout.",
  "settings.cashuMints.moveError.insufficient":
    "Zůstatek nepokryje tuto částku a poplatky.",
  "settings.cashuMints.moveError.pending":
    "Přesun je na cestě a dokončí se sám.",
  "settings.cashuAccount.mints": "Minty",
  "settings.cashuAccount.mintsDescription":
    "Výchozí mint, zůstatky, přesun prostředků",
  "settings.cashuAccount.withdraw": "Vybrat prostředky",
  "settings.cashuAccount.withdrawDescription": "Odeslat ecash přes Lightning",
  "settings.cashuAccount.enabled.label": "Přijímat Cashu",
  "settings.debugConsole.cashu.title": "Cashu peněženka Linky (vývoj)",
  "settings.debugConsole.cashu.activeShard": "Aktivní shard: {index}",
  "settings.debugConsole.cashu.hydrated": "Synchronizováno: {hydrated}",
  "settings.debugConsole.cashu.noBalance": "Žádné dostupné proofy.",
  "settings.debugConsole.cashu.writeTestSetting":
    "Zapsat testovací nastavení pro Linky",
  "settings.debugConsole.clear": "Vymazat",
  "settings.debugConsole.description":
    "Zobrazit zachycený konzolový výstup aplikace",
  "settings.debugConsole.empty":
    "Zatím nejsou zachycené žádné záznamy konzole.",
  "settings.debugConsole.history.title": "Historie výstupu konzole",
  "settings.debugConsole.pause": "Pauza",
  "settings.debugConsole.resume": "Pokračovat",
  "settings.debugConsole.title": "Debug Console",
  "settings.demoData.accountName": "Demo kavárna",
  "settings.demoData.action": "Vytvořit demo účet",
  "settings.demoData.action.pending": "Vytváří se…",
  "settings.demoData.confirm.cancel": "Zrušit",
  "settings.demoData.confirm.confirm": "Vytvořit a vygenerovat",
  "settings.demoData.confirm.description":
    "Aplikace se přepne na nový demo účet a naplní ho fiktivními daty. Vrátit to jde jen odebráním demo účtu.",
  "settings.demoData.confirm.title": "Vytvořit demo účet?",
  "settings.demoData.current.description":
    "Všechno v něm je fiktivní a nikdy se nesynchronizuje. Na skutečný účet se přepnete v sekci Účty.",
  "settings.demoData.current.title": "Jste v demo účtu",
  "settings.demoData.description":
    "Naplnit samostatný demo účet fiktivními prodeji",
  "settings.demoData.title": "Demo data",
  "settings.demoData.warning.duration":
    "Generování začne dneškem a postupuje den po dni do minulosti. Tři měsíce trvají asi půl hodiny, na telefonu déle, ale můžete ho kdykoli zastavit: rozpracovaný den se dokončí a dosavadní historie zůstane.",
  "settings.demoData.warning.irreversible":
    "Demo účet se nenávratně naplní až třemi měsíci fiktivního katalogu, stolů, plateb a refundací. Nejde je mazat po jednom, jen spolu s celým demo účtem.",
  "settings.demoData.warning.newAccount":
    "Na zařízení vznikne nový účet „{name}“ a stane se aktivním. Váš současný účet a jeho data zůstanou nedotčené; přepnete se na něj zpět v sekci Účty.",
  "settings.demoData.warning.relays":
    "Synchronizační relaye jsou pro demo účet vypnuté a nejde je zapnout, takže se fiktivní data nikdy nedostanou na relay ani do jiného zařízení.",
  "settings.demoData.warning.services":
    "Nic se neodesílá do banky, platebního terminálu ani do sítě Lightning: všechny vnější služby jsou simulované. EET zůstává vypnuté.",
  "settings.demoData.warning.title": "Přečtěte si před generováním",
  "settings.developers": "VÝVOJÁŘI",
  "settings.donations.amount.invalid": "Zadejte kladný celý počet sats.",
  "settings.donations.amount.range": "Částka je mimo povolený rozsah daru.",
  "settings.donations.amount.required": "Zadejte částku daru.",
  "settings.donations.create": "Vytvořit fakturu",
  "settings.donations.create.pending": "Vytvářím fakturu...",
  "settings.donations.description": "Podpořte vývoj {appNameGen}",
  "settings.donations.fiat.description": "Používá aktuálně vybranou fiat měnu.",
  "settings.donations.fiat.label": "Částka",
  "settings.donations.form.description":
    "Zadejte jednu částku. Druhé pole se dopočítá podle aktuálního BTC kurzu.",
  "settings.donations.form.title": "Částka daru",
  "settings.donations.history.amount": "{amount} sats",
  "settings.donations.history.empty.description":
    "Dary se zde zobrazí, jakmile nějaký přijde.",
  "settings.donations.history.empty.title": "Zatím žádné dary",
  "settings.donations.history.error": "Historii darů se nepodařilo načíst.",
  "settings.donations.history.more": "Zobrazit další",
  "settings.donations.history.retry": "Zkusit znovu",
  "settings.donations.history.title": "Poslední dary",
  "settings.donations.invoice.backToSettings": "Zpět do nastavení",
  "settings.donations.invoice.copied": "Faktura zkopírována.",
  "settings.donations.invoice.copy": "Zkopírovat fakturu",
  "settings.donations.invoice.copyFailed": "Fakturu se nepodařilo zkopírovat.",
  "settings.donations.invoice.description":
    "Naskenujte tuto Lightning fakturu pro zaplacení.",
  "settings.donations.invoice.error": "Fakturu pro dar se nepodařilo vytvořit.",
  "settings.donations.invoice.missing": "Faktura pro dar chybí.",
  "settings.donations.invoice.openWallet": "Otevřít v peněžence",
  "settings.donations.invoice.title": "Lightning faktura",
  "settings.donations.invoice.verify.error": "Platbu se nepodařilo ověřit.",
  "settings.donations.invoice.verify.paid": "Platba přijata",
  "settings.donations.invoice.verify.paid.description":
    "Děkujeme za podporu vývoje této aplikace.",
  "settings.donations.invoice.verify.waiting": "Čekám na platbu...",
  "settings.donations.metadata.error":
    "Darovací Lightning adresu se nepodařilo načíst.",
  "settings.donations.rate.error": "BTC kurz se nepodařilo načíst.",
  "settings.donations.sats.description": "Jen celé sats.",
  "settings.donations.sats.label": "Sats",
  "settings.donations.sats.range": "Povolený rozsah: {min}-{max} sats.",
  "settings.donations.title": "Dary",
  "settings.eet.certificate.description":
    "Certifikát, který vydala CA EET pro podepisování tržeb. Určuje evidující EIČ a {appName} si jeho heslo neukládá.",
  "settings.eet.certificate.eic": "Evidující EIČ",
  "settings.eet.certificate.error.expired": "Platnost certifikátu skončila.",
  "settings.eet.certificate.error.fileRequired":
    "Vyberte soubor s certifikátem.",
  "settings.eet.certificate.error.notYetValid": "Certifikát ještě není platný.",
  "settings.eet.certificate.error.unreadable":
    "Soubor není čitelný certifikát pokladny.",
  "settings.eet.certificate.error.withoutEic": "Certifikát neuvádí EIČ.",
  "settings.eet.certificate.error.withoutKey":
    "Soubor neobsahuje soukromý klíč k certifikátu.",
  "settings.eet.certificate.error.wrongPassword": "Heslo není správné.",
  "settings.eet.certificate.expired.description":
    "Tržby nelze evidovat, dokud neimportujete nový certifikát.",
  "settings.eet.certificate.expired.title": "Platnost certifikátu skončila",
  "settings.eet.certificate.expiresSoon.description":
    "Obnovte ho v portálu EET a importujte nový certifikát.",
  "settings.eet.certificate.expiresSoon.title":
    "Platnost certifikátu brzy skončí",
  "settings.eet.certificate.file.description":
    "Soubor .p12 stažený z portálu EET.",
  "settings.eet.certificate.file.label": "Soubor s certifikátem",
  "settings.eet.certificate.import": "Importovat certifikát",
  "settings.eet.certificate.imported": "Certifikát je importován",
  "settings.eet.certificate.none": "Zatím není importován žádný certifikát.",
  "settings.eet.certificate.password.label": "Heslo k certifikátu",
  "settings.eet.certificate.testBadge": "Testovací certifikát",
  "settings.eet.certificate.title": "Certifikát pokladny",
  "settings.eet.certificate.validTo": "Platný do {date}",
  "settings.eet.enabled.description":
    "Evidují se jen platby přijaté po zapnutí.",
  "settings.eet.enabled.incomplete":
    "EET nejde zapnout, dokud není nastaven certifikát a číslo evidenční jednotky.",
  "settings.eet.enabled.label": "Evidovat tržby v EET",
  "settings.eet.enabled.missing": "Pro zapnutí EET doplňte {missing}.",
  "settings.eet.environment.description": "Kam {appName} tržby odesílá.",
  "settings.eet.environment.playground.description":
    "Pro vyzkoušení EET. Tržby jdou do testovacího prostředí EET a neevidují se.",
  "settings.eet.environment.playground.title": "Sandbox",
  "settings.eet.environment.production.description":
    "Tržby se evidují u finanční správy.",
  "settings.eet.environment.production.title": "Produkce",
  "settings.eet.environment.productionUnavailable":
    "Produkce v této verzi {appNameGen} zatím není dostupná.",
  "settings.eet.environment.sandboxConfirm.cancel": "Zrušit",
  "settings.eet.environment.sandboxConfirm.confirm": "Použít sandbox",
  "settings.eet.environment.sandboxConfirm.description":
    "Tržby se budou odesílat jen do testovacího prostředí EET. U finanční správy se evidovat nebudou.",
  "settings.eet.environment.sandboxConfirm.title": "Přepnout EET do sandboxu?",
  "settings.eet.environment.saved": "Prostředí je uloženo",
  "settings.eet.environment.testCertificateBlocksProduction":
    "Před přepnutím do produkce importujte produkční certifikát.",
  "settings.eet.environment.title": "Prostředí",
  "settings.eet.establishment.description":
    "Číslo evidenční jednotky přidělené v MOJE daně.",
  "settings.eet.establishment.invalid": "Zadejte celé číslo bez úvodních nul.",
  "settings.eet.establishment.label": "Číslo evidenční jednotky",
  "settings.eet.gap.certificate": "certifikát pokladny",
  "settings.eet.gap.certificateExpired": "platný certifikát",
  "settings.eet.gap.establishment": "číslo evidenční jednotky",
  "settings.eet.nav.off": "Vypnuto",
  "settings.eet.nav.production": "Zapnuto",
  "settings.eet.nav.sandbox": "Sandbox",
  "settings.eet.officialTest.description":
    "V sandboxu můžete místo souboru použít některý z oficiálních testovacích certifikátů finanční správy.",
  "settings.eet.officialTest.loading":
    "Stahuji oficiální testovací certifikáty…",
  "settings.eet.officialTest.show": "Použít oficiální testovací certifikát",
  "settings.eet.officialTest.title": "Oficiální testovací certifikáty",
  "settings.eet.officialTest.unavailable.description":
    "Teď je nejde stáhnout. Importujte místo nich soubor s certifikátem.",
  "settings.eet.officialTest.unavailable.title":
    "Oficiální testovací certifikáty nejsou dostupné",
  "settings.eet.officialTest.use": "Použít testovací certifikát {name}",
  "settings.eet.officialTest.useShort": "Použít",
  "settings.eet.reporting.description":
    "Eviduje každou platbu přijatou na tomto účtu v systému EET 2.0. Platba zůstane zaplacená, i když EET není dostupná.",
  "settings.eet.reporting.title": "Evidence tržeb",
  "settings.eet.test.connection": "Otestovat spojení",
  "settings.eet.test.description":
    "Ověří nastavení bez přijetí platby. Nic odeslaného odsud se neeviduje jako tržba.",
  "settings.eet.test.errorCode": "Chyba {code}: {message}",
  "settings.eet.test.outcome.accepted": "EET testovací tržbu potvrdila.",
  "settings.eet.test.outcome.failed": "EET zprávu nepřijala.",
  "settings.eet.test.outcome.verified": "EET testovací zprávu přijala.",
  "settings.eet.test.pok": "POK: {pok}",
  "settings.eet.test.rawRequest": "Požadavek",
  "settings.eet.test.rawResponse": "Odpověď",
  "settings.eet.test.sale": "Odeslat testovací tržbu",
  "settings.eet.test.title": "Test",
  "settings.eet.test.unavailable":
    "Nejdřív nastavte certifikát a číslo evidenční jednotky.",
  "settings.eet.tip.business.description":
    "{appName} eviduje celou platbu včetně spropitného.",
  "settings.eet.tip.business.title": "Spropitné patří podniku",
  "settings.eet.tip.description":
    "Jestli je spropitné součástí evidované tržby, záleží na tom, komu patří. Spropitné, které je příjmem podniku, se ze zákona eviduje. Spropitné, které patří zaměstnancům, se evidovat nemusí. Změna platí pro platby přijaté od té chvíle.",
  "settings.eet.tip.employees.description":
    "{appName} eviduje platbu bez spropitného. Spropitné zůstává u platby zapsané zvlášť.",
  "settings.eet.tip.employees.title": "Spropitné patří zaměstnancům",
  "settings.eet.tip.label": "Komu spropitné patří",
  "settings.eet.tip.note":
    "Povinný kuvert ani servisní poplatek nejsou spropitné. Účtujte je jako běžnou položku na účtu, do tržby se započítají vždy.",
  "settings.eet.tip.title": "Spropitné",
  "settings.eet.title": "EET",
  "settings.eet.unconfirmed.description": "Tržby, které EET zatím nepotvrdila.",
  "settings.eet.unconfirmed.empty": "EET potvrdila všechny tržby.",
  "settings.eet.unconfirmed.reversal": "Storno {amount}",
  "settings.eet.unconfirmed.title": "Nepotvrzené tržby",
  "settings.evoluExport.action": "Exportovat",
  "settings.evoluExport.action.pending": "Exportuji...",
  "settings.evoluExport.confirm.description":
    "Export bude uložený bez anonymizace.",
  "settings.evoluExport.confirm.label":
    "Rozumím, že export může obsahovat citlivá data.",
  "settings.evoluExport.database.app": "Aplikační databáze",
  "settings.evoluExport.description":
    "Export lokálních Evolu databází pro zálohu a podporu",
  "settings.evoluExport.destination.capacitor":
    "Soubor předáte přes nabídku sdílení, kde zvolíte, kam ho poslat.",
  "settings.evoluExport.destination.web": "Soubory stáhne tento prohlížeč.",
  "settings.evoluExport.format.description":
    "Každá vybraná databáze se exportuje jako surový SQLite soubor.",
  "settings.evoluExport.format.sqlite": "SQLite",
  "settings.evoluExport.options.description":
    "Vyberte, které lokální databáze se mají zahrnout.",
  "settings.evoluExport.options.format": "Formát",
  "settings.evoluExport.options.title": "Nastavení exportu",
  "settings.evoluExport.status.createdAt": "Vytvořeno {createdAt}",
  "settings.evoluExport.status.error": "Export selhal.",
  "settings.evoluExport.status.handedOff":
    "Sdílecí nabídka byla zavřena. Ověřte, že soubor dorazil, než se na tuto zálohu spolehnete.",
  "settings.evoluExport.status.success": "Export dokončen.",
  "settings.evoluExport.status.title": "Stav exportu",
  "settings.evoluExport.title": "Evolu Export",
  "settings.evoluExport.warning.businessData": "obchodní data",
  "settings.evoluExport.warning.description":
    "Full export databází může obsahovat data, která umožňují přístup k prostředkům, integracím nebo soukromé obchodní historii. Exportované soubory ukládejte bezpečně a sdílejte je jen s důvěryhodnými příjemci.",
  "settings.evoluExport.warning.localConfiguration":
    "lokální konfigurace aplikace a nastavení synchronizace",
  "settings.evoluExport.warning.payments": "účtenky, platby a transakce",
  "settings.evoluExport.warning.secrets":
    "mnemoniky peněženek, recovery phrase a API tokeny",
  "settings.evoluExport.warning.title": "Citlivý export",
  "settings.evoluExport.warning.walletMetadata":
    "metadata související s peněženkou",
  "settings.fiat.czk.title": "Česká koruna",
  "settings.fiat.eur.title": "Euro",
  "settings.fiat.usd.title": "Americký dolar",
  "settings.fiatBankAccount.advanced": "Pokročilé volby",
  "settings.fiatBankAccount.currency.description":
    "Platby v této měně mohou použít tento bankovní účet.",
  "settings.fiatBankAccount.currency.label": "Měna bankovního účtu",
  "settings.fiatBankAccount.enabled.label": "Povolit fiat bankovní účet",
  "settings.fiatBankAccount.form.description":
    "Aplikace teď používá jeden deterministický fiat bankovní účet.",
  "settings.fiatBankAccount.form.title": "Údaje bankovního účtu",
  "settings.fiatBankAccount.iban.description":
    "Zadejte české číslo účtu, například 123456789/0100, nebo IBAN. Uložená hodnota se normalizuje na IBAN.",
  "settings.fiatBankAccount.iban.format.bban": "Číslo účtu",
  "settings.fiatBankAccount.iban.format.iban": "IBAN",
  "settings.fiatBankAccount.iban.invalid":
    "Zadejte platný IBAN nebo české číslo účtu.",
  "settings.fiatBankAccount.iban.label": "Číslo účtu nebo IBAN",
  "settings.fiatBankAccount.iban.required":
    "Zadejte IBAN nebo číslo účtu, nebo bankovní převod vypněte.",
  "settings.fiatBankAccount.iban.unknownBank":
    "Neznámá banka — nepodařilo se rozpoznat, ke které bance účet patří",
  "settings.fiatBankAccount.qrFormat.description":
    "Tento formát se u bankovních QR plateb zobrazí jako první.",
  "settings.fiatBankAccount.qrFormat.label": "Výchozí formát QR",
  "settings.fiatBankAccount.qrFormat.payBySquare1_0_0":
    "Pay by square 1.0 (Slovensko)",
  "settings.fiatBankAccount.qrFormat.payBySquare1_2_0":
    "Pay by square 1.2 (Slovensko)",
  "settings.fiatBankAccount.qrFormat.spayd": "SPAYD (Česko)",
  "settings.fioPlugin.active.description":
    "Když je plugin zapnutý, kontroluje transakce Fio banky pro fiat bankovní účet.",
  "settings.fioPlugin.active.label": "Povolit Fio plugin",
  "settings.fioPlugin.description":
    "Nastavení tokenů pro synchronizaci transakcí z Fio banky",
  "settings.fioPlugin.form.description":
    "Plugin teď používá deterministický fiat bankovní účet.",
  "settings.fioPlugin.form.title": "Základní nastavení",
  "settings.fioPlugin.interval.description":
    "Jak často má plugin kontrolovat nové transakce.",
  "settings.fioPlugin.interval.invalid": "Zadejte celé číslo větší než nula.",
  "settings.fioPlugin.interval.label": "Sekund mezi kontrolami",
  "settings.fioPlugin.lastSyncedDate.description":
    "Lokální zarážka synchronizace. Pokud ještě neexistuje, použije se včerejší datum.",
  "settings.fioPlugin.lastSyncedDate.invalid": "Zadejte platné datum.",
  "settings.fioPlugin.lastSyncedDate.label": "Poslední synchronizované datum",
  "settings.fioPlugin.nativeRuntimeWarning.description":
    "Tato aplikace teď běží v běžném prohlížeči/PWA prostředí, takže automatické kontroly plateb Fio se tady nespustí.",
  "settings.fioPlugin.nativeRuntimeWarning.title":
    "Fio plugin je dostupný jen v nativní aplikaci.",
  "settings.fioPlugin.syncLookbackDays.description":
    "Kolik dní před poslední lokální zarážkou se má znovu kontrolovat.",
  "settings.fioPlugin.syncLookbackDays.invalid":
    "Zadejte celé číslo větší než nula.",
  "settings.fioPlugin.syncLookbackDays.label": "Dny zpětné kontroly",
  "settings.fioPlugin.notFioIbanWarning":
    "Tento IBAN nepatří k účtu u Fio banky, plugin proto jeho platby nenajde.",
  "settings.fioPlugin.title": "Fio plugin",
  "settings.fioPlugin.token.description":
    "Nechte prázdné, pokud chcete uložit jen základní nastavení.",
  "settings.fioPlugin.token.invalid":
    "Zadejte token dlouhý maximálně 255 znaků.",
  "settings.fioPlugin.token.label": "Fio API token",
  "settings.fioPlugin.token.required":
    "Při vytváření pluginu je první token povinný.",
  "settings.fioPlugin.tokens.active": "Aktivní",
  "settings.fioPlugin.tokens.add.description":
    "Ukládá se samostatně, takže nastavení výše se dá měnit bez přepsání tokenu. Sync job prochází všechny uložené tokeny.",
  "settings.fioPlugin.tokens.add.saved": "Fio API token přidán.",
  "settings.fioPlugin.tokens.add.submit": "Přidat token",
  "settings.fioPlugin.tokens.add.title": "Přidat token",
  "settings.fioPlugin.tokens.description":
    "Uložené tokeny se používají při kontrole transakcí účtu.",
  "settings.fioPlugin.tokens.empty": "Nejsou uložené žádné tokeny.",
  "settings.fioPlugin.tokens.item": "Fio API token",
  "settings.fioPlugin.tokens.remove": "Odebrat",
  "settings.fioPlugin.tokens.title": "Tokeny",
  "settings.monetaPlugin.title": "MONETA Plugin",
  "settings.monetaPlugin.description":
    "Automaticky potvrzovat převody na účet u MONETA Money Bank",
  "settings.monetaPlugin.status.on": "Zapnuto",
  "settings.monetaPlugin.status.off": "Vypnuto",
  "settings.monetaPlugin.nativeRuntimeWarning.title":
    "MONETA plugin funguje jen v mobilní aplikaci.",
  "settings.monetaPlugin.nativeRuntimeWarning.description":
    "MONETA nepustí prohlížeč ke svému API. Připojte token v mobilní aplikaci {appName}, potvrzené platby pak uvidí i tento terminál.",
  "settings.monetaPlugin.notMonetaIbanWarning":
    "Bankovní účet není u MONETA Money Bank (kód banky 0600), takže není co připojit.",
  "settings.monetaPlugin.connect.title": "Připojit token",
  "settings.monetaPlugin.connect.replaceTitle": "Připojit jiný token",
  "settings.monetaPlugin.connect.description":
    "Token vytvoříte v Internet Bance MONETA v Nastavení › Správa API tokenů s právy „Pasivní – pouze náhled“. {appName} si u banky ověří, že token vidí tento účet.",
  "settings.monetaPlugin.connect.submit": "Připojit",
  "settings.monetaPlugin.connect.saved": "Token MONETA připojen.",
  "settings.monetaPlugin.connect.error.unauthorized":
    "Banka token odmítla. Zkontrolujte, že je zkopírovaný celý a nebyl zrušen.",
  "settings.monetaPlugin.connect.error.accountNotVisible":
    "Token funguje, ale nevidí účet {iban}. Vytvořte ho pro tento účet.",
  "settings.monetaPlugin.connect.error.rateLimited":
    "Token dnes vyčerpal dotazy do banky. Zkuste to zítra.",
  "settings.monetaPlugin.connect.error.unreachable":
    "Banka neodpovídá. Zkontrolujte připojení a zkuste to znovu.",
  "settings.monetaPlugin.connect.error.unexpected":
    "Banka odpověděla neočekávaně. Zkuste to později.",
  "settings.monetaPlugin.token.label": "API token MONETA",
  "settings.monetaPlugin.token.required": "Vložte token z Internet Banky.",
  "settings.monetaPlugin.connected.title": "Připojený účet",
  "settings.monetaPlugin.connected.iban": "Účet",
  "settings.monetaPlugin.connected.token": "Token",
  "settings.monetaPlugin.connected.ibanMismatch":
    "Token byl připojen pro účet {iban}, ne pro současný bankovní účet. Připojte token pro současný účet.",
  "settings.monetaPlugin.active.label": "Automaticky potvrzovat platby",
  "settings.monetaPlugin.active.description":
    "Kontroluje příchozí převody na pozadí a během čekání na platbu.",
  "settings.monetaPlugin.interval.label": "Sekundy mezi kontrolami na pozadí",
  "settings.monetaPlugin.interval.description":
    "Čekající platba se kontroluje po několika sekundách bez ohledu na toto nastavení.",
  "settings.monetaPlugin.interval.invalid": "Zadejte celé číslo, alespoň 60.",
  "settings.monetaPlugin.interval.estimate":
    "Zhruba {calls} dotazů denně na zařízení z {limit}, které banka povolí všem zařízením dohromady.",
  "settings.monetaPlugin.lastSyncedDate.label": "Datum poslední synchronizace",
  "settings.monetaPlugin.lastSyncedDate.description":
    "Odkud synchronizace na pozadí pokračuje. Bez něj se načtou poslední dva měsíce.",
  "settings.monetaPlugin.lastSyncedDate.invalid": "Zadejte platné datum.",
  "settings.monetaPlugin.disconnect.action": "Odpojit",
  "settings.monetaPlugin.disconnect.confirm.title": "Odpojit MONETU?",
  "settings.monetaPlugin.disconnect.confirm.description":
    "{appName} přestane token používat na všech zařízeních a přestane potvrzovat převody. Už potvrzené platby zůstanou, jak jsou. Token zůstane v šifrované historii synchronizace, proto ho zrušte i v MONETA Internet Bance.",
  "settings.monetaPlugin.disconnect.confirm.confirm": "Odpojit",
  "settings.monetaPlugin.disconnect.confirm.cancel": "Zrušit",
  "settings.homeScreen.atLeastOneMode":
    "Nechte zapnutý aspoň jeden mód — hlavní obrazovka musí mít co zobrazit.",
  "settings.homeScreen.modes.description":
    "Vyberte, mezi kterými zobrazeními lze na hlavní obrazovce přepínat. Když necháte zapnuté jen jedno, přepínač zmizí.",
  "settings.homeScreen.modes.title": "Módy",
  "settings.homeScreen.numpad.description":
    "Zadejte částku a rovnou ji naúčtujte.",
  "settings.homeScreen.pos.description":
    "Stoly a otevřené účty, účtované z katalogu.",
  "settings.homeScreen.title": "Hlavní obrazovka",
  "catalog.items.add": "Přidat položku",
  "catalog.items.category.all": "Vše",
  "catalog.items.category.uncategorized": "Bez kategorie",
  "catalog.items.delete": "Smazat položku",
  "catalog.items.delete.confirm.cancel": "Zrušit",
  "catalog.items.delete.confirm.confirm": "Smazat",
  "catalog.items.delete.confirm.description":
    "Účty a platby, ve kterých byla položka {name} už použita, si ponechají vlastní kopii, ale nebude ji možné přidat do nových.",
  "catalog.items.delete.confirm.title": "Smazat položku {name}?",
  "catalog.items.description": "Správa prodávaných produktů a služeb",
  "catalog.items.empty.description":
    "Přidejte produkty nebo služby, které prodáváte, abyste je mohli rychle přidávat do účtu.",
  "catalog.items.empty.title": "Zatím žádné položky",
  "catalog.items.emptySearch": "Hledání nenašlo žádné položky.",
  "catalog.items.form.card.description":
    "Název, cena a nepovinný popis zobrazený při přidávání položky do účtu.",
  "catalog.items.form.card.title": "Detaily",
  "catalog.items.form.category.label": "Kategorie",
  "catalog.items.form.category.none": "Bez kategorie",
  "catalog.items.form.currency.label": "Měna",
  "catalog.items.form.description.invalid":
    "Popis je příliš dlouhý (max. 255 znaků).",
  "catalog.items.form.description.label": "Popis",
  "catalog.items.form.description.placeholder": "Nepovinné",
  "catalog.items.form.internalDescription.invalid":
    "Interní popis je příliš dlouhý (max. 255 znaků).",
  "catalog.items.form.internalDescription.label": "Interní popis",
  "catalog.items.form.internalDescription.placeholder":
    "Nepovinné – viditelné pouze pro personál",
  "catalog.items.form.internalName.hint":
    "Zobrazí se personálu místo veřejného názvu. Zákazníci na účtu stále vidí veřejný název a popis.",
  "catalog.items.form.internalName.invalid":
    "Interní název je příliš dlouhý (max. 255 znaků).",
  "catalog.items.form.internalName.label": "Interní název",
  "catalog.items.form.internalName.placeholder":
    "Nepovinné – zobrazí se personálu místo veřejného názvu",
  "catalog.items.form.invalidId": "Neplatné ID položky.",
  "catalog.items.form.name.invalid": "Zadejte název.",
  "catalog.items.form.name.label": "Název",
  "catalog.items.form.name.placeholder": "např. Káva",
  "catalog.items.form.notFound": "Tato položka už neexistuje.",
  "catalog.items.form.price.invalid": "Zadejte platnou cenu.",
  "catalog.items.form.price.label": "Cena",
  "catalog.items.form.save.create": "Přidat položku",
  "catalog.items.form.saved.create": "Položka byla přidána.",
  "catalog.items.form.scanCode.duplicate": "Už je přiřazen položce {name}.",
  "catalog.items.form.scanCode.invalid": "Zadejte platný kód.",
  "catalog.items.form.scanCode.label": "Kód pro skenování",
  "catalog.items.form.scanCode.placeholder": "např. 8594001234567",
  "catalog.items.form.scanCode.scan.aria": "Naskenovat kód",
  "catalog.items.form.sku.invalid": "SKU je příliš dlouhé (max. 255 znaků).",
  "catalog.items.form.sku.label": "SKU",
  "catalog.items.form.sku.placeholder": "Nepovinné",
  "catalog.items.form.taxRate.description":
    "Uplatní se na účtech a platbách po použití této položky. Sazby správte v Nastavení › Daňové sazby.",
  "catalog.items.form.taxRate.label": "Daňová sazba",
  "catalog.items.form.taxRate.none": "Bez daňové sazby",
  "catalog.items.form.title.create": "Přidat položku",
  "catalog.items.form.title.edit": "Upravit položku",
  "catalog.items.search": "Hledat položky...",
  "catalog.items.search.clear.aria": "Vymazat hledání",
  "catalog.items.title": "Položky",
  "settings.language.locale.czech.title": "Česko",
  "settings.language.locale.description":
    "Vyberte regionální formát pro data, čísla a měny.",
  "settings.language.locale.english.title": "Spojené státy",
  "settings.language.locale.slovak.title": "Slovensko",
  "settings.language.locale.title": "Regionální formát",
  "settings.language.mode.description":
    "Vyberte jazyk, který má aplikace používat.",
  "settings.language.mode.title": "Jazyk aplikace",
  "settings.language.title": "Jazyk a region",
  "settings.legalEntity.country.label": "Země",
  "settings.legalEntity.country.placeholder": "Vyberte zemi",
  "settings.legalEntity.currency.description":
    "Fiat měna, ve které se ve výchozím stavu vytvářejí platby.",
  "settings.legalEntity.currency.label": "Měna",
  "settings.legalEntity.description":
    "Země, měna a plátcovství DPH vašeho podniku.",
  "settings.legalEntity.title": "Podnik",
  "settings.legalEntity.vatPayer.description":
    "Přidá daňové sazby k položkám katalogu.",
  "settings.legalEntity.vatPayer.label": "Jsem plátce DPH",
  "settings.paymentAccounts.default": "Výchozí",
  "settings.paymentAccounts.experimental": "Experimentální",
  "settings.paymentAccounts.method.cashRegister": "Hotovost",
  "settings.paymentAccounts.method.iban": "Bankovní převod",
  "settings.paymentAccounts.method.cashu": "Cashu",
  "settings.paymentAccounts.method.cardSwitchio": "Platební karta",
  "settings.paymentAccounts.method.qerkoTerminal": "Platební terminál (Qerko)",
  "settings.paymentAccounts.method.spark": "Bitcoin",
  "settings.paymentAccounts.moveDown.aria": "Posunout {name} dolů",
  "settings.paymentAccounts.moveUp.aria": "Posunout {name} nahoru",
  "settings.paymentAccounts.reorder.aria": "Změnit pořadí: {name}",
  "settings.paymentAccounts.order.description":
    "Zákazník uvidí platební metody v tomto pořadí. První dostupná se otevře automaticky.",
  "settings.paymentAccounts.status.currencyMismatch":
    "Nastaveno v {currency}, aplikace ale používá {appCurrency}",
  "settings.paymentAccounts.status.unavailableHere":
    "V této verzi aplikace zatím není dostupné",
  "settings.paymentAccounts.status.missingIban":
    "Pro zapnutí doplňte bankovní účet",
  "settings.paymentAccounts.title": "Platební metody",
  "settings.paymentNumberSeries.day.default.description":
    "Přidat do generovaných čísel plateb dvouciferný den",
  "settings.paymentNumberSeries.day.default.title": "Zobrazit den",
  "settings.paymentNumberSeries.day.hidden.description":
    "Nepřidávat den do generovaných čísel plateb",
  "settings.paymentNumberSeries.day.hidden.title": "Skrýt den",
  "settings.paymentNumberSeries.day.label": "Formát dne",
  "settings.paymentNumberSeries.description":
    "Nastavení generování čísel plateb",
  "settings.paymentNumberSeries.form.description":
    "Tyto hodnoty určují deterministickou číselnou řadu používanou terminálem.",
  "settings.paymentNumberSeries.form.title": "Formát číselné řady",
  "settings.paymentNumberSeries.lastNumber.date.description":
    "Kotevní datum pro rozhodnutí, jestli další platba pokračuje v řadě, nebo ji resetuje. Prázdná hodnota resetuje řadu při další platbě.",
  "settings.paymentNumberSeries.lastNumber.date.invalid":
    "Zadejte platné datum.",
  "settings.paymentNumberSeries.lastNumber.date.label": "Kotevní datum",
  "settings.paymentNumberSeries.lastNumber.description":
    "Přenastavení posledního použitého pořadového čísla. Další vygenerované číslo platby bude pokračovat od této hodnoty.",
  "settings.paymentNumberSeries.lastNumber.serialNumber.description":
    "Poslední použité pořadové číslo. Například zadejte 499, pokud další platba má použít 500.",
  "settings.paymentNumberSeries.lastNumber.serialNumber.invalid":
    "Zadejte nulu nebo kladné celé číslo.",
  "settings.paymentNumberSeries.lastNumber.serialNumber.label":
    "Poslední pořadové číslo",
  "settings.paymentNumberSeries.lastNumber.title": "Poslední použité číslo",
  "settings.paymentNumberSeries.month.default.description":
    "Přidat do generovaných čísel plateb dvouciferný měsíc",
  "settings.paymentNumberSeries.month.default.title": "Zobrazit měsíc",
  "settings.paymentNumberSeries.month.hidden.description":
    "Nepřidávat měsíc do generovaných čísel plateb",
  "settings.paymentNumberSeries.month.hidden.title": "Skrýt měsíc",
  "settings.paymentNumberSeries.month.label": "Formát měsíce",
  "settings.paymentNumberSeries.prefix.description":
    "Volitelná předpona přidaná před generovaná čísla plateb.",
  "settings.paymentNumberSeries.prefix.invalid":
    "Zadejte předponu dlouhou maximálně 255 znaků.",
  "settings.paymentNumberSeries.prefix.label": "Předpona",
  "settings.paymentNumberSeries.serialNumberDigits.description":
    "Minimální počet číslic pro rostoucí pořadovou část.",
  "settings.paymentNumberSeries.serialNumberDigits.invalid":
    "Zadejte celé číslo větší než nula.",
  "settings.paymentNumberSeries.serialNumberDigits.label":
    "Počet číslic pořadí",
  "settings.paymentNumberSeries.title": "Číselná řada plateb",
  "settings.paymentNumberSeries.year.default.description":
    "Přidat do generovaných čísel plateb celý čtyřciferný rok",
  "settings.paymentNumberSeries.year.default.title": "Celý rok",
  "settings.paymentNumberSeries.year.label": "Formát roku",
  "settings.paymentNumberSeries.year.short.description":
    "Přidat do generovaných čísel plateb krátký dvouciferný rok",
  "settings.paymentNumberSeries.year.short.title": "Krátký rok",
  "settings.payments": "PLATBY",
  "settings.privacy.errorReporting.description":
    "Odesílat hlášení pádů a chyb, aby se daly snadněji opravit. Ve výchozím stavu vypnuto — nic se neodesílá, dokud to nezapnete.",
  "settings.privacy.errorReporting.disable": "Vypnout",
  "settings.privacy.errorReporting.disabled": "Vypnuto",
  "settings.privacy.errorReporting.enable": "Zapnout",
  "settings.privacy.errorReporting.enabled": "Zapnuto",
  "settings.privacy.errorReporting.title": "Hlášení chyb",
  "settings.privacy.productLookup.description":
    "Když naskenujete čárový kód, který v katalogu není, dohledat produkt v Open Food Facts a Open Beauty Facts a předvyplnit jeho název. Naskenovaný kód se těmto službám odešle. Ve výchozím stavu vypnuto.",
  "settings.privacy.productLookup.disable": "Vypnout",
  "settings.privacy.productLookup.disabled": "Vypnuto",
  "settings.privacy.productLookup.enable": "Zapnout",
  "settings.privacy.productLookup.enabled": "Zapnuto",
  "settings.privacy.productLookup.title": "Dohledání produktů",
  "settings.privacy.aiAssistant.title": "AI asistent",
  "settings.privacy.aiAssistant.description":
    "Asistent odpovídá přes server {appNameGen} a poskytovatele AI, takže vaše dotazy a to, co asistent čte, opouští toto zařízení. Ve výchozím stavu vypnuto.",
  "settings.privacy.aiAssistant.off.title": "Vypnuto",
  "settings.privacy.aiAssistant.off.description":
    "Asistent je skrytý a nic se neodesílá.",
  "settings.privacy.aiAssistant.public.title": "Jen dokumentace a kód",
  "settings.privacy.aiAssistant.public.description":
    "Čte veřejnou dokumentaci a zdrojový kód {appNameGen}. Vaše účty a platby zůstávají v tomto zařízení.",
  "settings.privacy.aiAssistant.all.title": "Včetně mých dat",
  "settings.privacy.aiAssistant.all.description":
    "Čte i vaše účty a platby v tomto zařízení a to, co přečte, odesílá poskytovateli AI.",
  "settings.profile.description":
    "Váš Nostr profil, stejný, jaký pro tuto obnovovací frázi zobrazuje Linky.",
  "settings.profile.loadFailed":
    "Nepodařilo se spojit s žádným Nostr relayem a načíst profil. Zkontrolujte připojení a zkuste to znovu.",
  "settings.profile.name.invalid": "Jméno je příliš dlouhé.",
  "settings.profile.name.label": "Jméno",
  "settings.profile.name.placeholder": "Název vašeho obchodu",
  "settings.profile.npub.copied": "Veřejný klíč zkopírován",
  "settings.profile.npub.copy": "Kopírovat veřejný klíč",
  "settings.profile.npub.copyFailed": "Veřejný klíč se nepodařilo zkopírovat",
  "settings.profile.npub.label": "Veřejný klíč",
  "settings.profile.picture.choose": "Vybrat obrázek",
  "settings.profile.picture.invalid":
    "Tento soubor není obrázek, který prohlížeč umí načíst.",
  "settings.profile.picture.label": "Obrázek",
  "settings.profile.picture.remove": "Odebrat obrázek",
  "settings.profile.retry": "Zkusit znovu",
  "settings.profile.saveFailed":
    "Žádný Nostr relay profil nepřijal. Zkuste to později.",
  "settings.profile.setName": "Nastavte své jméno",
  "settings.profile.title": "Profil",
  "settings.qerkoTerminal.terminal.change": "Změnit terminál",
  "settings.qerkoTerminal.terminal.choose": "Vybrat terminál",
  "settings.qerkoTerminal.terminal.label": "Terminál na tomto zařízení",
  "settings.qerkoTerminal.terminal.none":
    "Na tomto zařízení není vybraný terminál",
  "settings.qerkoTerminal.terminals.choose": "Použít tento terminál",
  "settings.qerkoTerminal.terminals.description":
    "Každé zařízení platí na vlastním terminálu. Tato volba platí jen pro toto zařízení.",
  "settings.qerkoTerminal.terminals.empty":
    "Qerko pro tuto firmu zatím nemá žádný aktivovaný terminál.",
  "settings.qerkoTerminal.terminals.empty.help":
    "Dostupné terminály pro vaši firmu může nastavit jen podpora Qerko. Kontaktujte ji, požádejte o aktivaci terminálu a pak se vraťte a zkuste to znovu.",
  "settings.qerkoTerminal.terminals.failed": "Terminály se nepodařilo načíst.",
  "settings.qerkoTerminal.terminals.keyRejected":
    "Qerko už toto spárování nepřijímá. Možná bylo v Qerku zrušeno. Pro pokračování spárujte znovu.",
  "settings.qerkoTerminal.terminals.keyRejected.action": "Spárovat znovu",
  "settings.qerkoTerminal.terminals.later": "Vybrat později",
  "settings.qerkoTerminal.terminals.platform.physical": "Terminál",
  "settings.qerkoTerminal.terminals.platform.softPos": "SoftPOS",
  "settings.qerkoTerminal.terminals.retry": "Zkusit znovu",
  "settings.qerkoTerminal.terminals.title": "Vyberte terminál",
  "settings.qerkoTerminal.test.action": "Otestovat spojení",
  "settings.qerkoTerminal.test.bankUnreachable":
    "Terminál je připojený, ale nedovolá se zpracovateli plateb.",
  "settings.qerkoTerminal.test.busy":
    "Terminál právě zpracovává jinou operaci.",
  "settings.qerkoTerminal.test.connected": "Terminál je připojený.",
  "settings.qerkoTerminal.test.notActivated":
    "Terminál není v Qerku aktivovaný.",
  "settings.qerkoTerminal.test.notConnected": "Terminál není připojený.",
  "settings.qerkoTerminal.test.running": "Testuji…",
  "settings.qerkoTerminal.test.unknownTerminal":
    "Qerko tento terminál nezná. Vyberte ho znovu.",
  "settings.qerkoTerminal.test.upstreamError":
    "Qerko se k terminálu nepodařilo dovolat.",
  "settings.qerkoTerminal.test.upstreamTimeout": "Terminál neodpověděl včas.",
  "settings.qerkoTerminal.title": "Terminál Qerko",
  "settings.qerkoTerminal.unpair.action": "Zrušit párování",
  "settings.qerkoTerminal.unpair.confirm.cancel": "Zpět",
  "settings.qerkoTerminal.unpair.confirm.confirm": "Zrušit párování",
  "settings.qerkoTerminal.unpair.confirm.description":
    "Platby kartou na terminálu Qerko se vypnou na všech zařízeních. Už přijaté platby zůstanou, jak jsou.",
  "settings.qerkoTerminal.unpair.confirm.title": "Zrušit párování s Qerkem?",
  "settings.qerkoTerminal.unpaired.description":
    "Propojte účet své firmy v Qerku a přijímejte platby kartou na jeho platebních terminálech. Qerko pošle potvrzovací kód na e-mail firmy.",
  "settings.qerkoTerminal.unpaired.title": "Spárovat s Qerkem",
  "settings.security.description": "Správa synchronizace a obnovy účtu",
  "settings.security.mnemonic.copied": "Recovery phrase zkopírována.",
  "settings.security.mnemonic.copy": "Kopírovat",
  "settings.security.mnemonic.copyError":
    "Recovery phrase se nepodařilo zkopírovat.",
  "settings.security.mnemonic.description":
    "Zobrazení recovery phrase pro aktivní lokální účet.",
  "settings.security.mnemonic.help":
    "Udržujte tuto frázi v soukromí. Kdo ji zná, může účet obnovit.",
  "settings.security.mnemonic.label": "Recovery phrase",
  "settings.security.mnemonic.title": "Obnova účtu",
  "settings.security.mnemonic.warning":
    "Pokud tuto frázi ztratíte, tento účet a jeho data už nikdy nepůjde obnovit – ani nám se to nepodaří.",
  "settings.security.mnemonic.intro":
    "Těchto 20 slov je jediná cesta, jak tento účet dostat na jiné zařízení nebo po ztrátě telefonu. Uložte je do správce hesel nebo na papír — ne do screenshotu ani do chatu. Nikdo, ani {appName}, vám je neobnoví.",
  "settings.security.mnemonic.nativeHint":
    "Opište slova na papír v uvedeném pořadí, obrazovku nefoťte. Potom zálohu ověřte.",
  "settings.security.mnemonic.savePasswords": "Uložit do hesel",
  "settings.security.mnemonic.savePasswords.saved":
    "Recovery phrase uložena do správce hesel.",
  "settings.security.mnemonic.savePasswords.unsupported":
    "Tento prohlížeč neumí ukládat do správce hesel. Zkopírujte frázi nebo ji opište.",
  "settings.security.mnemonic.savePasswords.failed":
    "Do správce hesel se uložit nepodařilo.",
  "settings.security.verify.action": "Ověřit zálohu",
  "settings.security.verify.title": "Ověření zálohy",
  "settings.security.verify.description":
    "Zadejte slova {slots} ze své zálohy. Je to volitelné a nic neblokuje.",
  "settings.security.verify.wordLabel": "Slovo {index}",
  "settings.security.verify.submit": "Zkontrolovat",
  "settings.security.verify.cancel": "Zrušit",
  "settings.security.verify.wrong":
    "Slova nesedí s vaší recovery phrase. Zkontrolujte svůj zápis a zkuste to znovu.",
  "settings.security.verify.success": "Záloha ověřena.",
  "settings.security.verify.status.verified": "Ověřeno {date}",
  "settings.security.verify.status.unverified": "Neověřeno",
  "settings.security.reminder.text": "Zazálohujte si účet",
  "settings.security.reminder.action": "Zálohovat teď",
  "settings.security.reminder.later": "Později",
  "settings.security.backup.description":
    "Zda je recovery phrase zazálohovaná a ověřená.",
  "settings.security.backup.open": "Zálohovat",
  "settings.security.backup.view": "Zobrazit zálohu",
  "settings.security.backup.start": "Zobrazit recovery phrase",
  "settings.security.backup.continue": "Mám zapsáno — ověřit",
  "settings.security.verify.skip": "Přeskočit ověření",
  "settings.security.reminder.description":
    "Když přijdete o telefon, bez zálohy se do svého účtu nedostanete. Zabere to asi minutu.",
  "settings.security.title": "Bezpečnost a synchronizace",
  "settings.security.transports.add": "Přidat transport",
  "settings.security.transports.demo":
    "Toto je demo účet: nikdy se nesynchronizuje, takže jeho relaye zůstávají vypnuté.",
  "settings.security.transports.description":
    "Nastavení Evolu WebSocket endpointů pro tento device účet.",
  "settings.security.transports.empty": "Nejsou uložené žádné transporty.",
  "settings.security.transports.footer":
    "Neaktivní transporty zůstanou uložené, ale při otevírání aplikačních dat se ignorují.",
  "settings.security.transports.inactive": "Neaktivní",
  "settings.security.transports.saved": "Transport přidán.",
  "settings.security.transports.status.synced": "Synchronizováno",
  "settings.security.transports.status.syncing": "Synchronizuji…",
  "settings.security.transports.status.connecting": "Připojuji…",
  "settings.security.transports.status.offline": "Offline",
  "settings.security.transports.status.error": "Chyba synchronizace",
  "settings.security.transports.status.errors.version":
    "Aplikace a relay používají nekompatibilní verze. Aktualizujte aplikaci.",
  "settings.security.transports.status.errors.writeKey":
    "Relay odmítl zapisovací klíč tohoto účtu.",
  "settings.security.transports.status.errors.quota":
    "Úložiště tohoto účtu na relayi je plné.",
  "settings.security.transports.status.errors.decrypt":
    "Data z relaye se nepodařilo dešifrovat.",
  "settings.security.transports.status.errors.generic":
    "Synchronizace s tímto relayem selhala.",
  "settings.security.transports.status.lastSynced": "Naposledy {time}",
  "settings.security.transports.status.firstSync": "První synchronizace",
  "settings.security.transports.status.unreachable": "Relay není dostupný",
  "settings.security.transports.status.offlineSince": "Od {time}",
  "settings.security.transports.accountId": "ID účtu",
  "settings.security.transports.toggle": "Synchronizovat přes {url}",
  "settings.security.transports.title": "Evolu transporty",
  "settings.security.transports.url.description":
    "Povolené jsou jen zabezpečené WebSocket URL začínající na wss:.",
  "settings.security.transports.url.invalid": "Zadejte platnou wss URL.",
  "settings.security.transports.url.label": "WebSocket URL",
  "settings.sparkAccount.enabled.label": "Povolit Spark účet",
  "settings.sparkAccount.advanced": "Pokročilé volby",
  "settings.sparkAccount.form.customDescription":
    "{appName} přijímá Spark platby do vaší vlastní peněženky.",
  "settings.sparkAccount.form.description":
    "{appName} tuto Spark peněženku odvodí z klíče pro obnovu účtu.",
  "settings.sparkAccount.form.title": "Spark účet",
  "settings.sparkAccount.mnemonic.description":
    "Mnemonic uchovejte v tajnosti. Kdokoli s ním má přístup ke Spark peněžence.",
  "settings.sparkAccount.mnemonic.label": "Mnemonic peněženky",
  "settings.sparkAccount.privacyMode.description":
    "Zapne režim soukromí Spark peněženky pro Lightning platby.",
  "settings.sparkAccount.privacyMode.label": "Zapnout privacy mode",
  "settings.sparkAccount.privacyMode.loadError":
    "Nastavení privacy mode ve Sparku se nepodařilo načíst.",
  "settings.sparkAccount.privacyMode.loading": "Načítám privacy mode...",
  "settings.sparkAccount.syncPointer.description":
    "Lokální ukazatel synchronizace pro periodické přeskenování historie. Pokud ukazatel ještě neexistuje, použije se dnešní datum; přeskenování se z něj dívá jen 72 hodin zpět.",
  "settings.sparkAccount.syncPointer.invalid": "Zadejte platné datum.",
  "settings.sparkAccount.syncPointer.label": "Poslední synchronizované datum",
  "settings.sparkAccount.wallet.cancel": "Zrušit",
  "settings.sparkAccount.wallet.change": "Změnit peněženku…",
  "settings.sparkAccount.wallet.changeDialog.current":
    "Tuto peněženku už používáte.",
  "settings.sparkAccount.wallet.changeDialog.description":
    "Vyberte peněženku, do které mají chodit nové Spark platby.",
  "settings.sparkAccount.wallet.changeDialog.inUse": "Právě se používá.",
  "settings.sparkAccount.wallet.changeDialog.invalid":
    "Toto není platný mnemonic o 12 slovech.",
  "settings.sparkAccount.wallet.changeDialog.title": "Změnit peněženku",
  "settings.sparkAccount.wallet.changeDialog.wordCount": "{value}/12 slov",
  "settings.sparkAccount.wallet.custom.description":
    "Spark peněženka, kterou přidáte jejím 12slovným mnemonicem.",
  "settings.sparkAccount.wallet.custom.title": "Vlastní peněženka",
  "settings.sparkAccount.wallet.label": "Peněženka",
  "settings.sparkAccount.wallet.payky.description":
    "Odvozená z klíče pro obnovu účtu.",
  "settings.sparkAccount.wallet.payky.title": "Peněženka {appNameGen}",
  "settings.sparkAccount.wallet.switch": "Přepnout",
  "settings.sparkAccount.wallet.warning.funds":
    "Peníze zůstanou v současné peněžence a tady už nebudou vidět. Nejdřív je vyberte, nebo si uschovejte její mnemonic.",
  "settings.sparkAccount.wallet.warning.invoices":
    "Nezaplacené faktury současné peněženky se už nezaznamenají.",
  "settings.supportChat.teamUnavailable":
    "Podpora je teď nedostupná. Zkontrolujte připojení a zkuste to znovu.",
  "settings.supportChat.inbox.unverified":
    "Nepodařilo se ověřit, kam vám může podpora odpovědět, takže zatím nemusí mít jak odpovědět.",
  "settings.supportChat.inbox.publishFailed":
    "Podpora vám zatím nemůže odpovědět: seznam relayí pro odpovědi se nepodařilo zveřejnit.",
  "settings.supportChat.inbox.publishAnyway": "Přesto zveřejnit",
  "settings.supportChat.inbox.confirm.title":
    "Přesto zveřejnit relaye pro odpovědi?",
  "settings.supportChat.inbox.confirm.description":
    "Pokud už váš účet má seznam relayí pro soukromé zprávy, například z Linky, bude nahrazen a zprávy posílané na jeho relaye vám tam nemusí docházet.",
  "settings.supportChat.inbox.confirm.confirm": "Zveřejnit",
  "settings.supportChat.inbox.confirm.cancel": "Zrušit",
  "settings.supportChat.title": "Kontaktovat podporu",
  "settings.supportChat.description": "Napište týmu {appNameGen}",
  "settings.supportChat.empty":
    "Zatím tu nejsou žádné zprávy. Popište, s čím potřebujete pomoct, a tým {appNameGen} vám odpoví tady.",
  "settings.supportChat.loadFailed":
    "Konverzaci se nepodařilo načíst. Zkontrolujte připojení a zkuste to znovu.",
  "settings.supportChat.retry": "Zkusit znovu",
  "settings.supportChat.message.label": "Zpráva",
  "settings.supportChat.message.placeholder": "Napište zprávu…",
  "settings.supportChat.send": "Odeslat",
  "settings.supportChat.sent": "Odesláno",
  "settings.supportChat.sending": "Odesílám…",
  "settings.supportChat.notDelivered": "Nedoručeno. Zkusit znovu",
  "settings.assistant.title": "AI asistent",
  "settings.assistant.description":
    "Zeptejte se na účty, platby a jak {appName} funguje",
  "settings.assistant.empty":
    "Zeptejte se na své účty a platby nebo na to, jak {appName} funguje. Asistent čte vaše data v tomto zařízení a dokumentaci {appNameGen} a odpovídá pomocí poskytovatele AI.",
  "settings.assistant.emptyPublic":
    "Zeptejte se, jak {appName} funguje. Asistent čte dokumentaci a kód {appNameGen}, ne vaše data, a odpovídá pomocí poskytovatele AI.",
  "settings.assistant.suggestion.openBills": "Které účty jsou ještě otevřené?",
  "settings.assistant.suggestion.latestPayments":
    "Jaké byly moje poslední platby?",
  "settings.assistant.suggestion.today": "Kolik dnes přišlo na tržbách?",
  "settings.assistant.suggestion.howSplit": "Jak funguje rozdělení účtu?",
  "settings.assistant.suggestion.howRefund": "Jak vrátím platbu?",
  "settings.assistant.message.label": "Dotaz",
  "settings.assistant.message.placeholder": "Zeptejte se…",
  "settings.assistant.send": "Odeslat",
  "settings.assistant.stop": "Zastavit",
  "settings.assistant.thinking": "Přemýšlím…",
  "settings.assistant.lookingUp.data": "Procházím vaše data…",
  "settings.assistant.lookingUp.docs": "Čtu dokumentaci…",
  "settings.assistant.newConversation": "Nová konverzace",
  "settings.chat.scrollToLatest": "Přejít na nejnovější zprávu",
  "settings.assistant.stopped": "Zastaveno",
  "settings.assistant.failed": "Nepodařilo se odpovědět. Zkusit znovu",
  "settings.support": "PODPORA A INFORMACE",
  "catalog.tables.add": "Přidat stůl",
  "catalog.tables.delete": "Smazat stůl",
  "catalog.tables.delete.confirm.cancel": "Zrušit",
  "catalog.tables.delete.confirm.confirm": "Smazat",
  "catalog.tables.delete.confirm.description":
    "Uzavřené účty si stůl {name} ponechají, ale nepůjde ho přiřadit k novým.",
  "catalog.tables.delete.confirm.title": "Smazat stůl {name}?",
  "catalog.tables.delete.hasOpenBills":
    "Stůl {name} má otevřený účet. Nejdřív ho zaplaťte nebo přesuňte na jiný stůl.",
  "catalog.tables.description": "Správa stolů a míst k sezení",
  "catalog.tables.empty.description":
    "Přidejte stoly ve svém podniku, abyste k nim mohli přiřazovat účty.",
  "catalog.tables.empty.title": "Zatím žádné stoly",
  "catalog.tables.emptySearch": "Hledání nenašlo žádné stoly.",
  "catalog.tables.form.card.description":
    "Název a počet míst zobrazené při přiřazování stolu k účtu.",
  "catalog.tables.form.card.title": "Detaily",
  "catalog.tables.form.code.description":
    "Zatím se nepoužívá - rezervováno pro budoucí QR kód, který bude tento stůl identifikovat.",
  "catalog.tables.form.code.label": "Kód",
  "catalog.tables.form.invalidId": "Neplatné ID stolu.",
  "catalog.tables.form.name.invalid": "Zadejte název.",
  "catalog.tables.form.name.label": "Název",
  "catalog.tables.form.name.placeholder": "např. Stůl 5",
  "catalog.tables.form.notFound": "Tento stůl už neexistuje.",
  "catalog.tables.form.save.create": "Přidat stůl",
  "catalog.tables.form.saved.create": "Stůl přidán.",
  "catalog.tables.form.seatCount.invalid": "Zadejte platný počet míst.",
  "catalog.tables.form.seatCount.label": "Počet míst",
  "catalog.tables.form.seatCount.placeholder": "např. 4",
  "catalog.tables.form.title.create": "Přidat stůl",
  "catalog.tables.form.title.edit": "Upravit stůl",
  "catalog.tables.search": "Hledat stoly...",
  "catalog.tables.search.clear.aria": "Vymazat hledání",
  "catalog.tables.seatCount": "{value} míst",
  "catalog.tables.title": "Stoly",
  "settings.taxRates.activate": "Znovu aktivovat {name}",
  "settings.taxRates.activate.confirm.cancel": "Zrušit",
  "settings.taxRates.activate.confirm.confirm": "Aktivovat",
  "settings.taxRates.activate.confirm.description":
    "{name} bude znovu dostupná při přiřazování daňových sazeb katalogovým položkám.",
  "settings.taxRates.activate.confirm.title": "Znovu aktivovat {name}?",
  "settings.taxRates.add": "Přidat sazbu",
  "settings.taxRates.add.title": "Přidat daňovou sazbu",
  "settings.taxRates.archive": "Archivovat {name}",
  "settings.taxRates.archive.confirm.cancel": "Zrušit",
  "settings.taxRates.archive.confirm.confirm": "Archivovat",
  "settings.taxRates.archive.confirm.description":
    "{name} se skryje z nabídky u nových katalogových položek. Stávající položky ji mají dál, dokud je nezměníte. Později ji lze znovu aktivovat.",
  "settings.taxRates.archive.confirm.title": "Archivovat {name}?",
  "settings.taxRates.archived.title": "Archivované",
  "settings.taxRates.default.set": "Nastavit {name} jako výchozí",
  "settings.taxRates.default.unset": "Zrušit {name} jako výchozí",
  "settings.taxRates.description":
    "Sazbu po vytvoření nelze upravit ani smazat — místo změny procenta ji archivujte a založte novou, pokud se sazba reálně změní.",
  "settings.taxRates.empty": "Zatím žádné daňové sazby.",
  "settings.taxRates.name.invalid": "Zadejte název.",
  "settings.taxRates.name.label": "Název",
  "settings.taxRates.name.placeholder": "např. Základní sazba",
  "settings.taxRates.rate.description":
    "Procento, např. 21 nebo 12,5. Po uložení již nelze změnit.",
  "settings.taxRates.rate.invalid": "Zadejte procento mezi 0 a 100.",
  "settings.taxRates.rate.label": "Sazba (%)",
  "settings.taxRates.rename": "Přejmenovat {name}",
  "settings.taxRates.rename.input": "Nový název pro {name}",
  "settings.taxRates.title": "Daňové sazby",
  "settings.theme.dark.description": "Vždy použít tmavé rozhraní",
  "settings.theme.dark.title": "Tmavý",
  "settings.theme.light.description": "Vždy použít světlé rozhraní",
  "settings.theme.light.title": "Světlý",
  "settings.theme.mode.description":
    "Vyberte pevný motiv nebo nastavení podle zařízení.",
  "settings.theme.mode.title": "Režim vzhledu",
  "settings.theme.system.description": "Řídit se nastavením operačního systému",
  "settings.theme.system.title": "Auto",
  "settings.theme.title": "Motiv",
  "settings.tips.enabled.description":
    "Zákazníci mohou při placení přidat spropitné.",
  "settings.tips.enabled.label": "Povolit spropitné",
  "settings.tips.fixedAmounts.add": "Přidat pevnou částku",
  "settings.tips.fixedAmounts.description":
    "Zákazníci mohou při placení vybrat tyto částky v {currency}.",
  "settings.tips.fixedAmounts.duplicate": "Tato pevná částka už je v seznamu.",
  "settings.tips.fixedAmounts.invalid":
    "Zadejte kladnou částku nejvýše se dvěma desetinnými místy.",
  "settings.tips.fixedAmounts.label": "Předvolené pevné částky",
  "settings.tips.fixedAmounts.maximum":
    "Můžete přidat nejvýše čtyři předvolené pevné částky.",
  "settings.tips.fixedAmounts.placeholder": "např. 20,00",
  "settings.tips.form.description":
    "Nastavte rychlé volby spropitného zobrazované při placení.",
  "settings.tips.form.title": "Možnosti spropitného",
  "settings.tips.percentages.add": "Přidat procento",
  "settings.tips.percentages.description":
    "Zákazníci mohou při placení vybrat tato procenta.",
  "settings.tips.percentages.duplicate": "Toto procento už je v seznamu.",
  "settings.tips.percentages.invalid": "Zadejte celé procento od 1 do 100.",
  "settings.tips.percentages.label": "Předvolené procentní hodnoty",
  "settings.tips.percentages.maximum":
    "Můžete přidat nejvýše čtyři předvolené procentní hodnoty.",
  "settings.tips.percentages.placeholder": "např. 15",
  "settings.tips.percentages.value": "{value} %",
  "settings.tips.preset.remove": "Odebrat {value}",
  "settings.tips.reset": "Obnovit výchozí hodnoty",
  "settings.tips.save": "Uložit spropitné",
  "settings.tips.saved": "Nastavení spropitného uloženo.",
  "settings.tips.title": "Spropitné",
  "settings.title": "Nastavení",
  "settings.withdrawals.description":
    "Odeslat bitcoin ze Spark účtu on-chain nebo přes Lightning",
  "settings.withdrawals.title": "Výběry",
  "settings.taxesGroup": "DANĚ A DOKLADY",
  "settings.tips.nav.on": "Zapnuto",
  "settings.tips.nav.off": "Vypnuto",
  "settings.paymentAccounts.nav.none": "Žádné",
  "settings.taxRates.nav.description": "Sazby DPH pro vaše položky",
  "access.action.acknowledgeExcess": "Potvrdit přeplatek",
  "access.action.aiAccess": "Změnit přístup AI k datům",
  "access.action.cashuMints": "Změnit minty Cashu",
  "access.action.moveCashuFunds": "Přesunout prostředky mezi minty",
  "access.action.cancelPayment": "Zrušit platbu",
  "access.action.changePin": "Změnit PIN",
  "access.action.confirmClosedDespiteCancellation":
    "Označit zahozený účet jako uzavřený",
  "access.action.confirmPaidDespiteCancellation":
    "Označit zrušenou platbu jako zaplacenou",
  "access.action.createItem": "Vytvořit položku katalogu",
  "access.action.disable": "Vypnout řízení přístupu",
  "access.action.exportDatabase": "Exportovat databázi aplikace",
  "access.action.revealRecoveryPhrase": "Zobrazit obnovovací frázi",
  "access.action.discardBill": "Zahodit účet",
  "access.action.enable": "Zapnout řízení přístupu se současným PINem",
  "access.action.markCashPaid": "Potvrdit přijetí hotovosti",
  "access.action.markIbanPaid": "Potvrdit příchod převodu",
  "access.action.refund": "Vrátit peníze",
  "access.action.removeAccount": "Odebrat účet z tohoto zařízení",
  "access.action.removeLines": "Odebrat položky z účtu",
  "access.action.switchAccount": "Přepnout účet",
  "access.action.unblock": "Odblokovat zařízení",
  "access.action.withdraw": "Vybrat prostředky",
  "access.attempts.continue": "Pokračovat",
  "access.attempts.title":
    "Špatné PINy zadané na tomto zařízení od posledního správného: {count}",
  "access.cancel": "Zrušit",
  "access.changePin": "Změnit PIN",
  "access.description":
    "Jeden PIN majitele zamyká nastavení a riskantní akce. Každé zařízení si drží oprávnění, která mu dáte; PIN odemkne vše ostatní. Chrání před personálem a zákazníky u pokladny — ne před útočníkem.",
  "access.device.adminWarning":
    "S oprávněními Majitel toto zařízení nepotřebuje PIN na nic kromě změny PINu, vypnutí řízení přístupu a odblokování zařízení.",
  "access.device.blocked": "PIN zablokován",
  "access.device.name": "Název zařízení",
  "access.device.permissions": "Oprávnění",
  "access.device.permissions.description":
    "Co toto zařízení smí bez PINu. Vyberte předvolbu a pak ji upravte.",
  "access.device.preset": "Oprávnění zařízení {name}",
  "access.device.remove": "Odebrat",
  "access.device.remove.confirm": "Odebrat zařízení",
  "access.device.remove.description":
    "Jeho oprávnění se smažou. Pokud se zařízení dál používá, objeví se znovu bez oprávnění.",
  "access.device.remove.title": "Odebrat {name}?",
  "access.device.rename": "Přejmenovat",
  "access.device.this": "Toto zařízení",
  "access.device.unblock": "Odblokovat",
  "access.devices.add": "Přidat zařízení",
  "access.devices.description":
    "Zařízení tohoto účtu a co každé smí bez PINu. Zařízení se objeví, jakmile se synchronizuje.",
  "access.devices.title": "Zařízení",
  "access.nav.description": "PIN majitele a oprávnění zařízení",
  "access.newPin.description":
    "4–8 číslic. Nepoužívejte PIN z platební karty ani telefonu: jeho hash je uložen na každém zařízení účtu a v každém exportu databáze.",
  "access.newPin.label": "Nový PIN",
  "access.newPin.mismatch": "PINy se neshodují.",
  "access.newPin.repeat": "Zopakujte PIN",
  "access.permission.activity": "Historie",
  "access.permission.activity.description":
    "Historie plateb a účtů, detail platby, opakování EET, AI asistent",
  "access.permission.admin": "Správa",
  "access.permission.admin.description":
    "Platební účty, účty, profil, zabezpečení, EET, export dat, ladicí konzole, přístup AI k datům, řízení přístupu",
  "access.permission.catalog": "Katalog",
  "access.permission.catalog.description":
    "Položky, kategorie a stoly, i založení položky z účtu",
  "access.permission.confirm": "Potvrzování plateb",
  "access.permission.confirm.description":
    "Ručně potvrdit, že dorazila hotovost nebo převod",
  "access.permission.discard": "Rušení",
  "access.permission.discard.description":
    "Zahodit účet, odebrat z něj položky, zrušit platbu",
  "access.permission.refund": "Vratky",
  "access.permission.refund.description": "Vratky a potvrzení přeplatku",
  "access.permission.sell": "Prodej",
  "access.permission.sell.description":
    "Domovská obrazovka, účty, rozdělení účtu, platby a spropitné",
  "access.permission.settings": "Nastavení",
  "access.permission.settings.description":
    "Údaje o firmě, daně, číselné řady, spropitné, domovská obrazovka, podpora",
  "access.permission.stats": "Statistiky",
  "access.permission.stats.description":
    "Statistiky prodeje: tržby, způsoby platby, nejprodávanější položky, očekávaná hotovost",
  "access.phrase.back": "Zpět na PIN",
  "access.phrase.description":
    "Fráze pro obnovení účtu odemkne na tomto zařízení vše a zruší blokaci PINu.",
  "access.phrase.label": "Fráze pro obnovení",
  "access.phrase.setNewPin": "Nastavit nový PIN",
  "access.phrase.submit": "Odemknout",
  "access.phrase.warning":
    "Psaní fráze pro obnovení u pokladny ji může prozradit kamerám a lidem okolo. Otevírá celý účet. Lepší je odblokovat zařízení z jiného zařízení v Nastavení → Přístup.",
  "access.phrase.wrong": "Tohle není fráze pro obnovení tohoto účtu.",
  "access.pin.blocked.description":
    "Příliš mnoho špatných PINů. Majitel může toto zařízení odblokovat z jiného zařízení v Nastavení → Přístup, nebo tady frází pro obnovení. Zařízení si mezitím drží svá oprávnění.",
  "access.pin.blocked.title": "Zadávání PINu je na tomto zařízení zablokované",
  "access.pin.cancel": "Zrušit",
  "access.pin.entered": "Zadaných číslic: {count}",
  "access.pin.erase": "Smazat",
  "access.pin.forgot": "Zapomenutý PIN",
  "access.pin.help":
    "Neznáte PIN? Požádejte majitele, aby ho zadal, nebo aby na tomto zařízení povolil {permission}.",
  "access.pin.submit": "OK",
  "access.pin.title": "Zadejte PIN",
  "access.pin.why.action": "{action} vyžaduje PIN",
  "access.pin.why.route": "Tato obrazovka vyžaduje {permission}",
  "access.pin.wrong":
    "Špatný PIN. Zbývající pokusy do zablokování zařízení: {count}",
  "access.preset.basic": "Základ",
  "access.preset.custom": "Vlastní",
  "access.preset.manager": "Manažer",
  "access.preset.none": "Nic",
  "access.preset.owner": "Majitel",
  "access.preset.shiftLead": "Vedoucí směny",
  "access.preset.staff": "Obsluha",
  "access.save": "Uložit",
  "access.status.off": "Řízení přístupu je vypnuté",
  "access.status.on": "Řízení přístupu je zapnuté",
  "access.title": "Přístup",
  "access.turnOff": "Vypnout",
  "access.turnOn": "Zapnout",
  "access.webWarning":
    "V prohlížeči na počítači je tento zámek jen kosmetický: kdo otevře vývojářské nástroje, obejde ho. Smysl má jen v aplikaci pro Android, ideálně v kiosk režimu.",
  "access.wizard.back": "Zpět",
  "access.wizard.devices.description":
    "Co smí každé zařízení bez PINu. Zařízení, které se ještě nesynchronizovalo, tu není a začne bez oprávnění.",
  "access.wizard.devices.title": "Výchozí oprávnění zařízení",
  "access.wizard.keepPin": "Použít současný PIN",
  "access.wizard.next": "Dál",
  "access.wizard.noPin": "Nastavte nový PIN; žádný současný není.",
  "access.wizard.pin.description":
    "PIN majitele odemkne vše. Měl by ho znát jen majitel.",
  "access.wizard.pin.title": "PIN majitele",
  "settings.paymentAccounts.method.lightningAddress": "Lightning adresa",
  "settings.paymentAccounts.status.missingLightningAddress":
    "Lightning adresa není nastavená",
  "settings.lightningAddress.enabled.label":
    "Přijímat platby na Lightning adresu",
  "settings.lightningAddress.form.title": "Vlastní peněženka",
  "settings.lightningAddress.form.description":
    "Platby jdou rovnou do peněženky za adresou. {appName} si od ní jen vyžádá invoice a sleduje, jestli je zaplacený; nedrží žádné klíče ani peníze.",
  "settings.lightningAddress.address.label": "Lightning adresa",
  "settings.lightningAddress.address.placeholder": "jmeno@penezenka.cz",
  "settings.lightningAddress.address.description":
    "Peněženka musí podporovat LUD-21 verify a prozradit důkaz platby (preimage). Jinak {appName} nepozná, že je platba zaplacená.",
  "settings.lightningAddress.address.required": "Zadejte Lightning adresu.",
  "settings.lightningAddress.address.invalid":
    "Tohle není Lightning adresa. Vypadá jako jmeno@penezenka.cz.",
  "settings.lightningAddress.submit": "Ověřit a uložit",
  "settings.lightningAddress.saved": "Uloženo.",
  "settings.lightningAddress.error.verifyUnsupported":
    "Tato peněženka neumožní {appNameDat} ověřit, jestli je invoice zaplacený (LUD-21 verify). Použijte jinou peněženku.",
  "settings.lightningAddress.error.rejected":
    "Peněženka požadavek odmítla. Zkontrolujte adresu.",
  "settings.lightningAddress.error.unreachable":
    "Peněženka není dostupná. Zkontrolujte adresu a připojení.",
  "settings.lightningAddress.error.invalid":
    "Peněženka odpověděla něčím, s čím {appName} neumí pracovat.",
  "settings.paymentAccounts.method.bitcoin": "Bitcoin",
  "settings.bitcoin.enabled.label": "Přijímat Bitcoin",
  "settings.bitcoin.wallet.spark": "Spark",
  "settings.bitcoin.wallet.linky": "Peněženka Linky",
  "settings.salesGroup": "PRODEJ",
  "catalog.items.form.category.new.placeholder": "Nová kategorie",
  "settings.paymentAccounts.status.nativeOnly": "Pouze v nativní aplikaci",
  "settings.cashuAccount.balance.switchUnit": "Přepnout jednotku",
  "settings.fiat.czk.symbol": "Kč",
  "settings.fiat.eur.symbol": "€",
  "settings.fiat.usd.symbol": "$",
  "settings.profile.vatPayer": "Plátce DPH",
  "settings.bitcoin.mainMethod": "Hlavní metoda",
  "settings.cashuAccount.qr.title": "Platební QR",
  "settings.cashuAccount.qr.both": "Obojí",
  "settings.cashuAccount.qr.cashu": "Cashu",
  "settings.cashuAccount.qr.lightning": "Lightning",
} satisfies Record<keyof typeof enSettings, string>
