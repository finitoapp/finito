import type { enSettings } from "../en/settings.ts"

export const skSettings = {
  "settings.about.app.title": "{appName}",
  "settings.about.description": "Verzia, podmienky a kontakt",
  "settings.about.github.description": "Zapojte sa do vývoja aplikácie",
  "settings.about.github.title": "Zdrojový kód na GitHube",
  "settings.about.privacy.body":
    "{appName} - ZÁSADY OCHRANY SÚKROMIA\n\n1. ZBER DÁT\n{appName} nepredáva osobné údaje a je navrhnuté tak, aby aplikačné dáta zostávali lokálne vo vašom zariadení. Aplikácia ukladá nastavenia terminálu, katalógové dáta, záznamy platieb a súvisiace prevádzkové dáta lokálne a synchronizuje aplikačné dáta cez Evolu.\n\n2. PLATOBNÉ DÁTA\nPlatobné a terminálové dáta môžu obsahovať sumy, časové údaje, názvy položiek, stav platby, informácie o Spark peňaženke, identifikátory zariadení a ďalšie záznamy potrebné na prevádzku bitcoinového platobného terminálu. Chráňte svoje zariadenie, prihlasovacie údaje, zálohy a prístupové dáta k peňaženke, najmä obnovovaciu frázu.\n\n3. SIEŤOVÁ KOMUNIKÁCIA\nAplikácia môže komunikovať s:\n- infraštruktúrou Evolu na synchronizáciu lokálnych aplikačných dát\n- Spark operátormi a poskytovateľmi služieb Spark na prevádzku Spark peňaženky a odosielanie či prijímanie bitcoinových platieb\n- Lightning alebo peňaženkovými službami používanými na vytvorenie alebo vyrovnanie platieb\n- cenovými alebo kurzovými API, ak je zapnutý fiat prepočet\n- Open Food Facts a Open Beauty Facts na dohľadanie naskenovaných čiarových kódov, ak je zapnuté dohľadanie produktov\n- Server {appNameGen} a jeho poskytovateľa AI na odpovede AI asistenta, ak je zapnutý: vaše otázky, odpovede asistenta a, ak to povolíte, účty a platby, ktoré asistent číta\n\nTieto služby môžu mať vlastné zásady ochrany súkromia, logy a pravidlá uchovávania dát.\n\n4. ANALYTIKA A HLÁSENIE CHÝB\n{appName} nepoužíva analytické ani sledovacie služby. K dispozícii je voliteľné hlásenie chýb cez Sentry, ktoré pomáha diagnostikovať pády a chyby aplikácie. Je vo východiskovom stave vypnuté a aktivuje sa len vtedy, keď ho zapnete v Nastavenia > O aplikácii > Dáta a súkromie. Po zapnutí môžu hlásenia chýb obsahovať informácie o zariadení a aplikácii a chybové správy a stack trace; obnovovacie frázy a čísla bankových účtov sú pred odoslaním automaticky redigované.\n\n5. SIEŤ SPARK\nPlatby cez Spark peňaženku spracúvajú Spark operátori a poskytovatelia služieb Spark, ktorí môžu vidieť sumy transakcií, časovanie, identifikátory peňaženky a súvisiace metadáta.\n\n6. ZÁLOHY A SYNCHRONIZÁCIA\nAk sú zapnuté synchronizačné alebo zálohovacie funkcie, aplikačné dáta môžu byť prenášané do synchronizačnej infraštruktúry. So synchronizovanými dátami zaobchádzajte ako s prevádzkovými obchodnými dátami a chráňte každé zariadenie, ktoré k nim má prístup.\n\n7. KONTAKT\nKontaktné údaje pre otázky súkromia budú zverejnené v dokumentácii projektu.\n\nPosledná aktualizácia: október 2026",
  "settings.about.privacy.description":
    "Dáta aplikácie sa ukladajú lokálne a synchronizujú cez Evolu.",
  "settings.about.privacy.heading": "Zásady ochrany súkromia {appNameGen}",
  "settings.about.privacy.summary":
    "Prispôsobené pre lokálny bitcoinový platobný terminál.",
  "settings.about.privacy.title": "Dáta a súkromie",
  "settings.about.terms.body":
    '{appName} - PODMIENKY POUŽÍVANIA\n\n1. PRIJATIE\nPoužívaním tejto aplikácie platobného terminálu súhlasíte s týmito podmienkami.\n\n2. POVAHA SLUŽBY\n{appName} je lokálny bitcoinový platobný terminál využívajúci protokol Spark pre bitcoinové a Lightning platby a súvisiacu platobnú infraštruktúru. Zodpovedáte za konfiguráciu aplikácie, výber služieb aj za nakladanie s prijatými prostriedkami.\n\n3. PRÍSTUP A OBNOVA\nChráňte svoje zariadenie, prihlasovacie údaje, zálohy a všetky prístupové dáta k peňaženke, najmä obnovovaciu frázu. {appName} nemôže obnoviť stratené prihlasovacie údaje, stratenú obnovovaciu frázu ani prostriedky odoslané na nesprávne ciele.\n\n4. BEZ ZÁRUKY\nSoftvér sa poskytuje "tak, ako je", bez akejkoľvek záruky. Používate ho na vlastné riziko.\n\n5. OBMEDZENIE ZODPOVEDNOSTI\nNezodpovedáme za stratu prostriedkov, prerušenie podnikania, zlyhanie platby, chyby v softvéri, chybu používateľa ani zlyhanie siete alebo služby tretej strany.\n\n6. SPARK PEŇAŽENKA\nSpark peňaženka je nekustodiálna: jej kľúče sa odvodzujú vo vašom zariadení z vašej obnovovacej frázy. Prevody závisia od Spark operátorov a poskytovateľov služieb Spark, ktorí môžu zlyhať, byť nedostupní alebo zmeniť svoje podmienky. Držte len zostatky, o ktoré ste pripravení prísť.\n\n7. SÚKROMIE\n{appName} je navrhnuté tak, aby ukladalo aplikačné dáta lokálne a synchronizovalo ich cez Evolu. Platby však môžu byť spracovávané cez sieť Spark, Lightning služby alebo inú infraštruktúru tretích strán, ktoré môžu mať vlastné zásady ochrany súkromia a logy.\n\n8. AKTUALIZÁCIE\nTieto podmienky môžu byť aktualizované. Ďalšie používanie {appNameGen} znamená prijatie aktualizovaných podmienok.\n\nPosledná aktualizácia: október 2026',
  "settings.about.terms.description":
    "Prečítajte si podmienky platné pri používaní {appNameGen}.",
  "settings.about.terms.heading": "Podmienky používania {appNameGen}",
  "settings.about.terms.summary":
    "Prispôsobené pre lokálny bitcoinový platobný terminál.",
  "settings.about.terms.title": "Podmienky používania",
  "settings.about.title": "O aplikácii",
  "settings.accountAndSync": "ÚČET A SYNCHRONIZÁCIA",
  "settings.accounts.add.title": "Pridať účet",
  "settings.accounts.elsewhere.title": "Tento účet na inom zariadení",
  "settings.accounts.create.confirm.cancel": "Zrušiť",
  "settings.accounts.create.confirm.confirm": "Vytvoriť účet",
  "settings.accounts.create.confirm.description":
    "Prepnete sa z účtu {name} a založíte úplne nový účet s vlastnou recovery phrase.",
  "settings.accounts.create.confirm.title": "Vytvoriť nový účet?",
  "settings.accounts.list.active": "Aktívny",
  "settings.accounts.list.createdAt": "Vytvorené",
  "settings.accounts.list.empty": "Na tomto zariadení nie sú uložené účty.",
  "settings.accounts.list.remove": "Odobrať",
  "settings.accounts.list.switch": "Prepnúť",
  "settings.accounts.list.title": "V tomto zariadení",
  "settings.accounts.nav.description":
    "Vyberte, ktorý používateľský účet je na tomto zariadení aktívny",
  "settings.accounts.nav.title": "Prepnutie používateľského účtu",
  "settings.accounts.remove.confirm.cancel": "Ponechať účet",
  "settings.accounts.remove.confirm.confirm": "Odobrať účet",
  "settings.accounts.remove.confirm.description":
    "Zariadenie tento účet aj jeho údaje zabudne. Vrátiť ho späť ide len pomocou jeho recovery phrase — bez nej je všetko v účte nadobro stratené.",
  "settings.accounts.remove.confirm.title": "Odobrať účet {name}?",
  "settings.accounts.restore.failed":
    "Účet sa nepodarilo obnoviť. Skúste to prosím znova.",
  "settings.accounts.restore.mnemonic.checksum":
    "Slová sú platné, ale fráza nesedí. Skontrolujte poradie a preklepy.",
  "settings.accounts.restore.mnemonic.foreign":
    "Toto vyzerá ako seed z inej peňaženky. {appName} obnovuje len svoje 20-slovné frázy.",
  "settings.accounts.restore.mnemonic.invalid":
    "Zadajte 20 slov z recovery phrase {appNameGen}.",
  "settings.accounts.restore.mnemonic.label": "Recovery phrase",
  "settings.accounts.restore.mnemonic.required": "Recovery phrase je povinná.",
  "settings.accounts.restore.mnemonic.wordCount": "Recovery phrase má 20 slov.",
  "settings.accounts.title": "Účet aplikácie",
  "settings.appVersion": "Verzia aplikácie:",
  "settings.appVersionCode": "Kód verzie:",
  "settings.appearance": "VZHĽAD A JAZYK",
  "settings.cashRegisterAccount.enabled.label": "Povoliť pokladnicu",
  "settings.cardSwitchioAccount.enabled.label": "Zapnúť platobný terminál",
  "settings.qerkoTerminal.advanced": "Ďalšie možnosti",
  "settings.qerkoTerminal.code.back": "Späť",
  "settings.qerkoTerminal.code.confirm": "Potvrdiť",
  "settings.qerkoTerminal.code.expired": "Kód vypršal. Vyžiadajte si nový.",
  "settings.qerkoTerminal.code.instructions":
    "Zadajte štvormiestny kód, ktorý Qerko poslalo e-mailom vlastníkovi zadanej firmy. Ak e-mail nedorazil, kontaktujte technickú podporu Qerko.",
  "settings.qerkoTerminal.code.invalid":
    "Kód nie je správny. Zostávajúce pokusy: {count}.",
  "settings.qerkoTerminal.code.label": "Potvrdzovací kód",
  "settings.qerkoTerminal.code.maxAttempts":
    "Príliš veľa chybných kódov. Vyžiadajte si nový.",
  "settings.qerkoTerminal.code.resend": "Poslať kód znova",
  "settings.qerkoTerminal.code.resendIn": "Kód môžete poslať znova o {time}.",
  "settings.qerkoTerminal.code.title": "Zadajte kód",
  "settings.qerkoTerminal.company.country.label": "Krajina",
  "settings.qerkoTerminal.company.identificationNumber.invalid":
    "Zadajte IČO firmy.",
  "settings.qerkoTerminal.company.identificationNumber.label": "IČO",
  "settings.qerkoTerminal.enabled.label": "Zapnúť terminál Qerko",
  "settings.qerkoTerminal.environment.description":
    "Sandbox pracuje s testovacími údajmi a nestrháva peniaze zo žiadnej skutočnej karty. Vyberte ho len na vyskúšanie prepojenia.",
  "settings.qerkoTerminal.environment.label": "Prostredie Qerko",
  "settings.qerkoTerminal.environment.production": "Produkcia",
  "settings.qerkoTerminal.environment.sandbox": "Sandbox (testovanie)",
  "settings.qerkoTerminal.error.unreachable":
    "Qerko sa nepodarilo zastihnúť. Skontrolujte pripojenie a skúste to znova.",
  "settings.qerkoTerminal.paired.company": "Firma",
  "settings.qerkoTerminal.paired.description":
    "Platby kartou na tomto zariadení pôjdu na terminál vybraný nižšie.",
  "settings.qerkoTerminal.paired.environmentReadOnly":
    "Ak chcete prostredie zmeniť, zrušte párovanie a spárujte znova.",
  "settings.qerkoTerminal.paired.keyName": "Názov prepojenia",
  "settings.qerkoTerminal.paired.title": "Prepojené s Qerkom",
  "settings.qerkoTerminal.requestCode": "Poslať kód",
  "settings.qerkoTerminal.status.noTerminal":
    "Na tomto zariadení nie je vybraný terminál",
  "settings.qerkoTerminal.status.notPaired": "Nespárované s Qerkom",
  "settings.cardSwitchioAccount.info.contract":
    "uzavretú zmluvu s poskytovateľom platobného riešenia, napríklad Comgate.",
  "settings.cardSwitchioAccount.info.description":
    "Na prijímanie platieb platobnou kartou potrebujete:",
  "settings.cardSwitchioAccount.info.softpos":
    "aplikáciu Switchio SoftPOS na tomto zariadení,",
  "settings.cardSwitchioAccount.info.softposLink":
    "O aplikácii Switchio SoftPOS",
  "settings.cardSwitchioAccount.info.title": "Platby platobnou kartou",
  "settings.cardSwitchioAccount.notInstalledWarning":
    "Aplikácia Switchio SoftPOS nie je na tomto zariadení nainštalovaná.",
  "settings.cardSwitchioAccount.nativeRuntimeWarning":
    "Platobný terminál je dostupný len v natívnej aplikácii.",
  "settings.catalog": "PONUKA",
  "settings.categories.add": "Pridať kategóriu",
  "settings.categories.delete": "Vymazať kategóriu",
  "settings.categories.delete.confirm.cancel": "Zrušiť",
  "settings.categories.delete.confirm.confirm": "Vymazať",
  "settings.categories.delete.confirm.description":
    "Položky priradené ku kategórii {name} sa po vymazaní zobrazia ako nekategorizované.",
  "settings.categories.delete.confirm.title": "Vymazať kategóriu {name}?",
  "settings.categories.description": "Zoskupte svoje produkty a služby",
  "settings.categories.empty.description":
    "Pridajte kategórie na zoskupenie produktov a služieb, potom ich priraďte vo formulári položky.",
  "settings.categories.empty.title": "Zatiaľ žiadne kategórie",
  "settings.categories.emptySearch": "Vyhľadávanie nenašlo žiadne kategórie.",
  "settings.categories.form.card.description":
    "Názov zobrazený pri zoskupovaní položiek a filtrovaní na účte.",
  "settings.categories.form.card.title": "Detaily",
  "settings.categories.form.invalidId": "Neplatné ID kategórie.",
  "settings.categories.form.name.invalid": "Zadajte názov.",
  "settings.categories.form.name.label": "Názov",
  "settings.categories.form.name.placeholder": "napr. Nápoje",
  "settings.categories.form.notFound": "Táto kategória už neexistuje.",
  "settings.categories.form.save.create": "Pridať kategóriu",
  "settings.categories.form.saved.create": "Kategória pridaná.",
  "settings.categories.form.title.create": "Pridať kategóriu",
  "settings.categories.form.title.edit": "Upraviť kategóriu",
  "settings.categories.search": "Hľadať kategórie...",
  "settings.categories.search.clear.aria": "Vymazať hľadanie",
  "settings.categories.title": "Kategórie",
  "settings.cashuAccount.title": "Cashu",
  "settings.cashuAccount.wallet.title": "Peňaženka zdieľaná s Linky",
  "settings.cashuAccount.wallet.description":
    "Platby Cashu idú do tej istej ecash peňaženky, ktorú ukazuje vaša aplikácia Linky. Jej zostatok zahŕňa aj peniaze prijaté v Linky.",
  "settings.cashuAccount.defaultMint": "Predvolený mint",
  "settings.cashuAccount.syncing": "Synchronizujem peňaženku s Linky...",
  "settings.cashuAccount.empty": "Peňaženka zatiaľ nemá žiadny ecash.",
  "settings.cashuMints.title": "Minty",
  "settings.cashuMints.known": "Vaše minty",
  "settings.cashuMints.suggested": "Odporúčané minty",
  "settings.cashuMints.empty": "Peňaženka zatiaľ nepozná žiadny mint.",
  "settings.cashuMints.default": "Predvolený",
  "settings.cashuMints.add": "Pridať mint",
  "settings.cashuMints.url": "Adresa mintu",
  "settings.cashuMints.addDescription":
    "Mint sa pred pridaním overí. Pridanie nemení predvolený mint ani to, ktoré tokeny platia vaše platby.",
  "settings.cashuMints.addError.invalid": "Toto nie je adresa mintu.",
  "settings.cashuMints.addError.unreachable": "Mint neodpovedal.",
  "settings.cashuMints.addError.rejected":
    "Mint bol odmietnutý: nenačítal sa, alebo uvádza kľúče iného mintu.",
  "settings.cashuMints.invalid": "Táto adresa mintu nie je platná.",
  "settings.cashuMints.infoUnavailable": "Mint neodpovedal.",
  "settings.cashuMints.balance": "Zostatok: {amount}",
  "settings.cashuMints.defaultWarning":
    "Nové platby Cashu použijú tento mint, aj v Linky. Lightning adresa v Linky bude ďalej platiť do starého mintu, kým predvolený mint nezmeníte v Linky.",
  "settings.cashuMints.setDefault": "Nastaviť ako predvolený",
  "settings.cashuMints.remove": "Odobrať mint",
  "settings.cashuMints.removeError.inUse":
    "Mint ešte drží ecash, preto ho nemožno odobrať.",
  "settings.cashuMints.move.title": "Presunúť prostriedky",
  "settings.cashuMints.move.description":
    "Presunie ecash z tohto mintu do predvoleného mintu {mint} cez Lightning.",
  "settings.cashuMints.move.amount": "Suma v sat",
  "settings.cashuMints.move.amountDescription":
    "Nechajte prázdne, ak chcete presunúť všetko.",
  "settings.cashuMints.move.estimate": "Odhadnúť náklady",
  "settings.cashuMints.move.estimateResult":
    "Dorazí {amount}; z tohto mintu odíde najviac {total}.",
  "settings.cashuMints.move.confirm": "Presunúť",
  "settings.cashuMints.movePinDetail": "{amount} do {mint}",
  "settings.cashuMints.moveError.unreachable":
    "Niektorý mint neodpovedal. Skúste to neskôr.",
  "settings.cashuMints.moveError.rejected": "Mint presun odmietol.",
  "settings.cashuMints.moveError.nothing": "Nie je čo presunúť.",
  "settings.cashuMints.moveError.insufficient":
    "Zostatok nepokryje túto sumu a poplatky.",
  "settings.cashuMints.moveError.pending":
    "Presun je na ceste a dokončí sa sám.",
  "settings.cashuAccount.mints": "Minty",
  "settings.cashuAccount.mintsDescription":
    "Predvolený mint, zostatky, presun prostriedkov",
  "settings.cashuAccount.withdraw": "Výber",
  "settings.cashuAccount.withdrawDescription": "Odoslať ecash cez Lightning",
  "settings.cashuAccount.enabled.label": "Prijímať Cashu",
  "settings.debugConsole.cashu.title": "Cashu peňaženka Linky (vývoj)",
  "settings.debugConsole.cashu.activeShard": "Aktívny shard: {index}",
  "settings.debugConsole.cashu.hydrated": "Synchronizované: {hydrated}",
  "settings.debugConsole.cashu.noBalance": "Žiadne dostupné proofy.",
  "settings.debugConsole.cashu.writeTestSetting":
    "Zapísať testovacie nastavenie pre Linky",
  "settings.debugConsole.clear": "Vymazať",
  "settings.debugConsole.description":
    "Zobraziť zachytený konzolový výstup aplikácie",
  "settings.debugConsole.empty":
    "Zatiaľ nie sú zachytené žiadne záznamy konzoly.",
  "settings.debugConsole.history.title": "Historie výstupu konzole",
  "settings.debugConsole.pause": "Pozastaviť",
  "settings.debugConsole.resume": "Pokračovať",
  "settings.debugConsole.title": "Debug Console",
  "settings.demoData.accountName": "Demo kaviareň",
  "settings.demoData.action": "Vytvoriť demo účet",
  "settings.demoData.action.pending": "Vytvára sa…",
  "settings.demoData.confirm.cancel": "Zrušiť",
  "settings.demoData.confirm.confirm": "Vytvoriť a vygenerovať",
  "settings.demoData.confirm.description":
    "Aplikácia sa prepne na nový demo účet a naplní ho fiktívnymi dátami. Vrátiť to ide len odobratím demo účtu.",
  "settings.demoData.confirm.title": "Vytvoriť demo účet?",
  "settings.demoData.current.description":
    "Všetko v ňom je fiktívne a nikdy sa nesynchronizuje. Na skutočný účet sa prepnete v sekcii Účty.",
  "settings.demoData.current.title": "Ste v demo účte",
  "settings.demoData.description":
    "Naplniť samostatný demo účet fiktívnymi predajmi",
  "settings.demoData.title": "Demo dáta",
  "settings.demoData.warning.duration":
    "Generovanie začne dneškom a postupuje deň po dni do minulosti. Tri mesiace trvajú asi pol hodiny, na telefóne dlhšie, ale môžete ho kedykoľvek zastaviť: rozpracovaný deň sa dokončí a doterajšia história zostane.",
  "settings.demoData.warning.irreversible":
    "Demo účet sa nenávratne naplní až tromi mesiacmi fiktívneho katalógu, stolov, platieb a refundácií. Nedajú sa mazať po jednom, len spolu s celým demo účtom.",
  "settings.demoData.warning.newAccount":
    "Na zariadení vznikne nový účet „{name}“ a stane sa aktívnym. Váš súčasný účet a jeho dáta zostanú nedotknuté; prepnete sa naň späť v sekcii Účty.",
  "settings.demoData.warning.relays":
    "Synchronizačné relaye sú pre demo účet vypnuté a nedajú sa zapnúť, takže sa fiktívne dáta nikdy nedostanú na relay ani do iného zariadenia.",
  "settings.demoData.warning.services":
    "Nič sa neodosiela do banky, platobného terminálu ani do siete Lightning: všetky vonkajšie služby sú simulované. EET zostáva vypnuté.",
  "settings.demoData.warning.title": "Prečítajte si pred generovaním",
  "settings.developers": "VÝVOJÁRI",
  "settings.donations.amount.invalid": "Zadajte kladný celý počet sats.",
  "settings.donations.amount.range": "Suma je mimo povolený rozsah daru.",
  "settings.donations.amount.required": "Zadajte sumu daru.",
  "settings.donations.create": "Vytvoriť faktúru",
  "settings.donations.create.pending": "Vytváram faktúru...",
  "settings.donations.description": "Podporte vývoj {appNameGen}",
  "settings.donations.fiat.description": "Používa aktuálne vybranú fiat menu.",
  "settings.donations.fiat.label": "Suma",
  "settings.donations.form.description":
    "Zadajte jednu sumu. Druhé pole sa dopočíta podľa aktuálneho BTC kurzu.",
  "settings.donations.form.title": "Suma daru",
  "settings.donations.history.amount": "{amount} sats",
  "settings.donations.history.empty.description":
    "Dary sa tu zobrazia, akonáhle nejaký príde.",
  "settings.donations.history.empty.title": "Zatiaľ žiadne dary",
  "settings.donations.history.error": "Históriu darov sa nepodarilo načítať.",
  "settings.donations.history.more": "Zobraziť ďalšie",
  "settings.donations.history.retry": "Skúsiť znova",
  "settings.donations.history.title": "Posledné dary",
  "settings.donations.invoice.backToSettings": "Späť do nastavení",
  "settings.donations.invoice.copied": "Faktúra skopírovaná.",
  "settings.donations.invoice.copy": "Skopírovať faktúru",
  "settings.donations.invoice.copyFailed": "Faktúru sa nepodarilo skopírovať.",
  "settings.donations.invoice.description":
    "Naskenujte túto Lightning faktúru pre zaplatenie.",
  "settings.donations.invoice.error": "Faktúru pre dar sa nepodarilo vytvoriť.",
  "settings.donations.invoice.missing": "Faktúra pre dar chýba.",
  "settings.donations.invoice.openWallet": "Otvoriť v peňaženke",
  "settings.donations.invoice.title": "Lightning faktúra",
  "settings.donations.invoice.verify.error": "Platbu sa nepodarilo overiť.",
  "settings.donations.invoice.verify.paid": "Platba prijatá",
  "settings.donations.invoice.verify.paid.description":
    "Ďakujeme za podporu vývoja tejto aplikácie.",
  "settings.donations.invoice.verify.waiting": "Čakám na platbu...",
  "settings.donations.metadata.error":
    "Darovaciu Lightning adresu sa nepodarilo načítať.",
  "settings.donations.rate.error": "BTC kurz sa nepodarilo načítať.",
  "settings.donations.sats.description": "Iba celé sats.",
  "settings.donations.sats.label": "Sats",
  "settings.donations.sats.range": "Povolený rozsah: {min}-{max} sats.",
  "settings.donations.title": "Dary",
  "settings.eet.certificate.description":
    "Certifikát, ktorý vydala CA EET na podpisovanie tržieb. Určuje evidujúce EIČ a {appName} si jeho heslo neukladá.",
  "settings.eet.certificate.eic": "Evidujúce EIČ",
  "settings.eet.certificate.error.expired": "Platnosť certifikátu skončila.",
  "settings.eet.certificate.error.fileRequired":
    "Vyberte súbor s certifikátom.",
  "settings.eet.certificate.error.notYetValid":
    "Certifikát ešte nie je platný.",
  "settings.eet.certificate.error.unreadable":
    "Súbor nie je čitateľný certifikát pokladnice.",
  "settings.eet.certificate.error.withoutEic": "Certifikát neuvádza EIČ.",
  "settings.eet.certificate.error.withoutKey":
    "Súbor neobsahuje súkromný kľúč k certifikátu.",
  "settings.eet.certificate.error.wrongPassword": "Heslo nie je správne.",
  "settings.eet.certificate.expired.description":
    "Tržby nie je možné evidovať, kým neimportujete nový certifikát.",
  "settings.eet.certificate.expired.title": "Platnosť certifikátu skončila",
  "settings.eet.certificate.expiresSoon.description":
    "Obnovte ho v portáli EET a importujte nový certifikát.",
  "settings.eet.certificate.expiresSoon.title":
    "Platnosť certifikátu čoskoro skončí",
  "settings.eet.certificate.file.description":
    "Súbor .p12 stiahnutý z portálu EET.",
  "settings.eet.certificate.file.label": "Súbor s certifikátom",
  "settings.eet.certificate.import": "Importovať certifikát",
  "settings.eet.certificate.imported": "Certifikát je importovaný",
  "settings.eet.certificate.none":
    "Zatiaľ nie je importovaný žiadny certifikát.",
  "settings.eet.certificate.password.label": "Heslo k certifikátu",
  "settings.eet.certificate.testBadge": "Testovací certifikát",
  "settings.eet.certificate.title": "Certifikát pokladnice",
  "settings.eet.certificate.validTo": "Platný do {date}",
  "settings.eet.enabled.description":
    "Evidujú sa len platby prijaté po zapnutí.",
  "settings.eet.enabled.incomplete":
    "EET nie je možné zapnúť, kým nie je nastavený certifikát a číslo evidenčnej jednotky.",
  "settings.eet.enabled.label": "Evidovať tržby v EET",
  "settings.eet.enabled.missing": "Na zapnutie EET doplňte {missing}.",
  "settings.eet.environment.description": "Kam {appName} tržby odosiela.",
  "settings.eet.environment.playground.description":
    "Na vyskúšanie EET. Tržby idú do testovacieho prostredia EET a neevidujú sa.",
  "settings.eet.environment.playground.title": "Sandbox",
  "settings.eet.environment.production.description":
    "Tržby sa evidujú u finančnej správy.",
  "settings.eet.environment.production.title": "Produkcia",
  "settings.eet.environment.productionUnavailable":
    "Produkcia v tejto verzii {appNameGen} zatiaľ nie je dostupná.",
  "settings.eet.environment.sandboxConfirm.cancel": "Zrušiť",
  "settings.eet.environment.sandboxConfirm.confirm": "Použiť sandbox",
  "settings.eet.environment.sandboxConfirm.description":
    "Tržby sa budú odosielať len do testovacieho prostredia EET. U finančnej správy sa evidovať nebudú.",
  "settings.eet.environment.sandboxConfirm.title": "Prepnúť EET do sandboxu?",
  "settings.eet.environment.saved": "Prostredie je uložené",
  "settings.eet.environment.testCertificateBlocksProduction":
    "Pred prepnutím do produkcie importujte produkčný certifikát.",
  "settings.eet.environment.title": "Prostredie",
  "settings.eet.establishment.description":
    "Číslo evidenčnej jednotky pridelené v MOJE daně.",
  "settings.eet.establishment.invalid": "Zadajte celé číslo bez úvodných núl.",
  "settings.eet.establishment.label": "Číslo evidenčnej jednotky",
  "settings.eet.gap.certificate": "certifikát pokladnice",
  "settings.eet.gap.certificateExpired": "platný certifikát",
  "settings.eet.gap.establishment": "číslo evidenčnej jednotky",
  "settings.eet.nav.off": "Vypnuté",
  "settings.eet.nav.production": "Zapnuté",
  "settings.eet.nav.sandbox": "Sandbox",
  "settings.eet.officialTest.description":
    "V sandboxe môžete namiesto súboru použiť niektorý z oficiálnych testovacích certifikátov finančnej správy.",
  "settings.eet.officialTest.loading":
    "Sťahujem oficiálne testovacie certifikáty…",
  "settings.eet.officialTest.show": "Použiť oficiálny testovací certifikát",
  "settings.eet.officialTest.title": "Oficiálne testovacie certifikáty",
  "settings.eet.officialTest.unavailable.description":
    "Teraz ich nie je možné stiahnuť. Importujte namiesto nich súbor s certifikátom.",
  "settings.eet.officialTest.unavailable.title":
    "Oficiálne testovacie certifikáty nie sú dostupné",
  "settings.eet.officialTest.use": "Použiť testovací certifikát {name}",
  "settings.eet.officialTest.useShort": "Použiť",
  "settings.eet.reporting.description":
    "Eviduje každú platbu prijatú na tomto účte v českom systéme EET 2.0. Platba zostane zaplatená, aj keď EET nie je dostupná.",
  "settings.eet.reporting.title": "Evidencia tržieb",
  "settings.eet.test.connection": "Otestovať spojenie",
  "settings.eet.test.description":
    "Overí nastavenia bez prijatia platby. Nič odoslané odtiaľto sa neeviduje ako tržba.",
  "settings.eet.test.errorCode": "Chyba {code}: {message}",
  "settings.eet.test.outcome.accepted": "EET testovaciu tržbu potvrdila.",
  "settings.eet.test.outcome.failed": "EET správu neprijala.",
  "settings.eet.test.outcome.verified": "EET testovaciu správu prijala.",
  "settings.eet.test.pok": "POK: {pok}",
  "settings.eet.test.rawRequest": "Požiadavka",
  "settings.eet.test.rawResponse": "Odpoveď",
  "settings.eet.test.sale": "Odoslať testovaciu tržbu",
  "settings.eet.test.title": "Test",
  "settings.eet.test.unavailable":
    "Najprv nastavte certifikát a číslo evidenčnej jednotky.",
  "settings.eet.tip.business.description":
    "{appName} eviduje celú platbu vrátane prepitného.",
  "settings.eet.tip.business.title": "Prepitné patrí podniku",
  "settings.eet.tip.description":
    "Či je prepitné súčasťou evidovanej tržby, závisí od toho, komu patrí. Prepitné, ktoré je príjmom podniku, sa zo zákona eviduje. Prepitné, ktoré patrí zamestnancom, sa evidovať nemusí. Zmena platí pre platby prijaté od tej chvíle.",
  "settings.eet.tip.employees.description":
    "{appName} eviduje platbu bez prepitného. Prepitné zostáva pri platbe zapísané zvlášť.",
  "settings.eet.tip.employees.title": "Prepitné patrí zamestnancom",
  "settings.eet.tip.label": "Komu patrí prepitné",
  "settings.eet.tip.note":
    "Povinný kuvert ani servisný poplatok nie sú prepitné. Účtujte ich ako bežnú položku na účte, do tržby sa započítajú vždy.",
  "settings.eet.tip.title": "Prepitné",
  "settings.eet.title": "EET",
  "settings.eet.unconfirmed.description":
    "Tržby, ktoré EET zatiaľ nepotvrdila.",
  "settings.eet.unconfirmed.empty": "EET potvrdila všetky tržby.",
  "settings.eet.unconfirmed.reversal": "Storno {amount}",
  "settings.eet.unconfirmed.title": "Nepotvrdené tržby",
  "settings.evoluExport.action": "Exportovať",
  "settings.evoluExport.action.pending": "Exportujem...",
  "settings.evoluExport.confirm.description":
    "Export bude uložený bez anonymizácie.",
  "settings.evoluExport.confirm.label":
    "Rozumiem, že export môže obsahovať citlivé dáta.",
  "settings.evoluExport.database.app": "Aplikačná databáza",
  "settings.evoluExport.description":
    "Export lokálnych Evolu databáz pre zálohu a podporu",
  "settings.evoluExport.destination.capacitor":
    "Súbor odovzdáte cez ponuku zdieľania, kde zvolíte, kam ho poslať.",
  "settings.evoluExport.destination.web": "Súbory stiahne tento prehliadač.",
  "settings.evoluExport.format.description":
    "Každá vybraná databáza sa exportuje ako surový SQLite súbor.",
  "settings.evoluExport.format.sqlite": "SQLite",
  "settings.evoluExport.options.description":
    "Vyberte, ktoré lokálne databázy sa majú zahrnúť.",
  "settings.evoluExport.options.format": "Formát",
  "settings.evoluExport.options.title": "Nastavenia exportu",
  "settings.evoluExport.status.createdAt": "Vytvorené {createdAt}",
  "settings.evoluExport.status.error": "Export zlyhal.",
  "settings.evoluExport.status.handedOff":
    "Zdieľacia ponuka bola zatvorená. Overte, že súbor dorazil, skôr ako sa na túto zálohu spoľahnete.",
  "settings.evoluExport.status.success": "Export dokončený.",
  "settings.evoluExport.status.title": "Stav exportu",
  "settings.evoluExport.title": "Evolu Export",
  "settings.evoluExport.warning.businessData": "business dáta",
  "settings.evoluExport.warning.description":
    "Full export databáz môže obsahovať dáta, ktoré umožňujú prístup k prostriedkom, integráciám alebo súkromnej obchodnej histórii. Exportované súbory ukladajte bezpečne a zdieľajte ich len s dôveryhodnými príjemcami.",
  "settings.evoluExport.warning.localConfiguration":
    "lokálna konfigurácia aplikácie a nastavenia synchronizácie",
  "settings.evoluExport.warning.payments": "účtenky, platby a transakcie",
  "settings.evoluExport.warning.secrets":
    "mnemoniky peňaženiek, recovery phrase a API tokeny",
  "settings.evoluExport.warning.title": "Citlivý export",
  "settings.evoluExport.warning.walletMetadata":
    "metadata súvisiace s peňaženkou",
  "settings.fiat.czk.title": "Česká koruna",
  "settings.fiat.eur.title": "Euro",
  "settings.fiat.usd.title": "Americký dolar",
  "settings.fiatBankAccount.advanced": "Pokročilé možnosti",
  "settings.fiatBankAccount.currency.description":
    "Platby v tejto mene môžu použiť tento bankový účet.",
  "settings.fiatBankAccount.currency.label": "Mena bankového účtu",
  "settings.fiatBankAccount.enabled.label": "Povoliť fiat bankový účet",
  "settings.fiatBankAccount.form.description":
    "Aplikácia teraz používa jeden deterministický fiat bankový účet.",
  "settings.fiatBankAccount.form.title": "Údaje bankového účtu",
  "settings.fiatBankAccount.iban.description":
    "Zadajte české číslo účtu, napríklad 123456789/0100, alebo IBAN. Uložená hodnota sa normalizuje na IBAN.",
  "settings.fiatBankAccount.iban.format.bban": "Číslo účtu",
  "settings.fiatBankAccount.iban.format.iban": "IBAN",
  "settings.fiatBankAccount.iban.invalid":
    "Zadajte platný IBAN alebo české číslo účtu.",
  "settings.fiatBankAccount.iban.label": "Číslo účtu alebo IBAN",
  "settings.fiatBankAccount.iban.required":
    "Zadajte IBAN alebo číslo účtu, alebo bankový prevod vypnite.",
  "settings.fiatBankAccount.iban.unknownBank":
    "Neznáma banka — nepodarilo sa rozpoznať, ku ktorej banke účet patrí",
  "settings.fiatBankAccount.qrFormat.description":
    "Tento formát sa pri bankových QR platbách zobrazí ako prvý.",
  "settings.fiatBankAccount.qrFormat.label": "Predvolený formát QR",
  "settings.fiatBankAccount.qrFormat.payBySquare1_0_0":
    "Pay by square 1.0 (Slovensko)",
  "settings.fiatBankAccount.qrFormat.payBySquare1_2_0":
    "Pay by square 1.2 (Slovensko)",
  "settings.fiatBankAccount.qrFormat.spayd": "SPAYD (Česko)",
  "settings.fioPlugin.active.description":
    "Keď je plugin zapnutý, kontroluje transakcie Fio banky pre fiat bankový účet.",
  "settings.fioPlugin.active.label": "Povoliť Fio plugin",
  "settings.fioPlugin.description":
    "Nastavenie tokenov na synchronizáciu transakcií z Fio banky",
  "settings.fioPlugin.form.description":
    "Plugin teraz používa deterministický fiat bankový účet.",
  "settings.fioPlugin.form.title": "Základné nastavenia",
  "settings.fioPlugin.interval.description":
    "Ako často má plugin kontrolovať nové transakcie.",
  "settings.fioPlugin.interval.invalid": "Zadajte celé číslo väčšie ako nula.",
  "settings.fioPlugin.interval.label": "Sekúnd medzi kontrolami",
  "settings.fioPlugin.lastSyncedDate.description":
    "Lokálna zarážka synchronizácie. Ak ešte neexistuje, použije sa včerajší dátum.",
  "settings.fioPlugin.lastSyncedDate.invalid": "Zadajte platný dátum.",
  "settings.fioPlugin.lastSyncedDate.label": "Posledný synchronizovaný dátum",
  "settings.fioPlugin.nativeRuntimeWarning.description":
    "Táto aplikácia teraz beží v bežnom prehliadači/PWA prostredí, takže automatické kontroly platieb Fio sa tu nespustia.",
  "settings.fioPlugin.nativeRuntimeWarning.title":
    "Fio plugin je dostupný iba v natívnej aplikácii.",
  "settings.fioPlugin.syncLookbackDays.description":
    "Koľko dní pred poslednou lokálnou zarážkou sa má znovu kontrolovať.",
  "settings.fioPlugin.syncLookbackDays.invalid":
    "Zadajte celé číslo väčšie ako nula.",
  "settings.fioPlugin.syncLookbackDays.label": "Dni spätnej kontroly",
  "settings.fioPlugin.notFioIbanWarning":
    "Tento IBAN nepatrí k účtu vo Fio banke, plugin preto jeho platby nenájde.",
  "settings.fioPlugin.title": "Fio plugin",
  "settings.fioPlugin.token.description":
    "Nechajte prázdne, ak chcete uložiť len základné nastavenia.",
  "settings.fioPlugin.token.invalid":
    "Zadajte token dlhý maximálne 255 znakov.",
  "settings.fioPlugin.token.label": "Fio API token",
  "settings.fioPlugin.token.required":
    "Pri vytváraní pluginu je prvý token povinný.",
  "settings.fioPlugin.tokens.active": "Aktívny",
  "settings.fioPlugin.tokens.add.description":
    "Ukladá sa samostatne, takže nastavenia vyššie sa dajú meniť bez prepísania tokenu. Sync job prechádza všetky uložené tokeny.",
  "settings.fioPlugin.tokens.add.saved": "Fio API token pridaný.",
  "settings.fioPlugin.tokens.add.submit": "Pridať token",
  "settings.fioPlugin.tokens.add.title": "Pridať token",
  "settings.fioPlugin.tokens.description":
    "Uložené tokeny sa používajú pri kontrole transakcií účtu.",
  "settings.fioPlugin.tokens.empty": "Nie sú uložené žiadne tokeny.",
  "settings.fioPlugin.tokens.item": "Fio API token",
  "settings.fioPlugin.tokens.remove": "Odobrať",
  "settings.fioPlugin.tokens.title": "Tokeny",
  "settings.monetaPlugin.title": "MONETA Plugin",
  "settings.monetaPlugin.description":
    "Automaticky potvrdzovať prevody na účet v MONETA Money Bank",
  "settings.monetaPlugin.status.on": "Zapnuté",
  "settings.monetaPlugin.status.off": "Vypnuté",
  "settings.monetaPlugin.nativeRuntimeWarning.title":
    "MONETA plugin funguje iba v mobilnej aplikácii.",
  "settings.monetaPlugin.nativeRuntimeWarning.description":
    "MONETA nepustí prehliadač k svojmu API. Pripojte token v mobilnej aplikácii {appName}, potvrdené platby potom uvidí aj tento terminál.",
  "settings.monetaPlugin.notMonetaIbanWarning":
    "Bankový účet nie je v MONETA Money Bank (kód banky 0600), takže nie je čo pripojiť.",
  "settings.monetaPlugin.connect.title": "Pripojiť token",
  "settings.monetaPlugin.connect.replaceTitle": "Pripojiť iný token",
  "settings.monetaPlugin.connect.description":
    "Token vytvoríte v Internet Banke MONETA v Nastavení › Správa API tokenů s právami „Pasivní – pouze náhled“. {appName} si v banke overí, že token vidí tento účet.",
  "settings.monetaPlugin.connect.submit": "Pripojiť",
  "settings.monetaPlugin.connect.saved": "Token MONETA pripojený.",
  "settings.monetaPlugin.connect.error.unauthorized":
    "Banka token odmietla. Skontrolujte, že je skopírovaný celý a nebol zrušený.",
  "settings.monetaPlugin.connect.error.accountNotVisible":
    "Token funguje, ale nevidí účet {iban}. Vytvorte ho pre tento účet.",
  "settings.monetaPlugin.connect.error.rateLimited":
    "Token dnes vyčerpal dopyty do banky. Skúste to zajtra.",
  "settings.monetaPlugin.connect.error.unreachable":
    "Banka neodpovedá. Skontrolujte pripojenie a skúste to znova.",
  "settings.monetaPlugin.connect.error.unexpected":
    "Banka odpovedala neočakávane. Skúste to neskôr.",
  "settings.monetaPlugin.token.label": "API token MONETA",
  "settings.monetaPlugin.token.required": "Vložte token z Internet Banky.",
  "settings.monetaPlugin.connected.title": "Pripojený účet",
  "settings.monetaPlugin.connected.iban": "Účet",
  "settings.monetaPlugin.connected.token": "Token",
  "settings.monetaPlugin.connected.ibanMismatch":
    "Token bol pripojený pre účet {iban}, nie pre súčasný bankový účet. Pripojte token pre súčasný účet.",
  "settings.monetaPlugin.active.label": "Automaticky potvrdzovať platby",
  "settings.monetaPlugin.active.description":
    "Kontroluje prichádzajúce prevody na pozadí a počas čakania na platbu.",
  "settings.monetaPlugin.interval.label": "Sekundy medzi kontrolami na pozadí",
  "settings.monetaPlugin.interval.description":
    "Čakajúca platba sa kontroluje po niekoľkých sekundách bez ohľadu na toto nastavenie.",
  "settings.monetaPlugin.interval.invalid": "Zadajte celé číslo, aspoň 60.",
  "settings.monetaPlugin.interval.estimate":
    "Zhruba {calls} dopytov denne na zariadenie z {limit}, ktoré banka povolí všetkým zariadeniam dokopy.",
  "settings.monetaPlugin.lastSyncedDate.label":
    "Dátum poslednej synchronizácie",
  "settings.monetaPlugin.lastSyncedDate.description":
    "Odkiaľ synchronizácia na pozadí pokračuje. Bez neho sa načítajú posledné dva mesiace.",
  "settings.monetaPlugin.lastSyncedDate.invalid": "Zadajte platný dátum.",
  "settings.monetaPlugin.disconnect.action": "Odpojiť",
  "settings.monetaPlugin.disconnect.confirm.title": "Odpojiť MONETU?",
  "settings.monetaPlugin.disconnect.confirm.description":
    "{appName} prestane token používať na všetkých zariadeniach a prestane potvrdzovať prevody. Už potvrdené platby zostanú, ako sú. Token zostane v šifrovanej histórii synchronizácie, preto ho zrušte aj v MONETA Internet Banke.",
  "settings.monetaPlugin.disconnect.confirm.confirm": "Odpojiť",
  "settings.monetaPlugin.disconnect.confirm.cancel": "Zrušiť",
  "settings.homeScreen.atLeastOneMode":
    "Nechajte zapnutý aspoň jeden režim — hlavná obrazovka musí mať čo zobraziť.",
  "settings.homeScreen.modes.description":
    "Vyberte, medzi ktorými zobrazeniami sa dá na hlavnej obrazovke prepínať. Keď necháte zapnuté len jedno, prepínač zmizne.",
  "settings.homeScreen.modes.title": "Režimy",
  "settings.homeScreen.numpad.description":
    "Zadajte sumu a rovno ju naúčtujte.",
  "settings.homeScreen.pos.description":
    "Stoly a otvorené účty, účtované z katalógu.",
  "settings.homeScreen.title": "Hlavná obrazovka",
  "settings.items.add": "Pridať položku",
  "settings.items.category.all": "Všetko",
  "settings.items.category.uncategorized": "Bez kategórie",
  "settings.items.delete": "Vymazať položku",
  "settings.items.delete.confirm.cancel": "Zrušiť",
  "settings.items.delete.confirm.confirm": "Vymazať",
  "settings.items.delete.confirm.description":
    "Účty a platby, v ktorých bola položka {name} už použitá, si zachovajú vlastnú kópiu, ale nebude ju možné pridať do nových.",
  "settings.items.delete.confirm.title": "Vymazať položku {name}?",
  "settings.items.description": "Správa predávaných produktov a služieb",
  "settings.items.empty.description":
    "Pridajte produkty alebo služby, ktoré predávate, aby ste ich mohli rýchlo pridávať do účtu.",
  "settings.items.empty.title": "Zatiaľ žiadne položky",
  "settings.items.emptySearch": "Vyhľadávanie nenašlo žiadne položky.",
  "settings.items.form.card.description":
    "Názov, cena a nepovinný popis zobrazený pri pridávaní položky do účtu.",
  "settings.items.form.card.title": "Detaily",
  "settings.items.form.category.label": "Kategória",
  "settings.items.form.category.none": "Bez kategórie",
  "settings.items.form.currency.label": "Mena",
  "settings.items.form.description.invalid":
    "Popis je príliš dlhý (max. 255 znakov).",
  "settings.items.form.description.label": "Popis",
  "settings.items.form.description.placeholder": "Nepovinné",
  "settings.items.form.internalDescription.invalid":
    "Interný popis je príliš dlhý (max. 255 znakov).",
  "settings.items.form.internalDescription.label": "Interný popis",
  "settings.items.form.internalDescription.placeholder":
    "Nepovinné – viditeľné iba pre personál",
  "settings.items.form.internalName.hint":
    "Zobrazí sa personálu namiesto verejného názvu. Zákazníci na účte stále vidia verejný názov a popis.",
  "settings.items.form.internalName.invalid":
    "Interný názov je príliš dlhý (max. 255 znakov).",
  "settings.items.form.internalName.label": "Interný názov",
  "settings.items.form.internalName.placeholder":
    "Nepovinné – zobrazí sa personálu namiesto verejného názvu",
  "settings.items.form.invalidId": "Neplatné ID položky.",
  "settings.items.form.name.invalid": "Zadajte názov.",
  "settings.items.form.name.label": "Názov",
  "settings.items.form.name.placeholder": "napr. Káva",
  "settings.items.form.notFound": "Táto položka už neexistuje.",
  "settings.items.form.price.invalid": "Zadajte platnú cenu.",
  "settings.items.form.price.label": "Cena",
  "settings.items.form.save.create": "Pridať položku",
  "settings.items.form.saved.create": "Položka bola pridaná.",
  "settings.items.form.scanCode.duplicate": "Už je priradený položke {name}.",
  "settings.items.form.scanCode.invalid": "Zadajte platný kód.",
  "settings.items.form.scanCode.label": "Kód na skenovanie",
  "settings.items.form.scanCode.placeholder": "napr. 8594001234567",
  "settings.items.form.scanCode.scan.aria": "Naskenovať kód",
  "settings.items.form.sku.invalid": "SKU je príliš dlhé (max. 255 znakov).",
  "settings.items.form.sku.label": "SKU",
  "settings.items.form.sku.placeholder": "Nepovinné",
  "settings.items.form.taxRate.description":
    "Uplatní sa na účtoch a platbách po použití tejto položky. Sadzby správte v Nastaveniach › Daňové sadzby.",
  "settings.items.form.taxRate.label": "Daňová sadzba",
  "settings.items.form.taxRate.none": "Bez daňovej sadzby",
  "settings.items.form.title.create": "Pridať položku",
  "settings.items.form.title.edit": "Upraviť položku",
  "settings.items.search": "Hľadať položky...",
  "settings.items.search.clear.aria": "Vymazať hľadanie",
  "settings.items.title": "Položky",
  "settings.language.locale.czech.title": "Česko",
  "settings.language.locale.description":
    "Vyberte regionálny formát pre dátumy, čísla a meny.",
  "settings.language.locale.english.title": "Spojené štáty",
  "settings.language.locale.slovak.title": "Slovensko",
  "settings.language.locale.title": "Regionálny formát",
  "settings.language.mode.description":
    "Vyberte jazyk, ktorý má aplikácia používať.",
  "settings.language.mode.title": "Jazyk aplikácie",
  "settings.language.title": "Jazyk a región",
  "settings.legalEntity.country.label": "Krajina",
  "settings.legalEntity.country.placeholder": "Vyberte krajinu",
  "settings.legalEntity.currency.description":
    "Fiat mena, v ktorej sa predvolene vytvárajú platby.",
  "settings.legalEntity.currency.label": "Mena",
  "settings.legalEntity.description":
    "Krajina, mena a platiteľstvo DPH vášho podniku.",
  "settings.legalEntity.title": "Podnik",
  "settings.legalEntity.vatPayer.description":
    "Pridá daňové sadzby k položkám katalógu.",
  "settings.legalEntity.vatPayer.label": "Som platiteľ DPH",
  "settings.paymentAccounts.default": "Predvolená",
  "settings.paymentAccounts.experimental": "Experimentálne",
  "settings.paymentAccounts.method.cashRegister": "Hotovosť",
  "settings.paymentAccounts.method.iban": "Bankový prevod",
  "settings.paymentAccounts.method.cashu": "Cashu",
  "settings.paymentAccounts.method.cardSwitchio": "Platobná karta",
  "settings.paymentAccounts.method.qerkoTerminal": "Platobný terminál (Qerko)",
  "settings.paymentAccounts.method.spark": "Bitcoin",
  "settings.paymentAccounts.moveDown.aria": "Posunúť {name} nadol",
  "settings.paymentAccounts.moveUp.aria": "Posunúť {name} nahor",
  "settings.paymentAccounts.order.description":
    "Zákazník uvidí platobné metódy v tomto poradí. Prvá dostupná sa otvorí automaticky.",
  "settings.paymentAccounts.status.currencyMismatch":
    "Nastavené v {currency}, aplikácia však používa {appCurrency}",
  "settings.paymentAccounts.status.unavailableHere":
    "V tejto verzii aplikácie zatiaľ nie je dostupné",
  "settings.paymentAccounts.status.missingIban":
    "Na zapnutie doplňte bankový účet",
  "settings.paymentAccounts.title": "Platobné účty",
  "settings.paymentNumberSeries.day.default.description":
    "Pridať do generovaných čísel platieb dvojciferný deň",
  "settings.paymentNumberSeries.day.default.title": "Zobraziť deň",
  "settings.paymentNumberSeries.day.hidden.description":
    "Nepridávať deň do generovaných čísel platieb",
  "settings.paymentNumberSeries.day.hidden.title": "Skryť deň",
  "settings.paymentNumberSeries.day.label": "Formát dňa",
  "settings.paymentNumberSeries.description":
    "Nastavenie generovania čísel platieb",
  "settings.paymentNumberSeries.form.description":
    "Tieto hodnoty určujú deterministický číselný rad používaný terminálom.",
  "settings.paymentNumberSeries.form.title": "Formát číselného radu",
  "settings.paymentNumberSeries.lastNumber.date.description":
    "Kotviaci dátum na rozhodnutie, či ďalšia platba pokračuje v rade, alebo ho resetuje. Prázdna hodnota resetuje rad pri ďalšej platbe.",
  "settings.paymentNumberSeries.lastNumber.date.invalid":
    "Zadajte platný dátum.",
  "settings.paymentNumberSeries.lastNumber.date.label": "Kotviaci dátum",
  "settings.paymentNumberSeries.lastNumber.description":
    "Prestavenie posledného použitého poradového čísla. Ďalšie vygenerované číslo platby bude pokračovať od tejto hodnoty.",
  "settings.paymentNumberSeries.lastNumber.serialNumber.description":
    "Posledné použité poradové číslo. Napríklad zadajte 499, ak ďalšia platba má použiť 500.",
  "settings.paymentNumberSeries.lastNumber.serialNumber.invalid":
    "Zadajte nulu alebo kladné celé číslo.",
  "settings.paymentNumberSeries.lastNumber.serialNumber.label":
    "Posledné poradové číslo",
  "settings.paymentNumberSeries.lastNumber.title": "Posledné použité číslo",
  "settings.paymentNumberSeries.month.default.description":
    "Pridať do generovaných čísel platieb dvojciferný mesiac",
  "settings.paymentNumberSeries.month.default.title": "Zobraziť mesiac",
  "settings.paymentNumberSeries.month.hidden.description":
    "Nepridávať mesiac do generovaných čísel platieb",
  "settings.paymentNumberSeries.month.hidden.title": "Skryť mesiac",
  "settings.paymentNumberSeries.month.label": "Formát mesiaca",
  "settings.paymentNumberSeries.prefix.description":
    "Voliteľná predpona pridaná pred generované čísla platieb.",
  "settings.paymentNumberSeries.prefix.invalid":
    "Zadajte predponu dlhú maximálne 255 znakov.",
  "settings.paymentNumberSeries.prefix.label": "Predpona",
  "settings.paymentNumberSeries.serialNumberDigits.description":
    "Minimálny počet číslic pre rastúcu poradovú časť.",
  "settings.paymentNumberSeries.serialNumberDigits.invalid":
    "Zadajte celé číslo väčšie ako nula.",
  "settings.paymentNumberSeries.serialNumberDigits.label":
    "Počet číslic poradia",
  "settings.paymentNumberSeries.title": "Číselný rad platieb",
  "settings.paymentNumberSeries.year.default.description":
    "Pridať do generovaných čísel platieb celý štvorciferný rok",
  "settings.paymentNumberSeries.year.default.title": "Celý rok",
  "settings.paymentNumberSeries.year.label": "Formát roka",
  "settings.paymentNumberSeries.year.short.description":
    "Pridať do generovaných čísel platieb krátky dvojciferný rok",
  "settings.paymentNumberSeries.year.short.title": "Krátky rok",
  "settings.payments": "PLATBY",
  "settings.privacy.errorReporting.description":
    "Odosielať hlásenia pádov a chýb, aby sa dali ľahšie opraviť. Vo východiskovom stave vypnuté — nič sa neodosiela, kým to nezapnete.",
  "settings.privacy.errorReporting.disable": "Vypnúť",
  "settings.privacy.errorReporting.disabled": "Vypnuté",
  "settings.privacy.errorReporting.enable": "Zapnúť",
  "settings.privacy.errorReporting.enabled": "Zapnuté",
  "settings.privacy.errorReporting.title": "Hlásenie chýb",
  "settings.privacy.productLookup.description":
    "Keď naskenujete čiarový kód, ktorý v katalógu nie je, dohľadať produkt v Open Food Facts a Open Beauty Facts a predvyplniť jeho názov. Naskenovaný kód sa týmto službám odošle. Vo východiskovom stave vypnuté.",
  "settings.privacy.productLookup.disable": "Vypnúť",
  "settings.privacy.productLookup.disabled": "Vypnuté",
  "settings.privacy.productLookup.enable": "Zapnúť",
  "settings.privacy.productLookup.enabled": "Zapnuté",
  "settings.privacy.productLookup.title": "Dohľadanie produktov",
  "settings.privacy.aiAssistant.title": "AI asistent",
  "settings.privacy.aiAssistant.description":
    "Asistent odpovedá cez server {appNameGen} a poskytovateľa AI, takže vaše otázky a to, čo asistent číta, opúšťa toto zariadenie. Vo východiskovom stave vypnuté.",
  "settings.privacy.aiAssistant.off.title": "Vypnuté",
  "settings.privacy.aiAssistant.off.description":
    "Asistent je skrytý a nič sa neodosiela.",
  "settings.privacy.aiAssistant.public.title": "Len dokumentácia a kód",
  "settings.privacy.aiAssistant.public.description":
    "Číta verejnú dokumentáciu a zdrojový kód {appNameGen}. Vaše účty a platby zostávajú v tomto zariadení.",
  "settings.privacy.aiAssistant.all.title": "Vrátane mojich dát",
  "settings.privacy.aiAssistant.all.description":
    "Číta aj vaše účty a platby v tomto zariadení a to, čo prečíta, odosiela poskytovateľovi AI.",
  "settings.profile.description":
    "Váš Nostr profil, rovnaký, aký pre túto obnovovaciu frázu zobrazuje Linky.",
  "settings.profile.loadFailed":
    "Nepodarilo sa spojiť so žiadnym Nostr relayom a načítať profil. Skontrolujte pripojenie a skúste to znova.",
  "settings.profile.name.invalid": "Meno je príliš dlhé.",
  "settings.profile.name.label": "Meno",
  "settings.profile.name.placeholder": "Názov vášho obchodu",
  "settings.profile.npub.copied": "Verejný kľúč skopírovaný",
  "settings.profile.npub.copy": "Kopírovať verejný kľúč",
  "settings.profile.npub.copyFailed": "Verejný kľúč sa nepodarilo skopírovať",
  "settings.profile.npub.label": "Verejný kľúč",
  "settings.profile.picture.choose": "Vybrať obrázok",
  "settings.profile.picture.invalid":
    "Tento súbor nie je obrázok, ktorý prehliadač vie načítať.",
  "settings.profile.picture.label": "Obrázok",
  "settings.profile.picture.remove": "Odstrániť obrázok",
  "settings.profile.retry": "Skúsiť znova",
  "settings.profile.saveFailed":
    "Žiadny Nostr relay profil neprijal. Skúste to neskôr.",
  "settings.profile.setName": "Nastavte svoje meno",
  "settings.profile.title": "Profil",
  "settings.qerkoTerminal.terminal.change": "Zmeniť terminál",
  "settings.qerkoTerminal.terminal.choose": "Vybrať terminál",
  "settings.qerkoTerminal.terminal.label": "Terminál na tomto zariadení",
  "settings.qerkoTerminal.terminal.none":
    "Na tomto zariadení nie je vybraný terminál",
  "settings.qerkoTerminal.terminals.choose": "Použiť tento terminál",
  "settings.qerkoTerminal.terminals.description":
    "Každé zariadenie platí na vlastnom termináli. Táto voľba platí len pre toto zariadenie.",
  "settings.qerkoTerminal.terminals.empty":
    "Qerko pre túto firmu zatiaľ nemá žiadny aktivovaný terminál.",
  "settings.qerkoTerminal.terminals.empty.help":
    "Dostupné terminály pre vašu firmu môže nastaviť len podpora Qerko. Kontaktujte ju, požiadajte o aktiváciu terminálu a potom sa vráťte a skúste to znova.",
  "settings.qerkoTerminal.terminals.failed": "Terminály sa nepodarilo načítať.",
  "settings.qerkoTerminal.terminals.keyRejected":
    "Qerko už toto spárovanie neprijíma. Možno bolo v Qerku zrušené. Na pokračovanie spárujte znova.",
  "settings.qerkoTerminal.terminals.keyRejected.action": "Spárovať znova",
  "settings.qerkoTerminal.terminals.later": "Vybrať neskôr",
  "settings.qerkoTerminal.terminals.platform.physical": "Terminál",
  "settings.qerkoTerminal.terminals.platform.softPos": "SoftPOS",
  "settings.qerkoTerminal.terminals.retry": "Skúsiť znova",
  "settings.qerkoTerminal.terminals.title": "Vyberte terminál",
  "settings.qerkoTerminal.test.action": "Otestovať spojenie",
  "settings.qerkoTerminal.test.bankUnreachable":
    "Terminál je pripojený, ale nedovolá sa spracovateľovi platieb.",
  "settings.qerkoTerminal.test.busy": "Terminál práve spracúva inú operáciu.",
  "settings.qerkoTerminal.test.connected": "Terminál je pripojený.",
  "settings.qerkoTerminal.test.notActivated":
    "Terminál nie je v Qerku aktivovaný.",
  "settings.qerkoTerminal.test.notConnected": "Terminál nie je pripojený.",
  "settings.qerkoTerminal.test.running": "Testujem…",
  "settings.qerkoTerminal.test.unknownTerminal":
    "Qerko tento terminál nepozná. Vyberte ho znova.",
  "settings.qerkoTerminal.test.upstreamError":
    "Qerko sa k terminálu nepodarilo dovolať.",
  "settings.qerkoTerminal.test.upstreamTimeout": "Terminál neodpovedal včas.",
  "settings.qerkoTerminal.title": "Terminál Qerko",
  "settings.qerkoTerminal.unpair.action": "Zrušiť párovanie",
  "settings.qerkoTerminal.unpair.confirm.cancel": "Späť",
  "settings.qerkoTerminal.unpair.confirm.confirm": "Zrušiť párovanie",
  "settings.qerkoTerminal.unpair.confirm.description":
    "Platby kartou na termináli Qerko sa vypnú na všetkých zariadeniach. Už prijaté platby zostanú, ako sú.",
  "settings.qerkoTerminal.unpair.confirm.title": "Zrušiť párovanie s Qerkom?",
  "settings.qerkoTerminal.unpaired.description":
    "Prepojte účet svojej firmy v Qerku a prijímajte platby kartou na jeho platobných termináloch. Qerko pošle potvrdzovací kód na e-mail firmy.",
  "settings.qerkoTerminal.unpaired.title": "Spárovať s Qerkom",
  "settings.security.description": "Správa synchronizácie a obnovy účtu",
  "settings.security.mnemonic.copied": "Recovery phrase skopírovaná.",
  "settings.security.mnemonic.copy": "Kopírovať",
  "settings.security.mnemonic.copyError":
    "Recovery phrase sa nepodarilo skopírovať.",
  "settings.security.mnemonic.description":
    "Zobrazenie recovery phrase pre aktívny lokálny účet.",
  "settings.security.mnemonic.help":
    "Udržiavajte túto frázu v súkromí. Kto ju pozná, môže účet obnoviť.",
  "settings.security.mnemonic.label": "Recovery phrase",
  "settings.security.mnemonic.title": "Obnova účtu",
  "settings.security.mnemonic.warning":
    "Ak túto frázu stratíte, tento účet a jeho dáta už nikdy nepôjde obnoviť – nepodarí sa to ani nám.",
  "settings.security.mnemonic.intro":
    "Týchto 20 slov je jediná cesta, ako tento účet dostať na iné zariadenie alebo po strate telefónu. Uložte ich do správcu hesiel alebo na papier — nie do screenshotu ani do chatu. Nikto, ani {appName}, vám ich neobnoví.",
  "settings.security.mnemonic.nativeHint":
    "Opíšte slová na papier v uvedenom poradí, obrazovku nefoťte. Potom zálohu overte.",
  "settings.security.mnemonic.savePasswords": "Uložiť do hesiel",
  "settings.security.mnemonic.savePasswords.saved":
    "Recovery phrase uložená do správcu hesiel.",
  "settings.security.mnemonic.savePasswords.unsupported":
    "Tento prehliadač nevie ukladať do správcu hesiel. Skopírujte frázu alebo ju opíšte.",
  "settings.security.mnemonic.savePasswords.failed":
    "Do správcu hesiel sa uložiť nepodarilo.",
  "settings.security.verify.action": "Overiť zálohu",
  "settings.security.verify.title": "Overenie zálohy",
  "settings.security.verify.description":
    "Zadajte slová {slots} zo svojej zálohy. Je to voliteľné a nič neblokuje.",
  "settings.security.verify.wordLabel": "Slovo {index}",
  "settings.security.verify.submit": "Skontrolovať",
  "settings.security.verify.cancel": "Zrušiť",
  "settings.security.verify.wrong":
    "Slová nesedia s vašou recovery phrase. Skontrolujte svoj zápis a skúste to znova.",
  "settings.security.verify.success": "Záloha overená.",
  "settings.security.verify.status.verified": "Overené {date}",
  "settings.security.verify.status.unverified": "Neoverené",
  "settings.security.reminder.text": "Zazálohujte si účet",
  "settings.security.reminder.action": "Zálohovať teraz",
  "settings.security.reminder.later": "Neskôr",
  "settings.security.backup.description":
    "Či je recovery phrase zálohovaná a overená.",
  "settings.security.backup.open": "Zálohovať",
  "settings.security.backup.view": "Zobraziť zálohu",
  "settings.security.backup.start": "Zobraziť recovery phrase",
  "settings.security.backup.continue": "Mám zapísané — overiť",
  "settings.security.verify.skip": "Preskočiť overenie",
  "settings.security.reminder.description":
    "Keď prídete o telefón, bez zálohy sa do svojho účtu nedostanete. Zaberie to asi minútu.",
  "settings.security.title": "Bezpečnosť a synchronizácia",
  "settings.security.transports.add": "Pridať transport",
  "settings.security.transports.demo":
    "Toto je demo účet: nikdy sa nesynchronizuje, takže jeho relaye zostávajú vypnuté.",
  "settings.security.transports.description":
    "Nastavenie Evolu WebSocket endpointov pre tento device účet.",
  "settings.security.transports.empty": "Nie sú uložené žiadne transporty.",
  "settings.security.transports.footer":
    "Neaktívne transporty zostanú uložené, ale pri otváraní aplikačných dát sa ignorujú.",
  "settings.security.transports.inactive": "Neaktívny",
  "settings.security.transports.saved": "Transport pridaný.",
  "settings.security.transports.status.synced": "Synchronizované",
  "settings.security.transports.status.syncing": "Synchronizujem…",
  "settings.security.transports.status.connecting": "Pripájam…",
  "settings.security.transports.status.offline": "Offline",
  "settings.security.transports.status.error": "Chyba synchronizácie",
  "settings.security.transports.status.errors.version":
    "Aplikácia a relay používajú nekompatibilné verzie. Aktualizujte aplikáciu.",
  "settings.security.transports.status.errors.writeKey":
    "Relay odmietol zapisovací kľúč tohto účtu.",
  "settings.security.transports.status.errors.quota":
    "Úložisko tohto účtu na relayi je plné.",
  "settings.security.transports.status.errors.decrypt":
    "Dáta z relaya sa nepodarilo dešifrovať.",
  "settings.security.transports.status.errors.generic":
    "Synchronizácia s týmto relayom zlyhala.",
  "settings.security.transports.status.lastSynced": "Naposledy {time}",
  "settings.security.transports.status.firstSync": "Prvá synchronizácia",
  "settings.security.transports.status.unreachable": "Relay nie je dostupný",
  "settings.security.transports.status.offlineSince": "Od {time}",
  "settings.security.transports.accountId": "ID účtu",
  "settings.security.transports.toggle": "Synchronizovať cez {url}",
  "settings.security.transports.title": "Evolu transporty",
  "settings.security.transports.url.description":
    "Povolené sú len zabezpečené WebSocket URL začínajúce na wss:.",
  "settings.security.transports.url.invalid": "Zadajte platnú wss URL.",
  "settings.security.transports.url.label": "WebSocket URL",
  "settings.sparkAccount.enabled.label": "Povoliť Spark účet",
  "settings.sparkAccount.advanced": "Pokročilé možnosti",
  "settings.sparkAccount.form.customDescription":
    "{appName} prijíma Spark platby do vašej vlastnej peňaženky.",
  "settings.sparkAccount.form.description":
    "{appName} túto Spark peňaženku odvodí z kľúča na obnovu účtu.",
  "settings.sparkAccount.form.title": "Spark účet",
  "settings.sparkAccount.mnemonic.description":
    "Mnemonic uchovávajte v tajnosti. Ktokoľvek s ním má prístup k Spark peňaženke.",
  "settings.sparkAccount.mnemonic.label": "Mnemonic peňaženky",
  "settings.sparkAccount.privacyMode.description":
    "Zapne režim súkromia Spark peňaženky pre Lightning platby.",
  "settings.sparkAccount.privacyMode.label": "Zapnúť privacy mode",
  "settings.sparkAccount.privacyMode.loadError":
    "Nastavenie privacy mode v Sparku sa nepodarilo načítať.",
  "settings.sparkAccount.privacyMode.loading": "Načítavam privacy mode...",
  "settings.sparkAccount.syncPointer.description":
    "Lokálny ukazovateľ synchronizácie pre periodické preskenovanie historie. Ak ukazovateľ ešte neexistuje, použije sa dnešný dátum; preskenovanie sa z neho pozerá len 72 hodín dozadu.",
  "settings.sparkAccount.syncPointer.invalid": "Zadajte platný dátum.",
  "settings.sparkAccount.syncPointer.label": "Posledný synchronizovaný dátum",
  "settings.sparkAccount.wallet.cancel": "Zrušiť",
  "settings.sparkAccount.wallet.change": "Zmeniť peňaženku…",
  "settings.sparkAccount.wallet.changeDialog.current":
    "Túto peňaženku už používate.",
  "settings.sparkAccount.wallet.changeDialog.description":
    "Vyberte peňaženku, do ktorej majú chodiť nové Spark platby.",
  "settings.sparkAccount.wallet.changeDialog.inUse": "Práve sa používa.",
  "settings.sparkAccount.wallet.changeDialog.invalid":
    "Toto nie je platný mnemonic s 12 slovami.",
  "settings.sparkAccount.wallet.changeDialog.title": "Zmeniť peňaženku",
  "settings.sparkAccount.wallet.changeDialog.wordCount": "{value}/12 slov",
  "settings.sparkAccount.wallet.custom.description":
    "Spark peňaženka, ktorú pridáte jej 12-slovným mnemonicom.",
  "settings.sparkAccount.wallet.custom.title": "Vlastná peňaženka",
  "settings.sparkAccount.wallet.label": "Peňaženka",
  "settings.sparkAccount.wallet.payky.description":
    "Odvodená z kľúča na obnovu účtu.",
  "settings.sparkAccount.wallet.payky.title": "Peňaženka {appNameGen}",
  "settings.sparkAccount.wallet.switch": "Prepnúť",
  "settings.sparkAccount.wallet.warning.funds":
    "Peniaze zostanú v súčasnej peňaženke a tu už nebudú vidieť. Najprv ich vyberte, alebo si uschovajte jej mnemonic.",
  "settings.sparkAccount.wallet.warning.invoices":
    "Nezaplatené faktúry súčasnej peňaženky sa už nezaznamenajú.",
  "settings.supportChat.teamUnavailable":
    "Podpora je teraz nedostupná. Skontrolujte pripojenie a skúste to znova.",
  "settings.supportChat.inbox.unverified":
    "Nepodarilo sa overiť, kam vám môže podpora odpovedať, takže zatiaľ nemusí mať ako odpovedať.",
  "settings.supportChat.inbox.publishFailed":
    "Podpora vám zatiaľ nemôže odpovedať: zoznam relayí pre odpovede sa nepodarilo zverejniť.",
  "settings.supportChat.inbox.publishAnyway": "Napriek tomu zverejniť",
  "settings.supportChat.inbox.confirm.title":
    "Napriek tomu zverejniť relaye pre odpovede?",
  "settings.supportChat.inbox.confirm.description":
    "Ak už váš účet má zoznam relayí pre súkromné správy, napríklad z Linky, bude nahradený a správy posielané na jeho relaye vám tam nemusia chodiť.",
  "settings.supportChat.inbox.confirm.confirm": "Zverejniť",
  "settings.supportChat.inbox.confirm.cancel": "Zrušiť",
  "settings.supportChat.title": "Kontaktovať podporu",
  "settings.supportChat.description": "Napíšte tímu {appNameGen}",
  "settings.supportChat.empty":
    "Zatiaľ tu nie sú žiadne správy. Popíšte, s čím potrebujete pomôcť, a tím {appNameGen} vám odpovie tu.",
  "settings.supportChat.loadFailed":
    "Konverzáciu sa nepodarilo načítať. Skontrolujte pripojenie a skúste to znova.",
  "settings.supportChat.retry": "Skúsiť znova",
  "settings.supportChat.message.label": "Správa",
  "settings.supportChat.message.placeholder": "Napíšte správu…",
  "settings.supportChat.send": "Odoslať",
  "settings.supportChat.sent": "Odoslané",
  "settings.supportChat.sending": "Odosielam…",
  "settings.supportChat.notDelivered": "Nedoručené. Skúsiť znova",
  "settings.assistant.title": "AI asistent",
  "settings.assistant.description":
    "Opýtajte sa na účty, platby a ako {appName} funguje",
  "settings.assistant.empty":
    "Opýtajte sa na svoje účty a platby alebo na to, ako {appName} funguje. Asistent číta vaše dáta v tomto zariadení a dokumentáciu {appNameGen} a odpovedá pomocou poskytovateľa AI.",
  "settings.assistant.emptyPublic":
    "Opýtajte sa, ako {appName} funguje. Asistent číta dokumentáciu a kód {appNameGen}, nie vaše dáta, a odpovedá pomocou poskytovateľa AI.",
  "settings.assistant.suggestion.openBills": "Ktoré účty sú ešte otvorené?",
  "settings.assistant.suggestion.latestPayments":
    "Aké boli moje posledné platby?",
  "settings.assistant.suggestion.today": "Koľko dnes prišlo na tržbách?",
  "settings.assistant.suggestion.howSplit": "Ako funguje rozdelenie účtu?",
  "settings.assistant.suggestion.howRefund": "Ako vrátim platbu?",
  "settings.assistant.message.label": "Otázka",
  "settings.assistant.message.placeholder": "Opýtajte sa…",
  "settings.assistant.send": "Odoslať",
  "settings.assistant.stop": "Zastaviť",
  "settings.assistant.thinking": "Premýšľam…",
  "settings.assistant.lookingUp.data": "Prechádzam vaše dáta…",
  "settings.assistant.lookingUp.docs": "Čítam dokumentáciu…",
  "settings.assistant.newConversation": "Nová konverzácia",
  "settings.chat.scrollToLatest": "Prejsť na najnovšiu správu",
  "settings.assistant.stopped": "Zastavené",
  "settings.assistant.failed": "Nepodarilo sa odpovedať. Skúsiť znova",
  "settings.support": "PODPORA A INFORMÁCIE",
  "settings.tables.add": "Pridať stôl",
  "settings.tables.delete": "Vymazať stôl",
  "settings.tables.delete.confirm.cancel": "Zrušiť",
  "settings.tables.delete.confirm.confirm": "Vymazať",
  "settings.tables.delete.confirm.description":
    "Uzavreté účty si stôl {name} ponechajú, ale nebude ho možné priradiť k novým.",
  "settings.tables.delete.confirm.title": "Vymazať stôl {name}?",
  "settings.tables.delete.hasOpenBills":
    "Stôl {name} má otvorený účet. Najprv ho zaplaťte alebo presuňte na iný stôl.",
  "settings.tables.description": "Správa stolov a miest na sedenie",
  "settings.tables.empty.description":
    "Pridajte stoly vo svojej prevádzke, aby ste k nim mohli priraďovať účty.",
  "settings.tables.empty.title": "Zatiaľ žiadne stoly",
  "settings.tables.emptySearch": "Vyhľadávanie nenašlo žiadne stoly.",
  "settings.tables.form.card.description":
    "Názov a počet miest zobrazené pri priraďovaní stola k účtu.",
  "settings.tables.form.card.title": "Detaily",
  "settings.tables.form.code.description":
    "Zatiaľ sa nepoužíva - rezervované pre budúci QR kód, ktorý bude tento stôl identifikovať.",
  "settings.tables.form.code.label": "Kód",
  "settings.tables.form.invalidId": "Neplatné ID stola.",
  "settings.tables.form.name.invalid": "Zadajte názov.",
  "settings.tables.form.name.label": "Názov",
  "settings.tables.form.name.placeholder": "napr. Stôl 5",
  "settings.tables.form.notFound": "Tento stôl už neexistuje.",
  "settings.tables.form.save.create": "Pridať stôl",
  "settings.tables.form.saved.create": "Stôl pridaný.",
  "settings.tables.form.seatCount.invalid": "Zadajte platný počet miest.",
  "settings.tables.form.seatCount.label": "Počet miest",
  "settings.tables.form.seatCount.placeholder": "napr. 4",
  "settings.tables.form.title.create": "Pridať stôl",
  "settings.tables.form.title.edit": "Upraviť stôl",
  "settings.tables.search": "Hľadať stoly...",
  "settings.tables.search.clear.aria": "Vymazať hľadanie",
  "settings.tables.seatCount": "{value} miest",
  "settings.tables.title": "Stoly",
  "settings.taxRates.activate": "Znovu aktivovať {name}",
  "settings.taxRates.activate.confirm.cancel": "Zrušiť",
  "settings.taxRates.activate.confirm.confirm": "Aktivovať",
  "settings.taxRates.activate.confirm.description":
    "{name} bude znovu dostupná pri priraďovaní daňových sadzieb katalógovým položkám.",
  "settings.taxRates.activate.confirm.title": "Znovu aktivovať {name}?",
  "settings.taxRates.add": "Pridať sadzbu",
  "settings.taxRates.add.title": "Pridať daňovú sadzbu",
  "settings.taxRates.archive": "Archivovať {name}",
  "settings.taxRates.archive.confirm.cancel": "Zrušiť",
  "settings.taxRates.archive.confirm.confirm": "Archivovať",
  "settings.taxRates.archive.confirm.description":
    "{name} sa skryje z ponuky pre nové katalógové položky. Existujúce položky ju majú ďalej, kým ju nezmeníte. Neskôr ju možno znovu aktivovať.",
  "settings.taxRates.archive.confirm.title": "Archivovať {name}?",
  "settings.taxRates.archived.title": "Archivované",
  "settings.taxRates.default.set": "Nastaviť {name} ako predvolenú",
  "settings.taxRates.default.unset": "Zrušiť {name} ako predvolenú",
  "settings.taxRates.description":
    "Sadzbu po vytvorení nemožno upraviť ani vymazať — namiesto zmeny percenta ju archivujte a založte novú, ak sa sadzba reálne zmení.",
  "settings.taxRates.empty": "Zatiaľ žiadne daňové sadzby.",
  "settings.taxRates.name.invalid": "Zadajte názov.",
  "settings.taxRates.name.label": "Názov",
  "settings.taxRates.name.placeholder": "napr. Základná sadzba",
  "settings.taxRates.rate.description":
    "Percento, napr. 21 alebo 12,5. Po uložení už nemožno zmeniť.",
  "settings.taxRates.rate.invalid": "Zadajte percento medzi 0 a 100.",
  "settings.taxRates.rate.label": "Sadzba (%)",
  "settings.taxRates.rename": "Premenovať {name}",
  "settings.taxRates.rename.input": "Nový názov pre {name}",
  "settings.taxRates.title": "Daňové sadzby",
  "settings.theme.dark.description": "Vždy použiť tmavé rozhranie",
  "settings.theme.dark.title": "Tmavý",
  "settings.theme.light.description": "Vždy použiť svetlé rozhranie",
  "settings.theme.light.title": "Svetlý",
  "settings.theme.mode.description":
    "Vyberte pevný motív alebo nastavenie podľa zariadenia.",
  "settings.theme.mode.title": "Režim vzhľadu",
  "settings.theme.system.description":
    "Riadiť sa nastavením operačného systému",
  "settings.theme.system.title": "Auto",
  "settings.theme.title": "Motív",
  "settings.tips.enabled.description":
    "Zákazníci môžu pri platení pridať tringelt.",
  "settings.tips.enabled.label": "Povoliť tringelty",
  "settings.tips.fixedAmounts.add": "Pridať pevnú sumu",
  "settings.tips.fixedAmounts.description":
    "Zákazníci môžu pri platení vybrať tieto sumy v {currency}.",
  "settings.tips.fixedAmounts.duplicate": "Táto pevná suma už je v zozname.",
  "settings.tips.fixedAmounts.invalid":
    "Zadajte kladnú sumu najviac s dvoma desatinnými miestami.",
  "settings.tips.fixedAmounts.label": "Predvolené pevné sumy",
  "settings.tips.fixedAmounts.maximum":
    "Môžete pridať najviac štyri predvolené pevné sumy.",
  "settings.tips.fixedAmounts.placeholder": "napr. 20,00",
  "settings.tips.form.description":
    "Nastavte rýchle voľby tringeltu zobrazované pri platení.",
  "settings.tips.form.title": "Možnosti tringeltu",
  "settings.tips.percentages.add": "Pridať percento",
  "settings.tips.percentages.description":
    "Zákazníci môžu pri platení vybrať tieto percentá.",
  "settings.tips.percentages.duplicate": "Toto percento už je v zozname.",
  "settings.tips.percentages.invalid": "Zadajte celé percento od 1 do 100.",
  "settings.tips.percentages.label": "Predvolené percentuálne hodnoty",
  "settings.tips.percentages.maximum":
    "Môžete pridať najviac štyri predvolené percentuálne hodnoty.",
  "settings.tips.percentages.placeholder": "napr. 15",
  "settings.tips.percentages.value": "{value} %",
  "settings.tips.preset.remove": "Odstrániť {value}",
  "settings.tips.reset": "Obnoviť predvolené hodnoty",
  "settings.tips.save": "Uložiť tringelty",
  "settings.tips.saved": "Nastavenie tringeltu uložené.",
  "settings.tips.title": "Tringelty",
  "settings.title": "Nastavenia",
  "settings.withdrawals.description":
    "Odoslať bitcoin zo Spark účtu on-chain alebo cez Lightning",
  "settings.withdrawals.title": "Výbery",
  "settings.taxesGroup": "DANE A DOKLADY",
  "settings.tips.nav.on": "Zapnuté",
  "settings.tips.nav.off": "Vypnuté",
  "settings.paymentAccounts.nav.none": "Žiadne",
  "settings.taxRates.nav.description": "Sadzby DPH pre vaše položky",
  "access.action.acknowledgeExcess": "Potvrdiť preplatok",
  "access.action.aiAccess": "Zmeniť prístup AI k dátam",
  "access.action.cashuMints": "Zmeniť minty Cashu",
  "access.action.moveCashuFunds": "Presunúť prostriedky medzi mintami",
  "access.action.cancelPayment": "Zrušiť platbu",
  "access.action.changePin": "Zmeniť PIN",
  "access.action.confirmClosedDespiteCancellation":
    "Označiť zahodený účet ako uzavretý",
  "access.action.confirmPaidDespiteCancellation":
    "Označiť zrušenú platbu ako zaplatenú",
  "access.action.createItem": "Vytvoriť položku katalógu",
  "access.action.disable": "Vypnúť riadenie prístupu",
  "access.action.exportDatabase": "Exportovať databázu aplikácie",
  "access.action.revealRecoveryPhrase": "Zobraziť obnovovaciu frázu",
  "access.action.discardBill": "Zahodiť účet",
  "access.action.enable": "Zapnúť riadenie prístupu so súčasným PINom",
  "access.action.markCashPaid": "Potvrdiť prijatie hotovosti",
  "access.action.markIbanPaid": "Potvrdiť príchod prevodu",
  "access.action.refund": "Vrátiť peniaze",
  "access.action.removeAccount": "Odobrať účet z tohto zariadenia",
  "access.action.removeLines": "Odobrať položky z účtu",
  "access.action.switchAccount": "Prepnúť účet",
  "access.action.unblock": "Odblokovať zariadenie",
  "access.action.withdraw": "Vybrať prostriedky",
  "access.attempts.continue": "Pokračovať",
  "access.attempts.title":
    "Nesprávne PINy zadané na tomto zariadení od posledného správneho: {count}",
  "access.cancel": "Zrušiť",
  "access.changePin": "Zmeniť PIN",
  "access.description":
    "Jeden PIN majiteľa zamyká nastavenia a riskantné akcie. Každé zariadenie si drží oprávnenia, ktoré mu dáte; PIN odomkne všetko ostatné. Chráni pred personálom a zákazníkmi pri pokladni — nie pred útočníkom.",
  "access.device.adminWarning":
    "S oprávneniami Majiteľ toto zariadenie nepotrebuje PIN na nič okrem zmeny PINu, vypnutia riadenia prístupu a odblokovania zariadenia.",
  "access.device.blocked": "PIN zablokovaný",
  "access.device.name": "Názov zariadenia",
  "access.device.permissions": "Oprávnenia",
  "access.device.permissions.description":
    "Čo toto zariadenie smie bez PINu. Vyberte predvoľbu a potom ju upravte.",
  "access.device.preset": "Oprávnenia zariadenia {name}",
  "access.device.remove": "Odobrať",
  "access.device.remove.confirm": "Odobrať zariadenie",
  "access.device.remove.description":
    "Jeho oprávnenia sa zmažú. Ak sa zariadenie ďalej používa, objaví sa znova bez oprávnení.",
  "access.device.remove.title": "Odobrať {name}?",
  "access.device.rename": "Premenovať",
  "access.device.this": "Toto zariadenie",
  "access.device.unblock": "Odblokovať",
  "access.devices.add": "Pridať zariadenie",
  "access.devices.description":
    "Zariadenia tohto účtu a čo každé smie bez PINu. Zariadenie sa objaví, keď sa zosynchronizuje.",
  "access.devices.title": "Zariadenia",
  "access.nav.description": "PIN majiteľa a oprávnenia zariadení",
  "access.newPin.description":
    "4–8 číslic. Nepoužívajte PIN z platobnej karty ani telefónu: jeho hash je uložený na každom zariadení účtu a v každom exporte databázy.",
  "access.newPin.label": "Nový PIN",
  "access.newPin.mismatch": "PINy sa nezhodujú.",
  "access.newPin.repeat": "Zopakujte PIN",
  "access.permission.activity": "História",
  "access.permission.activity.description":
    "História platieb a účtov, detail platby, opakovanie EET, AI asistent",
  "access.permission.admin": "Správa",
  "access.permission.admin.description":
    "Platobné účty, účty, profil, zabezpečenie, EET, export dát, ladiaca konzola, prístup AI k dátam, riadenie prístupu",
  "access.permission.confirm": "Potvrdzovanie platieb",
  "access.permission.confirm.description":
    "Ručne potvrdiť, že dorazila hotovosť alebo prevod",
  "access.permission.discard": "Rušenie",
  "access.permission.discard.description":
    "Zahodiť účet, odobrať z neho položky, zrušiť platbu",
  "access.permission.refund": "Vratky",
  "access.permission.refund.description": "Vratky a potvrdenie preplatku",
  "access.permission.sell": "Predaj",
  "access.permission.sell.description":
    "Domovská obrazovka, účty, rozdelenie účtu, platby a sprepitné",
  "access.permission.settings": "Nastavenia",
  "access.permission.settings.description":
    "Katalóg, stoly, údaje o firme, dane, číselné rady, sprepitné, domovská obrazovka, podpora",
  "access.permission.stats": "Štatistiky",
  "access.permission.stats.description":
    "Štatistiky predaja: tržby, spôsoby platby, najpredávanejšie položky, očakávaná hotovosť",
  "access.phrase.back": "Späť na PIN",
  "access.phrase.description":
    "Fráza na obnovenie účtu odomkne na tomto zariadení všetko a zruší blokáciu PINu.",
  "access.phrase.label": "Fráza na obnovenie",
  "access.phrase.setNewPin": "Nastaviť nový PIN",
  "access.phrase.submit": "Odomknúť",
  "access.phrase.warning":
    "Písanie frázy na obnovenie pri pokladni ju môže prezradiť kamerám a ľuďom okolo. Otvára celý účet. Lepšie je odblokovať zariadenie z iného zariadenia v Nastavenia → Prístup.",
  "access.phrase.wrong": "Toto nie je fráza na obnovenie tohto účtu.",
  "access.pin.blocked.description":
    "Príliš veľa nesprávnych PINov. Majiteľ môže toto zariadenie odblokovať z iného zariadenia v Nastavenia → Prístup, alebo tu frázou na obnovenie. Zariadenie si medzitým drží svoje oprávnenia.",
  "access.pin.blocked.title":
    "Zadávanie PINu je na tomto zariadení zablokované",
  "access.pin.cancel": "Zrušiť",
  "access.pin.entered": "Zadaných číslic: {count}",
  "access.pin.erase": "Zmazať",
  "access.pin.forgot": "Zabudnutý PIN",
  "access.pin.help":
    "Nepoznáte PIN? Požiadajte majiteľa, aby ho zadal, alebo aby na tomto zariadení povolil {permission}.",
  "access.pin.submit": "OK",
  "access.pin.title": "Zadajte PIN",
  "access.pin.why.action": "{action} vyžaduje PIN",
  "access.pin.why.route": "Táto obrazovka vyžaduje {permission}",
  "access.pin.wrong":
    "Nesprávny PIN. Zostávajúce pokusy do zablokovania zariadenia: {count}",
  "access.preset.basic": "Základ",
  "access.preset.custom": "Vlastné",
  "access.preset.manager": "Manažér",
  "access.preset.none": "Nič",
  "access.preset.owner": "Majiteľ",
  "access.preset.shiftLead": "Vedúci zmeny",
  "access.preset.staff": "Obsluha",
  "access.save": "Uložiť",
  "access.status.off": "Riadenie prístupu je vypnuté",
  "access.status.on": "Riadenie prístupu je zapnuté",
  "access.title": "Prístup",
  "access.turnOff": "Vypnúť",
  "access.turnOn": "Zapnúť",
  "access.webWarning":
    "V prehliadači na počítači je tento zámok len kozmetický: kto otvorí vývojárske nástroje, obíde ho. Zmysel má len v aplikácii pre Android, ideálne v kiosk režime.",
  "access.wizard.back": "Späť",
  "access.wizard.devices.description":
    "Čo smie každé zariadenie bez PINu. Zariadenie, ktoré sa ešte nezosynchronizovalo, tu nie je a začne bez oprávnení.",
  "access.wizard.devices.title": "Predvolené oprávnenia zariadení",
  "access.wizard.keepPin": "Použiť súčasný PIN",
  "access.wizard.next": "Ďalej",
  "access.wizard.noPin": "Nastavte nový PIN; žiadny súčasný nie je.",
  "access.wizard.pin.description":
    "PIN majiteľa odomkne všetko. Mal by ho poznať len majiteľ.",
  "access.wizard.pin.title": "PIN majiteľa",
  "settings.paymentAccounts.method.lightningAddress": "Lightning adresa",
  "settings.paymentAccounts.status.missingLightningAddress":
    "Lightning adresa nie je nastavená",
  "settings.lightningAddress.enabled.label":
    "Prijímať platby na Lightning adresu",
  "settings.lightningAddress.form.title": "Vlastná peňaženka",
  "settings.lightningAddress.form.description":
    "Platby idú rovno do peňaženky za adresou. {appName} si od nej len vyžiada invoice a sleduje, či je zaplatený; nedrží žiadne kľúče ani peniaze.",
  "settings.lightningAddress.address.label": "Lightning adresa",
  "settings.lightningAddress.address.placeholder": "meno@penazenka.sk",
  "settings.lightningAddress.address.description":
    "Peňaženka musí podporovať LUD-21 verify a prezradiť dôkaz platby (preimage). Inak {appName} nespozná, že je platba zaplatená.",
  "settings.lightningAddress.address.required": "Zadajte Lightning adresu.",
  "settings.lightningAddress.address.invalid":
    "Toto nie je Lightning adresa. Vyzerá ako meno@penazenka.sk.",
  "settings.lightningAddress.submit": "Overiť a uložiť",
  "settings.lightningAddress.saved": "Uložené.",
  "settings.lightningAddress.error.verifyUnsupported":
    "Táto peňaženka neumožní {appNameDat} overiť, či je invoice zaplatený (LUD-21 verify). Použite inú peňaženku.",
  "settings.lightningAddress.error.rejected":
    "Peňaženka požiadavku odmietla. Skontrolujte adresu.",
  "settings.lightningAddress.error.unreachable":
    "Peňaženka nie je dostupná. Skontrolujte adresu a pripojenie.",
  "settings.lightningAddress.error.invalid":
    "Peňaženka odpovedala niečím, s čím {appName} nevie pracovať.",
} satisfies Record<keyof typeof enSettings, string>
